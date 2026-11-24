using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.InteropTypes;

namespace VSCheatsheetBridge;

// Reads the run via reflection. The game occasionally renames fields between versions,
// so every access tries several known names
// (sources: lukeod/vampiresurvivors-modding and VSEvolutionHelperEx).
// If nothing matches anymore, /debug shows the names that actually exist.
internal static class RunReader
{
    private const BindingFlags Inst = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
    private const BindingFlags Stat = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    private static Type _gameManagerType;
    private static Type _gmType;
    private static Type _levelUpPageType;
    private static Il2CppSystem.Type _levelUpPageIl2CppType;
    private static MethodInfo _castToLevelUpPage;
    private static bool _typesResolved;
    private static string _debugJson = "{}";
    private static Type _debugFor;
    private static readonly List<KeyValuePair<string, string>> DebugEntries = new();
    private static readonly Dictionary<string, Type> DebugTypes = new();
    private static readonly HashSet<string> Warned = new();
    private static int _offerLogs;

    /// <summary>The game's GameManager (or null in the main menu).</summary>
    public static object GameManager()
    {
        ResolveTypes();
        return FindGameManager();
    }

    /// <summary>First existing field or property with one of the names.</summary>
    public static object GetMember(object obj, params string[] names) => Get(obj, names);

    /// <summary>The first player's character (player 1), or null outside a run.</summary>
    public static object FirstCharacter()
    {
        ResolveTypes();
        object gm = FindGameManager();
        return gm == null ? null : FindCharacters(gm).FirstOrDefault();
    }

    /// <summary>All players' characters (player 1 first), empty outside a run.</summary>
    public static List<object> AllCharacters()
    {
        ResolveTypes();
        object gm = FindGameManager();
        return gm == null ? new List<object>() : FindCharacters(gm);
    }

    private static readonly Dictionary<string, Type> GameTypes = new();

    /// <summary>A type from the game's assembly by its name (e.g. "MapManager"); null if not found (yet).</summary>
    public static Type FindGameType(string name)
    {
        if (GameTypes.TryGetValue(name, out Type known)) return known;
        foreach (Assembly a in AppDomain.CurrentDomain.GetAssemblies())
        {
            if (!(a.GetName().Name ?? "").StartsWith("VampireSurvivors")) continue;
            Type[] types;
            try { types = a.GetTypes(); }
            catch (ReflectionTypeLoadException e) { types = e.Types.Where(t => t != null).ToArray(); }
            catch { continue; }
            foreach (Type t in types)
            {
                try
                {
                    if (t.Name == name && t.Namespace != null && t.Namespace.StartsWith("VampireSurvivors"))
                    {
                        GameTypes[name] = t;
                        return t;
                    }
                }
                catch { }
            }
        }
        return null;
    }

    /// <summary>Name of an enum value from the game (Il2Cpp nullables included).</summary>
    public static string EnumNameOf(object value) => EnumName(value);

    /// <summary>Adds an object's field names to /debug (only rebuilt when its type changes).</summary>
    public static void AddDebugEntry(string key, object o) => AddDebug(key, o);

    public static RunSnapshot Read()
    {
        ResolveTypes();
        var snap = new RunSnapshot { DebugJson = _debugJson };
        object gm = FindGameManager();
        if (gm == null) return snap;

        List<object> characters = FindCharacters(gm);
        var playerObjects = new List<object>(); // the game object of each entry in snap.Players
        for (int i = 0; i < characters.Count; i++)
        {
            object c = characters[i];
            object weapons = Get(c, "WeaponsManager", "_weaponsManager");
            object accessories = Get(c, "AccessoriesManager", "_accessoriesManager");
            if (weapons == null && accessories == null) continue;

            if (_debugFor != c.GetType())
            {
                _debugFor = c.GetType();
                AddDebug("gameManager", gm);
                AddDebug("character", c);
                AddDebug("weaponsManager", weapons);
                AddDebug("firstWeapon", Items(Get(weapons, "ActiveEquipment", "_activeEquipment", "Equipment")).FirstOrDefault());
                AddDebug("accessoriesManager", accessories);
            }

            snap.Players.Add(new PlayerSnapshot
            {
                Index = i,
                Character = EnumName(Get(c, "CharacterType", "_characterType", "CurrentCharacterType", "CharType")),
                Weapons = ReadEquipment(weapons, "WeaponType"),
                Passives = ReadEquipment(accessories, "ItemType"),
            });
            playerObjects.Add(c);
        }
        snap.InRun = snap.Players.Count > 0;
        if (snap.InRun && Plugin.LevelUpGrades.Value) ReadLevelUp(snap, playerObjects);
        snap.DebugJson = _debugJson;
        return snap;
    }

    private static void ResolveTypes()
    {
        if (_typesResolved) return;
        _typesResolved = true;
        // Only search the game assembly: GetTypes() on Unity assemblies sometimes throws
        // TypeLoadException under Il2CppInterop.
        foreach (Assembly a in AppDomain.CurrentDomain.GetAssemblies())
        {
            if (!(a.GetName().Name ?? "").StartsWith("VampireSurvivors")) continue;
            Type[] types;
            try { types = a.GetTypes(); }
            catch (ReflectionTypeLoadException e) { types = e.Types.Where(t => t != null).ToArray(); }
            catch (Exception ex) { WarnOnce("types:" + a.GetName().Name, ex); continue; }
            foreach (Type t in types)
            {
                try
                {
                    if (t.Namespace == null || !t.Namespace.StartsWith("VampireSurvivors")) continue;
                    if (t.Name == "GameManager" && _gameManagerType == null) _gameManagerType = t;
                    if (t.Name == "GM" && _gmType == null) _gmType = t;
                    if (t.Name == "LevelUpPage" && _levelUpPageType == null) _levelUpPageType = t;
                }
                catch { }
            }
        }
        Plugin.Logger.LogInfo($"GameManager: {_gameManagerType?.FullName ?? "not found"}, GM: {_gmType?.FullName ?? "not found"}, " +
            $"LevelUpPage: {_levelUpPageType?.FullName ?? "not found"}");
        if (_gameManagerType == null) _typesResolved = false; // assembly may not be loaded yet
    }

    // GM.Core is the usual entry point; otherwise a static field of type GameManager.
    private static object FindGameManager()
    {
        if (_gameManagerType == null) return null;
        if (_gmType != null)
        {
            object core = GetStatic(_gmType, "Core", "_core");
            if (core != null) return core;
        }
        foreach (Type owner in new[] { _gameManagerType, _gmType })
        {
            if (owner == null) continue;
            foreach (MemberInfo m in owner.GetMembers(Stat))
            {
                try
                {
                    if (m is PropertyInfo p && p.PropertyType == _gameManagerType && p.GetIndexParameters().Length == 0)
                    { object v = p.GetValue(null); if (v != null) return v; }
                    if (m is FieldInfo f && f.FieldType == _gameManagerType)
                    { object v = f.GetValue(null); if (v != null) return v; }
                }
                catch { }
            }
        }
        return null;
    }

    // All players (local and online co-op), otherwise just player 1.
    private static List<object> FindCharacters(object gm)
    {
        var result = new List<object>();
        object all = Get(gm, "AllPlayers", "_allPlayers", "Players", "AllCharacters");
        if (all == null)
        {
            object mm = Get(gm, "_multiplayerManager", "MultiplayerManager");
            if (mm != null) all = Call(mm, "GetAllCharacters");
        }
        foreach (object item in Items(all))
        {
            object c = item;
            if (Get(c, "WeaponsManager", "_weaponsManager") == null)
                c = Get(item, "Character", "CharacterController", "_character", "_characterController") ?? item;
            result.Add(c);
        }
        if (result.Count == 0)
        {
            object single = Get(gm, "Player", "_player", "PlayerOne");
            if (single == null)
            {
                object session = Get(gm, "GameSession", "_gameSession", "Session");
                single = Get(session, "ActiveCharacter");
            }
            if (single != null) result.Add(single);
        }
        return result;
    }

    private static List<ItemSnapshot> ReadEquipment(object manager, string typeName)
    {
        var list = new List<ItemSnapshot>();
        object equipment = Get(manager, "ActiveEquipment", "_activeEquipment", "Equipment");
        foreach (object e in Items(equipment))
        {
            string type = EnumName(Get(e, "Type", "_type", typeName, "_" + char.ToLower(typeName[0]) + typeName.Substring(1)));
            if (type == null || type == "VOID") continue;
            object lvl = Get(e, "Level", "_level", "CurrentLevel");
            int level = 0;
            try { if (lvl != null) level = Convert.ToInt32(lvl); } catch { }
            list.Add(new ItemSnapshot { Type = type, Level = level });
        }
        return list;
    }

    // ---- Level-up screen ----------------------------------------------------

    // The open level-up screen (LevelUpPage) and what its cards offer. Each card is a
    // LevelUpItemUI: _type is the WeaponType (passive items are WeaponTypes too, e.g. POWER),
    // VOID for other pickups such as gold, which only have an _itemType; limit breaks
    // have _isLimitBreak. Names per the game's decompiled code, as used by the community mods
    // VSEvolutionHelperEx and jev_vampire_survivors. /debug lists the real names.
    private static void ReadLevelUp(RunSnapshot snap, List<object> playerObjects)
    {
        object page = FindLevelUpPage();
        if (page == null) return;

        var offers = new List<string>();
        object firstCard = null;
        foreach (object card in Items(Get(page, "LevelUpItems", "_spawnedItems")))
        {
            firstCard ??= card;
            if (Get(card, "_isLimitBreak", "IsLimitBreak") is bool limitBreak && limitBreak) continue;
            string type = EnumName(Get(card, "_type", "Type", "_weaponType"));
            if (type == null || type == "VOID" || offers.Contains(type)) continue;
            offers.Add(type);
        }
        AddDebug("levelUpPage", page);
        if (firstCard != null) AddDebug("levelUpItem", firstCard);
        if (offers.Count == 0)
        {
            if (firstCard == null) WarnOnce("levelUpCards", new InvalidOperationException("level-up screen found, but no cards (see /debug, levelUpPage)"));
            return;
        }

        PlayerSnapshot player = ControllingPlayer(page, snap, playerObjects);
        if (player == null) return;
        player.Offers.AddRange(offers);
        if (_offerLogs < 3)
        {
            _offerLogs++;
            Plugin.Logger.LogInfo($"[LevelUp] P{player.Index + 1} offered: {string.Join(", ", offers)}");
        }
    }

    // Unity only finds active objects, so this is null while the level-up screen is closed.
    private static object FindLevelUpPage()
    {
        if (_levelUpPageType == null) return null;
        try
        {
            _levelUpPageIl2CppType ??= Il2CppType.From(_levelUpPageType);
            // Typed wrapper (TryCast<LevelUpPage>), so reflection sees the page's fields.
            _castToLevelUpPage ??= typeof(Il2CppObjectBase).GetMethod("TryCast", Type.EmptyTypes)?.MakeGenericMethod(_levelUpPageType);
            var found = UnityEngine.Object.FindObjectsOfType(_levelUpPageIl2CppType);
            if (found == null || _castToLevelUpPage == null) return null;
            foreach (UnityEngine.Object o in found)
            {
                if (o == null) continue;
                object page = _castToLevelUpPage.Invoke(o, null);
                if (page != null) return page;
            }
        }
        catch (Exception ex)
        {
            WarnOnce("levelUpPage", ex);
        }
        return null;
    }

    // Whose level-up is it? In co-op the screen belongs to one player.
    private static PlayerSnapshot ControllingPlayer(object page, RunSnapshot snap, List<object> playerObjects)
    {
        if (snap.Players.Count <= 1) return snap.Players.FirstOrDefault();
        IntPtr controlling = PointerOf(Call(page, "GetCharacterControllingUi"));
        if (controlling != IntPtr.Zero)
        {
            for (int i = 0; i < playerObjects.Count; i++)
                if (PointerOf(playerObjects[i]) == controlling) return snap.Players[i];
        }
        WarnOnce("levelUpPlayer", new InvalidOperationException("level-up screen: player not found, grades shown for player 1"));
        return snap.Players[0];
    }

    private static IntPtr PointerOf(object o) => o is Il2CppObjectBase b ? b.Pointer : IntPtr.Zero;

    // ---- Reflection helpers -----------------------------------------------

    private static object Get(object obj, params string[] names)
    {
        if (obj == null) return null;
        Type t = obj.GetType();
        foreach (string n in names)
        {
            try
            {
                PropertyInfo p = t.GetProperty(n, Inst);
                if (p != null && p.GetIndexParameters().Length == 0) { object v = p.GetValue(obj); if (v != null) return v; }
                FieldInfo f = t.GetField(n, Inst);
                if (f != null) { object v = f.GetValue(obj); if (v != null) return v; }
            }
            catch (Exception ex) { WarnOnce(t.Name + "." + n, ex); }
        }
        return null;
    }

    private static object GetStatic(Type t, params string[] names)
    {
        foreach (string n in names)
        {
            try
            {
                PropertyInfo p = t.GetProperty(n, Stat);
                if (p != null) { object v = p.GetValue(null); if (v != null) return v; }
                FieldInfo f = t.GetField(n, Stat);
                if (f != null) { object v = f.GetValue(null); if (v != null) return v; }
            }
            catch (Exception ex) { WarnOnce(t.Name + "." + n, ex); }
        }
        return null;
    }

    private static object Call(object obj, string method)
    {
        try { return obj.GetType().GetMethod(method, Inst, null, Type.EmptyTypes, null)?.Invoke(obj, null); }
        catch (Exception ex) { WarnOnce(method, ex); return null; }
    }

    // Il2Cpp lists and arrays are not .NET IEnumerables: Count/Length + indexer.
    internal static IEnumerable<object> Items(object list)
    {
        if (list == null) yield break;
        Type t = list.GetType();
        PropertyInfo count = t.GetProperty("Count") ?? t.GetProperty("Length");
        PropertyInfo item = t.GetProperties().FirstOrDefault(p => p.GetIndexParameters().Length == 1);
        if (count == null || item == null) yield break;
        int n;
        try { n = Convert.ToInt32(count.GetValue(list)); } catch { yield break; }
        for (int i = 0; i < n; i++)
        {
            object v = null;
            try { v = item.GetValue(list, new object[] { i }); } catch { }
            if (v != null) yield return v;
        }
    }

    private static string EnumName(object v)
    {
        if (v == null) return null;
        // Nullable<Enum> from Il2Cpp has a Value field; normal enums return their name.
        object inner = v.GetType().Name.StartsWith("Nullable") ? Get(v, "Value", "value") : v;
        return inner?.ToString();
    }

    internal static void WarnOnce(string key, Exception ex)
    {
        if (Warned.Add(key)) Plugin.Logger.LogWarning($"[{key}] {ex.GetType().Name}: {ex.Message}");
    }

    // Names of the existing fields for /debug, so renamed fields can be found quickly.
    // Each entry is only rebuilt when the object's type changes.
    private static void AddDebug(string key, object o)
    {
        Type t = o?.GetType();
        if (DebugTypes.TryGetValue(key, out Type known) && known == t) return;
        DebugTypes[key] = t;
        var sb = new StringBuilder("{\"type\":").Append(Json.Str(t?.FullName ?? "null")).Append(",\"members\":[");
        if (t != null)
            sb.Append(string.Join(",", t.GetProperties(Inst).Select(p => Json.Str(p.Name)).Distinct().OrderBy(s => s)));
        sb.Append("]}");
        var entry = new KeyValuePair<string, string>(key, sb.ToString());
        int i = DebugEntries.FindIndex(e => e.Key == key);
        if (i >= 0) DebugEntries[i] = entry;
        else DebugEntries.Add(entry);
        _debugJson = "{" + string.Join(",", DebugEntries.Select(e => Json.Str(e.Key) + ":" + e.Value)) + "}";
    }
}
