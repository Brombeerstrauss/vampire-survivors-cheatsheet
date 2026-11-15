using System;
using System.Collections.Generic;
using UnityEngine;
using VampireSurvivors.Graphics;

namespace VSCheatsheetBridge;

// Weapon and passive item images taken directly from the game (no copies in the mod).
// In the game, passive items live in the same table as weapons (WeaponType).
//
// Careful, crash risk: the weapon table (GetConvertedWeapons) is read only once per run,
// in Update and only a few seconds after the run starts, never while drawing.
// While drawing there is only SpriteManager.GetSpriteFast, which loads nothing.
// Everything on the main thread only.
internal static class GameSprites
{
    /// <summary>Game ID -> (frame name, atlas), as plain .NET strings.</summary>
    private static Dictionary<string, (string frame, string texture)> _frames;
    private static readonly Dictionary<string, float> MissUntil = new();

    public static bool Ready => _frames != null;

    /// <summary>Forgets everything, e.g. when a run ends (atlases may get unloaded).</summary>
    public static void Reset()
    {
        _frames = null;
        Sprites.Clear();
        MissUntil.Clear();
    }

    /// <summary>
    /// Reads the frame names of all weapons and items once. Only call from Update.
    ///
    /// Not via GetConvertedWeapons: that returns an Il2Cpp dictionary with an enum key
    /// (WeaponType), and such generic types crash the game under BepInEx be.788 with
    /// Unity 6 ("Class::Init signatures have been exhausted"). Instead, the game's raw
    /// data as JSON text, parsed with System.Text.Json.
    /// </summary>
    public static void LoadFrames()
    {
        if (_frames != null) return;
        var frames = new Dictionary<string, (string, string)>();
        _frames = frames; // only try once, even on errors
        try
        {
            string json = ReadWeaponJson();
            if (string.IsNullOrEmpty(json))
            {
                Plugin.Logger.LogWarning("[Icons] no weapon data found, overlay without images");
                return;
            }
            ParseFrames(json, frames);
            Plugin.Logger.LogInfo($"[Icons] read {frames.Count} frame names");
        }
        catch (Exception ex)
        {
            Plugin.Logger.LogWarning("[Icons] weapon data not readable: " + ex.Message);
        }
    }

    // Only non-generic Il2Cpp calls: get the object, ToString() returns the JSON text.
    private static string ReadWeaponJson()
    {
        object gm = RunReader.GameManager();
        object data = RunReader.GetMember(gm, "_dataManager", "DataManager", "Data");
        object json = RunReader.GetMember(data, "_allWeaponDataJson", "AllWeaponDataJson");
        return json == null ? null : Il2CppToString(json);
    }

    // object.ToString() only returns the type name for Il2Cpp objects. The game's ToString
    // method (here JToken.ToString, i.e. the JSON text) must be called explicitly.
    private static string Il2CppToString(object obj)
    {
        foreach (var m in obj.GetType().GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
        {
            if (m.Name != "ToString" || m.DeclaringType == typeof(object)) continue;
            object[] args;
            var ps = m.GetParameters();
            if (ps.Length == 0) args = null;
            // JToken.ToString(Formatting, params JsonConverter[]): Formatting.None, no converters
            else if (ps.Length == 2 && ps[0].ParameterType.IsEnum) args = new[] { Enum.ToObject(ps[0].ParameterType, 0), null };
            else continue;
            try
            {
                if (m.Invoke(obj, args) is string text && text.TrimStart().StartsWith("{")) return text;
            }
            catch
            {
                // Some overloads throw (e.g. without a converter list); try the next one.
            }
        }
        return null;
    }

    // Structure per the game data: { "WHIP": [ { "frameName": "...", "texture": "...", ... }, ... ], ... }
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

    /// <summary>Image for a game ID from the game's sprite cache; null if there is none (yet).</summary>
    public static Sprite Get(string gameId)
    {
        if (_frames == null || string.IsNullOrEmpty(gameId)) return null;
        if (Sprites.TryGetValue(gameId, out Sprite cached) && cached != null) return cached;
        if (MissUntil.TryGetValue(gameId, out float until) && Time.realtimeSinceStartup < until) return null;
        try
        {
            if (_frames.TryGetValue(gameId, out var f) && !string.IsNullOrEmpty(f.texture))
            {
                // The game's cache first, otherwise let the game load it (only called from Update).
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
