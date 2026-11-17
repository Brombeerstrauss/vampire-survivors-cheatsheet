using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace VSCheatsheetBridge;

// Data from the cheatsheet app (scripts/export-mod-data.mjs): game ID -> app ID,
// names, max levels and evolutions.
internal sealed class CheatsheetData
{
    public Dictionary<string, string> Characters { get; set; } = new();
    public Dictionary<string, string> Weapons { get; set; } = new();
    public Dictionary<string, string> Passives { get; set; } = new();
    public Dictionary<string, NameEntry> Names { get; set; } = new();
    public List<EvolutionEntry> Evolutions { get; set; } = new();

    public static CheatsheetData Load(string path)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        return JsonSerializer.Deserialize<CheatsheetData>(File.ReadAllText(path), options) ?? new CheatsheetData();
    }
}

internal sealed class NameEntry
{
    public string De { get; set; }
    public string En { get; set; }
    public int Max { get; set; }
    /// <summary>Game ID, used for the image.</summary>
    public string G { get; set; }
}

internal sealed class EvolutionEntry
{
    public string Kind { get; set; }
    public string Result { get; set; }
    public List<Ingredient> Weapons { get; set; } = new();
    public List<Ingredient> Passives { get; set; } = new();
    public List<string> Characters { get; set; }
}

internal sealed class Ingredient
{
    public string Id { get; set; }
    public bool Max { get; set; }
}

// ---- What the overlay shows -------------------------------------------------------------

internal enum RowStatus { Missing, NeedsMax, Ready, Evolved, NoEvolution }

/// <summary>An image in the overlay: weapon or item with its level.</summary>
internal sealed class Icon
{
    public string Id;
    public string GameId;
    public string Name;
    public int Level;
    public int Max;
    /// <summary>Owned in the run (otherwise faded).</summary>
    public bool Owned = true;
    /// <summary>Comes from another player (co-op), e.g. "P2".</summary>
    public string From;
    /// <summary>Still needs max level for the evolution.</summary>
    public bool NeedsMax;
}

internal sealed class WeaponRow
{
    public Icon Weapon;
    public RowStatus Status;
    /// <summary>Other ingredients of the next evolution (excluding the weapon itself).</summary>
    public List<Icon> Parts = new();
    public Icon Result;
    public string StatusText;
    /// <summary>Further steps after the next evolution, e.g. a union with the evolved weapon.</summary>
    public List<EvolutionStep> Next = new();
}

/// <summary>A later evolution step: the other ingredients and the result.</summary>
internal sealed class EvolutionStep
{
    public List<Icon> Parts = new();
    public Icon Result;
}

internal sealed class PlayerPanel
{
    public string Title;
    public List<WeaponRow> Rows = new();
    public List<Icon> Passives = new();
}

// What does each weapon still need for its next evolution? Same rules as the app
// (src/logic/evolution.ts), but with the real levels from the game.
//
// Co-op: other players' passive items count toward your own evolutions
// (e.g. another player's Spinach for the Fire Wand) when `sharePassives` is on.
internal sealed class EvolutionAdvisor
{
    private readonly CheatsheetData _data;
    /// <summary>Setting "Language": "auto" (like the game), "de" or "en".</summary>
    private readonly string _setting;
    /// <summary>App IDs of weapons and passive items (their names can come from the game).</summary>
    private readonly HashSet<string> _itemIds;
    private readonly Dictionary<string, string> _names = new();
    private bool _german;
    private bool _gameNames;
    private bool _languageKnown;

    public EvolutionAdvisor(CheatsheetData data, string language)
    {
        _data = data;
        _setting = (language ?? "auto").Trim().ToLowerInvariant();
        _itemIds = new HashSet<string>(data.Weapons.Values.Concat(data.Passives.Values));
    }

    /// <summary>
    /// Overlay language from the setting and the game's language. Names come from the game when
    /// it runs in the overlay language, so they match what the game shows; otherwise from the
    /// app's data in the overlay language. That way labels and names are always in one language.
    /// </summary>
    private void UpdateLanguage()
    {
        string game = GameText.LanguageCode();
        string lang = _setting switch
        {
            "de" => "de",
            "en" => "en",
            _ => (game ?? SystemLanguage()).StartsWith("de") ? "de" : "en",
        };
        bool german = lang == "de";
        bool gameNames = game != null && game.StartsWith(lang);
        if (_languageKnown && german == _german && gameNames == _gameNames) return;
        _languageKnown = true;
        _german = german;
        _gameNames = gameNames;
        _names.Clear();
        Plugin.Logger.LogInfo($"[Language] setting {_setting}, game {game ?? "unknown"} -> overlay {lang}, names from {(gameNames ? "the game" : "the app's data")}");
    }

    // Only used when the game's language cannot be read.
    private static string SystemLanguage()
    {
        try { return System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName.ToLowerInvariant(); }
        catch { return "en"; }
    }

    private string Name(string id)
    {
        if (_names.TryGetValue(id, out string cached)) return cached;
        string name = id;
        if (_data.Names.TryGetValue(id, out NameEntry n))
        {
            name = (_german ? n.De : n.En) ?? n.En ?? id;
            if (_gameNames && n.G != null && _itemIds.Contains(id)) name = GameText.WeaponName(n.G) ?? name;
        }
        _names[id] = name;
        return name;
    }

    private int MaxLevel(string id) => _data.Names.TryGetValue(id, out NameEntry n) ? n.Max : 0;

    private string GameId(string id) => _data.Names.TryGetValue(id, out NameEntry n) ? n.G : null;

    private string T(string de, string en) => _german ? de : en;

    /// <summary>Text in the overlay language.</summary>
    public string Text(string de, string en) => T(de, en);

    private sealed class PlayerItems
    {
        public int Index;
        public string Character;
        public readonly List<string> Weapons = new();
        public readonly List<string> Passives = new();
        public readonly Dictionary<string, int> Levels = new();
    }

    private PlayerItems Map(PlayerSnapshot player)
    {
        var p = new PlayerItems
        {
            Index = player.Index,
            Character = player.Character != null && _data.Characters.TryGetValue(player.Character, out string c) ? c : null,
        };
        foreach (ItemSnapshot w in player.Weapons)
            if (_data.Weapons.TryGetValue(w.Type, out string id) && !p.Levels.ContainsKey("w:" + id)) { p.Weapons.Add(id); p.Levels["w:" + id] = w.Level; }
        foreach (ItemSnapshot it in player.Passives)
            if (_data.Passives.TryGetValue(it.Type, out string id) && !p.Levels.ContainsKey("p:" + id)) { p.Passives.Add(id); p.Levels["p:" + id] = it.Level; }
        return p;
    }

    private Icon MakeIcon(string id, int level) =>
        new() { Id = id, GameId = GameId(id), Name = Name(id), Level = level, Max = MaxLevel(id) };

    /// <summary>At most this many steps after the next evolution (Bracelet -> Bi-Bracelet -> Tri-Bracelet -> union).</summary>
    private const int MaxFollowUps = 2;

    /// <param name="inGame">Does the game have this game ID (DLC installed)? null: unknown, show everything.</param>
    public List<PlayerPanel> Build(RunSnapshot snap, bool sharePassives, Func<string, bool> inGame = null)
    {
        UpdateLanguage();
        List<PlayerItems> players = snap.Players.Select(Map).ToList();
        bool coop = players.Count > 1;
        return players.Select(p => BuildPlayer(p, coop && sharePassives ? players : null, coop, inGame)).ToList();
    }

    private PlayerPanel BuildPlayer(PlayerItems me, List<PlayerItems> team, bool coop, Func<string, bool> inGame)
    {
        var panel = new PlayerPanel();
        if (coop)
            panel.Title = $"P{me.Index + 1}" + (me.Character != null ? " " + Name(me.Character) : "");

        foreach (string weapon in me.Weapons)
        {
            var row = new WeaponRow { Weapon = MakeIcon(weapon, me.Levels["w:" + weapon]) };
            panel.Rows.Add(row);

            var candidates = _data.Evolutions
                .Where(e => e.Weapons.Any(w => w.Id == weapon))
                .Where(e => e.Characters == null || (me.Character != null && e.Characters.Contains(me.Character)))
                .Where(e => !me.Weapons.Contains(e.Result))
                .Select(e => Check(e, weapon, me, team))
                .OrderBy(r => r.Missing * 10 + r.NotMax)
                .ToList();

            if (candidates.Count == 0)
            {
                bool evolved = _data.Evolutions.Any(e => e.Result == weapon);
                row.Status = evolved ? RowStatus.Evolved : RowStatus.NoEvolution;
                row.StatusText = evolved ? T("entwickelt", "evolved") : T("keine Entwicklung", "no evolution");
                continue;
            }

            CheckResult best = candidates[0];
            row.Parts = best.Parts;
            row.Result = MakeIcon(best.Evolution.Result, 0);
            row.Weapon.NeedsMax = best.WeaponNeedsMax;
            row.Next = FollowUps(weapon, best.Evolution.Result, me, team, inGame);
            if (best.Missing > 0)
            {
                row.Status = RowStatus.Missing;
                row.StatusText = T("fehlt: ", "missing: ") + string.Join(", ", best.Parts.Where(p => !p.Owned).Select(p => p.Name));
            }
            else if (best.NotMax > 0)
            {
                row.Status = RowStatus.NeedsMax;
                var names = best.Parts.Where(p => p.NeedsMax).Select(p => p.Name).ToList();
                if (best.WeaponNeedsMax) names.Insert(0, row.Weapon.Name);
                row.StatusText = T("noch auf Max: ", "still to max: ") + string.Join(", ", names);
            }
            else
            {
                row.Status = RowStatus.Ready;
                row.StatusText = best.Evolution.Kind == "morph" ? T("BEREIT", "READY") : T("BEREIT - nächste Truhe", "READY - next chest");
            }
        }

        panel.Passives = me.Passives.Select(p => MakeIcon(p, me.Levels["p:" + p])).ToList();
        return panel;
    }

    // What the result of an evolution can become afterwards: evolutions with it as a weapon
    // (mostly unions, e.g. Mannajja + Arrow of Goth -> Dies Irae).
    private List<EvolutionStep> FollowUps(string weapon, string result, PlayerItems me, List<PlayerItems> team, Func<string, bool> inGame)
    {
        var steps = new List<EvolutionStep>();
        var visited = new HashSet<string> { weapon, result };
        string current = result;
        for (int i = 0; i < MaxFollowUps; i++)
        {
            string from = current;
            CheckResult next = _data.Evolutions
                .Where(e => e.Weapons.Any(w => w.Id == from))
                .Where(e => e.Characters == null || (me.Character != null && e.Characters.Contains(me.Character)))
                .Where(e => !visited.Contains(e.Result) && !me.Weapons.Contains(e.Result))
                .Where(e => InGame(e, inGame))
                .Select(e => Check(e, from, me, team))
                .OrderBy(r => r.Missing * 10 + r.NotMax)
                .FirstOrDefault();
            if (next == null) break;
            steps.Add(new EvolutionStep { Parts = next.Parts, Result = MakeIcon(next.Evolution.Result, 0) });
            current = next.Evolution.Result;
            visited.Add(current);
        }
        return steps;
    }

    // Only evolutions whose weapons and items all exist in the game: content from DLCs that are
    // not installed is missing from the game's data.
    private bool InGame(EvolutionEntry e, Func<string, bool> inGame)
    {
        if (inGame == null) return true;
        bool Has(string id) => !_data.Names.TryGetValue(id, out NameEntry n) || n.G == null || inGame(n.G);
        return Has(e.Result) && e.Weapons.All(w => Has(w.Id)) && e.Passives.All(p => Has(p.Id));
    }

    private sealed class CheckResult
    {
        public EvolutionEntry Evolution;
        public List<Icon> Parts = new();
        public int Missing;
        public int NotMax;
        public bool WeaponNeedsMax;
    }

    private CheckResult Check(EvolutionEntry e, string weapon, PlayerItems me, List<PlayerItems> team)
    {
        var r = new CheckResult { Evolution = e };
        bool AtMax(string id, int level) => MaxLevel(id) <= 1 || level >= MaxLevel(id);

        foreach (Ingredient w in e.Weapons)
        {
            bool owned = me.Weapons.Contains(w.Id);
            int level = owned ? me.Levels["w:" + w.Id] : 0;
            bool needsMax = owned && w.Max && !AtMax(w.Id, level);
            if (!owned) r.Missing++;
            if (needsMax) r.NotMax++;
            if (w.Id == weapon) { r.WeaponNeedsMax = needsMax; continue; }
            Icon icon = MakeIcon(w.Id, level);
            icon.Owned = owned;
            icon.NeedsMax = needsMax;
            r.Parts.Add(icon);
        }

        foreach (Ingredient p in e.Passives)
        {
            // Own item first, otherwise another player's (highest level).
            PlayerItems holder = me.Passives.Contains(p.Id) ? me : null;
            if (holder == null && team != null)
                holder = team.Where(t => t != me && t.Passives.Contains(p.Id))
                             .OrderByDescending(t => t.Levels["p:" + p.Id]).FirstOrDefault();
            int level = holder != null ? holder.Levels["p:" + p.Id] : 0;
            bool needsMax = holder != null && p.Max && !AtMax(p.Id, level);
            if (holder == null) r.Missing++;
            if (needsMax) r.NotMax++;
            Icon icon = MakeIcon(p.Id, level);
            icon.Owned = holder != null;
            icon.NeedsMax = needsMax;
            if (holder != null && holder != me) icon.From = $"P{holder.Index + 1}";
            r.Parts.Add(icon);
        }
        return r;
    }
}
