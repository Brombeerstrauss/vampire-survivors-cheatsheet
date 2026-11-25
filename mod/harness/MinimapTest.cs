// Minimap reader with fake game objects: items, chests, enemies, bosses, groups, F8 cycle,
// size and range steps.
using System;
using System.Collections.Generic;
using VampireSurvivors.Framework;
using VampireSurvivors.Objects.Pickups;
using VampireSurvivors.UI;
using VSCheatsheetBridge;

public static class MinimapTest
{
    static T At<T>(T c, float x, float y) where T : UnityEngine.Component
    {
        c.transform.position = new UnityEngine.Vector3 { x = x, y = y };
        return c;
    }

    public static void Run()
    {
        Plugin.Logger = new BepInEx.Logging.ManualLogSource();
        Plugin.LevelUpGrades = new BepInEx.Configuration.ConfigEntry<bool> { Value = false };
        Plugin.MinimapRange = new BepInEx.Configuration.ConfigEntry<float> { Value = 4f };
        Plugin.MinimapEnemies = new BepInEx.Configuration.ConfigEntry<string> { Value = "all" };
        var stage = new Stage();
        GM.Core = new GameManager { Player = At(new CharacterController(), 10, 5), Stage = stage };
        for (int k = 0; k < 25; k++) stage._spawnedEnemies.Add(At(new EnemyController { EnemyType = k % 5 == 0 ? EnemyType.LEM_SPECTRAL : EnemyType.BAT }, 10 + k, 5));
        stage._spawnedEnemies.Add(At(new EnemyController { EnemyType = EnemyType.BOSS_XLBAT, IsBoss = true }, 300, 5));
        var points = new List<MapPoint>();
        bool ok = MinimapReader.Read(points, 0, out var p0, out var h0);
        Console.WriteLine($"no map manager: {ok}, points {points.Count}, player {p0.x},{p0.y}, half screen {h0}");

        var map = new MapManager();
        map.Items.Add(At(new Pickup { PickupType = ItemType.RELIC }, 40, 5));
        map.Items.Add(At(new Pickup { PickupType = ItemType.GEM }, 11, 5));
        map.Items.Add(At(new Pickup { PickupType = ItemType.ROSARY }, 10, -2));
        map.Items.Add(At(new Pickup { PickupType = ItemType.TREASURE }, 14, -2));
        map.Items.Add(At(new Pickup { PickupType = ItemType.CLOVER }, 15, -2));
        map.Items.Add(At(new Pickup { PickupType = ItemType.MAP_TOKEN }, 16, -2));
        UnityEngine.Object.Registry.Add(map);
        UnityEngine.Object.Registry.Add(At(new TreasureChest(), 12, 8));
        MinimapReader.Reset();
        ok = MinimapReader.Read(points, 10000, out var p1, out var h1);
        Console.WriteLine($"with map manager: {ok}, {points.Count} points (nearest first, gems skipped)");
        foreach (var g in System.Linq.Enumerable.GroupBy(points, pt => pt.Style))
            Console.WriteLine($"  {g.Key}: {System.Linq.Enumerable.Count(g)}, first {System.Linq.Enumerable.First(g).Kind} at {System.Linq.Enumerable.First(g).Position.x}");
        Console.WriteLine($"  draw order: {string.Join(",", System.Linq.Enumerable.Distinct(System.Linq.Enumerable.Select(points, pt => pt.Style)))}");
        Plugin.MinimapEnemies.Value = "bosses";
        MinimapReader.Read(points, 20000, out _, out _);
        Console.WriteLine($"bosses only: {System.Linq.Enumerable.Count(points, pt => pt.Style == MapPointStyle.Enemy)} enemies, {System.Linq.Enumerable.Count(points, pt => pt.Style == MapPointStyle.Boss)} bosses");
        Plugin.MinimapEnemies.Value = "off";
        MinimapReader.Read(points, 30000, out _, out _);
        Console.WriteLine($"off: {System.Linq.Enumerable.Count(points, pt => pt.Style != MapPointStyle.Item)} enemies/bosses");

        // Items the stage starts with and portals: only in the scene, not in the map's list.
        // One pickup is in both (counted once); gems in the scene are skipped.
        var shared = At(new Pickup { PickupType = ItemType.RELIC }, 40, 5);
        map.Items.Clear();
        map.Items.Add(shared);
        UnityEngine.Object.Registry.Add(shared);
        UnityEngine.Object.Registry.Add(At(new Pickup { PickupType = ItemType.WEAPON, IsStagePickup = true }, 200, 5));
        UnityEngine.Object.Registry.Add(At(new Pickup { PickupType = ItemType.TELEPORTER, IsStagePickup = true, HasMapTokenData = true, MapTokenFrameName = "portal.png", MapTokenTexture = "items" }, -300, 40));
        UnityEngine.Object.Registry.Add(At(new Pickup { PickupType = ItemType.GEM }, 11, 6));
        Plugin.MinimapEnemies.Value = "off";
        MinimapReader.Read(points, 60000, out _, out _);
        MinimapReader.Read(points, 80000, out _, out _); // 15 s later: the sources are logged
        Console.WriteLine("with scene pickups: " + string.Join(",", System.Linq.Enumerable.Select(points, pt => pt.Kind)));

        // Item groups
        Plugin.MinimapEnemies.Value = "off";
        Plugin.MinimapChests = new BepInEx.Configuration.ConfigEntry<bool> { Value = true };
        Plugin.MinimapRelics = new BepInEx.Configuration.ConfigEntry<bool> { Value = true };
        Plugin.MinimapMinor = new BepInEx.Configuration.ConfigEntry<bool> { Value = true };
        Plugin.MinimapCoins = new BepInEx.Configuration.ConfigEntry<bool> { Value = false };
        map.Items.Add(At(new Pickup { PickupType = ItemType.COIN }, 12, 6));
        string Kinds() { MinimapReader.Read(points, 40000, out _, out _); return string.Join(",", System.Linq.Enumerable.Select(points, pt => pt.Kind)); }
        Console.WriteLine("all groups: " + Kinds());
        Plugin.MinimapMinor.Value = false;
        Console.WriteLine("no small pickups: " + Kinds());
        Plugin.MinimapChests.Value = false;
        Console.WriteLine("no chests either: " + Kinds());
        Plugin.MinimapRelics.Value = false;
        Console.WriteLine("nothing: '" + Kinds() + "'");
        Plugin.MinimapCoins.Value = true;
        Console.WriteLine("only coins switched on: " + Kinds());
        var modes = new List<string>();
        Plugin.MinimapEnemies.Value = "ALL ";
        for (int k = 0; k < 4; k++) { modes.Add(Plugin.EnemyMode()); Plugin.NextEnemyMode(); }
        Console.WriteLine("Enemies button: " + string.Join(" -> ", modes));
        float size = 0.24f; var sizes = new List<string>();
        for (int k = 0; k < 8; k++) { size = MinimapOverlay.NextSize(size, 1); sizes.Add(size.ToString("0.00")); }
        Console.WriteLine("Size +: " + string.Join(" ", sizes));
        sizes.Clear();
        for (int k = 0; k < 11; k++) { size = MinimapOverlay.NextSize(size, -1); sizes.Add(size.ToString("0.00")); }
        Console.WriteLine("Size -: " + string.Join(" ", sizes));
        float range = 4f; var ranges = new List<float>();
        for (int k = 0; k < 4; k++) { range = MinimapOverlay.NextRange(range, 1); ranges.Add(range); }
        for (int k = 0; k < 7; k++) { range = MinimapOverlay.NextRange(range, -1); ranges.Add(range); }
        Console.WriteLine("Range from 4, +4 then -7: " + string.Join(" ", ranges) + $"; from 5: -{MinimapOverlay.NextRange(5f, -1)} +{MinimapOverlay.NextRange(5f, 1)}");

        // Stage map image: read from the map manager; no pause map image in the fakes, so it warns.
        map._detailedMapSprite = new UnityEngine.Sprite { name = "TestStageMap", rect = new UnityEngine.Rect(0, 0, 512, 256) };
        MinimapReader.UpdateStageMap(50000);
        Console.WriteLine($"stage map status: {StageMap.Status}");

        Plugin.OverlayVisible = new BepInEx.Configuration.ConfigEntry<bool> { Value = true };
        Plugin.MinimapVisible = new BepInEx.Configuration.ConfigEntry<bool> { Value = true };
        Plugin.MinimapEnabled = new BepInEx.Configuration.ConfigEntry<bool> { Value = true };
        var next = typeof(Plugin).Assembly.GetType("VSCheatsheetBridge.BridgeBehaviour")
            .GetMethod("NextVisibility", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        var steps = new List<string>();
        for (int k = 0; k < 5; k++) { steps.Add($"{(Plugin.OverlayVisible.Value ? "O" : "-")}{(Plugin.MinimapVisible.Value ? "M" : "-")}"); next.Invoke(null, null); }
        Console.WriteLine("F8 cycle: " + string.Join(" -> ", steps));
        Plugin.MinimapEnabled.Value = false;
        steps.Clear();
        for (int k = 0; k < 3; k++) { steps.Add(Plugin.OverlayVisible.Value ? "O" : "-"); next.Invoke(null, null); }
        Console.WriteLine("F8 without minimap: " + string.Join(" -> ", steps));
    }
}
