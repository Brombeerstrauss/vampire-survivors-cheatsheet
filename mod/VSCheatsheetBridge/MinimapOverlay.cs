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
// While the game is paused, a bar of four buttons sits below the map (setting Minimap.Buttons):
//   [Gegner: alle]  [x] Truhen
//   [x] Relikte/Items  [x] Kleinkram
// A click switches what the map shows (Plugin.ClickMinimapButton).
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

    private const int ButtonCount = 4;
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

    /// <summary>
    /// Draws the points around the player. halfScreen: half a screen width in world units.
    /// buttons: show the bar below the map.
    /// </summary>
    public void Show(Vector2 player, float halfScreen, List<MapPoint> points, bool buttons)
    {
        EnsureRoot();
        float size = Mathf.Round(Screen.height * Mathf.Clamp(Plugin.MinimapSize.Value, 0.08f, 0.6f));
        bool bar = buttons && EnsureButtons();
        float rowH = Mathf.Max(14f, Mathf.Round(size * 0.1f)), pad = 2f;
        float height = size + (bar ? pad + 2f * (rowH + pad) : 0f);

        Vector2 pos = _dragPos ?? new Vector2(Screen.width * Plugin.MinimapX.Value, Screen.height * Plugin.MinimapY.Value);
        float x = Mathf.Clamp(pos.x, 0f, Mathf.Max(0f, Screen.width - size));
        float y = Mathf.Clamp(pos.y, 0f, Mathf.Max(0f, Screen.height - height));
        _panel.anchoredPosition = new Vector2(x, -y);
        _panel.sizeDelta = new Vector2(size, height);
        ScreenRect = new Rect(x, y, size, height);
        if (bar) LayoutButtons(size, rowH, pad);
        for (int b = 0; b < ButtonCount; b++)
            if (_buttons[b] != null) _buttons[b].gameObject.SetActive(bar);
        _buttonsShown = bar;
        _background.color = new Color(0f, 0f, 0f, Plugin.MinimapOpacity.Value);

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

    // Two rows of two buttons below the map. Labels and states from the settings.
    private void LayoutButtons(float size, float rowH, float pad)
    {
        float w = (size - 3f * pad) / 2f;
        for (int b = 0; b < ButtonCount; b++)
        {
            float bx = pad + (b % 2) * (w + pad);
            float by = size + pad + (b / 2) * (rowH + pad);
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
        switch (button)
        {
            case 0:
                string mode = Plugin.EnemyMode();
                on = mode != "off";
                return mode == "all" ? T("Gegner: alle", "Enemies: all")
                    : mode == "bosses" ? T("Gegner: Bosse", "Enemies: bosses")
                    : T("Gegner: aus", "Enemies: off");
            case 1:
                on = Plugin.MinimapChests.Value;
                return Box(on) + T("Truhen", "Chests");
            case 2:
                on = Plugin.MinimapRelics.Value;
                return Box(on) + T("Relikte/Items", "Relics/items");
            default:
                on = Plugin.MinimapMinor.Value;
                return Box(on) + T("Kleinkram", "Small pickups");
        }
    }

    // The buttons need the game's font (from UiOverlay); until it is there, no bar.
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
        _background = panelGo.AddComponent<Image>();
        _background.raycastTarget = false;

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
