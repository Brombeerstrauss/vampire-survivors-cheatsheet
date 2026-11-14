using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Injection;
using UnityEngine;

namespace VSCheatsheetBridge;

// Liest den laufenden Run (Charakter, Waffen, passive Gegenstände) aus, zeigt im Spiel an,
// was pro Waffe für die nächste Entwicklung fehlt, und stellt den Run zusätzlich der
// Cheatsheet-App über http://127.0.0.1:<port> bereit. Am Spiel selbst ändert das Plugin nichts.
[BepInPlugin(Guid, Name, Version)]
public class Plugin : BasePlugin
{
    public const string Guid = "de.cheatsheet.vs.bridge";
    public const string Name = "VS Cheatsheet Bridge";
    public const string Version = "0.5.0";

    internal static ManualLogSource Logger;
    internal static StateServer Server;
    internal static float IntervalMs;
    internal static EvolutionAdvisor Advisor;

    internal static ConfigEntry<bool> OverlayVisible;
    internal static ConfigEntry<KeyCode> ToggleKey;
    internal static ConfigEntry<KeyCode> ResetKey;
    internal static ConfigEntry<float> OverlayX;
    internal static ConfigEntry<float> OverlayY;
    internal static ConfigEntry<float> OverlayWidth;
    internal static ConfigEntry<float> OverlayOpacity;
    internal static ConfigEntry<float> FontScale;
    internal static ConfigEntry<bool> ShareCoopPassives;
    internal static ConfigEntry<bool> Icons;

    public override void Load()
    {
        Logger = Log;
        ConfigEntry<int> port = Config.Bind("Server", "Port", 47321,
            "Port auf 127.0.0.1, unter dem die App den Run abfragt.");
        ConfigEntry<int> interval = Config.Bind("Server", "IntervalMs", 500,
            "Wie oft der Run ausgelesen wird (Millisekunden).");
        ConfigEntry<string> language = Config.Bind("Overlay", "Language", "de", "Sprache des Overlays: de oder en.");
        OverlayVisible = Config.Bind("Overlay", "Visible", true, "Overlay beim Start anzeigen.");
        ToggleKey = Config.Bind("Overlay", "ToggleKey", KeyCode.F8, "Taste zum Ein- und Ausblenden.");
        ResetKey = Config.Bind("Overlay", "ResetKey", KeyCode.F9, "Taste, um das Overlay an seine Standardposition zurückzusetzen.");
        OverlayX = Config.Bind("Overlay", "X", 0.005f, "Linker Rand, Anteil der Bildschirmbreite (0 bis 1). Wird beim Ziehen mit der Maus gespeichert.");
        OverlayY = Config.Bind("Overlay", "Y", 0.11f, "Oberer Rand, Anteil der Bildschirmhöhe (0 bis 1). Wird beim Ziehen mit der Maus gespeichert.");
        OverlayWidth = Config.Bind("Overlay", "Width", 0.19f, "Breite, Anteil der Bildschirmbreite.");
        OverlayOpacity = Config.Bind("Overlay", "Opacity", 0.6f, "Deckkraft des Hintergrunds (0 bis 1).");
        FontScale = Config.Bind("Overlay", "FontScale", 1f, "Schriftgröße (1 = Standard).");
        ShareCoopPassives = Config.Bind("Overlay", "ShareCoopPassives", true,
            "Koop: passive Gegenstände der Mitspieler zählen für die eigenen Entwicklungen.");
        Icons = Config.Bind("Overlay", "Icons", true, "Bilder aus dem Spiel im Overlay anzeigen (aus: nur Text-Kürzel).");
        IntervalMs = Math.Max(100, interval.Value);

        string dataPath = Path.Combine(Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? ".", "cheatsheet-data.json");
        try
        {
            Advisor = new EvolutionAdvisor(CheatsheetData.Load(dataPath), language.Value != "en");
        }
        catch (Exception ex)
        {
            Logger.LogError($"Daten für das Overlay fehlen ({dataPath}): {ex.Message}");
        }

        Server = new StateServer(port.Value, Logger);
        Server.Start();

        ClassInjector.RegisterTypeInIl2Cpp<BridgeBehaviour>();
        AddComponent<BridgeBehaviour>();
        Logger.LogInfo($"{Name} {Version} läuft auf http://127.0.0.1:{port.Value}/state, Overlay mit {ToggleKey.Value}");
    }

    public override bool Unload()
    {
        Server?.Stop();
        return true;
    }
}

// Unity ruft Update auf dem Hauptthread auf. Nur hier darf das Spiel gelesen werden; der
// Server bekommt fertige JSON-Texte. Pro Bild läuft hier fast nichts: Der Lauf wird alle
// IntervalMs gelesen, das Overlay (UiOverlay) nur bei Änderungen neu aufgebaut, und
// gezeichnet wird es von Unity selbst. Kein OnGUI (siehe UiOverlay, Absturz in coreclr).
public class BridgeBehaviour : MonoBehaviour
{
    public BridgeBehaviour(IntPtr ptr) : base(ptr) { }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct POINT { public int X, Y; }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT p);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool ScreenToClient(IntPtr hWnd, ref POINT p);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr GetActiveWindow();

    private bool _resetDown;
    private bool _mouseDown;
    private bool _dragging;
    private Vector2 _dragOffset;

    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private double _next;
    private double _nextKey;
    private bool _keyDown;
    private string _key = "";
    private List<PlayerPanel> _panels;
    private bool _inRun;
    private double _runStartedAt = -1;
    private bool _dirty;
    private bool _iconsReady;
    private int _screenW, _screenH;
    private double _retryIconsAt = -1;
    private int _iconRetries;
    private readonly UiOverlay _ui = new();

    private void Update()
    {
        double now = _clock.Elapsed.TotalMilliseconds;
        if (now >= _nextKey)
        {
            _nextKey = now + 50;
            PollToggleKey();
        }
        PollDrag();
        if (now < _next) return;
        _next = now + Plugin.IntervalMs;
        try
        {
            RunSnapshot snap = RunReader.Read();
            string key = snap.ContentKey();
            Plugin.Server.Publish(key, snap.ToJson(), snap.DebugJson);
            if (snap.InRun && !_inRun) _runStartedAt = now;
            if (!snap.InRun && _inRun) { GameSprites.Reset(); _iconsReady = false; }
            if (snap.InRun != _inRun) _dirty = true;
            _inRun = snap.InRun;

            // Bildnamen erst lesen, wenn die Stage sicher fertig geladen ist.
            if (_inRun && Plugin.Icons.Value && !GameSprites.Ready && now - _runStartedAt > 3000)
                GameSprites.LoadFrames();
            if (GameSprites.Ready != _iconsReady) { _iconsReady = GameSprites.Ready; _dirty = true; }
            if (Screen.width != _screenW || Screen.height != _screenH) { _screenW = Screen.width; _screenH = Screen.height; _dirty = true; }
            if (key != _key)
            {
                _key = key;
                _panels = Plugin.Advisor?.Build(snap, Plugin.ShareCoopPassives.Value);
                _dirty = true;
            }
            // Fehlten Bilder, weil das Spiel den Atlas erst lädt: einige Male später neu aufbauen.
            if (_retryIconsAt > 0 && now >= _retryIconsAt) { _retryIconsAt = -1; _dirty = true; }
            if (_dirty) Refresh();
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("update", ex);
        }
    }

    private void Refresh()
    {
        _dirty = false;
        if (!Plugin.OverlayVisible.Value || !_inRun) { _ui.Hide(); return; }
        _ui.Show(_panels);
        if (_ui.MissingIcons && _iconRetries < 6) { _iconRetries++; _retryIconsAt = _clock.Elapsed.TotalMilliseconds + 5000; }
        else if (!_ui.MissingIcons) _iconRetries = 0;
    }

    // Ein-/Ausblenden über die Tastatur, direkt über Windows abgefragt (kein Unity-Input nötig).
    private void PollToggleKey()
    {
        try
        {
            if (!Application.isFocused) return;
            bool down = (GetAsyncKeyState(VirtualKey(Plugin.ToggleKey.Value)) & 0x8000) != 0;
            if (down && !_keyDown)
            {
                Plugin.OverlayVisible.Value = !Plugin.OverlayVisible.Value;
                _dirty = true;
                Refresh();
            }
            _keyDown = down;

            bool reset = (GetAsyncKeyState(VirtualKey(Plugin.ResetKey.Value)) & 0x8000) != 0;
            if (reset && !_resetDown)
            {
                Plugin.OverlayX.Value = (float)Plugin.OverlayX.DefaultValue;
                Plugin.OverlayY.Value = (float)Plugin.OverlayY.DefaultValue;
                _dirty = true;
                Refresh();
            }
            _resetDown = reset;
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("key", ex);
        }
    }

    // Ziehen mit der linken Maustaste, direkt über Windows (Fensterkoordinaten, Ursprung oben
    // links wie das Panel). Beim Loslassen wird die Position in der Konfiguration gespeichert.
    private void PollDrag()
    {
        try
        {
            if (!_ui.Visible || !Application.isFocused) { _dragging = false; return; }
            bool down = (GetAsyncKeyState(0x01) & 0x8000) != 0;
            if (!down && !_mouseDown) return;

            IntPtr hwnd = GetActiveWindow();
            if (hwnd == IntPtr.Zero || !GetCursorPos(out POINT p) || !ScreenToClient(hwnd, ref p)) return;
            var mouse = new Vector2(p.X, p.Y);
            Rect r = _ui.ScreenRect;

            if (down && !_mouseDown && r.Contains(mouse))
            {
                _dragging = true;
                _dragOffset = mouse - r.position;
            }
            else if (down && _dragging)
            {
                float x = Mathf.Clamp(mouse.x - _dragOffset.x, 0f, Mathf.Max(0f, Screen.width - r.width));
                float y = Mathf.Clamp(mouse.y - _dragOffset.y, 0f, Mathf.Max(0f, Screen.height - r.height));
                _ui.MoveTo(x, y);
            }
            else if (!down && _dragging)
            {
                _dragging = false;
                Plugin.OverlayX.Value = _ui.ScreenRect.x / Mathf.Max(1, Screen.width);
                Plugin.OverlayY.Value = _ui.ScreenRect.y / Mathf.Max(1, Screen.height);
            }
            _mouseDown = down;
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("drag", ex);
        }
    }

    private static int VirtualKey(KeyCode key)
    {
        if (key >= KeyCode.F1 && key <= KeyCode.F15) return 0x70 + (key - KeyCode.F1);
        if (key >= KeyCode.A && key <= KeyCode.Z) return 0x41 + (key - KeyCode.A);
        if (key >= KeyCode.Alpha0 && key <= KeyCode.Alpha9) return 0x30 + (key - KeyCode.Alpha0);
        return 0x77; // F8
    }
}
