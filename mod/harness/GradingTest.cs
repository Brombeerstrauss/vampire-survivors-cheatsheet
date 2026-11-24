// Level-up grades with the real app data (cheatsheet-data.json, see README) for a few
// characters and builds. Prints grade, score and reason per offered card.
using System;
using System.Collections.Generic;
using System.Linq;
using VSCheatsheetBridge;

public static class GradingTest
{
    static CheatsheetData Data;
    static string G(string appId) => Data.Weapons.Concat(Data.Passives).First(kv => kv.Value == appId).Key;
    static ItemSnapshot I(string appId, int level) => new() { Type = G(appId), Level = level };

    static void Run(string title, string character, List<ItemSnapshot> weapons, List<ItemSnapshot> passives, params string[] offers)
    {
        var snap = new RunSnapshot { InRun = true };
        var p = new PlayerSnapshot { Index = 0, Character = character, Weapons = weapons, Passives = passives };
        p.Offers.AddRange(offers.Select(G));
        snap.Players.Add(p);
        var panel = Plugin.Advisor.Build(snap, true)[0];
        Console.WriteLine($"--- {title}");
        foreach (var o in panel.Offers) Console.WriteLine($"  {o.Grade,-2} {o.Score,4:0.##}  {o.Item.Name,-22} {o.Reason}");
    }

    public static void Run()
    {
        Plugin.Logger = new BepInEx.Logging.ManualLogSource();
        Data = CheatsheetData.Load(System.IO.Path.Combine(AppContext.BaseDirectory, "cheatsheet-data.json"));
        Plugin.Advisor = new EvolutionAdvisor(Data, "en");
        // Shape of the game's weapon data, values made up.
        string json = "{" + string.Join(",", new[] {
            $"\"{G("knife")}\":[{{\"level\":1,\"amount\":1}},{{\"amount\":1}},{{\"power\":5}}]",
            $"\"{G("whip")}\":[{{\"level\":1}},{{\"amount\":1}},{{\"area\":0.1}}]",
            $"\"{G("garlic")}\":[{{\"level\":1}},{{\"area\":0.4}},{{\"power\":2}}]",
            $"\"{G("king-bible")}\":[{{\"level\":1}},{{\"amount\":1}},{{\"duration\":0.5}},{{\"speed\":0.3}}]",
            $"\"{G("duplicator")}\":[{{\"level\":1,\"isPowerUp\":true,\"amount\":1}}]",
            $"\"{G("candelabrador")}\":[{{\"level\":1,\"isPowerUp\":true,\"area\":0.1}}]",
            $"\"{G("spinach")}\":[{{\"level\":1,\"isPowerUp\":true,\"power\":0.1}}]",
            $"\"{G("spellbinder")}\":[{{\"level\":1,\"isPowerUp\":true,\"duration\":0.1}}]",
        }) + "}";
        using (var doc = System.Text.Json.JsonDocument.Parse(json)) WeaponStats.Read(doc.RootElement);

        Run("Slots: Antonio, Whip, 5 items without Hollow Heart (1 slot left)", "ANTONIO", new() { I("whip", 4) },
            new() { I("spinach", 1), I("armor", 1), I("wings", 1), I("clover", 1), I("crown", 1) },
            "candelabrador", "hollow-heart", "king-bible", "whip");
        Run("Slots: Antonio, Whip, 6 items incl. Hollow Heart (full)", "ANTONIO", new() { I("whip", 4) },
            new() { I("hollow-heart", 1), I("armor", 1), I("wings", 1), I("clover", 1), I("crown", 1), I("attractorb", 1) },
            "axe", "garlic", "whip", "armor");
        Run("Slots: Alucard with 5 weapons, upgrade vs new", "TP_ALUCARD", new() { I("alucart-sworb", 3), I("knife", 3), I("garlic", 2), I("axe", 2), I("cross", 2) },
            new() { I("bracer", 1) },
            "knife", "king-bible", "garlic");
        Run("Your example: Alucard with Bracer, Duplicator, Empty Tome", "TP_ALUCARD", new() { I("alucart-sworb", 3) },
            new() { I("bracer", 1), I("duplicator", 1), I("empty-tome", 1) },
            "knife", "king-bible", "whip", "garlic", "santa-water", "runetracer");
        Run("Few items: Antonio with Whip only", "ANTONIO", new() { I("whip", 2) }, new(),
            "king-bible", "garlic", "santa-water", "lightning-ring", "knife", "fire-wand");
        Run("Few items: Antonio with Whip only, items offered", "ANTONIO", new() { I("whip", 2) }, new(),
            "spellbinder", "bracer", "candelabrador", "wings");
        Run("Babi-Onna: Empty Tome is to be avoided", "ONNA", new() { I("mirage-robe", 2) }, new(),
            "empty-tome", "wings", "lifesign-scan", "spinach");
        Run("Congregation: Tirajisu now recommended", "CONGREGATION", new() { I("screams-from-the-void", 1) }, new(),
            "tirajisu", "empty-tome");
        Run("Congregation, start: Screams from the Void L1", "CONGREGATION", new() { I("screams-from-the-void", 1) }, new(),
            "empty-tome", "candelabrador", "bracer", "crown", "armor", "wings");
        Run("Congregation, start: other choices", "CONGREGATION", new() { I("screams-from-the-void", 1) }, new(),
            "attractorb", "spinach", "duplicator", "garlic", "magic-wand");
        Run("Congregation later: + Garlic, Candelabrador", "CONGREGATION", new() { I("screams-from-the-void", 3), I("garlic", 2) }, new() { I("candelabrador", 1) },
            "candelabrador", "santa-water", "spellbinder", "pummarola");
        Run("Antonio, Whip + Knife", "ANTONIO", new() { I("whip", 3), I("knife", 2) }, new(),
            "duplicator", "candelabrador", "spinach", "empty-tome", "clock-lancet");
        Run("Alucard (DLC), Alucart Sworb + Knife, Duplicator", "TP_ALUCARD", new() { I("alucart-sworb", 2), I("knife", 2) }, new() { I("duplicator", 1) },
            "king-bible", "garlic", "spellbinder", "axe", "magic-wand", "armor");
        Run("Evolved Bloody Tear owned: inherits Whip stats", "ANTONIO", new() { I("bloody-tear", 1) }, new(),
            "candelabrador", "wings");
        Run("Inherited stats: Bloody Tear uses Candelabrador (same grade as community, stats come first)", "TP_ALUCARD", new() { I("bloody-tear", 1) }, new() { I("candelabrador", 2) },
            "bloody-tear");
        Plugin.Advisor = new EvolutionAdvisor(Data, "de");
        Run("German", "TP_ALUCARD", new() { I("knife", 2), I("garlic", 2) }, new() { I("candelabrador", 1) },
            "whip", "duplicator", "axe");
    }
}
