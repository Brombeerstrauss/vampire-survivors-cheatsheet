using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.InteropTypes;
using UnityEngine;

namespace VSCheatsheetBridge;

/// <summary>A point of interest for the minimap, in world units.</summary>
internal sealed class MapPoint
{
    public Vector2 Position;
    /// <summary>The object's own sprite in the world (null: draw a coloured square).</summary>
    public Sprite Sprite;
    /// <summary>Pickup type from the game (e.g. TREASURE, RELIC...), or CHEST.</summary>
    public string Kind;
}

// Reads what the minimap shows, from the same places the game's own pause map uses:
// - MapManager.GetAllWorldItems(): the pickups lying on the stage (stage items, relics, ...).
//   MapManager belongs to the pause menu, so it may exist while inactive; Resources finds it.
// - TreasureChest objects in the scene (the pause map adds chests separately).
// - The player's position from the character.
// Names per the game's decompiled code (game-api of VSEvolutionHelperEx, which hooks the same
// MapManager). Everything via reflection with fallbacks; /debug lists the real field names.
// Only call from Update (main thread).
internal static class MinimapReader
{
    private const BindingFlags Inst = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    /// <summary>At most this many points, the nearest first.</summary>
    private const int MaxPoints = 120;

    private static bool _resolved;
    private static Type _mapManagerType, _chestType;
    private static Il2CppSystem.Type _mapManagerIl2Cpp, _chestIl2Cpp;
    private static MethodInfo _castMapManager, _castChest, _getAllWorldItems;
    private static object _mapManager;
    private static double _retryAt;
    private static bool _loggedFirst;

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
    }

    /// <summary>
    /// Fills `points` with what is around the player. False if the player's position is unknown.
    /// `range` is half a screen width in world units (from the camera).
    /// </summary>
    public static bool Read(List<MapPoint> points, double now, out Vector2 player, out float halfScreen)
    {
        points.Clear();
        player = default;
        halfScreen = 0f;
        Resolve();

        Component character = RunReader.FirstCharacter() as Component;
        if (character == null) return false;
        Vector3 p = character.transform.position;
        player = new Vector2(p.x, p.y);

        Camera cam = Camera.main;
        halfScreen = cam != null && cam.orthographic ? cam.orthographicSize * cam.aspect : 0f;
        if (halfScreen <= 0f) halfScreen = 12f; // rough fallback until the camera is known

        var found = new List<(float d, MapPoint point)>();
        int worldItems = AddWorldItems(found, player, now);
        int chests = AddChests(found, player);

        foreach (var f in found.OrderBy(f => f.d).Take(MaxPoints)) points.Add(f.point);

        if (!_loggedFirst && (worldItems > 0 || chests > 0))
        {
            _loggedFirst = true;
            string kinds = string.Join(", ", found.GroupBy(f => f.point.Kind).Select(g => $"{g.Key} {g.Count()}"));
            Plugin.Logger.LogInfo($"[Minimap] {worldItems} world items, {chests} chests: {kinds}");
        }
        return true;
    }

    private static int AddWorldItems(List<(float, MapPoint)> found, Vector2 player, double now)
    {
        object map = MapManager(now);
        if (map == null || _getAllWorldItems == null) return 0;
        object list;
        try { list = _getAllWorldItems.Invoke(map, null); }
        catch (Exception ex) { RunReader.WarnOnce("minimap:items", ex); return 0; }

        int count = 0;
        object first = null;
        foreach (object item in RunReader.Items(list))
        {
            first ??= item;
            if (item is not Component c || c == null) continue;
            string kind = RunReader.EnumNameOf(RunReader.GetMember(item, "PickupType", "_pickupType", "ItemType")) ?? item.GetType().Name;
            if (kind == "GEM") continue; // experience gems: far too many, the game's map skips them too
            Vector3 pos = c.transform.position;
            found.Add((Distance(player, pos), new MapPoint { Position = new Vector2(pos.x, pos.y), Sprite = SpriteOf(c), Kind = kind }));
            count++;
        }
        if (first != null) RunReader.AddDebugEntry("worldItem", first);
        return count;
    }

    private static int AddChests(List<(float, MapPoint)> found, Vector2 player)
    {
        if (_chestIl2Cpp == null || _castChest == null) return 0;
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
                found.Add((Distance(player, pos), new MapPoint { Position = new Vector2(pos.x, pos.y), Sprite = SpriteOf(c), Kind = "CHEST" }));
                count++;
            }
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("minimap:chests", ex);
        }
        return count;
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
