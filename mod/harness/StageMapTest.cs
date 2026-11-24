// Learning where the world lies on a stage's map image, and the part of it the minimap shows.
using System;
using UnityEngine;
using VSCheatsheetBridge;

public static class StageMapTest
{
    // Made-up truth: u = 0.002 * x + 0.5, v = -0.004 * y + 0.3 (v runs against world up).
    static float U(float x) => 0.002f * x + 0.5f;
    static float V(float y) => -0.004f * y + 0.3f;

    public static void Run()
    {
        Plugin.Logger = new BepInEx.Logging.ManualLogSource();
        const float half = 12f; // half a screen width in world units
        var cal = new StageMapCalibration();

        cal.Add(0, 0, U(0), V(0));
        Console.WriteLine($"1 sample: ready {cal.Fit(half, 0.15f * half)}");
        cal.Add(5, 30, U(5), V(30));
        Console.WriteLine($"2 samples, only 5 apart left/right: ready {cal.Fit(half, 0.15f * half)}");
        Console.WriteLine($"same place again, marker moved: {cal.Add(5.2f, 30.1f, U(5) + 0.01f, V(30))}, unchanged: {cal.Add(5.2f, 30.1f, U(5) + 0.01f, V(30))}");
        cal.Add(5.2f, 30.1f, U(5), V(30));
        cal.Add(40, -20, U(40), V(-20));
        bool ready = cal.Fit(half, 0.15f * half);
        Console.WriteLine($"3 samples: ready {ready}, Ax {cal.Ax:0.####} Bx {cal.Bx:0.####} Ay {cal.Ay:0.####} By {cal.By:0.####}, error {cal.Error:0.###}");

        // An outlier (marker read before the map placed it) is left out.
        cal.Add(-30, 10, 0.9f, 0.9f);
        cal.Fit(half, 0.15f * half);
        Console.WriteLine($"with an outlier: ready {cal.Ready}, uses {cal.Used} of {cal.Samples.Count}, Ax {cal.Ax:0.####} By {cal.By:0.####}");

        // Window: player at (0, 0), 48 world units to the edge, sprite fills its texture.
        var full = new Rect(0, 0, 1, 1);
        cal.Window(0, 0, 48, full, out float l, out float t, out float r, out float b, out Rect uv);
        Console.WriteLine($"window in the middle: square {l:0.##},{t:0.##} to {r:0.##},{b:0.##}; uv x {uv.x:0.####} w {uv.width:0.####} y {uv.y:0.####} h {uv.height:0.####}");
        // Near the image's left edge (u = 0 at x = -250): the left part of the square stays empty.
        cal.Window(-240, 0, 48, full, out l, out t, out r, out b, out uv);
        Console.WriteLine($"near the left edge: square {l:0.##},{t:0.##} to {r:0.##},{b:0.##}; uv x {uv.x:0.####} w {uv.width:0.####}");
        // Sprite in the right half of an atlas.
        cal.Window(0, 0, 48, new Rect(0.5f, 0, 0.5f, 1), out l, out t, out r, out b, out uv);
        Console.WriteLine($"in an atlas: uv x {uv.x:0.####} w {uv.width:0.####}");
        bool outside = cal.Window(1000, 0, 48, full, out _, out _, out _, out _, out _);
        Console.WriteLine($"far off the image: shown {outside}");
    }
}
