// Compile-only stand-ins for BepInEx, Il2CppInterop, Unity, TextMeshPro and the game.
// Only what the plugin uses; behaviour is minimal.
#pragma warning disable CS0649, CS0169, CS0414
using System;
using System.Collections.Generic;

namespace Il2CppSystem { public class Type { public System.Type Managed; } }

namespace Il2CppInterop.Runtime.InteropTypes
{
    public class Il2CppObjectBase
    {
        public IntPtr Pointer { get; set; }
        public Il2CppObjectBase() { }
        public Il2CppObjectBase(IntPtr p) { Pointer = p; }
        public T TryCast<T>() where T : Il2CppObjectBase => this as T;
    }
}
namespace Il2CppInterop.Runtime
{
    public static class Il2CppType
    {
        public static Il2CppSystem.Type Of<T>() => new() { Managed = typeof(T) };
        public static Il2CppSystem.Type From(Type t) => new() { Managed = t };
    }
}
namespace Il2CppInterop.Runtime.Injection
{
    public static class ClassInjector { public static void RegisterTypeInIl2Cpp<T>() { } }
}
namespace BepInEx
{
    [AttributeUsage(AttributeTargets.Class)]
    public class BepInPlugin : Attribute { public BepInPlugin(string guid, string name, string version) { } }
}
namespace BepInEx.Logging
{
    public class ManualLogSource
    {
        public void LogInfo(object o) => Console.WriteLine("[Info] " + o);
        public void LogWarning(object o) => Console.WriteLine("[Warning] " + o);
        public void LogError(object o) => Console.WriteLine("[Error] " + o);
    }
}
namespace BepInEx.Configuration
{
    public class ConfigEntry<T> { public T Value { get; set; } public object DefaultValue { get; set; } }
    public class ConfigFile
    {
        public string ConfigFilePath => System.IO.Path.Combine(System.IO.Path.GetTempPath(), "harness.cfg");
        public ConfigEntry<T> Bind<T>(string section, string key, T value, string description) => new() { Value = value, DefaultValue = value };
    }
}
namespace BepInEx.Unity.IL2CPP
{
    public abstract class BasePlugin
    {
        public BepInEx.Logging.ManualLogSource Log = new();
        public BepInEx.Configuration.ConfigFile Config = new();
        public abstract void Load();
        public virtual bool Unload() => true;
        public T AddComponent<T>() => default;
    }
}
namespace UnityEngine
{
    public class Object : Il2CppInterop.Runtime.InteropTypes.Il2CppObjectBase
    {
        public Object() { }
        public Object(IntPtr p) : base(p) { }
        public string name;
        public static List<Object> Registry = new();
        public static Object[] FindObjectsOfType(Il2CppSystem.Type t) => Registry.FindAll(o => t.Managed.IsInstanceOfType(o)).ToArray();
        public static void DontDestroyOnLoad(Object o) { }
        public static void Destroy(Object o) { }
    }
    public class Component : Object
    {
        public Component() { }
        public Component(IntPtr p) : base(p) { }
        private GameObject _go;
        public GameObject gameObject => _go ??= new GameObject("stub");
        private Transform _t;
        public Transform transform => _t ??= this as Transform ?? new Transform();
        public T GetComponentInChildren<T>() where T : Component => null;
        public T[] GetComponentsInChildren<T>(bool includeInactive) where T : Component => Array.Empty<T>();
    }
    public struct Vector3 { public float x, y, z; public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; } }
    public struct Scene { public bool IsValid() => true; }
    public class Camera : Component { public static Camera main => null; public bool orthographic; public float orthographicSize, aspect; }
    public class SpriteRenderer : Component { public Sprite sprite; }
    public static class Resources { public static Object[] FindObjectsOfTypeAll(Il2CppSystem.Type t) => Object.Registry.FindAll(o => t.Managed.IsInstanceOfType(o)).ToArray(); }
    public class Behaviour : Component { public Behaviour(IntPtr p) : base(p) { } public Behaviour() { } }
    public class MonoBehaviour : Behaviour { public MonoBehaviour(IntPtr p) : base(p) { } }
    public class Transform : Component
    {
        public Vector3 position;
        public Transform parent => null;
        public Vector3 TransformPoint(Vector3 p) => p;
        public Vector3 InverseTransformPoint(Vector3 p) => p;
        public void SetAsLastSibling() { }
        public void SetParent(Transform t, bool keep) { }
        public int childCount => 0;
        public Transform GetChild(int i) => null;
    }
    public class RectTransform : Transform
    {
        public Vector2 anchorMin, anchorMax, pivot, anchoredPosition, sizeDelta;
        public Rect rect;
    }
    public class GameObject : Object
    {
        public GameObject(string name) { }
        public Transform transform => null;
        public T AddComponent<T>() where T : new() => new T();
        public void SetActive(bool b) { }
        public bool activeSelf => true;
        public bool activeInHierarchy => true;
        public Scene scene => default;
    }
    public enum RenderMode { ScreenSpaceOverlay }
    public class CanvasRenderer : Component { public float GetInheritedAlpha() => 1f; }
    public class Canvas : Component { public RenderMode renderMode; public bool overrideSorting; public int sortingOrder; }
    public class Texture2D : Object { public int width, height; }
    public class Sprite : Object { public Texture2D texture; public Rect rect, textureRect; }
    public struct Color
    {
        public float r, g, b, a;
        public Color(float r, float g, float b, float a = 1f) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public static Color white => new(1, 1, 1);
    }
    public struct Vector2
    {
        public float x, y;
        public Vector2(float x, float y) { this.x = x; this.y = y; }
        public static Vector2 operator -(Vector2 a, Vector2 b) => new(a.x - b.x, a.y - b.y);
        public static Vector2 operator /(Vector2 a, float d) => new(a.x / d, a.y / d);
    }
    public struct Rect
    {
        public float x, y, width, height;
        public Rect(float x, float y, float w, float h) { this.x = x; this.y = y; width = w; height = h; }
        public Vector2 position => new(x, y);
        public bool Contains(Vector2 p) => p.x >= x && p.y >= y && p.x < x + width && p.y < y + height;
    }
    public static class Mathf
    {
        public static float Max(float a, float b) => Math.Max(a, b);
        public static float Min(float a, float b) => Math.Min(a, b);
        public static float Clamp(float v, float a, float b) => Math.Clamp(v, a, b);
        public static float Round(float v) => MathF.Round(v);
        public static float Ceil(float v) => MathF.Ceiling(v);
        public static float Abs(float v) => MathF.Abs(v);
    }
    public static class Screen { public static int width => 1920; public static int height => 1080; }
    public static class Application { public static bool isFocused => true; }
    public static class Time { public static float realtimeSinceStartup => 0f; }
    public enum KeyCode { A = 97, Z = 122, Alpha0 = 48, Alpha9 = 57, F1 = 282, F7 = 288, F8 = 289, F9 = 290, F10 = 291, F15 = 296 }
}
namespace UnityEngine.UI
{
    public class Image : UnityEngine.Component { public UnityEngine.Sprite sprite; public UnityEngine.Color color; public bool raycastTarget, preserveAspect, isActiveAndEnabled = true; public UnityEngine.RectTransform rectTransform => null; public UnityEngine.CanvasRenderer canvasRenderer => null; }
    public class RawImage : UnityEngine.Component { public UnityEngine.Texture2D texture; public UnityEngine.Rect uvRect; public UnityEngine.Color color; public bool raycastTarget; public UnityEngine.RectTransform rectTransform => null; }
}
namespace TMPro
{
    public class TMP_FontAsset : UnityEngine.Object { }
    public enum FontStyles { Normal, Bold }
    public enum TextAlignmentOptions { Left, Center, MidlineLeft, MidlineRight, Midline, TopLeft, BottomRight }
    public enum TextOverflowModes { Overflow }
    public class TextMeshProUGUI : UnityEngine.Component
    {
        public TMP_FontAsset font; public float fontSize; public UnityEngine.Color color; public TextAlignmentOptions alignment;
        public bool enableWordWrapping, raycastTarget, richText; public TextOverflowModes overflowMode; public FontStyles fontStyle; public string text;
        public bool enableAutoSizing; public float fontSizeMin, fontSizeMax; public UnityEngine.RectTransform rectTransform => null;
        public UnityEngine.Vector2 GetPreferredValues(string t, float w, float h) => new(t.Length * fontSize * 0.5f, fontSize);
    }
}
namespace VampireSurvivors.Graphics
{
    public static class SpriteManager
    {
        public static UnityEngine.Sprite GetSpriteFast(string f, string t) => null;
        public static UnityEngine.Sprite GetSprite(string f, string t, bool b) => null;
    }
}
namespace VSCheatsheetBridge { internal static class BuildInfo { public const string Version = "test"; } }
