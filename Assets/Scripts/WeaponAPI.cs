using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Networking;
using UnityEngine.UI;

public class WeaponAPI : MonoBehaviour
{
    [SerializeField] string serverUrl = "http://localhost:3000/generate-weapon";
    [SerializeField] GameObject playerObject;

    InputField promptInput;
    Button generateButton;
    Text statusText;
    GameObject equippedWeaponObject;
    string currentPrompt;

    [System.Serializable]
    class PromptRequest
    {
        public string prompt;
    }

    void Start()
    {
        if (playerObject == null)
        {
            playerObject = GameObject.Find("Player");
        }

        EnsureEventSystem();
        CreatePromptUI();
    }

    void EnsureEventSystem()
    {
        if (FindObjectOfType<EventSystem>() != null)
        {
            return;
        }

        GameObject eventSystemObject = new GameObject("EventSystem");
        eventSystemObject.AddComponent<EventSystem>();
        eventSystemObject.AddComponent<StandaloneInputModule>();
    }

    void CreatePromptUI()
    {
        Canvas canvas = FindObjectOfType<Canvas>();
        if (canvas == null)
        {
            GameObject canvasObject = new GameObject("Weapon Prompt Canvas");
            canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasObject.AddComponent<CanvasScaler>();
            canvasObject.AddComponent<GraphicRaycaster>();
        }
        else
        {
            if (canvas.GetComponent<CanvasScaler>() == null)
            {
                canvas.gameObject.AddComponent<CanvasScaler>();
            }

            if (canvas.GetComponent<GraphicRaycaster>() == null)
            {
                canvas.gameObject.AddComponent<GraphicRaycaster>();
            }
        }

        Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        if (font == null)
        {
            font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        GameObject panel = new GameObject("Weapon Prompt Panel");
        panel.transform.SetParent(canvas.transform, false);
        Image panelImage = panel.AddComponent<Image>();
        panelImage.color = new Color(0f, 0f, 0f, 0.65f);

        RectTransform panelRect = panel.GetComponent<RectTransform>();
        panelRect.anchorMin = new Vector2(0.5f, 1f);
        panelRect.anchorMax = new Vector2(0.5f, 1f);
        panelRect.pivot = new Vector2(0.5f, 1f);
        panelRect.anchoredPosition = new Vector2(0f, -24f);
        panelRect.sizeDelta = new Vector2(720f, 150f);

        Text titleText = CreateText(panel.transform, "Title", "무기 프롬프트 입력", font, 24, TextAnchor.MiddleLeft);
        RectTransform titleRect = titleText.GetComponent<RectTransform>();
        titleRect.anchoredPosition = new Vector2(24f, -24f);
        titleRect.sizeDelta = new Vector2(440f, 32f);

        promptInput = CreateInput(panel.transform, font);
        RectTransform inputRect = promptInput.GetComponent<RectTransform>();
        inputRect.anchoredPosition = new Vector2(24f, -70f);
        inputRect.sizeDelta = new Vector2(520f, 40f);

        generateButton = CreateButton(panel.transform, font);
        RectTransform buttonRect = generateButton.GetComponent<RectTransform>();
        buttonRect.anchoredPosition = new Vector2(560f, -70f);
        buttonRect.sizeDelta = new Vector2(136f, 40f);
        generateButton.onClick.AddListener(SubmitPrompt);

        promptInput.onEndEdit.AddListener(_ =>
        {
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
            {
                SubmitPrompt();
            }
        });

        statusText = CreateText(panel.transform, "Status", "원하는 무기를 설명하고 생성 버튼을 누르세요.", font, 16, TextAnchor.MiddleLeft);
        RectTransform statusRect = statusText.GetComponent<RectTransform>();
        statusRect.anchoredPosition = new Vector2(24f, -120f);
        statusRect.sizeDelta = new Vector2(672f, 24f);
    }

    Text CreateText(Transform parent, string objectName, string text, Font font, int fontSize, TextAnchor alignment)
    {
        GameObject textObject = new GameObject(objectName);
        textObject.transform.SetParent(parent, false);

        Text textComponent = textObject.AddComponent<Text>();
        textComponent.text = text;
        textComponent.font = font;
        textComponent.fontSize = fontSize;
        textComponent.alignment = alignment;
        textComponent.color = Color.white;

        RectTransform rect = textComponent.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0f, 1f);
        rect.anchorMax = new Vector2(0f, 1f);
        rect.pivot = new Vector2(0f, 1f);

        return textComponent;
    }

    InputField CreateInput(Transform parent, Font font)
    {
        GameObject inputObject = new GameObject("Prompt Input");
        inputObject.transform.SetParent(parent, false);

        Image background = inputObject.AddComponent<Image>();
        background.color = Color.white;

        InputField input = inputObject.AddComponent<InputField>();

        Text inputText = CreateText(inputObject.transform, "Text", "", font, 18, TextAnchor.MiddleLeft);
        inputText.color = Color.black;
        RectTransform inputTextRect = inputText.GetComponent<RectTransform>();
        inputTextRect.anchorMin = Vector2.zero;
        inputTextRect.anchorMax = Vector2.one;
        inputTextRect.offsetMin = new Vector2(12f, 6f);
        inputTextRect.offsetMax = new Vector2(-12f, -6f);

        Text placeholder = CreateText(inputObject.transform, "Placeholder", "예: 번개를 품은 전설의 장검", font, 18, TextAnchor.MiddleLeft);
        placeholder.color = new Color(0.45f, 0.45f, 0.45f, 1f);
        RectTransform placeholderRect = placeholder.GetComponent<RectTransform>();
        placeholderRect.anchorMin = Vector2.zero;
        placeholderRect.anchorMax = Vector2.one;
        placeholderRect.offsetMin = new Vector2(12f, 6f);
        placeholderRect.offsetMax = new Vector2(-12f, -6f);

        input.textComponent = inputText;
        input.placeholder = placeholder;

        RectTransform rect = input.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0f, 1f);
        rect.anchorMax = new Vector2(0f, 1f);
        rect.pivot = new Vector2(0f, 1f);

        return input;
    }

    Button CreateButton(Transform parent, Font font)
    {
        GameObject buttonObject = new GameObject("Generate Button");
        buttonObject.transform.SetParent(parent, false);

        Image image = buttonObject.AddComponent<Image>();
        image.color = new Color(0.2f, 0.45f, 0.95f, 1f);

        Button button = buttonObject.AddComponent<Button>();
        Text label = CreateText(buttonObject.transform, "Label", "생성", font, 18, TextAnchor.MiddleCenter);
        RectTransform labelRect = label.GetComponent<RectTransform>();
        labelRect.anchorMin = Vector2.zero;
        labelRect.anchorMax = Vector2.one;
        labelRect.offsetMin = Vector2.zero;
        labelRect.offsetMax = Vector2.zero;

        RectTransform rect = button.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0f, 1f);
        rect.anchorMax = new Vector2(0f, 1f);
        rect.pivot = new Vector2(0f, 1f);

        return button;
    }

    void SubmitPrompt()
    {
        string prompt = promptInput.text.Trim();
        if (string.IsNullOrEmpty(prompt))
        {
            statusText.text = "프롬프트를 먼저 입력해 주세요.";
            return;
        }

        StartCoroutine(GenerateWeapon(prompt));
    }

    public IEnumerator GenerateWeapon(string prompt)
    {
        currentPrompt = prompt;
        SetLoadingState(true, "무기 생성 중...");

        string jsonBody = JsonUtility.ToJson(new PromptRequest { prompt = prompt });
        UnityWebRequest request = new UnityWebRequest(serverUrl, "POST");

        byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);

        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();

        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            Debug.Log("무기 생성 응답 수신");

            string json = request.downloadHandler.text;

            Debug.Log(json);

            WeaponData data = JsonUtility.FromJson<WeaponData>(json);

            ApplyWeapon(data);
            if (IsStaleMockResponse(data))
            {
                SetLoadingState(false, "서버가 예전 Common Fire Mock 응답을 반환했습니다.");
                yield break;
            }

            yield return AttachWeaponToPlayer(data);
            SetLoadingState(false, "생성 완료: " + data.name);
        }
        else
        {
            Debug.LogError(request.error);
            SetLoadingState(false, "생성 실패: " + request.error);
        }
    }

    void ApplyWeapon(WeaponData data)
    {
        Debug.Log("무기 이름: " + data.name);
        Debug.Log("속성: " + data.element);
        Debug.Log("희귀도: " + data.rarity);
        Debug.Log("이미지 프롬프트: " + data.imagePrompt);
        Debug.Log("서버가 사용한 프롬프트: " + data.promptUsed);

        if (playerObject != null)
        {
            Debug.Log("장착 대상: " + playerObject.name);
        }

        if (!string.IsNullOrEmpty(data.promptUsed) && data.promptUsed.Contains("Common Fire sword") && !currentPrompt.Contains("Common Fire"))
        {
            Debug.LogWarning("서버가 사용자 프롬프트 대신 Common Fire sword Mock 데이터를 반환했습니다. generate-weapon 라우트를 확인하세요.");
        }
    }

    bool IsStaleMockResponse(WeaponData data)
    {
        bool hasOldName = data.name == "Common Fire sword" || data.name == "Common Fire Sword";
        bool hasDummyImage = !string.IsNullOrEmpty(data.imageUrl) && data.imageUrl.Contains("dummyimage.com");
        bool promptWasReplaced = !string.IsNullOrEmpty(data.promptUsed)
            && data.promptUsed.Contains("A Common Fire sword")
            && !currentPrompt.Contains("Common Fire");

        return hasOldName || hasDummyImage || promptWasReplaced;
    }

    IEnumerator AttachWeaponToPlayer(WeaponData data)
    {
        if (playerObject == null)
        {
            Debug.LogWarning("Player Object가 연결되지 않아 무기를 장착하지 못했습니다.");
            yield break;
        }

        if (string.IsNullOrEmpty(data.imageUrl))
        {
            Debug.LogWarning("imageUrl이 비어 있어 무기 이미지를 적용하지 못했습니다.");
            yield break;
        }

        UnityWebRequest imageRequest = UnityWebRequestTexture.GetTexture(data.imageUrl);
        yield return imageRequest.SendWebRequest();

        if (imageRequest.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError("무기 이미지 다운로드 실패: " + imageRequest.error);
            yield break;
        }

        Texture2D texture = DownloadHandlerTexture.GetContent(imageRequest);
        Sprite weaponSprite = Sprite.Create(
            texture,
            new Rect(0f, 0f, texture.width, texture.height),
            new Vector2(0.5f, 0.5f),
            100f
        );

        if (equippedWeaponObject == null)
        {
            equippedWeaponObject = new GameObject("Generated Weapon");
            equippedWeaponObject.transform.SetParent(playerObject.transform, false);
            equippedWeaponObject.transform.localPosition = new Vector3(0.7f, 0f, 0f);
            equippedWeaponObject.transform.localScale = Vector3.one * 0.75f;
        }

        SpriteRenderer spriteRenderer = equippedWeaponObject.GetComponent<SpriteRenderer>();
        if (spriteRenderer == null)
        {
            spriteRenderer = equippedWeaponObject.AddComponent<SpriteRenderer>();
        }

        spriteRenderer.sprite = weaponSprite;
        spriteRenderer.sortingOrder = 10;
        equippedWeaponObject.name = data.name;
    }

    void SetLoadingState(bool isLoading, string message)
    {
        if (generateButton != null)
        {
            generateButton.interactable = !isLoading;
        }

        if (promptInput != null)
        {
            promptInput.interactable = !isLoading;
        }

        if (statusText != null)
        {
            statusText.text = message;
        }
    }
}
