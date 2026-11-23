# Test harness for the plugin

Compiles the plugin's sources (`../VSCheatsheetBridge/*.cs`) against small stand-ins for
BepInEx, Il2CppInterop, Unity, TextMeshPro and the game (`Stubs.cs`, `FakeGame.cs`), so the
logic can be tested on any PC without the game. Drawing (Canvas, images) is not tested: the
stand-ins return nothing there.

Needs the .NET SDK 8 or newer (and Node.js for the grading test's data).

```bash
cd mod/harness
dotnet run -- minimap   # minimap reader: items, chests, enemies, bosses, groups, F8 cycle, menu steps
node ../../scripts/export-mod-data.mjs cheatsheet-data.json   # once, and after data changes
dotnet run -- grading   # level-up grades for a few characters and builds
```

When the plugin uses a new Unity, BepInEx or game member, add it to `Stubs.cs` or
`FakeGame.cs`, otherwise the harness does not compile. Names in `FakeGame.cs` follow the game's
(e.g. `GM.Core`, `Stage._spawnedEnemies`), because the plugin finds them by reflection.
