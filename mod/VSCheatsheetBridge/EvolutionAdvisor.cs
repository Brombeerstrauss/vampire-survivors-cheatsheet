using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace VSCheatsheetBridge;

// Data from the cheatsheet app (scripts/export-mod-data.mjs): game ID -> app ID,
// names, max levels, evolutions and the recommendations per character.
internal sealed class CheatsheetData
{
    public Dictionary<string, string> Characters { get; set; } = new();
    public Dictionary<string, string> Weapons { get; set; } = new();
    public Dictionary<string, string> Passives { get; set; } = new();
    public Dictionary<string, NameEntry> Names { get; set; } = new();
    public List<EvolutionEntry> Evolutions { get; set; } = new();
    /// <summary>Character -> weapon or item -> priority (1 = core, 2 = good, 3 = optional).</summary>
    public Dictionary<string, Dictionary<string, int>> Recommendations { get; set; } = new();
    /// <summary>Weapon or item -> general strength from community tier lists (1 = strong, 2 = good, 3 = decent).</summary>
    public Dictionary<string, int> Community { get; set; } = new();

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

/// <summary>A choice on the level-up screen with its grade.</summary>
internal sealed class OfferRow
{
    public Icon Item;
    /// <summary>'A' (best fit) to 'D' (no fit known); '?' if the item is not in the app's data.</summary>
    public char Grade;
    /// <summary>Why, e.g. "for Bloody Tear"; null for D.</summary>
    public string Reason;
}

internal sealed class PlayerPanel
{
    public string Title;
    public List<WeaponRow> Rows = new();
    public List<Icon> Passives = new();
    /// <summary>Choices on the open level-up screen, in the game's order (empty: no level-up).</summary>
    public List<OfferRow> Offers = new();
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
        /// <summary>Game IDs offered on the level-up screen.</summary>
        public readonly List<string> Offers = new();
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
        p.Offers.AddRange(player.Offers);
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
        panel.Offers = GradeOffers(me, team, inGame);
        return panel;
    }

    // ---- Level-up grades ------------------------------------------------------------------

    // Grades the choices on the level-up screen. Each choice gets the best grade that applies;
    // with equal grades the reason that comes first in this list is shown:
    //   1. Evolutions of your weapons: missing ingredient (A); your weapon or item still needs
    //      max level, A if all ingredients are there, otherwise B.
    //   2. A new weapon that evolves with items you already have (B).
    //   3. Recommendation for the character: priority 1/2/3 = A/B/C.
    //   4. Stats (game data): an item raises area, amount, duration or speed of at least two of
    //      your weapons (B) or one (C); a weapon scales with two of your items (B) or one (C).
    //   5. Community tier lists: tier 1/2/3 = A/B/C. A weapon also counts with the tier of what
    //      it evolves into.
    //   D  none of these. The data knows no fit, which doesn't make it a bad choice.
    // An evolved weapon counts like the weapon it came from (recommendation, stats).
    private List<OfferRow> GradeOffers(PlayerItems me, List<PlayerItems> team, Func<string, bool> inGame)
    {
        var rows = new List<OfferRow>();
        foreach (string gameId in me.Offers)
        {
            string id = _data.Weapons.TryGetValue(gameId, out string w) ? w
                : _data.Passives.TryGetValue(gameId, out string p) ? p : null;
            if (id == null)
            {
                // Newer than the app's data: name from the game, no grade.
                rows.Add(new OfferRow { Item = new Icon { GameId = gameId, Name = GameText.WeaponName(gameId) ?? gameId }, Grade = '?' });
                continue;
            }
            var row = new OfferRow { Item = MakeIcon(id, 0), Grade = 'D' };
            void Consider(char grade, string reason)
            {
                if (grade >= row.Grade) return;
                row.Grade = grade;
                row.Reason = reason;
            }

            bool Applies(EvolutionEntry e) =>
                (e.Characters == null || (me.Character != null && e.Characters.Contains(me.Character))) && InGame(e, inGame);

            // Evolutions of the weapons you have: is the choice a missing ingredient, or does
            // it still need max level?
            foreach (string weapon in me.Weapons)
            {
                foreach (EvolutionEntry e in _data.Evolutions)
                {
                    if (!e.Weapons.Any(x => x.Id == weapon) || me.Weapons.Contains(e.Result) || !Applies(e)) continue;
                    CheckResult r = Check(e, weapon, me, team);
                    Icon part = r.Parts.FirstOrDefault(x => x.Id == id);
                    if (part != null && !part.Owned) Consider('A', T("für ", "for ") + Name(e.Result));
                    bool needsMax = (id == weapon && r.WeaponNeedsMax) || (part != null && part.Owned && part.NeedsMax && part.From == null);
                    if (needsMax) Consider(r.Missing == 0 ? 'A' : 'B', T("Max für ", "max for ") + Name(e.Result));
                }
            }

            // A new weapon that evolves with items you already have.
            if (!me.Weapons.Contains(id))
            {
                foreach (EvolutionEntry e in _data.Evolutions)
                {
                    if (e.Passives.Count == 0 || !e.Weapons.Any(x => x.Id == id) || !Applies(e)) continue;
                    if (!e.Passives.All(x => me.Passives.Contains(x.Id) || (team != null && team.Any(t => t.Passives.Contains(x.Id))))) continue;
                    Consider('B', T("passt zu ", "pairs with ") + string.Join(", ", e.Passives.Select(x => Name(x.Id))));
                }
            }

            int priority = Priority(me.Character, id);
            if (priority > 0) Consider((char)('A' + priority - 1), T("empfohlen", "recommended"));

            // Stats from the game's data: does the choice fit your weapons or items?
            HashSet<string> raises = WeaponStats.Raises(gameId);
            if (raises.Count > 0)
            {
                List<string> boosted = me.Weapons.Where(x => ScalesOf(x).Overlaps(raises)).ToList();
                if (boosted.Count > 0) Consider(boosted.Count >= 2 ? 'B' : 'C', T("verstärkt ", "boosts ") + NameList(boosted));
            }
            else if (_data.Weapons.ContainsKey(gameId))
            {
                HashSet<string> scales = ScalesOf(id);
                List<string> helpers = me.Passives.Where(x => WeaponStats.Raises(GameId(x)).Overlaps(scales)).ToList();
                if (helpers.Count > 0) Consider(helpers.Count >= 2 ? 'B' : 'C', T("nutzt ", "uses ") + NameList(helpers));
            }

            int tier = CommunityTier(id, me, Applies, out string via);
            if (tier > 0) Consider((char)('A' + tier - 1), via == null ? T("Community", "community") : T("Community: ", "community: ") + Name(via));
            rows.Add(row);
        }
        return rows;
    }

    // At most two names, then "+1" etc., so the reason stays short.
    private string NameList(List<string> ids) =>
        string.Join(", ", ids.Take(2).Select(Name)) + (ids.Count > 2 ? $" +{ids.Count - 2}" : "");

    // Stats a weapon scales with; an evolved weapon without level-ups of its own also counts
    // with those of the weapons it came from.
    private HashSet<string> ScalesOf(string id)
    {
        HashSet<string> own = WeaponStats.Scales(GameId(id));
        if (own.Count > 0) return own;
        var inherited = new HashSet<string>();
        foreach (EvolutionEntry e in _data.Evolutions)
            if (e.Result == id)
                foreach (Ingredient w in e.Weapons)
                    inherited.UnionWith(WeaponStats.Scales(GameId(w.Id)));
        return inherited;
    }

    // General strength from the community tier lists (1 to 3, 0 = none). A weapon also counts
    // with the tier of what it can evolve into for this character; `via` names that result.
    private int CommunityTier(string id, PlayerItems me, Func<EvolutionEntry, bool> applies, out string via)
    {
        via = null;
        int best = _data.Community.TryGetValue(id, out int own) && own >= 1 && own <= 3 ? own : 0;
        if (!_data.Weapons.ContainsValue(id)) return best;
        foreach (EvolutionEntry e in _data.Evolutions)
        {
            if (!e.Weapons.Any(w => w.Id == id) || !applies(e)) continue;
            if (_data.Community.TryGetValue(e.Result, out int tier) && tier >= 1 && tier <= 3 && (best == 0 || tier < best))
            {
                best = tier;
                via = e.Result;
            }
        }
        return best;
    }

    // Recommendation for the character: 1 to 3, 0 = none. An evolved weapon takes the best
    // priority of the weapons it evolved from.
    private int Priority(string character, string id)
    {
        if (character == null || !_data.Recommendations.TryGetValue(character, out Dictionary<string, int> items)) return 0;
        int best = items.TryGetValue(id, out int own) ? own : 0;
        foreach (EvolutionEntry e in _data.Evolutions)
        {
            if (e.Result != id) continue;
            foreach (Ingredient w in e.Weapons)
                if (items.TryGetValue(w.Id, out int prio) && prio >= 1 && prio <= 3 && (best == 0 || prio < best)) best = prio;
        }
        return best >= 1 && best <= 3 ? best : 0;
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
