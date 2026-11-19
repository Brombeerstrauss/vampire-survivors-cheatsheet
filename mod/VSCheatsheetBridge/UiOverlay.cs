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
// Layout:
//   [-] Evolutions                     ::     <- title bar: click collapses/expands, drag moves
//   Level-up choices, best first              <- only while the level-up screen is open
//   [A+] [image] Hollow Heart  for Bloody Tear · recommended
//   [D] [image] Garlic
//   ------------------------------------
//   [image] Name                        5/8
//           [ingredient] [ingredient] -> [result]
//           missing: Empty Tome
// Collapsed, only the title bar remains: "[+] Evolutions  2 ready  ::".
//
// Width: the configured width, wider for long names (up to MaxAutoWidth of the screen);
// names that are still too long wrap onto a second line.
internal sealed class UiOverlay
{
    private static readonly Color Gold = new(1f, 0.84f, 0.37f);
    private static readonly Color Red = new(1f, 0.55f, 0.55f);
    private static readonly Color Green = new(0.49f, 1f, 0.6f);
    private static readonly Color Grey = new(0.6f, 0.6f, 0.6f);
    private static readonly Color Light = new(0.88f, 0.88f, 0.88f);
    private static readonly Color Blue = new(0.62f, 0.8f, 1f);
    private static readonly Color HeaderShade = new(0f, 0f, 0f, 0.35f);

    /// <summary>The panel grows up to this fraction of the screen width for long names.</summary>
    private const float MaxAutoWidth = 0.26f;

    private GameObject _root;
    private RectTransform _panel;
    private Image _background;
    private TMP_FontAsset _font;
    private TextMeshProUGUI _measure;
    private float _headerHeight;

    /// <summary>Panel position in screen pixels, origin top left (for dragging).</summary>
    public Rect ScreenRect { get; private set; }

    public bool Visible => _root != null && _root.activeSelf;

    /// <summary>Is the point (screen pixels, origin top left) on the title bar?</summary>
    public bool OnHeader(Vector2 point) => ScreenRect.Contains(point) && point.y - ScreenRect.y <= _headerHeight;

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
    public void Show(List<PlayerPanel> panels, bool collapsed)
    {
        if (panels == null || panels.Count == 0) { Hide(); return; }
        if (!EnsureRoot()) return;
        Clear();
        MissingIcons = false;
        Build(panels, collapsed);
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
        _measure = null;
    }

    // Size of a text, measured with an invisible text element in the panel (removed with the
    // next Clear). width > 0: with line breaks at that width (for the height).
    private Vector2 MeasureText(string text, float size, bool bold, float width = 0f)
    {
        if (string.IsNullOrEmpty(text)) return new Vector2(0f, 0f);
        if (_measure == null) _measure = Text(0f, 0f, 1f, 1f, "", size, new Color(0f, 0f, 0f, 0f));
        _measure.fontSize = size;
        _measure.fontStyle = bold ? FontStyles.Bold : FontStyles.Normal;
        _measure.enableWordWrapping = width > 0f;
        return _measure.GetPreferredValues(text, width > 0f ? width : 100000f, 0f);
    }

    private float Measure(string text, float size, bool bold) => MeasureText(text, size, bold).x;

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

    private void Build(List<PlayerPanel> panels, bool collapsed)
    {
        float sw = Screen.width, sh = Screen.height;
        float f = Mathf.Max(11f, sh / 62f * Plugin.FontScale.Value);
        float pad = f * 0.5f, gap = Mathf.Round(f * 0.35f);
        float icon = Mathf.Round(f * 1.8f), part = Mathf.Round(f * 1.45f);
        float lineH = f * 1.4f, small = f * 0.82f, badge = f * 0.62f;
        float levelWidth = f * 2.8f;
        float headerH = Mathf.Round(f * 1.5f);

        // Title bar. Collapsed it also says how many evolutions are ready.
        int ready = 0;
        foreach (PlayerPanel panel in panels)
            foreach (WeaponRow row in panel.Rows)
                if (row.Status == RowStatus.Ready) ready++;
        string toggle = collapsed ? "[+]" : "[-]";
        string title = Plugin.Advisor.Text("Entwicklungen", "Evolutions");
        string summary = collapsed && ready > 0 ? Plugin.Advisor.Text($"{ready} bereit", $"{ready} ready") : null;
        const string grip = "::";
        float toggleW = Measure(toggle, small, true);
        float titleW = Measure(title, small, false);
        float summaryW = Measure(summary, small, true);
        float gripW = Measure(grip, small, true);
        float headerInner = toggleW + gap + titleW + (summary != null ? gap * 2 + summaryW : 0f) + gap * 3 + gripW;

        // Width: as configured, wider for long names up to MaxAutoWidth; longer names wrap.
        var nameWidths = new Dictionary<string, float>();
        float NameWidth(string name)
        {
            name ??= "";
            if (!nameWidths.TryGetValue(name, out float w)) nameWidths[name] = w = Measure(name, f, true);
            return w;
        }
        float inner;
        if (collapsed)
        {
            inner = headerInner;
        }
        else
        {
            float baseInner = sw * Plugin.OverlayWidth.Value - 2 * pad;
            float maxInner = Mathf.Max(baseInner, sw * MaxAutoWidth - 2 * pad);
            float needed = headerInner;
            foreach (PlayerPanel panel in panels)
            {
                if (panel.Title != null) needed = Mathf.Max(needed, NameWidth(panel.Title));
                foreach (OfferRow offer in panel.Offers)
                    needed = Mathf.Max(needed, GradeWidth(f) + part + 2 * gap + NameWidth(offer.Item.Name));
                foreach (WeaponRow row in panel.Rows)
                    needed = Mathf.Max(needed, icon + 2 * gap + NameWidth(row.Weapon.Name) + levelWidth);
            }
            inner = Mathf.Clamp(needed, baseInner, maxInner);
        }
        float width = inner + 2 * pad;
        _headerHeight = headerH;

        Box(0f, 0f, width, headerH, HeaderShade);
        float hx = pad;
        Text(hx, 0f, toggleW + 4f, headerH, toggle, small, Gold, TextAlignmentOptions.MidlineLeft, bold: true);
        hx += toggleW + gap;
        Text(hx, 0f, titleW + 4f, headerH, title, small, Light, TextAlignmentOptions.MidlineLeft);
        hx += titleW + gap * 2;
        if (summary != null) Text(hx, 0f, summaryW + 4f, headerH, summary, small, Green, TextAlignmentOptions.MidlineLeft, bold: true);
        Text(width - pad - gripW - 4f, 0f, gripW + 4f, headerH, grip, small, Grey, TextAlignmentOptions.MidlineRight, bold: true);

        float x = pad, y = headerH;
        if (!collapsed)
        {
            y += pad;
            y = BuildRuns(panels, x, y, inner, f, gap, icon, part, lineH, small, badge, levelWidth, NameWidth);
            y += pad;
        }

        float height = y;
        float px = Mathf.Clamp(sw * Plugin.OverlayX.Value, 0f, Mathf.Max(0f, sw - width));
        float py = Mathf.Clamp(sh * Plugin.OverlayY.Value, 0f, Mathf.Max(0f, sh - height));
        _panel.anchoredPosition = new Vector2(px, -py);
        _panel.sizeDelta = new Vector2(width, height);
        ScreenRect = new Rect(px, py, width, height);
        _background.color = new Color(0f, 0f, 0f, Plugin.OverlayOpacity.Value);
    }

    // The players' weapons below the title bar. Returns the y below the last element.
    private float BuildRuns(List<PlayerPanel> panels, float x, float y, float inner, float f, float gap,
        float icon, float part, float lineH, float small, float badge, float levelWidth, System.Func<string, float> nameWidth)
    {
        float indent = x + icon + gap;
        float lineWidth = inner - icon - gap;
        float nameAvail = inner - icon - 2 * gap - levelWidth;

        for (int p = 0; p < panels.Count; p++)
        {
            PlayerPanel panel = panels[p];
            if (p > 0) y += gap * 2;
            if (panel.Title != null)
            {
                Text(x, y, inner, lineH, panel.Title, f, Gold, bold: true);
                y += lineH;
            }

            if (panel.Offers.Count > 0)
            {
                y = OfferRows(panel.Offers, x, y, inner, f, gap, part, lineH, small, badge, nameWidth);
                y += gap * 0.5f;
                Box(x, y, inner, 1f, new Color(1f, 1f, 1f, 0.15f));
                y += gap * 1.5f;
            }

            foreach (WeaponRow row in panel.Rows)
            {
                // Red: ingredients missing; yellow: everything there, but a condition is open (e.g. max level);
                // green: ready; white: evolved or no evolution.
                Color nameColor = row.Status switch { RowStatus.Missing => Red, RowStatus.NeedsMax => Gold, RowStatus.Ready => Green, _ => Color.white };
                string name = row.Weapon.Name ?? "";

                // Names that don't fit even in the widened panel wrap onto further lines.
                float nameW = nameWidth(name);
                bool wrap = nameW > nameAvail;
                float nameH = lineH;
                if (wrap)
                {
                    float lines = Mathf.Ceil(nameW / Mathf.Max(1f, nameAvail));
                    nameH = Mathf.Max(MeasureText(name, f, true, nameAvail).y, lines * f * 1.3f);
                }
                float rowH = Mathf.Max(icon, nameH);

                IconAt(x, y + (rowH - icon) / 2f, icon, row.Weapon, 1f, badge);
                Text(indent, y + (rowH - nameH) / 2f, nameAvail, nameH, name, f, nameColor, TextAlignmentOptions.MidlineLeft, bold: true, wrap: wrap);
                if (row.Weapon.Max > 1)
                {
                    bool max = row.Weapon.Level >= row.Weapon.Max;
                    Text(x + inner - levelWidth, y + (rowH - lineH) / 2f, levelWidth, lineH, max ? "MAX" : $"{row.Weapon.Level}/{row.Weapon.Max}", small,
                        max || row.Weapon.NeedsMax ? Gold : Grey, TextAlignmentOptions.MidlineRight);
                }
                y += rowH + gap * 0.5f;

                if (row.Result != null)
                {
                    EvolutionLine(indent, y, part, gap, f, badge, row.Parts, row.Result, row.Status == RowStatus.Ready, 0.85f);
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

                // What the evolved weapon can become next (e.g. a union with it), faded as an outlook.
                foreach (EvolutionStep step in row.Next)
                {
                    string label = Plugin.Advisor.Text("danach:", "then:");
                    TextMeshProUGUI t = Text(indent, y, lineWidth, part, label, small, Grey, TextAlignmentOptions.MidlineLeft);
                    float lx = indent + t.GetPreferredValues(label, lineWidth, 0f).x + gap * 2;
                    float stepWidth = step.Parts.Count * (part + gap) + (step.Parts.Count > 0 ? f * 1.4f : 0f) + part;
                    if (lx + stepWidth > indent + lineWidth) { lx = indent + gap * 2; y += part + gap * 0.5f; }
                    EvolutionLine(lx, y, part, gap, f, badge, step.Parts, step.Result, false, 0.7f);
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

            // A "missing:" line with all of this player's missing ingredients (next evolution only).
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
        return y;
    }

    // Wide enough for "A+".
    private static float GradeWidth(float f) => Mathf.Round(f * 1.8f);

    // A+ and A green (A+ on a stronger background), B yellow, C blue, D and ? grey.
    private static Color GradeColor(string grade) => string.IsNullOrEmpty(grade) ? Grey
        : grade[0] switch { 'A' => Green, 'B' => Gold, 'C' => Blue, _ => Grey };

    // The choices on the level-up screen with their grades, best first. The reason follows the
    // name, or goes on the next line if it doesn't fit.
    private float OfferRows(List<OfferRow> offers, float x, float y, float inner, float f, float gap, float part,
        float lineH, float small, float badge, System.Func<string, float> nameWidth)
    {
        Text(x, y, inner, lineH, Plugin.Advisor.Text("Level-Up-Auswahl, beste zuerst", "Level-up choices, best first"), small, Gold, TextAlignmentOptions.MidlineLeft);
        y += lineH;
        float gradeW = GradeWidth(f);
        float nameX = x + gradeW + gap + part + gap;
        float nameAvail = Mathf.Max(1f, x + inner - nameX);

        foreach (OfferRow offer in offers)
        {
            string name = offer.Item.Name ?? "";
            float nameW = nameWidth(name);
            bool wrap = nameW > nameAvail;
            float nameH = wrap ? Mathf.Max(MeasureText(name, f, true, nameAvail).y, lineH) : lineH;
            float rowH = Mathf.Max(part, nameH);

            Color color = GradeColor(offer.Grade);
            float gy = y + (rowH - gradeW) / 2f;
            bool top = offer.Grade == "A+";
            Box(x, gy, gradeW, gradeW, new Color(color.r, color.g, color.b, top ? 0.45f : 0.2f));
            Text(x, gy, gradeW, gradeW, offer.Grade, top ? f * 0.9f : f, top ? Color.white : color, TextAlignmentOptions.Center, bold: true);
            IconAt(x + gradeW + gap, y + (rowH - part) / 2f, part, offer.Item, 1f, badge);
            Text(nameX, y + (rowH - nameH) / 2f, nameAvail, nameH, name, f, Light, TextAlignmentOptions.MidlineLeft, bold: true, wrap: wrap);

            if (offer.Reason != null)
            {
                float reasonW = Measure(offer.Reason, small, false);
                float rx = nameX + Mathf.Min(nameW, nameAvail) + gap * 2;
                if (!wrap && rx + reasonW <= x + inner)
                {
                    Text(rx, y + (rowH - lineH) / 2f, reasonW + 4f, lineH, offer.Reason, small, Grey, TextAlignmentOptions.MidlineLeft);
                }
                else
                {
                    y += rowH;
                    rowH = Mathf.Max(MeasureText(offer.Reason, small, false, nameAvail).y, small * 1.3f);
                    Text(nameX, y, nameAvail, rowH, offer.Reason, small, Grey, TextAlignmentOptions.MidlineLeft, wrap: true);
                }
            }
            y += rowH + gap * 0.5f;
        }
        return y;
    }

    // [ingredient] [ingredient] -> [result]; missing ingredients faded.
    private void EvolutionLine(float cx, float y, float part, float gap, float f, float badge, List<Icon> parts, Icon result, bool ready, float resultAlpha)
    {
        foreach (Icon ing in parts)
        {
            IconAt(cx, y, part, ing, ing.Owned ? 1f : 0.3f, badge);
            cx += part + gap;
        }
        if (parts.Count > 0)
        {
            Text(cx - gap * 0.5f, y, f * 1.6f, part, "->", f, Gold, TextAlignmentOptions.Midline, bold: true);
            cx += f * 1.4f;
        }
        if (ready) Box(cx - 2f, y - 2f, part + 4f, part + 4f, new Color(Green.r, Green.g, Green.b, 0.45f));
        IconAt(cx, y, part, result, ready ? 1f : resultAlpha, badge);
    }

    private static string Initials(string name)
    {
        if (string.IsNullOrEmpty(name)) return "?";
        string[] words = name.Split(' ');
        return words.Length > 1 ? $"{words[0][0]}{words[1][0]}" : name.Substring(0, System.Math.Min(2, name.Length));
    }
}
