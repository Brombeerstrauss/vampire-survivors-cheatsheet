using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.InteropTypes;
using UnityEngine;

namespace VSCheatsheetBridge;

/// <summary>How a point is drawn on the minimap.</summary>
internal enum MapPointStyle
{
    /// <summary>Stage item, relic, chest...: its sprite; beyond the range faded at the edge.</summary>
    Item,
    /// <summary>A normal enemy: a small red dot, only within the range.</summary>
    Enemy,
    /// <summary>A boss: its sprite, larger; beyond the range at the edge.</summary>
    Boss,
}

/// <summary>A point of interest for the minimap, in world units.</summary>
internal sealed class MapPoint
{
    public Vector2 Position;
    /// <summary>The object's own sprite in the world (null: draw a coloured square).</summary>
    public Sprite Sprite;
    /// <summary>Pickup type from the game (e.g. TREASURE, RELIC...), CHEST, or the enemy type.</summary>
    public string Kind;
    public MapPointStyle Style;
}

// Reads what the minimap shows, from the same places the game's own pause map uses:
// - MapManager.GetAllWorldItems(): the pickups lying on the stage (stage items, relics, ...).
//   MapManager belongs to the pause menu, so it may exist while inactive; Resources finds it.
// - TreasureChest objects in the scene (the pause map adds chests separately).
// - The enemies from the stage's list of spawned enemies (Stage._spawnedEnemies, as in the
//   modding docs), bosses (EnemyController.IsBoss) separately. The game's pause map has no enemies.
// - The player's position from the character.
// Names per the game's decompiled code (game-api of VSEvolutionHelperEx, which hooks the same
// MapManager). Everything via reflection with fallbacks; /debug lists the real field names.
// Only call from Update (main thread).
internal static class MinimapReader
{
    private const BindingFlags Inst = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    /// <summary>At most this many items, enemies and bosses, the nearest first.</summary>
    private const int MaxItems = 120, MaxEnemies = 250, MaxBosses = 20;

    private static bool _resolved;
    private static Type _mapManagerType, _chestType;
    private static Il2CppSystem.Type _mapManagerIl2Cpp, _chestIl2Cpp;
    private static MethodInfo _castMapManager, _castChest, _getAllWorldItems;
    private static object _mapManager;
    private static double _retryAt;
    private static bool _loggedItems, _loggedEnemies;
    private static int _loggedOwn;
    private static readonly HashSet<string> LoggedBosses = new();
    // Small pickups (setting Minimap.Minor): the game's own list (MapManager._minorItemTypes,
    // read once it is filled) and these, in case the game's list is missing or shorter.
    private static readonly HashSet<string> MinorKinds = new()
    {
        "COIN", "COINBAG1", "COINBAG2", "COINBAGMAX", "ALWAYS_COINBAG2", "STATIC_GOLDPILE", "CLOVER",
        "ROSARY", "ROSARYX", "VACUUM", "OROLOGION", "ROAST", "ALWAYS_ROAST", "LITTLEHEART", "GILDED",
        "HEALER", "PURIFY", "PURIFY2", "GOLDFINGER", "SORBETTO", "TP_HEART_REFRESH", "TP_WALL_CHICKEN",
        "TP_NEUTRON_BOMB", "TP_KARMA_COIN", "TP_SOULSTEAL_LITTLEHEART",
    };
    private static readonly HashSet<string> GameMinorKinds = new();

    private enum ItemGroup { Chest, Relic, Minor }

    private static ItemGroup GroupOf(string kind) =>
        kind == "CHEST" || kind.Contains("TREASURE") ? ItemGroup.Chest
        : MinorKinds.Contains(kind) || GameMinorKinds.Contains(kind) ? ItemGroup.Minor
        : ItemGroup.Relic;

    private static bool Shown(ItemGroup group) => group switch
    {
        ItemGroup.Chest => Plugin.MinimapChests?.Value ?? true,
        ItemGroup.Minor => Plugin.MinimapMinor?.Value ?? true,
        _ => Plugin.MinimapRelics?.Value ?? true,
    };

    // Getters per enemy type, so hundreds of enemies don't mean hundreds of member lookups.
    private static readonly Dictionary<(Type, string), Func<object, object>> Getters = new();

    private static void Resolve()
    {
        if (_resolved) return;
        _mapManagerType = RunReader.FindGameType("MapManager");
        _chestType = RunReader.FindGameType("TreasureChest");
        if (_mapManagerType == null && _chestType == null) return; // game assembly not loaded yet
        _resolved = true;
        MethodInfo tryCast = typeof(Il2CppObjectBase).GetMethod("TryCast", Type.EmptyTypes);
        if (_mapManagerType != null)
        {
            _mapManagerIl2Cpp = Il2CppType.From(_mapManagerType);
            _castMapManager = tryCast?.MakeGenericMethod(_mapManagerType);
            _getAllWorldItems = _mapManagerType.GetMethod("GetAllWorldItems", Inst, null, Type.EmptyTypes, null);
        }
        if (_chestType != null)
        {
            _chestIl2Cpp = Il2CppType.From(_chestType);
            _castChest = tryCast?.MakeGenericMethod(_chestType);
        }
        Plugin.Logger.LogInfo($"[Minimap] MapManager: {_mapManagerType?.FullName ?? "not found"} " +
            $"(GetAllWorldItems: {(_getAllWorldItems != null ? "yes" : "no")}), TreasureChest: {_chestType?.FullName ?? "not found"}");
    }

    /// <summary>Forgets the MapManager, e.g. when a run ends (the scene changes).</summary>
    public static void Reset()
    {
        _mapManager = null;
        _retryAt = 0;
        _loggedItems = _loggedEnemies = false;
        _loggedOwn = 0;
        LoggedBosses.Clear();
        StageMap.Reset();
    }

    /// <summary>
    /// Fills `points` with what is around the player, in drawing order: enemies, items, bosses.
    /// False if the player's position is unknown. `halfScreen`: half a screen width in world units
    /// (from the camera).
    /// </summary>
    public static bool Read(List<MapPoint> points, double now, out Vector2 player, out float halfScreen)
    {
        points.Clear();
        Resolve();
        if (!PlayerAndScreen(out player, out halfScreen)) return false;

        var items = new List<(float d, MapPoint point)>();
        int worldItems = AddWorldItems(items, player, now);
        int chests = AddChests(items, player);

        var enemies = new List<(float d, MapPoint point)>();
        var bosses = new List<(float d, MapPoint point)>();
        string show = Plugin.EnemyMode();
        if (show != "off")
        {
            float range = MinimapOverlay.RangeFor(halfScreen);
            AddEnemies(enemies, bosses, player, range * range, show != "bosses");
        }

        foreach (var f in enemies.OrderBy(f => f.d).Take(MaxEnemies)) points.Add(f.point);
        foreach (var f in items.OrderBy(f => f.d).Take(MaxItems)) points.Add(f.point);
        foreach (var f in bosses.OrderBy(f => f.d).Take(MaxBosses)) points.Add(f.point);

        if (!_loggedItems && (worldItems > 0 || chests > 0))
        {
            _loggedItems = true;
            string kinds = string.Join(", ", items.GroupBy(f => f.point.Kind).Select(g => $"{g.Key} {g.Count()}"));
            Plugin.Logger.LogInfo($"[Minimap] {worldItems} world items, {chests} chests: {kinds}");
        }
        return true;
    }

    /// <summary>
    /// The stage's map image for the minimap's background: reads it and learns where the world
    /// lies on it while the pause map is open (StageMap). Also while the minimap is hidden.
    /// </summary>
    public static void UpdateStageMap(double now)
    {
        Resolve();
        if (!PlayerAndScreen(out Vector2 player, out float halfScreen)) return;
        StageMap.Update(MapManager(now), player, halfScreen, now);
    }

    // Your position and half the screen width in world units (from the camera).
    private static bool PlayerAndScreen(out Vector2 player, out float halfScreen)
    {
        player = default;
        halfScreen = 0f;
        Camera cam = Camera.main;
        Component character = OwnCharacter(cam);
        if (character == null) return false;
        Vector3 p = character.transform.position;
        player = new Vector2(p.x, p.y);
        halfScreen = cam != null && cam.orthographic ? cam.orthographicSize * cam.aspect : 0f;
        if (halfScreen <= 0f) halfScreen = 12f; // rough fallback until the camera is known
        return true;
    }

    // Player 1, except in online co-op: there each player's camera follows their own character,
    // so the character nearest to the camera is yours (player 1 may be someone else).
    private static Component OwnCharacter(Camera cam)
    {
        List<object> all = RunReader.AllCharacters();
        if (all.Count == 0) return null;
        bool online = RunReader.GetMember(RunReader.GameManager(), "IsOnlineMultiplayer", "_isOnlineMultiplayer") is bool o && o;
        if (all.Count == 1 || !online || cam == null) return all[0] as Component;
        Vector3 c = cam.transform.position;
        Component own = null;
        float best = float.MaxValue;
        int index = 0;
        for (int i = 0; i < all.Count; i++)
        {
            if (all[i] is not Component ch || ch == null) continue;
            float d = Distance(new Vector2(c.x, c.y), ch.transform.position);
            if (d < best) { best = d; own = ch; index = i; }
        }
        if (_loggedOwn != index + 1)
        {
            _loggedOwn = index + 1;
            Plugin.Logger.LogInfo($"[Minimap] online co-op: the map follows player {index + 1} (nearest to the camera)");
        }
        return own;
    }

    // Enemies from the stage: within the range (squared, world units) as dots, bosses anywhere.
    private static void AddEnemies(List<(float, MapPoint)> enemies, List<(float, MapPoint)> bosses,
        Vector2 player, float rangeSq, bool all)
    {
        object stage = RunReader.GetMember(RunReader.GameManager(), "Stage", "_stage");
        object list = RunReader.GetMember(stage, "SpawnedEnemies", "_spawnedEnemies");
        if (list == null) return;

        object first = null;
        int total = 0;
        foreach (object enemy in RunReader.Items(list))
        {
            if (enemy is not Component c || c == null) continue;
            first ??= enemy;
            total++;
            Vector3 pos = c.transform.position;
            float d = Distance(player, pos);
            bool boss = Member(enemy, "IsBoss") is bool b && b;
            if (boss)
            {
                string type = RunReader.EnumNameOf(Member(enemy, "EnemyType")) ?? "BOSS";
                if (LoggedBosses.Add(type)) Plugin.Logger.LogInfo($"[Minimap] boss on the stage: {type}");
                bosses.Add((d, new MapPoint { Position = new Vector2(pos.x, pos.y), Sprite = SpriteOf(c), Kind = type, Style = MapPointStyle.Boss }));
            }
            else if (all && d <= rangeSq)
            {
                enemies.Add((d, new MapPoint { Position = new Vector2(pos.x, pos.y), Kind = "ENEMY", Style = MapPointStyle.Enemy }));
            }
        }
        if (first == null) return;
        RunReader.AddDebugEntry("stage", stage);
        RunReader.AddDebugEntry("enemy", first);

        // Once per run: which enemy types are there, so missing ones can be found in the log.
        if (!_loggedEnemies && total >= 20)
        {
            _loggedEnemies = true;
            string types = string.Join(", ", RunReader.Items(list)
                .Select(e => RunReader.EnumNameOf(Member(e, "EnemyType")) ?? "?")
                .GroupBy(t => t).OrderByDescending(g => g.Count()).Take(10).Select(g => $"{g.Key} {g.Count()}"));
            Plugin.Logger.LogInfo($"[Minimap] {total} enemies, {bosses.Count} bosses: {types}");
        }
    }

    // A field or property by name, with the lookup cached per type.
    private static object Member(object obj, string name)
    {
        if (obj == null) return null;
        Type t = obj.GetType();
        if (!Getters.TryGetValue((t, name), out Func<object, object> get))
        {
            PropertyInfo prop = t.GetProperty(name, Inst);
            FieldInfo field = prop == null ? t.GetField(name, Inst) : null;
            get = prop != null && prop.GetIndexParameters().Length == 0 ? prop.GetValue
                : field != null ? field.GetValue
                : _ => null;
            Getters[(t, name)] = get;
        }
        try { return get(obj); }
        catch (Exception ex) { RunReader.WarnOnce("minimap:" + name, ex); return null; }
    }

    private static int AddWorldItems(List<(float, MapPoint)> found, Vector2 player, double now)
    {
        object map = MapManager(now);
        if (map == null || _getAllWorldItems == null) return 0;
        object list;
        try { list = _getAllWorldItems.Invoke(map, null); }
        catch (Exception ex) { RunReader.WarnOnce("minimap:items", ex); return 0; }

        if (GameMinorKinds.Count == 0) ReadGameMinorKinds(map);
        int count = 0;
        object first = null;
        foreach (object item in RunReader.Items(list))
        {
            first ??= item;
            if (item is not Component c || c == null) continue;
            string kind = RunReader.EnumNameOf(RunReader.GetMember(item, "PickupType", "_pickupType", "ItemType")) ?? item.GetType().Name;
            if (kind == "GEM") continue; // experience gems: far too many, the game's map skips them too
            if (!Shown(GroupOf(kind))) continue;
            Vector3 pos = c.transform.position;
            found.Add((Distance(player, pos), new MapPoint { Position = new Vector2(pos.x, pos.y), Sprite = SpriteOf(c), Kind = kind, Style = MapPointStyle.Item }));
            count++;
        }
        if (first != null) RunReader.AddDebugEntry("worldItem", first);
        return count;
    }

    private static int AddChests(List<(float, MapPoint)> found, Vector2 player)
    {
        if (_chestIl2Cpp == null || _castChest == null || !Shown(ItemGroup.Chest)) return 0;
        int count = 0;
        try
        {
            var all = UnityEngine.Object.FindObjectsOfType(_chestIl2Cpp);
            if (all == null) return 0;
            foreach (UnityEngine.Object o in all)
            {
                if (o == null) continue;
                if (_castChest.Invoke(o, null) is not Component c || c == null) continue;
                Vector3 pos = c.transform.position;
                found.Add((Distance(player, pos), new MapPoint { Position = new Vector2(pos.x, pos.y), Sprite = SpriteOf(c), Kind = "CHEST", Style = MapPointStyle.Item }));
                count++;
            }
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("minimap:chests", ex);
        }
        return count;
    }

    // The game's own list of small pickups for its pause map, once it is filled.
    private static void ReadGameMinorKinds(object map)
    {
        foreach (object t in RunReader.Items(RunReader.GetMember(map, "_minorItemTypes")))
            if (RunReader.EnumNameOf(t) is string name) GameMinorKinds.Add(name);
        if (GameMinorKinds.Count > 0)
            Plugin.Logger.LogInfo($"[Minimap] small pickups per the game: {string.Join(", ", GameMinorKinds)}");
    }

    // The pause menu's MapManager, also while inactive. Searched again every 5 seconds until found.
    private static object MapManager(double now)
    {
        if (_mapManager is UnityEngine.Object alive && alive != null) return _mapManager;
        _mapManager = null;
        if (_mapManagerIl2Cpp == null || _castMapManager == null || now < _retryAt) return null;
        _retryAt = now + 5000;
        try
        {
            foreach (UnityEngine.Object o in Resources.FindObjectsOfTypeAll(_mapManagerIl2Cpp))
            {
                if (o == null) continue;
                object m = _castMapManager.Invoke(o, null);
                // Prefabs are found too: only take the one in the running scene.
                if (m is Component c && c != null && c.gameObject != null && c.gameObject.scene.IsValid())
                {
                    _mapManager = m;
                    RunReader.AddDebugEntry("mapManager", m);
                    Plugin.Logger.LogInfo("[Minimap] found the game's MapManager");
                    return m;
                }
            }
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("minimap:mapManager", ex);
        }
        return null;
    }

    private static Sprite SpriteOf(Component c)
    {
        try
        {
            SpriteRenderer r = c.GetComponentInChildren<SpriteRenderer>();
            return r != null ? r.sprite : null;
        }
        catch
        {
            return null;
        }
    }

    private static float Distance(Vector2 a, Vector3 b)
    {
        float dx = b.x - a.x, dy = b.y - a.y;
        return dx * dx + dy * dy;
    }
}
