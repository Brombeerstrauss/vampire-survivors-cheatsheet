using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;

namespace VSCheatsheetBridge;

// The game's own texts (I2 Localization): its current language and the names of weapons and
// items exactly as the game shows them. The term format comes from poncle's public
// localisation sheet (tab "weaponLang", key "{WHIP}name"; passive items are in the same tab).
//
// Everything via reflection and with a fallback: if the game changes something, the overlay
// uses the names from the app's data instead. Only call from the main thread (Update).
internal static class GameText
{
    private const BindingFlags Stat = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    private static bool _resolved;
    private static MethodInfo _getTranslation;
    private static PropertyInfo _languageCode;
    private static PropertyInfo _language;

    private static void Resolve()
    {
        if (_resolved) return;
        _resolved = true;
        Type manager = null;
        foreach (Assembly a in AppDomain.CurrentDomain.GetAssemblies())
        {
            manager = FindManager(a);
            if (manager != null) break;
        }
        // Interop assemblies are only loaded once something uses them: try the likely ones.
        if (manager == null)
        {
            foreach (string name in CandidateAssemblies())
            {
                try { manager = FindManager(Assembly.Load(new AssemblyName(name))); }
                catch (Exception ex) { RunReader.WarnOnce("load:" + name, ex); }
                if (manager != null) break;
            }
        }
        if (manager == null)
        {
            Plugin.Logger.LogInfo("[Language] I2 LocalizationManager not found, names come from the app's data");
            return;
        }
        try
        {
            _languageCode = manager.GetProperty("CurrentLanguageCode", Stat);
            _language = manager.GetProperty("CurrentLanguage", Stat);
            // GetTranslation(string Term, bool FixForRTL = true, ...): the overload with a string first.
            _getTranslation = manager.GetMethods(Stat)
                .Where(m => m.Name == "GetTranslation" && m.ReturnType == typeof(string))
                .Where(m => { ParameterInfo[] ps = m.GetParameters(); return ps.Length > 0 && ps[0].ParameterType == typeof(string); })
                .OrderBy(m => m.GetParameters().Length)
                .FirstOrDefault();
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("i2", ex);
        }
        Plugin.Logger.LogInfo($"[Language] {manager.FullName}: language {(_languageCode != null ? "yes" : "no")}, texts {(_getTranslation != null ? "yes" : "no")}");
    }

    private static Type FindManager(Assembly a)
    {
        try { return a.GetType("I2.Loc.LocalizationManager", false) ?? a.GetType("Il2CppI2.Loc.LocalizationManager", false); }
        catch { return null; }
    }

    // BepInEx/interop next to BepInEx/plugins/VSCheatsheetBridge: I2 assemblies first, then the game's.
    private static string[] CandidateAssemblies()
    {
        try
        {
            string pluginDir = Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? ".";
            string interop = Path.GetFullPath(Path.Combine(pluginDir, "..", "..", "interop"));
            if (!Directory.Exists(interop)) return Array.Empty<string>();
            return Directory.GetFiles(interop, "*.dll")
                .Select(Path.GetFileNameWithoutExtension)
                .Where(n => n.StartsWith("I2", StringComparison.OrdinalIgnoreCase) || n.StartsWith("Assembly-CSharp", StringComparison.OrdinalIgnoreCase))
                .OrderBy(n => n.StartsWith("I2", StringComparison.OrdinalIgnoreCase) ? 0 : n.Contains("firstpass") ? 1 : 2)
                .ToArray();
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("interop", ex);
            return Array.Empty<string>();
        }
    }

    /// <summary>The game's language as a lowercase code ("de", "en", ...), or null if unknown.</summary>
    public static string LanguageCode()
    {
        Resolve();
        try
        {
            if (_languageCode?.GetValue(null) is string code && code.Trim().Length > 0)
                return code.Trim().ToLowerInvariant();
            if (_language?.GetValue(null) is string name && name.Trim().Length > 0)
            {
                name = name.Trim();
                if (name.StartsWith("German", StringComparison.OrdinalIgnoreCase) || name.StartsWith("Deutsch", StringComparison.OrdinalIgnoreCase)) return "de";
                if (name.StartsWith("English", StringComparison.OrdinalIgnoreCase)) return "en";
                return name.ToLowerInvariant();
            }
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("language", ex);
        }
        return null;
    }

    /// <summary>Name of a weapon or passive item in the game's current language, or null.</summary>
    public static string WeaponName(string gameId) =>
        string.IsNullOrEmpty(gameId) ? null : Clean(Translate("weaponLang/{" + gameId + "}name"));

    private static string Translate(string term)
    {
        Resolve();
        if (_getTranslation == null) return null;
        try
        {
            ParameterInfo[] ps = _getTranslation.GetParameters();
            var args = new object[ps.Length];
            args[0] = term;
            for (int i = 1; i < ps.Length; i++)
                args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue
                    : ps[i].ParameterType.IsValueType ? Activator.CreateInstance(ps[i].ParameterType) : null;
            return _getTranslation.Invoke(null, args) as string;
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("translate", ex);
            return null;
        }
    }

    // Without the game's formatting tags; null for empty texts and for missing terms.
    private static string Clean(string text)
    {
        if (string.IsNullOrEmpty(text)) return null;
        text = Regex.Replace(text, "<[^>]*>", "");
        text = Regex.Replace(text, @"\s+", " ").Trim();
        if (text.Length == 0 || text.Contains("weaponLang/")) return null;
        return text;
    }
}
