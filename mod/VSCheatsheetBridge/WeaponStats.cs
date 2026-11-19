using System;
using System.Collections.Generic;
using System.Text.Json;

namespace VSCheatsheetBridge;

// Which stats each weapon scales with and which stats each passive item raises, read from the
// game's own weapon data (the same JSON text as the images, see GameSprites.LoadFrames).
//
// A weapon scales with a stat when its level-ups raise it: the game's designers chose these
// stats for the weapon, e.g. Knife gains amount, Garlic area. A passive item has its bonus in
// level 1 (Candelabrador: area, Duplicator: amount). Structure per weapon:
//   "KNIFE": [ { "level": 1, "power": 6.5, "amount": 1, ... }, { "amount": 1 }, { "power": 5 }, ... ]
//
// Only the stats that tell weapons apart count: area, amount, duration and speed. Might and
// cooldown help every weapon; the community tiers cover Spinach and Empty Tome.
internal static class WeaponStats
{
    public static readonly string[] Keys = { "area", "amount", "duration", "speed" };

    private static readonly HashSet<string> None = new();
    /// <summary>Weapon game ID -> stats its level-ups raise.</summary>
    private static Dictionary<string, HashSet<string>> _scales;
    /// <summary>Passive item game ID -> stats it raises.</summary>
    private static Dictionary<string, HashSet<string>> _raises;

    public static bool Ready => _scales != null;

    public static void Reset()
    {
        _scales = null;
        _raises = null;
    }

    /// <summary>Stats the weapon scales with (empty if unknown or it has no level-ups).</summary>
    public static HashSet<string> Scales(string gameId) =>
        gameId != null && _scales != null && _scales.TryGetValue(gameId, out HashSet<string> s) ? s : None;

    /// <summary>Stats the passive item raises (empty if unknown or none of the four).</summary>
    public static HashSet<string> Raises(string gameId) =>
        gameId != null && _raises != null && _raises.TryGetValue(gameId, out HashSet<string> s) ? s : None;

    /// <summary>Reads the stats from the game's weapon data (root object: game ID -> levels).</summary>
    public static void Read(JsonElement root)
    {
        var scales = new Dictionary<string, HashSet<string>>();
        var raises = new Dictionary<string, HashSet<string>>();
        foreach (JsonProperty prop in root.EnumerateObject())
        {
            JsonElement levels = prop.Value;
            if (levels.ValueKind != JsonValueKind.Array || levels.GetArrayLength() == 0) continue;
            JsonElement first = levels[0];
            if (first.ValueKind != JsonValueKind.Object) continue;

            var stats = new HashSet<string>();
            if (first.TryGetProperty("isPowerUp", out JsonElement p) && p.ValueKind == JsonValueKind.True)
            {
                foreach (string key in Keys)
                    if (NonZero(first, key)) stats.Add(key);
                if (stats.Count > 0) raises[prop.Name] = stats;
                continue;
            }
            for (int i = 1; i < levels.GetArrayLength(); i++)
            {
                if (levels[i].ValueKind != JsonValueKind.Object) continue;
                foreach (string key in Keys)
                    if (NonZero(levels[i], key)) stats.Add(key);
            }
            if (stats.Count > 0) scales[prop.Name] = stats;
        }
        _scales = scales;
        _raises = raises;
        Plugin.Logger.LogInfo($"[Stats] {scales.Count} weapons with level-up stats, {raises.Count} items that raise one of {string.Join(", ", Keys)}");
    }

    private static bool NonZero(JsonElement level, string key)
    {
        if (!level.TryGetProperty(key, out JsonElement v) || v.ValueKind != JsonValueKind.Number) return false;
        try { return Math.Abs(v.GetDouble()) > 1e-9; }
        catch (FormatException) { return false; }
    }
}
