// Mimics the game's objects with the field names the plugin expects.
using System.Collections.Generic;
namespace VampireSurvivors.Data { public enum WeaponType { VOID, WHIP, POWER, MAXHEALTH, GARLIC } public enum CharacterType { ANTONIO } }
namespace VampireSurvivors.Framework
{
    using VampireSurvivors.Data;
    public class Equipment { public WeaponType Type; public int Level; }
    public class EquipmentManager { public List<Equipment> ActiveEquipment = new(); }
    public class CharacterController : UnityEngine.Component
    {
        public CharacterType CharacterType = CharacterType.ANTONIO;
        public EquipmentManager WeaponsManager = new(), AccessoriesManager = new();
    }
    public enum EnemyType { BAT, LEM_SPECTRAL, BOSS_XLBAT }
    public class EnemyController : UnityEngine.Component { public EnemyType EnemyType; public bool IsBoss { get; set; } }
    public class Stage { public List<EnemyController> _spawnedEnemies = new(); }
    public class GameManager { public CharacterController Player; public Stage Stage; public bool IsPaused { get; set; } }
    public static class GM { public static GameManager Core; }
}
namespace VampireSurvivors.UI
{
    using VampireSurvivors.Data;
    public class LevelUpItemUI : UnityEngine.Object { public WeaponType _type; public int _itemType; public bool _isLimitBreak; }
    public class LevelUpPage : UnityEngine.Object { public List<LevelUpItemUI> LevelUpItems = new(); public VampireSurvivors.Framework.CharacterController GetCharacterControllingUi() => null; }
}

namespace VampireSurvivors.Objects.Pickups
{
    public enum ItemType { GEM, RELIC, ROSARY, MAP_TOKEN, COIN, TREASURE, CLOVER, WEAPON, TELEPORTER }
    public class Pickup : UnityEngine.Component
    {
        public ItemType PickupType;
        public bool IsStagePickup, HasMapTokenData;
        public string MapTokenFrameName, MapTokenTexture;
    }
    public class TreasureChest : UnityEngine.Component { }
}
namespace VampireSurvivors.UI
{
    public class MapManager : UnityEngine.Component
    {
        public System.Collections.Generic.List<VampireSurvivors.Objects.Pickups.Pickup> Items = new();
        private System.Collections.Generic.List<VampireSurvivors.Objects.Pickups.Pickup> GetAllWorldItems() => Items;
        public UnityEngine.Sprite _detailedMapSprite;
        public System.Collections.Generic.List<VampireSurvivors.Objects.Pickups.ItemType> _minorItemTypes = new() { VampireSurvivors.Objects.Pickups.ItemType.CLOVER, VampireSurvivors.Objects.Pickups.ItemType.MAP_TOKEN };
    }
}
