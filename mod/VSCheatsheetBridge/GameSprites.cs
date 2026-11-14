using System;
using System.Collections.Generic;
using UnityEngine;
using VampireSurvivors.Graphics;

namespace VSCheatsheetBridge;

// Bilder der Waffen und passiven Gegenstände direkt aus dem Spiel (keine Kopien im Mod).
// Passive Gegenstände stehen im Spiel in derselben Tabelle wie Waffen (WeaponType).
//
// Vorsicht, Absturzgefahr: Die Waffentabelle (GetConvertedWeapons) wird nur einmal pro Lauf
// gelesen, in Update und erst ein paar Sekunden nach Laufbeginn, nie beim Zeichnen.
// Beim Zeichnen gibt es nur SpriteManager.GetSpriteFast, das nichts nachlädt.
// Alles nur auf dem Hauptthread.
internal static class GameSprites
{
    /// <summary>Spielkennung -> (Bildname, Atlas), als normale .NET-Strings.</summary>
    private static Dictionary<string, (string frame, string texture)> _frames;
    private static readonly Dictionary<string, float> MissUntil = new();

    public static bool Ready => _frames != null;

    /// <summary>Vergisst alles, z. B. wenn ein Lauf endet (Atlanten können entladen werden).</summary>
    public static void Reset()
    {
        _frames = null;
        Sprites.Clear();
        MissUntil.Clear();
    }

    /// <summary>
    /// Liest einmalig die Bildnamen aller Waffen und Gegenstände. Nur aus Update aufrufen.
    ///
    /// Nicht über GetConvertedWeapons: Das liefert ein Il2Cpp-Dictionary mit Enum-Schlüssel
    /// (WeaponType), und solche generischen Typen lassen das Spiel unter BepInEx be.788 mit
    /// Unity 6 abstürzen ("Class::Init signatures have been exhausted"). Stattdessen die
    /// Rohdaten des Spiels als JSON-Text, ausgewertet mit System.Text.Json.
    /// </summary>
    public static void LoadFrames()
    {
        if (_frames != null) return;
        var frames = new Dictionary<string, (string, string)>();
        _frames = frames; // auch bei Fehlern nur einmal versuchen
        try
        {
            string json = ReadWeaponJson();
            if (string.IsNullOrEmpty(json))
            {
                Plugin.Logger.LogWarning("[Icons] keine Waffendaten gefunden, Overlay ohne Bilder");
                return;
            }
            ParseFrames(json, frames);
            Plugin.Logger.LogInfo($"[Icons] {frames.Count} Bildnamen gelesen");
        }
        catch (Exception ex)
        {
            Plugin.Logger.LogWarning("[Icons] Waffendaten nicht lesbar: " + ex.Message);
        }
    }

    // Nur nicht-generische Il2Cpp-Aufrufe: Objekt holen, ToString() liefert den JSON-Text.
    private static string ReadWeaponJson()
    {
        object gm = RunReader.GameManager();
        object data = RunReader.GetMember(gm, "_dataManager", "DataManager", "Data");
        object json = RunReader.GetMember(data, "_allWeaponDataJson", "AllWeaponDataJson");
        return json == null ? null : Il2CppToString(json);
    }

    // object.ToString() liefert bei Il2Cpp-Objekten nur den Typnamen. Die ToString-Methode des
    // Spiels (hier JToken.ToString, also der JSON-Text) muss ausdrücklich aufgerufen werden.
    private static string Il2CppToString(object obj)
    {
        foreach (var m in obj.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
        {
            if (m.Name != "ToString" || m.DeclaringType == typeof(object)) continue;
            object[] args;
            var ps = m.GetParameters();
            if (ps.Length == 0) args = null;
            // JToken.ToString(Formatting, params JsonConverter[]): Formatting.None, keine Konverter
            else if (ps.Length == 2 && ps[0].ParameterType.IsEnum) args = new[] { Enum.ToObject(ps[0].ParameterType, 0), null };
            else continue;
            try
            {
                if (m.Invoke(obj, args) is string text && text.TrimStart().StartsWith("{")) return text;
            }
            catch
            {
                // Manche Überladungen werfen (z. B. ohne Konverter-Liste); die nächste versuchen.
            }
        }
        return null;
    }

    // Aufbau laut Spieldaten: { "WHIP": [ { "frameName": "...", "texture": "...", ... }, ... ], ... }
    private static void ParseFrames(string json, Dictionary<string, (string, string)> frames)
    {
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            var value = prop.Value;
            var first = value.ValueKind == System.Text.Json.JsonValueKind.Array && value.GetArrayLength() > 0 ? value[0] : value;
            if (first.ValueKind != System.Text.Json.JsonValueKind.Object) continue;
            string frame = first.TryGetProperty("frameName", out var f) && f.ValueKind == System.Text.Json.JsonValueKind.String ? f.GetString() : null;
            string texture = first.TryGetProperty("texture", out var t) && t.ValueKind == System.Text.Json.JsonValueKind.String ? t.GetString() : null;
            if (!string.IsNullOrEmpty(frame)) frames[prop.Name] = (frame, texture);
        }
    }

    private static readonly Dictionary<string, Sprite> Sprites = new();

    /// <summary>Bild zu einer Spielkennung aus dem Sprite-Cache des Spiels; null, wenn (noch) keins da ist.</summary>
    public static Sprite Get(string gameId)
    {
        if (_frames == null || string.IsNullOrEmpty(gameId)) return null;
        if (Sprites.TryGetValue(gameId, out Sprite cached) && cached != null) return cached;
        if (MissUntil.TryGetValue(gameId, out float until) && Time.realtimeSinceStartup < until) return null;
        try
        {
            if (_frames.TryGetValue(gameId, out var f) && !string.IsNullOrEmpty(f.texture))
            {
                // Erst den Cache des Spiels, sonst das Spiel laden lassen (nur aus Update aufgerufen).
                Sprite sprite = SpriteManager.GetSpriteFast(f.frame, f.texture);
                if (sprite == null) sprite = SpriteManager.GetSprite(f.frame, f.texture, true);
                if (sprite != null)
                {
                    Sprites[gameId] = sprite;
                    return sprite;
                }
            }
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("sprite:" + gameId, ex);
        }
        MissUntil[gameId] = Time.realtimeSinceStartup + 4f;
        return null;
    }
}
