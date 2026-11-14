using System.Collections.Generic;
using Il2CppInterop.Runtime;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace VSCheatsheetBridge;

// The overlay built from regular Unity UI elements (Canvas, Image, TextMeshPro).
//
// Why not OnGUI: IMGUI calls plugin code every frame. Under BepInEx be.788 with Unity 6 the
// game reproducibly crashed in coreclr.dll after a few seconds (during the .NET garbage
// collector's stack walk through the Il2Cpp transitions). Here the plugin only rebuilds the
// elements when the run changes; Unity draws them itself, without plugin code per frame.
// Other stable mods for this game do it the same way.
//
// Layout per weapon:
//   [image] Name                        5/8
//           [ingredient] [ingredient] -> [result]
//           missing: Empty Tome
internal sealed class UiOverlay
{
    private static readonly Color Gold = new(1f, 0.84f, 0.37f);
    private static readonly Color Red = new(1f, 0.55f, 0.55f);
    private static readonly Color Green = new(0.49f, 1f, 0.6f);
    private static readonly Color Grey = new(0.6f, 0.6f, 0.6f);
    private static readonly Color Blue = new(0.62f, 0.8f, 1f);

    private GameObject _root;
    private RectTransform _panel;
    private Image _background;
    private TMP_FontAsset _font;

    /// <summary>Panel position in screen pixels, origin top left (for dragging).</summary>
    public Rect ScreenRect { get; private set; }

    public bool Visible => _root != null && _root.activeSelf;

    /// <summary>Moves the panel without rebuilding (top left corner in pixels, from top left).</summary>
    public void MoveTo(float x, float y)
    {
        if (_panel == null) return;
        _panel.anchoredPosition = new Vector2(x, -y);
        ScreenRect = new Rect(x, y, ScreenRect.width, ScreenRect.height);
    }

    /// <summary>Images were missing in the last build (atlas not loaded yet).</summary>
    public bool MissingIcons { get; private set; }

    public void Hide()
    {
        if (_root != null) _root.SetActive(false);
    }

    /// <summary>Rebuilds the overlay for the current run. Only call on changes.</summary>
    public void Show(List<PlayerPanel> panels)
    {
        if (panels == null || panels.Count == 0) { Hide(); return; }
        if (!EnsureRoot()) return;
        Clear();
        MissingIcons = false;
        Build(panels);
        _root.SetActive(true);
    }

    private bool EnsureRoot()
    {
        if (_font == null) _font = FindFont();
        if (_font == null)
        {
            RunReader.WarnOnce("font", new System.InvalidOperationException("no TextMeshPro font found in the game, overlay will follow on the next attempt"));
            return false;
        }
        if (_root != null) return true;

        _root = new GameObject("CheatsheetOverlay");
        Object.DontDestroyOnLoad(_root);
        var canvas = _root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting = true;
        canvas.sortingOrder = short.MaxValue; // above the HUD and the game's dark side borders

        var panelGo = new GameObject("Panel");
        panelGo.transform.SetParent(_root.transform, false);
        _panel = panelGo.AddComponent<RectTransform>();
        _panel.anchorMin = _panel.anchorMax = _panel.pivot = new Vector2(0f, 1f);
        _background = panelGo.AddComponent<Image>();
        _background.raycastTarget = false;
        return true;
    }

    // Font from a text the game is currently showing.
    private static TMP_FontAsset FindFont()
    {
        var found = Object.FindObjectsOfType(Il2CppType.Of<TextMeshProUGUI>());
        if (found == null) return null;
        foreach (Object o in found)
        {
            var tmp = o.TryCast<TextMeshProUGUI>();
            if (tmp != null && tmp.font != null) return tmp.font;
        }
        return null;
    }

    private void Clear()
    {
        for (int i = _panel.childCount - 1; i >= 0; i--)
            Object.Destroy(_panel.GetChild(i).gameObject);
    }

    // ---- Elements ------------------------------------------------------------------------

    private RectTransform Place(string name, float x, float y, float w, float h)
    {
        var go = new GameObject(name);
        go.transform.SetParent(_panel, false);
        var rt = go.AddComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = new Vector2(x, -y);
        rt.sizeDelta = new Vector2(w, h);
        return rt;
    }

    private TextMeshProUGUI Text(float x, float y, float w, float h, string text, float size, Color color,
        TextAlignmentOptions align = TextAlignmentOptions.Left, bool bold = false, bool wrap = false)
    {
        var rt = Place("Text", x, y, w, h);
        var t = rt.gameObject.AddComponent<TextMeshProUGUI>();
        t.font = _font;
        t.fontSize = size;
        t.color = color;
        t.alignment = align;
        t.enableWordWrapping = wrap;
        // Overflow instead of Ellipsis: Ellipsis hides text that does not fit vertically, and the
        // game's pixel font is taller than the font size. The width limits long names.
        t.overflowMode = TextOverflowModes.Overflow;
        t.raycastTarget = false;
        t.richText = false;
        if (bold) t.fontStyle = FontStyles.Bold;
        t.text = text;
        return t;
    }

    private void Box(float x, float y, float w, float h, Color color)
    {
        var img = Place("Box", x, y, w, h).gameObject.AddComponent<Image>();
        img.color = color;
        img.raycastTarget = false;
    }

    // showTarget: level as "current/required" (for the "Needed to evolve" line).
    private void IconAt(float x, float y, float size, Icon icon, float alpha, float badge, bool showTarget = false)
    {
        Sprite sprite = Plugin.Icons.Value ? GameSprites.Get(icon.GameId) : null;
        if (sprite != null)
        {
            var img = Place("Icon", x, y, size, size).gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.preserveAspect = true;
            img.color = new Color(1f, 1f, 1f, alpha);
            img.raycastTarget = false;
        }
        else
        {
            if (Plugin.Icons.Value && icon.GameId != null) MissingIcons = true;
            // No image: abbreviation in a box.
            Box(x, y, size, size, new Color(1f, 1f, 1f, 0.12f * alpha));
            Text(x, y, size, size, Initials(icon.Name), badge, new Color(1f, 1f, 1f, alpha), TextAlignmentOptions.Center, bold: true);
        }

        if (showTarget)
        {
            Text(x - size * 0.3f, y + size * 0.5f, size * 1.3f + 2f, size * 0.55f, $"{icon.Level}/{icon.Max}", badge,
                Gold, TextAlignmentOptions.BottomRight, bold: true);
        }
        else if (icon.Owned && icon.Max > 1 && icon.Level > 0)
        {
            bool max = icon.Level >= icon.Max;
            Text(x, y + size * 0.5f, size + 2f, size * 0.55f, max ? "M" : icon.Level.ToString(), badge,
                max || icon.NeedsMax ? Gold : Color.white, TextAlignmentOptions.BottomRight, bold: true);
        }
        if (icon.From != null)
            Text(x - 2f, y - 3f, size, size * 0.5f, icon.From, badge, Blue, TextAlignmentOptions.TopLeft, bold: true);
    }

    // ---- Layout --------------------------------------------------------------------------

    private void Build(List<PlayerPanel> panels)
    {
        float sw = Screen.width, sh = Screen.height;
        float f = Mathf.Max(11f, sh / 62f * Plugin.FontScale.Value);
        float width = sw * Plugin.OverlayWidth.Value;
        float pad = f * 0.5f, gap = Mathf.Round(f * 0.35f);
        float icon = Mathf.Round(f * 1.8f), part = Mathf.Round(f * 1.45f);
        float lineH = f * 1.4f, small = f * 0.82f, badge = f * 0.62f;
        float inner = width - 2 * pad;
        float x = pad, y = pad;

        for (int p = 0; p < panels.Count; p++)
        {
            PlayerPanel panel = panels[p];
            if (p > 0) y += gap * 2;
            if (panel.Title != null)
            {
                Text(x, y, inner, lineH, panel.Title, f, Gold, bold: true);
                y += lineH;
            }

            foreach (WeaponRow row in panel.Rows)
            {
                // Red: ingredients missing; yellow: everything there, but a condition is open (e.g. max level);
                // green: ready; white: evolved or no evolution.
                Color nameColor = row.Status switch { RowStatus.Missing => Red, RowStatus.NeedsMax => Gold, RowStatus.Ready => Green, _ => Color.white };
                float levelWidth = f * 2.8f;
                float textY = y + (icon - lineH) / 2f;
                IconAt(x, y, icon, row.Weapon, 1f, badge);
                Text(x + icon + gap, textY, inner - icon - gap - levelWidth, lineH, row.Weapon.Name, f, nameColor, TextAlignmentOptions.MidlineLeft, bold: true);
                if (row.Weapon.Max > 1)
                {
                    bool max = row.Weapon.Level >= row.Weapon.Max;
                    Text(x + inner - levelWidth, textY, levelWidth, lineH, max ? "MAX" : $"{row.Weapon.Level}/{row.Weapon.Max}", small,
                        max || row.Weapon.NeedsMax ? Gold : Grey, TextAlignmentOptions.MidlineRight);
                }
                y += icon + gap * 0.5f;

                float indent = x + icon + gap;
                float lineWidth = inner - icon - gap;

                if (row.Result != null)
                {
                    float cx = indent;
                    foreach (Icon ing in row.Parts)
                    {
                        IconAt(cx, y, part, ing, ing.Owned ? 1f : 0.3f, badge);
                        cx += part + gap;
                    }
                    if (row.Parts.Count > 0)
                    {
                        Text(cx - gap * 0.5f, y, f * 1.6f, part, "->", f, Gold, TextAlignmentOptions.Midline, bold: true);
                        cx += f * 1.4f;
                    }
                    bool ready = row.Status == RowStatus.Ready;
                    if (ready) Box(cx - 2f, y - 2f, part + 4f, part + 4f, new Color(Green.r, Green.g, Green.b, 0.45f));
                    IconAt(cx, y, part, row.Result, ready ? 1f : 0.85f, badge);
                    y += part + gap * 0.5f;
                }

                if (row.Status == RowStatus.NeedsMax)
                {
                    // Only what is still missing for the evolution: image with "current/required".
                    var needed = new List<Icon>();
                    if (row.Weapon.NeedsMax) needed.Add(row.Weapon);
                    foreach (Icon ing in row.Parts) if (ing.NeedsMax) needed.Add(ing);
                    string label = Plugin.Advisor.Text("Für Entwicklung:", "Needed to evolve:");
                    TextMeshProUGUI t = Text(indent, y, lineWidth, part, label, small, Gold, TextAlignmentOptions.MidlineLeft);
                    float cx = indent + t.GetPreferredValues(label, lineWidth, 0f).x + gap * 2;
                    foreach (Icon ing in needed)
                    {
                        if (cx + part * 1.4f > indent + lineWidth) { cx = indent; y += part + gap * 0.5f; }
                        IconAt(cx, y, part, ing, 1f, badge, showTarget: true);
                        cx += part * 1.4f + gap;
                    }
                    y += part + gap * 0.5f;
                }
                y += gap;
            }

            if (panel.Passives.Count > 0)
            {
                y += gap * 0.5f;
                Box(x, y, inner, 1f, new Color(1f, 1f, 1f, 0.15f));
                y += gap;
                float cx = x;
                foreach (Icon passive in panel.Passives)
                {
                    if (cx + part > x + inner) { cx = x; y += part + gap; }
                    IconAt(cx, y, part, passive, 1f, badge);
                    cx += part + gap;
                }
                y += part;
            }

            // A "missing:" line with all of this player's missing ingredients.
            var missingIcons = new List<Icon>();
            var seen = new HashSet<string>();
            foreach (WeaponRow row in panel.Rows)
                foreach (Icon ing in row.Parts)
                    if (!ing.Owned && seen.Add(ing.Id)) missingIcons.Add(ing);
            if (missingIcons.Count > 0)
            {
                y += gap;
                string label = Plugin.Advisor.Text("fehlt:", "missing:");
                TextMeshProUGUI t = Text(x, y, inner, part, label, small, Red, TextAlignmentOptions.MidlineLeft);
                float start = x + t.GetPreferredValues(label, inner, 0f).x + gap * 2;
                float cx = start;
                foreach (Icon ing in missingIcons)
                {
                    if (cx + part > x + inner) { cx = start; y += part + gap; }
                    IconAt(cx, y, part, ing, 1f, badge);
                    cx += part + gap;
                }
                y += part;
            }
        }

        float px = Mathf.Clamp(sw * Plugin.OverlayX.Value, 0f, Mathf.Max(0f, sw - width));
        float py = Mathf.Clamp(sh * Plugin.OverlayY.Value, 0f, Mathf.Max(0f, sh - (y + pad)));
        _panel.anchoredPosition = new Vector2(px, -py);
        _panel.sizeDelta = new Vector2(width, y + pad);
        ScreenRect = new Rect(px, py, width, y + pad);
        _background.color = new Color(0f, 0f, 0f, Plugin.OverlayOpacity.Value);
    }

    private static string Initials(string name)
    {
        if (string.IsNullOrEmpty(name)) return "?";
        string[] words = name.Split(' ');
        return words.Length > 1 ? $"{words[0][0]}{words[1][0]}" : name.Substring(0, System.Math.Min(2, name.Length));
    }
}
