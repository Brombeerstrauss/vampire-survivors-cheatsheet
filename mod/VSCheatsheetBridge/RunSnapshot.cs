using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace VSCheatsheetBridge;

// Format für die App (Version 1):
// { "v":1, "inRun":true, "time":1731600000000,
//   "players":[{ "index":0, "character":"ANTONIO",
//                "weapons":[{"type":"WHIP","level":3}],
//                "passives":[{"type":"MAXHEALTH","level":1}] }] }
// Die Namen sind die Enum-Namen des Spiels (WeaponType/ItemType/CharacterType).
internal sealed class RunSnapshot
{
    public bool InRun;
    public readonly List<PlayerSnapshot> Players = new();
    public string DebugJson = "{}";

    // Alles außer dem Zeitstempel: ändert sich nur, wenn sich der Run ändert.
    public string ContentKey() =>
        (InRun ? "1" : "0") + string.Join(",", Players.Select(p => p.ToJson()));

    public string ToJson()
    {
        var sb = new StringBuilder();
        sb.Append("{\"v\":1,\"plugin\":").Append(Json.Str(Plugin.Version))
          .Append(",\"inRun\":").Append(InRun ? "true" : "false")
          .Append(",\"time\":").Append(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture))
          .Append(",\"players\":[")
          .Append(string.Join(",", Players.Select(p => p.ToJson())))
          .Append("]}");
        return sb.ToString();
    }
}

internal sealed class PlayerSnapshot
{
    public int Index;
    public string Character;
    public List<ItemSnapshot> Weapons = new();
    public List<ItemSnapshot> Passives = new();

    public string ToJson() =>
        "{\"index\":" + Index.ToString(CultureInfo.InvariantCulture) +
        ",\"character\":" + Json.Str(Character) +
        ",\"weapons\":[" + string.Join(",", Weapons.Select(w => w.ToJson())) + "]" +
        ",\"passives\":[" + string.Join(",", Passives.Select(w => w.ToJson())) + "]}";
}

internal sealed class ItemSnapshot
{
    public string Type;
    public int Level;

    public string ToJson() =>
        "{\"type\":" + Json.Str(Type) + ",\"level\":" + Level.ToString(CultureInfo.InvariantCulture) + "}";
}

internal static class Json
{
    public static string Str(string s)
    {
        if (s == null) return "null";
        var sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.Append('"').ToString();
    }
}
