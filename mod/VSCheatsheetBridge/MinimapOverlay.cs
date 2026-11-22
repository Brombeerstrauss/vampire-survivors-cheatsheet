using System.Collections.Generic;
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

    public void Hide()
    {
        if (_root != null) _root.SetActive(false);
    }

    /// <summary>Draws the points around the player. halfScreen: half a screen width in world units.</summary>
    public void Show(Vector2 player, float halfScreen, List<MapPoint> points)
    {
        EnsureRoot();
        float size = Mathf.Round(Screen.height * Mathf.Clamp(Plugin.MinimapSize.Value, 0.08f, 0.6f));
        Vector2 pos = _dragPos ?? new Vector2(Screen.width * Plugin.MinimapX.Value, Screen.height * Plugin.MinimapY.Value);
        float x = Mathf.Clamp(pos.x, 0f, Mathf.Max(0f, Screen.width - size));
        float y = Mathf.Clamp(pos.y, 0f, Mathf.Max(0f, Screen.height - size));
        _panel.anchoredPosition = new Vector2(x, -y);
        _panel.sizeDelta = new Vector2(size, size);
        ScreenRect = new Rect(x, y, size, size);
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
