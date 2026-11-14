using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace VSCheatsheetBridge;

// Daten aus der Cheatsheet-App (scripts/export-mod-data.mjs): Spielkennung -> App-Kennung,
// Namen, Maximalstufen und Entwicklungen.
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
    /// <summary>Spielkennung, für das Bild.</summary>
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

// ---- Was das Overlay zeigt ---------------------------------------------------------------

internal enum RowStatus { Missing, NeedsMax, Ready, Evolved, NoEvolution }

/// <summary>Ein Bild im Overlay: Waffe oder Gegenstand mit Stufe.</summary>
internal sealed class Icon
{
    public string Id;
    public string GameId;
    public string Name;
    public int Level;
    public int Max;
    /// <summary>Im Lauf vorhanden (sonst blass).</summary>
    public bool Owned = true;
    /// <summary>Stammt von einem Mitspieler (Koop), z. B. "P2".</summary>
    public string From;
    /// <summary>Muss für die Entwicklung noch auf Maximalstufe.</summary>
    public bool NeedsMax;
}

internal sealed class WeaponRow
{
    public Icon Weapon;
    public RowStatus Status;
    /// <summary>Weitere Zutaten der nächsten Entwicklung (ohne die Waffe selbst).</summary>
    public List<Icon> Parts = new();
    public Icon Result;
    public string StatusText;
}

internal sealed class PlayerPanel
{
    public string Title;
    public List<WeaponRow> Rows = new();
    public List<Icon> Passives = new();
}

// Was fehlt pro Waffe für die nächste Entwicklung? Gleiche Regeln wie die App
// (src/logic/evolution.ts), aber mit den echten Stufen aus dem Spiel.
//
// Koop: Passive Gegenstände der Mitspieler zählen für die eigenen Entwicklungen mit
// (z. B. Spinat eines Mitspielers für den Feuerstab), wenn `sharePassives` an ist.
internal sealed class EvolutionAdvisor
{
    private readonly CheatsheetData _data;
    private readonly bool _german;

    public EvolutionAdvisor(CheatsheetData data, bool german)
    {
        _data = data;
        _german = german;
    }

    private string Name(string id) =>
        _data.Names.TryGetValue(id, out NameEntry n) ? (_german ? n.De : n.En) ?? n.En ?? id : id;

    private int MaxLevel(string id) => _data.Names.TryGetValue(id, out NameEntry n) ? n.Max : 0;

    private string GameId(string id) => _data.Names.TryGetValue(id, out NameEntry n) ? n.G : null;

    private string T(string de, string en) => _german ? de : en;

    /// <summary>Text in der Sprache des Overlays.</summary>
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

    public List<PlayerPanel> Build(RunSnapshot snap, bool sharePassives)
    {
        List<PlayerItems> players = snap.Players.Select(Map).ToList();
        bool coop = players.Count > 1;
        return players.Select(p => BuildPlayer(p, coop && sharePassives ? players : null, coop)).ToList();
    }

    private PlayerPanel BuildPlayer(PlayerItems me, List<PlayerItems> team, bool coop)
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
            // Eigener Gegenstand zuerst, sonst der eines Mitspielers (höchste Stufe).
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
