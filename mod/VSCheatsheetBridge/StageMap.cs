using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using UnityEngine;
using UnityEngine.UI;

namespace VSCheatsheetBridge;

/// <summary>
/// Where a point of the world lies on a stage's map image: u = Ax * x + Bx and v = Ay * y + By,
/// with u and v from 0 to 1 across the image (v upwards). Learned from samples: the player's
/// position in the world and where the game's pause map puts the player's marker on the image.
/// </summary>
internal sealed class StageMapCalibration
{
    public const int MaxSamples = 12;

    public readonly List<(float x, float y, float u, float v)> Samples = new();
    public double Ax, Bx, Ay, By;
    public bool Ready;
    /// <summary>Largest distance of a used sample from the fit, in world units.</summary>
    public double Error;
    /// <summary>Samples the fit uses (outliers left out).</summary>
    public int Used;

    public enum Change { None, New, Moved }

    /// <summary>
    /// Adds the sample, or replaces the one at the same world position: while the game is paused
    /// the player stands still, so a later reading of the same pause wins (the marker may be
    /// placed a moment after the map opens).
    /// </summary>
    public Change Add(float x, float y, float u, float v)
    {
        int i = Samples.FindIndex(s => Math.Abs(s.x - x) < 0.5f && Math.Abs(s.y - y) < 0.5f);
        if (i < 0)
        {
            Samples.Add((x, y, u, v));
            if (Samples.Count > MaxSamples) Samples.RemoveAt(0);
            return Change.New;
        }
        var old = Samples[i];
        if (Math.Abs(old.u - u) < 0.0005f && Math.Abs(old.v - v) < 0.0005f) return Change.None;
        Samples[i] = (x, y, u, v);
        return Change.Moved;
    }

    /// <summary>
    /// Fits both axes by least squares. Needs samples at least minSpread world units apart on
    /// each axis. Samples further than maxError from the fit are dropped one by one (worst first).
    /// </summary>
    public bool Fit(float minSpread, float maxError)
    {
        Ready = false;
        var used = new List<(float x, float y, float u, float v)>(Samples);
        while (true)
        {
            if (!FitAxis(used.Select(s => (s.x, s.u)).ToList(), minSpread, out Ax, out Bx)
                || !FitAxis(used.Select(s => (s.y, s.v)).ToList(), minSpread, out Ay, out By))
                return false;
            int worst = -1;
            double worstError = 0;
            for (int i = 0; i < used.Count; i++)
            {
                var s = used[i];
                double e = Math.Max(Math.Abs((Ax * s.x + Bx - s.u) / Ax), Math.Abs((Ay * s.y + By - s.v) / Ay));
                if (e > worstError) { worstError = e; worst = i; }
            }
            Error = worstError;
            Used = used.Count;
            if (worstError <= maxError) return Ready = true;
            if (used.Count <= 2) return false;
            used.RemoveAt(worst);
        }
    }

    private static bool FitAxis(List<(float w, float t)> p, float minSpread, out double a, out double b)
    {
        a = b = 0;
        if (p.Count < 2 || p.Max(q => q.w) - p.Min(q => q.w) < minSpread) return false;
        double mw = p.Average(q => q.w), mt = p.Average(q => q.t);
        double sww = p.Sum(q => (q.w - mw) * (q.w - mw)), swt = p.Sum(q => (q.w - mw) * (q.t - mt));
        if (sww <= 0) return false;
        a = swt / sww;
        b = mt - a * mw;
        return Math.Abs(a) > 1e-9;
    }

    /// <summary>
    /// The part of the minimap square that the map image covers, as fractions of the square from
    /// its top left (left, top, right, bottom), and the texture coordinates to show there.
    /// spriteInTexture: where the sprite lies in its texture, 0 to 1. False if the image is not in
    /// the square at all (or the calibration is not ready).
    /// </summary>
    public bool Window(float px, float py, float range, Rect spriteInTexture,
        out float left, out float top, out float right, out float bottom, out Rect uv)
    {
        left = top = right = bottom = 0f;
        uv = default;
        if (!Ready || range <= 0f) return false;
        // Across the square, t from 0 (left / top) to 1 (right / bottom).
        double u0 = Ax * (px - range) + Bx, u1 = Ax * (px + range) + Bx;
        double v0 = Ay * (py + range) + By, v1 = Ay * (py - range) + By; // top is world up
        if (!Inside(u0, u1, out double l, out double r) || !Inside(v0, v1, out double t, out double b)) return false;
        left = (float)l; right = (float)r; top = (float)t; bottom = (float)b;

        double uL = u0 + (u1 - u0) * l, uR = u0 + (u1 - u0) * r;
        double vT = v0 + (v1 - v0) * t, vB = v0 + (v1 - v0) * b;
        // A negative width or height flips the image, should an axis run the other way.
        uv = new Rect(
            (float)(spriteInTexture.x + uL * spriteInTexture.width),
            (float)(spriteInTexture.y + vB * spriteInTexture.height),
            (float)((uR - uL) * spriteInTexture.width),
            (float)((vT - vB) * spriteInTexture.height));
        return true;
    }

    // Where along the square (0..1) the image coordinate, running from c0 to c1, is within 0..1.
    private static bool Inside(double c0, double c1, out double from, out double to)
    {
        from = to = 0;
        if (Math.Abs(c1 - c0) < 1e-12) return false;
        double a = (0 - c0) / (c1 - c0), b = (1 - c0) / (c1 - c0);
        from = Math.Clamp(Math.Min(a, b), 0, 1);
        to = Math.Clamp(Math.Max(a, b), 0, 1);
        return to - from > 1e-4;
    }
}

// The stage's map image from the game's pause map (the detailed map some stages show, e.g. after
// picking up their map), for the minimap's background.
// - The image: MapManager._detailedMapSprite.
// - Learning where the world lies on it: while the pause map is open, the game puts the player's
//   marker (MapManager._Player) on the image. Its position on the image together with the
//   player's position in the world is one sample, taken while the player stands still (in online
//   co-op the game doesn't pause behind the menu); two openings at places far enough apart on
//   both axes are enough. The samples are saved per image (BepInEx/config/...stagemaps.json), so each
//   stage only needs to be learned once.
// Names per the game's decompiled code (VSEvolutionHelperEx's game-api), read by reflection.
// Only call from Update (main thread).
internal static class StageMap
{
    /// <summary>File for the samples per map image; set by the plugin.</summary>
    public static string FilePath;

    private static readonly Dictionary<string, StageMapCalibration> Calibrations = new();
    private static bool _loaded;
    private static string _loggedKey, _loggedImageKey;
    private static Image _image;
    private static Sprite _imageSprite;
    private static double _searchAt;

    // While the pause map is open: where the player stood when it opened, whether they moved
    // since, and the marker's last reading. In online co-op the game keeps running behind the
    // menu, and the marker may stay where it was put when the map opened: a sample only counts
    // while the player stands still and the marker holds its place.
    private static bool _open, _moved, _haveLast;
    private static Vector2 _openedAt;
    private static float _lastU, _lastV;
    private const float StandStill = 0.3f; // world units

    /// <summary>The current stage's map image, or null.</summary>
    public static Sprite Sprite { get; private set; }

    /// <summary>What is known about it, or null.</summary>
    public static StageMapCalibration Current { get; private set; }

    /// <summary>"none" (no map image on this stage, or not yet), "learning" or "ready".</summary>
    public static string Status => Sprite == null || Current == null ? "none" : Current.Ready ? "ready" : "learning";

    /// <summary>Forgets the stage, e.g. when a run ends.</summary>
    public static void Reset()
    {
        Sprite = null;
        Current = null;
        _image = null;
        _imageSprite = null;
        _searchAt = 0;
        _open = _moved = _haveLast = false;
    }

    /// <summary>Reads the map image and, while the pause map is open, learns from it.</summary>
    public static void Update(object mapManager, Vector2 player, float halfScreen, double now)
    {
        if (mapManager == null) return;
        Load();
        Sprite sprite = RunReader.GetMember(mapManager, "_detailedMapSprite") as Sprite;
        if (sprite == null)
        {
            Sprite = null;
            Current = null;
            return;
        }
        string key = KeyOf(sprite);
        if (!Calibrations.TryGetValue(key, out StageMapCalibration cal))
        {
            Calibrations[key] = cal = new StageMapCalibration();
        }
        Sprite = sprite;
        Current = cal;
        // Samples from the file (or earlier runs) are fitted with the current screen size.
        if (!cal.Ready && cal.Samples.Count >= 2) cal.Fit(halfScreen, 0.15f * halfScreen);
        if (_loggedKey != key)
        {
            _loggedKey = key;
            Plugin.Logger.LogInfo($"[StageMap] map image {key}, {(cal.Ready ? $"already learned ({cal.Used} samples)" : $"{cal.Samples.Count} samples so far")}; " +
                $"map fields: {Fields(mapManager, "_mapRatioX", "_mapRatioY", "_mapSpriteWidth", "_mapSpriteHeight", "_width", "_height", "_zoom")}");
        }

        try
        {
            Learn(mapManager, sprite, key, cal, player, halfScreen, now);
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("stagemap:learn", ex);
        }
    }

    private static void Learn(object mapManager, Sprite sprite, string key, StageMapCalibration cal, Vector2 player, float halfScreen, double now)
    {
        // Only while the pause map is open and shows the image (also in online co-op, where the
        // game doesn't pause). Otherwise the marker may still show an earlier position.
        Image image = Visible(mapManager, sprite, now);
        if (image == null) { _open = _moved = _haveLast = false; return; }
        if (!_open) { _open = true; _moved = false; _haveLast = false; _openedAt = player; }
        else if (Math.Abs(player.x - _openedAt.x) > StandStill || Math.Abs(player.y - _openedAt.y) > StandStill)
        {
            if (!_moved) Plugin.Logger.LogInfo("[StageMap] you moved while the map was open: no sample this time (stand still a moment)");
            _moved = true;
        }
        if (_moved) return;
        if (_loggedImageKey != key)
        {
            _loggedImageKey = key;
            Transform parent = image.transform.parent;
            Plugin.Logger.LogInfo($"[StageMap] shown by image '{image.gameObject.name}' in '{(parent != null ? parent.gameObject.name : "-")}', " +
                $"preserveAspect {image.preserveAspect}");
        }

        GameObject marker = RunReader.GetMember(mapManager, "_Player") as GameObject;
        if (marker == null || !marker.activeInHierarchy)
        {
            RunReader.WarnOnce("stagemap:marker", new InvalidOperationException(
                "the pause map's player marker (_Player) was not found or is hidden: the map image can't be learned"));
            return;
        }

        // The marker's centre in the image's own coordinates, then as 0..1 across the drawn image.
        Vector3 centre = marker.transform.position;
        RectTransform markerRect = marker.transform.TryCast<RectTransform>();
        if (markerRect != null)
        {
            Rect mr = markerRect.rect;
            centre = markerRect.TransformPoint(new Vector3(mr.x + mr.width / 2f, mr.y + mr.height / 2f, 0f));
        }
        RectTransform imageRect = image.rectTransform;
        Vector3 local = imageRect.InverseTransformPoint(centre);
        Rect drawn = DrawnRect(image, sprite, imageRect);
        if (drawn.width <= 0f || drawn.height <= 0f) return;
        float u = (local.x - drawn.x) / drawn.width, v = (local.y - drawn.y) / drawn.height;
        if (u < -0.05f || u > 1.05f || v < -0.05f || v > 1.05f) return; // marker not on the image

        // The marker must hold its place for two readings (it may be placed a moment after the
        // map opens).
        bool steady = _haveLast && Math.Abs(u - _lastU) < 0.002f && Math.Abs(v - _lastV) < 0.002f;
        _lastU = u; _lastV = v; _haveLast = true;
        if (!steady) return;

        StageMapCalibration.Change change = cal.Add(player.x, player.y, u, v);
        if (change == StageMapCalibration.Change.None) return;
        bool wasReady = cal.Ready;
        cal.Fit(halfScreen, 0.15f * halfScreen);
        if (change == StageMapCalibration.Change.New)
            Plugin.Logger.LogInfo($"[StageMap] sample {cal.Samples.Count}: world ({player.x:0.#}, {player.y:0.#}) -> image ({u:0.###}, {v:0.###})" +
                (cal.Ready ? "" : " - open the map again at least half a screen away, left/right and up/down"));
        if (cal.Ready && (!wasReady || change == StageMapCalibration.Change.New))
            Plugin.Logger.LogInfo($"[StageMap] {key} learned from {cal.Used} of {cal.Samples.Count} samples, largest error {cal.Error:0.##} world units");
        Save();
    }

    // The image showing the map in the open pause map, or null if the map is not visible:
    // MapManager active, not faded out (its CanvasGroup), the image active and not transparent.
    private static Image Visible(object mapManager, Sprite sprite, double now)
    {
        if (mapManager is not Component map || map == null || map.gameObject == null || !map.gameObject.activeInHierarchy) return null;
        if (RunReader.GetMember(RunReader.GetMember(mapManager, "_CanvasGroup"), "alpha") is float alpha && alpha < 0.5f) return null;
        Image image = ImageShowing(map, sprite, now);
        if (image == null || !image.isActiveAndEnabled) return null;
        try
        {
            if (image.canvasRenderer != null && image.canvasRenderer.GetInheritedAlpha() < 0.5f) return null;
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("stagemap:alpha", ex);
        }
        return image;
    }

    // The image in the pause map that shows the sprite. Searched again at most every 2 seconds.
    private static Image ImageShowing(Component map, Sprite sprite, double now)
    {
        if (_image != null && _imageSprite == sprite && _image.sprite == sprite) return _image;
        _image = null;
        if (now < _searchAt) return null;
        _searchAt = now + 2000;
        foreach (Image img in map.GetComponentsInChildren<Image>(true))
        {
            if (img != null && img.sprite == sprite)
            {
                _image = img;
                _imageSprite = sprite;
                return img;
            }
        }
        RunReader.WarnOnce("stagemap:image", new InvalidOperationException(
            $"no image in the pause map shows the map image {sprite.name} (yet)"));
        return null;
    }

    // The part of the image's rectangle that the sprite fills (less with "preserve aspect").
    private static Rect DrawnRect(Image image, Sprite sprite, RectTransform rt)
    {
        Rect r = rt.rect;
        if (!image.preserveAspect) return r;
        Rect s = sprite.rect;
        if (s.width <= 0f || s.height <= 0f || r.width <= 0f || r.height <= 0f) return r;
        float spriteAspect = s.width / s.height, rectAspect = r.width / r.height;
        Vector2 pivot = rt.pivot;
        if (rectAspect > spriteAspect)
        {
            float w = r.height * spriteAspect;
            return new Rect(r.x + (r.width - w) * pivot.x, r.y, w, r.height);
        }
        float h = r.width / spriteAspect;
        return new Rect(r.x, r.y + (r.height - h) * pivot.y, r.width, h);
    }

    private static string KeyOf(Sprite sprite)
    {
        Rect r = sprite.rect;
        return $"{sprite.name}@{(int)r.width}x{(int)r.height}";
    }

    private static string Fields(object obj, params string[] names) =>
        string.Join(", ", names.Select(n => $"{n}={Format(RunReader.GetMember(obj, n))}"));

    private static string Format(object v) => v is IFormattable f ? f.ToString(null, CultureInfo.InvariantCulture) : v?.ToString() ?? "-";

    // ---- File: {"<image>": [[x, y, u, v], ...], ...} -----------------------------------------

    private static void Load()
    {
        if (_loaded) return;
        _loaded = true;
        if (string.IsNullOrEmpty(FilePath) || !File.Exists(FilePath)) return;
        try
        {
            using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(FilePath));
            foreach (JsonProperty image in doc.RootElement.EnumerateObject())
            {
                var cal = new StageMapCalibration();
                foreach (JsonElement s in image.Value.EnumerateArray())
                    if (s.GetArrayLength() == 4)
                        cal.Samples.Add((s[0].GetSingle(), s[1].GetSingle(), s[2].GetSingle(), s[3].GetSingle()));
                Calibrations[image.Name] = cal; // fitted in Update, with the screen size
            }
            Plugin.Logger.LogInfo($"[StageMap] samples for {Calibrations.Count} map images loaded from {FilePath}");
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("stagemap:load", ex);
        }
    }

    private static void Save()
    {
        if (string.IsNullOrEmpty(FilePath)) return;
        try
        {
            static string F(float f) => f.ToString("0.####", CultureInfo.InvariantCulture);
            var sb = new StringBuilder("{\n");
            sb.Append(string.Join(",\n", Calibrations.Where(c => c.Value.Samples.Count > 0).Select(c =>
                $"  {Json.Str(c.Key)}: [{string.Join(", ", c.Value.Samples.Select(s => $"[{F(s.x)}, {F(s.y)}, {F(s.u)}, {F(s.v)}]"))}]")));
            sb.Append("\n}\n");
            File.WriteAllText(FilePath, sb.ToString());
        }
        catch (Exception ex)
        {
            RunReader.WarnOnce("stagemap:save", ex);
        }
    }
}
