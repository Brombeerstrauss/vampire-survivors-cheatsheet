using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;

namespace VSCheatsheetBridge;

// Liest den Run per Reflection. Das Spiel benennt Felder zwischen Versionen
// gelegentlich um, deshalb probiert jeder Zugriff mehrere bekannte Namen
// (Quellen: lukeod/vampiresurvivors-modding und VSEvolutionHelperEx).
// Passt nichts mehr, zeigt /debug die tatsächlich vorhandenen Namen.
internal static class RunReader
{
    private const BindingFlags Inst = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
    private const BindingFlags Stat = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    private static Type _gameManagerType;
    private static Type _gmType;
    private static bool _typesResolved;
    private static string _debugJson = "{}";
    private static Type _debugFor;
    private static readonly HashSet<string> Warned = new();

    /// <summary>Der GameManager des Spiels (oder null im Hauptmenü).</summary>
    public static object GameManager()
    {
        ResolveTypes();
        return FindGameManager();
    }

    /// <summary>Erstes vorhandenes Feld bzw. erste Eigenschaft mit einem der Namen.</summary>
    public static object GetMember(object obj, params string[] names) => Get(obj, names);

    public static RunSnapshot Read()
    {
        ResolveTypes();
        var snap = new RunSnapshot { DebugJson = _debugJson };
        object gm = FindGameManager();
        if (gm == null) return snap;

        List<object> characters = FindCharacters(gm);
        for (int i = 0; i < characters.Count; i++)
        {
            object c = characters[i];
            object weapons = Get(c, "WeaponsManager", "_weaponsManager");
            object accessories = Get(c, "AccessoriesManager", "_accessoriesManager");
            if (weapons == null && accessories == null) continue;

            if (_debugFor != c.GetType())
            {
                _debugFor = c.GetType();
                _debugJson = BuildDebug(gm, c, weapons, accessories);
                snap.DebugJson = _debugJson;
            }

            snap.Players.Add(new PlayerSnapshot
            {
                Index = i,
                Character = EnumName(Get(c, "CharacterType", "_characterType", "CurrentCharacterType", "CharType")),
                Weapons = ReadEquipment(weapons, "WeaponType"),
                Passives = ReadEquipment(accessories, "ItemType"),
            });
        }
        snap.InRun = snap.Players.Count > 0;
        return snap;
    }

    private static void ResolveTypes()
    {
        if (_typesResolved) return;
        _typesResolved = true;
        // Nur die Spiel-Assembly durchsuchen: GetTypes() auf Unity-Assemblies wirft
        // unter Il2CppInterop teils TypeLoadException.
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
                }
                catch { }
            }
        }
        Plugin.Logger.LogInfo($"GameManager: {_gameManagerType?.FullName ?? "nicht gefunden"}, GM: {_gmType?.FullName ?? "nicht gefunden"}");
        if (_gameManagerType == null) _typesResolved = false; // Assembly evtl. noch nicht geladen
    }

    // GM.Core ist der übliche Zugang; sonst ein statisches Feld vom Typ GameManager.
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

    // Alle Spieler (lokaler und Online-Koop), sonst nur Spieler 1.
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

    // ---- Reflection-Helfer ------------------------------------------------

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

    // Il2Cpp-Listen und -Arrays sind keine .NET-IEnumerables: Count/Length + Indexer.
    private static IEnumerable<object> Items(object list)
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
        // Nullable<Enum> aus Il2Cpp hat ein Value-Feld; normale Enums liefern ihren Namen.
        object inner = v.GetType().Name.StartsWith("Nullable") ? Get(v, "Value", "value") : v;
        return inner?.ToString();
    }

    internal static void WarnOnce(string key, Exception ex)
    {
        if (Warned.Add(key)) Plugin.Logger.LogWarning($"[{key}] {ex.GetType().Name}: {ex.Message}");
    }

    // Namen der vorhandenen Felder, damit sich umbenannte Felder schnell finden lassen.
    private static string BuildDebug(object gm, object character, object weapons, object accessories)
    {
        var sb = new StringBuilder("{");
        void Add(string key, object o, bool last = false)
        {
            sb.Append(Json.Str(key)).Append(":{\"type\":").Append(Json.Str(o?.GetType().FullName ?? "null")).Append(",\"members\":[");
            if (o != null)
                sb.Append(string.Join(",", o.GetType().GetProperties(Inst).Select(p => Json.Str(p.Name)).Distinct().OrderBy(s => s)));
            sb.Append("]}").Append(last ? "" : ",");
        }
        Add("gameManager", gm);
        Add("character", character);
        Add("weaponsManager", weapons);
        Add("firstWeapon", Items(Get(weapons, "ActiveEquipment", "_activeEquipment", "Equipment")).FirstOrDefault());
        Add("accessoriesManager", accessories, last: true);
        return sb.Append('}').ToString();
    }
}
