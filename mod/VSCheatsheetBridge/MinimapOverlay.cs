using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace VSCheatsheetBridge;

// A small map in a corner of the screen: the player in the middle, around it the points of
// interest from MinimapReader (stage items, relics, chests, ...) with their own sprites from
// the world, enemies as small red dots and bosses with their own sprite. A faint frame marks
// the visible screen. Items and bosses beyond the range sit at the edge, smaller and faded, so
// their direction stays visible. No walls or paths: the game's own pause map doesn't have them
// either. Can be dragged with the mouse like the overlay (Plugin.PollDrag).
//
// F7 opens a menu below the map (Plugin.MenuKey); a click on a button (Plugin.ClickMinimapButton):
//   [Gegner: alle]        [x] Truhen
//   [x] Relikte/Items     [x] Kleinkram
//   [Größe -]             [Größe +]
//   [Reichweite -]        [Reichweite +]
//   [Position zurücksetzen          ]
//
// Same building blocks as UiOverlay (Canvas, Image), no OnGUI. The icons are pooled and only
// moved, a few times per second from Update (Plugin.MinimapIntervalMs).
internal sealed class MinimapOverlay
{
    private static readonly Color Chest = new(1f, 0.84f, 0.37f);
    private static readonly Color Relic = new(0.78f, 0.6f, 1f);
    private static readonly Color Other = new(0.62f, 0.8f, 1f);
    private static readonly Color Enemy = new(1f, 0.32f, 0.3f);

    private GameObject _root;
    private RectTransform _panel;
    private Image _background;
    private Image _player;
    private readonly Image[] _frame = new Image[4];
    private readonly List<Image> _icons = new();
    private Vector2? _dragPos;

    /// <summary>Menu buttons, in the order of ButtonLabel.</summary>
    public const int Enemies = 0, Chests = 1, Relics = 2, Minor = 3, Smaller = 4, Larger = 5,
        Closer = 6, Further = 7, ResetPosition = 8;
    private const int ButtonCount = 9, MenuRows = 5;
    private static readonly float[] Sizes = { 0.12f, 0.16f, 0.2f, 0.24f, 0.28f, 0.32f, 0.36f, 0.4f, 0.45f, 0.5f };
    private static readonly float[] Ranges = { 2f, 3f, 4f, 6f, 8f, 12f };
    private Image _menuBackground;
    private readonly Image[] _buttons = new Image[ButtonCount];
    private readonly TextMeshProUGUI[] _labels = new TextMeshProUGUI[ButtonCount];
    private readonly Rect[] _buttonRects = new Rect[ButtonCount]; // from the panel's top left
    private bool _buttonsShown;
    private TMP_FontAsset _font;
    private int _fontWait;

    public bool Visible => _root != null && _root.activeSelf;

    /// <summary>Where the map is, in screen pixels from the top left.</summary>
    public Rect ScreenRect { get; private set; }

    /// <summary>World units from the player to the map's edge.</summary>
    public static float RangeFor(float halfScreen) => Mathf.Max(1f, halfScreen * Mathf.Max(1f, Plugin.MinimapRange.Value));

    /// <summary>While dragging: moves the map (top left corner in pixels, from top left).</summary>
    public void MoveTo(float x, float y)
    {
        if (_panel == null) return;
        _dragPos = new Vector2(x, y);
        _panel.anchoredPosition = new Vector2(x, -y);
        ScreenRect = new Rect(x, y, ScreenRect.width, ScreenRect.height);
    }

    /// <summary>After dragging: the position comes from the config again.</summary>
    public void EndDrag() => _dragPos = null;

    /// <summary>The button under the point (screen pixels from the top left), or -1.</summary>
    public int ButtonAt(Vector2 point)
    {
        if (!_buttonsShown || !Visible) return -1;
        Vector2 local = point - ScreenRect.position;
        for (int i = 0; i < ButtonCount; i++)
            if (_buttonRects[i].Contains(local)) return i;
        return -1;
    }

    public void Hide()
    {
        if (_root != null) _root.SetActive(false);
    }

    /// <summary>Setting Minimap.Size one step smaller (-1) or larger (+1), from 0.12 to 0.5.</summary>
    public static float NextSize(float size, int step) => NextStep(Sizes, size, step);

    /// <summary>Setting Minimap.Range one step closer (-1) or further (+1): 2, 3, 4, 6, 8, 12.</summary>
    public static float NextRange(float range, int step) => NextStep(Ranges, range, step);

    // The next value in the list above or below the current one (which need not be in the list).
    private static float NextStep(float[] steps, float current, int step)
    {
        if (step > 0) { foreach (float v in steps) if (v > current + 0.001f) return v; return steps[^1]; }
        for (int i = steps.Length - 1; i >= 0; i--) if (steps[i] < current - 0.001f) return steps[i];
        return steps[0];
    }

    /// <summary>
    /// Draws the points around the player. halfScreen: half a screen width in world units.
    /// menu: show the menu below the map.
    /// </summary>
    public void Show(Vector2 player, float halfScreen, List<MapPoint> points, bool menu)
    {
        EnsureRoot();
        float size = Mathf.Round(Screen.height * Mathf.Clamp(Plugin.MinimapSize.Value, 0.08f, 0.6f));
        menu = menu && EnsureButtons();
        // The menu's size follows the screen, not the map, so it stays readable on a small map.
        float rowH = Mathf.Max(14f, Mathf.Round(Screen.height * 0.026f)), pad = 2f;
        float width = menu ? Mathf.Max(size, Mathf.Round(Screen.height * 0.24f)) : size;
        float height = size + (menu ? pad + MenuRows * (rowH + pad) : 0f);

        Vector2 pos = _dragPos ?? new Vector2(Screen.width * Plugin.MinimapX.Value, Screen.height * Plugin.MinimapY.Value);
        float x = Mathf.Clamp(pos.x, 0f, Mathf.Max(0f, Screen.width - width));
        float y = Mathf.Clamp(pos.y, 0f, Mathf.Max(0f, Screen.height - height));
        _panel.anchoredPosition = new Vector2(x, -y);
        _panel.sizeDelta = new Vector2(width, height);
        ScreenRect = new Rect(x, y, width, height);
        Place(_background, 0f, 0f, size, size, new Color(0f, 0f, 0f, Plugin.MinimapOpacity.Value));
        if (menu)
        {
            Place(_menuBackground, 0f, size, width, height - size, new Color(0f, 0f, 0f, Mathf.Max(0.75f, Plugin.MinimapOpacity.Value)));
            LayoutButtons(width, size, rowH, pad);
        }
        _menuBackground.gameObject.SetActive(menu);
        for (int b = 0; b < ButtonCount; b++)
            if (_buttons[b] != null) _buttons[b].gameObject.SetActive(menu);
        _buttonsShown = menu;

        // World units from the middle to the edge: a number of half screen widths.
        float range = RangeFor(halfScreen);
        float half = size / 2f;
        float icon = Mathf.Max(6f, Mathf.Round(size * 0.08f));

        // The visible screen, as a faint frame around the player.
        float fw = Mathf.Min(half, halfScreen / range * half);
        float fh = Mathf.Min(half, halfScreen * Screen.height / Mathf.Max(1f, Screen.width) / range * half);
        var frameColor = new Color(1f, 1f, 1f, 0.18f);
        Place(_frame[0], half - fw, half - fh, fw * 2f, 1f, frameColor);
        Place(_frame[1], half - fw, half + fh, fw * 2f, 1f, frameColor);
        Place(_frame[2], half - fw, half - fh, 1f, fh * 2f, frameColor);
        Place(_frame[3], half + fw, half - fh, 1f, fh * 2f, frameColor);

        float dot = Mathf.Max(2f, Mathf.Round(icon * 0.3f));
        float bossIcon = Mathf.Round(icon * 1.4f);

        // In list order: enemies first, so items and bosses are drawn on top of them.
        int i = 0;
        foreach (MapPoint p in points)
        {
            Vector2 rel = (p.Position - player) / range; // -1 to 1 inside the map
            float m = Mathf.Max(Mathf.Abs(rel.x), Mathf.Abs(rel.y));
            bool outside = m > 1f;
            if (outside && p.Style == MapPointStyle.Enemy) continue; // a red rim would hide the edge
            if (outside) rel /= m;
            float full = p.Style == MapPointStyle.Enemy ? dot : p.Style == MapPointStyle.Boss ? bossIcon : icon;
            float s = outside ? full * 0.7f : full;
            float cx = half + rel.x * (half - s / 2f);
            float cy = half - rel.y * (half - s / 2f); // world up = screen up
            Image img = Icon(i++);
            img.sprite = p.Style == MapPointStyle.Enemy ? null : p.Sprite;
            Color color = img.sprite != null ? Color.white : KindColor(p);
            color.a = outside ? 0.55f : p.Style == MapPointStyle.Enemy ? 0.8f : 1f;
            Place(img, cx - s / 2f, cy - s / 2f, s, s, color);
            img.gameObject.SetActive(true);
        }
        for (; i < _icons.Count; i++) _icons[i].gameObject.SetActive(false);

        // The player last, so it is drawn on top.
        float ps = Mathf.Max(5f, Mathf.Round(icon * 0.6f));
        Place(_player, half - ps / 2f, half - ps / 2f, ps, ps, Color.white);
        _player.transform.SetAsLastSibling();
        _root.SetActive(true);
    }

    // Two buttons per row below the map, the last one over the whole width. Labels and states
    // from the settings.
    private void LayoutButtons(float width, float top, float rowH, float pad)
    {
        float half = (width - 3f * pad) / 2f;
        for (int b = 0; b < ButtonCount; b++)
        {
            bool full = b == ResetPosition;
            float w = full ? width - 2f * pad : half;
            float bx = pad + (full ? 0f : (b % 2) * (half + pad));
            float by = top + pad + (b / 2) * (rowH + pad);
            _buttonRects[b] = new Rect(bx, by, w, rowH);
            string label = ButtonLabel(b, out bool on);
            Place(_buttons[b], bx, by, w, rowH, on ? new Color(1f, 1f, 1f, 0.16f) : new Color(0f, 0f, 0f, 0.4f));
            TextMeshProUGUI t = _labels[b];
            var rt = t.rectTransform;
            rt.anchoredPosition = new Vector2(2f, 0f);
            rt.sizeDelta = new Vector2(w - 4f, rowH);
            t.fontSizeMax = Mathf.Round(rowH * 0.62f);
            t.color = on ? new Color(0.92f, 0.92f, 0.92f) : new Color(0.55f, 0.55f, 0.55f);
            if (t.text != label) t.text = label;
        }
    }

    private static string ButtonLabel(int button, out bool on)
    {
        string T(string de, string en) => Plugin.Advisor != null ? Plugin.Advisor.Text(de, en) : en;
        string Box(bool v) => v ? "[x] " : "[ ] ";
        on = true; // the buttons that do something rather than switch look "on"
        switch (button)
        {
            case Enemies:
                string mode = Plugin.EnemyMode();
                on = mode != "off";
                return mode == "all" ? T("Gegner: alle", "Enemies: all")
                    : mode == "bosses" ? T("Gegner: Bosse", "Enemies: bosses")
                    : T("Gegner: aus", "Enemies: off");
            case Chests:
                on = Plugin.MinimapChests.Value;
                return Box(on) + T("Truhen", "Chests");
            case Relics:
                on = Plugin.MinimapRelics.Value;
                return Box(on) + T("Relikte/Items", "Relics/items");
            case Minor:
                on = Plugin.MinimapMinor.Value;
                return Box(on) + T("Kleinkram", "Small pickups");
            case Smaller: return T("Größe -", "Size -");
            case Larger: return T("Größe +", "Size +");
            case Closer: return T("Reichweite -", "Range -");
            case Further: return T("Reichweite +", "Range +");
            default: return T("Position zurücksetzen", "Reset position");
        }
    }

    // The buttons need the game's font (from UiOverlay); until it is there, no menu.
    private bool EnsureButtons()
    {
        if (_labels[0] != null) return true;
        if (_font == null)
        {
            if (_fontWait-- > 0) return false;
            _font = UiOverlay.FindFont();
            if (_font == null) { _fontWait = 10; return false; }
        }
        for (int b = 0; b < ButtonCount; b++)
        {
            _buttons[b] = NewImage("Button");
            var go = new GameObject("Label");
            go.transform.SetParent(_buttons[b].transform, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            var t = go.AddComponent<TextMeshProUGUI>();
            t.font = _font;
            t.alignment = TextAlignmentOptions.Center;
            t.enableWordWrapping = false;
            t.enableAutoSizing = true; // long labels shrink to fit the button
            t.fontSizeMin = 6f;
            t.overflowMode = TextOverflowModes.Overflow;
            t.raycastTarget = false;
            t.richText = false;
            _labels[b] = t;
        }
        return true;
    }

    private static Color KindColor(MapPoint p)
    {
        if (p.Style != MapPointStyle.Item) return Enemy;
        string kind = p.Kind ?? "";
        return kind == "CHEST" || kind.Contains("TREASURE") ? Chest
            : kind.Contains("RELIC") ? Relic
            : Other;
    }

    private void EnsureRoot()
    {
        if (_root != null) return;
        _root = new GameObject("CheatsheetMinimap");
        Object.DontDestroyOnLoad(_root);
        var canvas = _root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting = true;
        canvas.sortingOrder = short.MaxValue - 1; // below the main overlay

        var panelGo = new GameObject("Panel");
        panelGo.transform.SetParent(_root.transform, false);
        _panel = panelGo.AddComponent<RectTransform>();
        _panel.anchorMin = _panel.anchorMax = _panel.pivot = new Vector2(0f, 1f);
        _background = NewImage("Background");
        _menuBackground = NewImage("MenuBackground");

        for (int i = 0; i < _frame.Length; i++) _frame[i] = NewImage("Frame");
        _player = NewImage("Player");
    }

    private Image Icon(int index)
    {
        while (_icons.Count <= index)
        {
            Image img = NewImage("Point");
            img.preserveAspect = true;
            _icons.Add(img);
        }
        return _icons[index];
    }

    private Image NewImage(string name)
    {
        var go = new GameObject(name);
        go.transform.SetParent(_panel, false);
        var rt = go.AddComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
        var img = go.AddComponent<Image>();
        img.raycastTarget = false;
        return img;
    }

    // Position from the panel's top left corner, in pixels.
    private static void Place(Image img, float x, float y, float w, float h, Color color)
    {
        var rt = img.rectTransform;
        rt.anchoredPosition = new Vector2(x, -y);
        rt.sizeDelta = new Vector2(w, h);
        img.color = color;
    }
}
