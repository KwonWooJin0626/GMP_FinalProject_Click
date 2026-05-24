using UnityEngine; // <-- 이 줄을 맨 위에 추가해주세요!

// 플레이어에 부착되어 실제 스탯을 관리할 컴포넌트
public class WeaponComponent : MonoBehaviour
{
    public string weaponName;
    public int damage;
    public string element;
    public string imageUrl;
}