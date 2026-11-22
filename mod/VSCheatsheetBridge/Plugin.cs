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

// Reads the current run (character, weapons, passive items), shows in game what each weapon
// still needs for its next evolution, grades the choices on the level-up screen, and also
// serves the run to the cheatsheet app via http://127.0.0.1:<port>. The plugin does not
// change anything in the game itself.
[BepInPlugin(Guid, Name, Version)]
public class Plugin : BasePlugin
{
    public const string Guid = "de.cheatsheet.vs.bridge";
    public const string Name = "VS Cheatsheet Bridge";
    public const string Version = BuildInfo.Version; // <Version> in VSCheatsheetBridge.csproj

    internal static ManualLogSource Logger;
    internal static StateServer Server;
    internal static float IntervalMs;
    internal static EvolutionAdvisor Advisor;

    internal static ConfigEntry<bool> OverlayVisible;
    internal static ConfigEntry<bool> OverlayCollapsed;
    internal static ConfigEntry<KeyCode> ToggleKey;
    internal static ConfigEntry<KeyCode> ResetKey;
    internal static ConfigEntry<float> OverlayX;
    internal static ConfigEntry<float> OverlayY;
    internal static ConfigEntry<float> OverlayWidth;
    internal static ConfigEntry<float> OverlayOpacity;
    internal static ConfigEntry<float> FontScale;
    internal static ConfigEntry<bool> ShareCoopPassives;
    internal static ConfigEntry<bool> Icons;
    internal static ConfigEntry<bool> LevelUpGrades;

    public override void Load()
    {
        Logger = Log;
        ConfigEntry<int> port = Config.Bind("Server", "Port", 47321,
            "Port on 127.0.0.1 where the app queries the run.");
        ConfigEntry<string> origins = Config.Bind("Server", "AllowedOrigins", "https://brombeerstrauss.github.io",
            "Websites that may read the run, separated by commas. Pages served by this PC (localhost) are always allowed.");
        ConfigEntry<int> interval = Config.Bind("Server", "IntervalMs", 500,
            "How often the run is read (milliseconds).");
        ConfigEntry<string> language = Config.Bind("Overlay", "Language", "auto",
            "Overlay language: auto (same as the game), de or en. Weapon and item names come from the game when it runs in this language.");
        OverlayVisible = Config.Bind("Overlay", "Visible", true, "Show the overlay on startup.");
        OverlayCollapsed = Config.Bind("Overlay", "Collapsed", false,
            "Only show the title bar. In the game, click the title bar to collapse or expand the overlay.");
        ToggleKey = Config.Bind("Overlay", "ToggleKey", KeyCode.F8, "Key to show and hide the overlay.");
        ResetKey = Config.Bind("Overlay", "ResetKey", KeyCode.F9, "Key to reset the overlay to its default position.");
        OverlayX = Config.Bind("Overlay", "X", 0.005f, "Left edge, fraction of the screen width (0 to 1). Saved when dragging with the mouse.");
        OverlayY = Config.Bind("Overlay", "Y", 0.11f, "Top edge, fraction of the screen height (0 to 1). Saved when dragging with the mouse.");
        OverlayWidth = Config.Bind("Overlay", "Width", 0.19f,
            "Width, fraction of the screen width. Grows by itself for long names (up to 0.26), longer names wrap.");
        OverlayOpacity = Config.Bind("Overlay", "Opacity", 0.6f, "Background opacity (0 to 1).");
        FontScale = Config.Bind("Overlay", "FontScale", 1f, "Font size (1 = default).");
        ShareCoopPassives = Config.Bind("Overlay", "ShareCoopPassives", true,
            "Co-op: other players' passive items count toward your own evolutions.");
        Icons = Config.Bind("Overlay", "Icons", true, "Show game images in the overlay (off: text abbreviations only).");
        LevelUpGrades = Config.Bind("Overlay", "LevelUpGrades", true,
            "On the level-up screen, grade the offered weapons and items from A (best fit) to D (no fit known) " +
            "for your character and your current weapons and items.");
        IntervalMs = Math.Max(100, interval.Value);

        string dataPath = Path.Combine(Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? ".", "cheatsheet-data.json");
        try
        {
            Advisor = new EvolutionAdvisor(CheatsheetData.Load(dataPath), language.Value);
        }
        catch (Exception ex)
        {
            Logger.LogError($"Overlay data is missing ({dataPath}): {ex.Message}");
        }

        Server = new StateServer(port.Value, origins.Value, Logger);
        Server.Start();

        ClassInjector.RegisterTypeInIl2Cpp<BridgeBehaviour>();
        AddComponent<BridgeBehaviour>();
        Logger.LogInfo($"{Name} {Version} running on http://127.0.0.1:{port.Value}/state, toggle overlay with {ToggleKey.Value}, " +
            "click its title bar to collapse/expand, drag it with the left mouse button");
    }

    public override bool Unload()
    {
        Server?.Stop();
        return true;
    }
}

// Unity calls Update on the main thread. The game may only be read here; the server receives
// finished JSON strings. Almost nothing runs per frame: the run is read every IntervalMs,
// the overlay (UiOverlay) is only rebuilt on changes, and Unity draws it itself.
// No OnGUI (see UiOverlay, crash in coreclr).
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

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    /// <summary>Pixels the mouse must move with the button held before the panel follows (below: a click).</summary>
    private const float DragThreshold = 5f;

    private bool _resetDown;
    private bool _mouseDown;
    private bool _pressed;
    private bool _pressOnHeader;
    private bool _dragging;
    private Vector2 _pressPos;
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

            // Only read the game's weapon data (images, stats for the level-up grades) once the
            // stage has surely finished loading.
            if (_inRun && (Plugin.Icons.Value || Plugin.LevelUpGrades.Value) && !GameSprites.Ready && now - _runStartedAt > 3000)
                GameSprites.LoadFrames();
            // With the game's data read, later evolution steps from DLCs that are not installed disappear.
            bool gameDataChanged = GameSprites.Ready != _iconsReady;
            if (gameDataChanged) { _iconsReady = GameSprites.Ready; _dirty = true; }
            if (Screen.width != _screenW || Screen.height != _screenH) { _screenW = Screen.width; _screenH = Screen.height; _dirty = true; }
            if (key != _key || gameDataChanged)
            {
                _key = key;
                _panels = Plugin.Advisor?.Build(snap, Plugin.ShareCoopPassives.Value, GameSprites.Knows);
                _dirty = true;
            }
            // If images were missing because the game is still loading the atlas: rebuild a few times later.
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
        if (_dragging) return; // rebuild after letting go, otherwise the panel jumps back
        _dirty = false;
        if (!Plugin.OverlayVisible.Value || !_inRun) { _ui.Hide(); return; }
        _ui.Show(_panels, Plugin.OverlayCollapsed.Value);
        if (_ui.MissingIcons && _iconRetries < 6) { _iconRetries++; _retryIconsAt = _clock.Elapsed.TotalMilliseconds + 5000; }
        else if (!_ui.MissingIcons) _iconRetries = 0;
    }

    // Show/hide via the keyboard, polled directly from Windows (no Unity input needed).
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

    // Mouse on the panel, read directly from Windows. Press and move: drag (the position is saved
    // to the config on release). Press and release on the title bar without moving: collapse or expand.
    private void PollDrag()
    {
        try
        {
            if (!_ui.Visible || !Application.isFocused) { _pressed = _dragging = false; return; }
            bool down = (GetAsyncKeyState(0x01) & 0x8000) != 0;
            if (!down && !_mouseDown) return;
            bool wasDown = _mouseDown;
            _mouseDown = down;
            if (!TryGetMouse(out Vector2 mouse))
            {
                if (!down) _pressed = _dragging = false;
                return;
            }
            Rect r = _ui.ScreenRect;

            if (down && !wasDown)
            {
                _pressed = r.Contains(mouse);
                _pressOnHeader = _pressed && _ui.OnHeader(mouse);
                _dragging = false;
                _pressPos = mouse;
                _dragOffset = mouse - r.position;
            }
            else if (down && _pressed)
            {
                float dx = mouse.x - _pressPos.x, dy = mouse.y - _pressPos.y;
                if (!_dragging && dx * dx + dy * dy > DragThreshold * DragThreshold) _dragging = true;
                if (_dragging)
                {
                    float x = Mathf.Clamp(mouse.x - _dragOffset.x, 0f, Mathf.Max(0f, Screen.width - r.width));
                    float y = Mathf.Clamp(mouse.y - _dragOffset.y, 0f, Mathf.Max(0f, Screen.height - r.height));
                    _ui.MoveTo(x, y);
                }
            }
            else if (!down && _pressed)
            {
                _pressed = false;
                if (_dragging)
                {
                    _dragging = false;
                    Plugin.OverlayX.Value = _ui.ScreenRect.x / Mathf.Max(1, Screen.width);
                    Plugin.OverlayY.Value = _ui.ScreenRect.y / Mathf.Max(1, Screen.height);
                }
                else if (_pressOnHeader)
                {
                    Plugin.OverlayCollapsed.Value = !Plugin.OverlayCollapsed.Value;
                    _dirty = true;
                }
                if (_dirty) Refresh();
            }
        }
        catch (Exception ex)
        {
            _pressed = _dragging = false;
            RunReader.WarnOnce("drag", ex);
        }
    }

    // Mouse position in Unity's screen pixels, origin top left like the panel.
    private static bool TryGetMouse(out Vector2 mouse)
    {
        mouse = new Vector2(0f, 0f);
        IntPtr hwnd = GameWindow();
        if (hwnd == IntPtr.Zero || !GetCursorPos(out POINT p) || !ScreenToClient(hwnd, ref p)) return false;
        float x = p.X, y = p.Y;
        // The window can be larger than the picture Unity renders (e.g. full screen with a lower
        // resolution): convert window pixels to Unity pixels.
        if (GetClientRect(hwnd, out RECT c) && c.Right > 0 && c.Bottom > 0 && (c.Right != Screen.width || c.Bottom != Screen.height))
        {
            x *= Screen.width / (float)c.Right;
            y *= Screen.height / (float)c.Bottom;
        }
        mouse = new Vector2(x, y);
        return true;
    }

    // The game window: the active window of this thread, otherwise the foreground window if it
    // belongs to the game's process.
    private static IntPtr GameWindow()
    {
        IntPtr hwnd = GetActiveWindow();
        if (hwnd != IntPtr.Zero) return hwnd;
        hwnd = GetForegroundWindow();
        if (hwnd != IntPtr.Zero && GetWindowThreadProcessId(hwnd, out uint pid) != 0 && pid == (uint)Environment.ProcessId) return hwnd;
        return IntPtr.Zero;
    }

    private static int VirtualKey(KeyCode key)
    {
        if (key >= KeyCode.F1 && key <= KeyCode.F15) return 0x70 + (key - KeyCode.F1);
        if (key >= KeyCode.A && key <= KeyCode.Z) return 0x41 + (key - KeyCode.A);
        if (key >= KeyCode.Alpha0 && key <= KeyCode.Alpha9) return 0x30 + (key - KeyCode.Alpha0);
        return 0x77; // F8
    }
}
