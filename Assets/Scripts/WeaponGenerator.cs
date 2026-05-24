using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

// 서버로부터 받을 JSON 데이터 구조
[System.Serializable]
public class WeaponData
{
    public string weaponName;
    public WeaponAttributes attributes;
    public string imageUrl;
}

[System.Serializable]
public class WeaponAttributes
{
    public int damage;
    public string element;
    public string rarity;
}

public class WeaponGenerator : MonoBehaviour
{
    [Header("Server Settings")]
    public string serverUrl = "http://localhost:3000/generate-weapon";
    
    [Header("Target Object")]
    public GameObject playerObject; // 무기를 장착할 플레이어 오브젝트

    // 테스트용: 게임 시작 시 특정 프롬프트로 무기 생성 요청
    void Start()
    {
        string testPrompt = "화염이 감도는 거대한 대검";
        StartCoroutine(GenerateWeapon(testPrompt));
    }

    IEnumerator GenerateWeapon(string prompt)
    {
        Debug.Log($"[Input] 프롬프트 전송: {prompt}");

        // 1. 요청 데이터 생성 (Input)
        string jsonInput = $"{{\"prompt\":\"{prompt}\"}}";
        
        using (UnityWebRequest request = new UnityWebRequest(serverUrl, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonInput);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            // 2. 서버 통신 대기 (Process)
            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"에러: {request.error}");
            }
            else
            {
                // 3. 결과 파싱 및 Player에 데이터 부착 (Output)
                string responseJson = request.downloadHandler.text;
                Debug.Log($"[Output] 수신된 JSON: {responseJson}");

                WeaponData newWeaponData = JsonUtility.FromJson<WeaponData>(responseJson);
                EquipToPlayer(newWeaponData);
            }
        }
    }

    void EquipToPlayer(WeaponData data)
    {
        if (playerObject == null) return;

        // 플레이어에 무기 데이터 컴포넌트 부착 (기존에 없다면 추가)
        WeaponComponent weaponComp = playerObject.GetComponent<WeaponComponent>();
        if (weaponComp == null)
        {
            weaponComp = playerObject.AddComponent<WeaponComponent>();
        }

        // 데이터 갱신
        weaponComp.weaponName = data.weaponName;
        weaponComp.damage = data.attributes.damage;
        weaponComp.element = data.attributes.element;
        weaponComp.imageUrl = data.imageUrl;

        Debug.Log($"무기 장착 완료: {weaponComp.weaponName} (공격력: {weaponComp.damage})");
        
        // TODO: imageUrl을 이용해 UnityWebRequestTexture로 이미지를 다운받아 Material에 적용하는 로직 추가 가능
    }
}