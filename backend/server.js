const http = require("http");
const zlib = require("zlib");

const PORT = Number(process.env.PORT || 3000);
const generatedImages = new Map();
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";

const ELEMENTS = {
  Lightning: {
    keywords: ["lightning", "thunder", "electric", "spark", "voltage", "storm", "bolt", "번개", "뇌전", "전기", "전류", "천둥"],
    color: [245, 220, 80],
    glow: [80, 180, 255],
    effect: "Chain lightning on hit",
  },
  Fire: {
    keywords: ["fire", "flame", "ember", "burning", "heat", "lava", "inferno", "불", "화염", "불꽃", "용암", "타오르는"],
    color: [255, 95, 45],
    glow: [255, 190, 70],
    effect: "Burn damage on hit",
  },
  Ice: {
    keywords: ["ice", "frost", "snow", "freezing", "glacier", "crystal", "얼음", "빙결", "서리", "눈", "냉기", "수정"],
    color: [115, 220, 255],
    glow: [220, 255, 255],
    effect: "Slow on hit",
  },
  Poison: {
    keywords: ["poison", "toxic", "venom", "acid", "corruption", "plague", "독", "맹독", "독성", "산성", "부패"],
    color: [100, 230, 95],
    glow: [190, 255, 90],
    effect: "Poison stacks on hit",
  },
  Wind: {
    keywords: ["wind", "gust", "air", "cyclone", "tempest", "바람", "폭풍", "회오리", "질풍"],
    color: [120, 235, 190],
    glow: [220, 255, 230],
    effect: "Attack speed increase",
  },
  Light: {
    keywords: ["light", "holy", "divine", "sacred", "angelic", "radiant", "빛", "신성", "성스러운", "천사", "광휘"],
    color: [255, 245, 175],
    glow: [255, 255, 255],
    effect: "Healing wave trigger",
  },
  Dark: {
    keywords: ["dark", "shadow", "void", "darkness", "curse", "abyss", "어둠", "암흑", "그림자", "공허", "저주", "심연"],
    color: [95, 45, 155],
    glow: [205, 80, 255],
    effect: "Life steal",
  },
  Neutral: {
    keywords: ["plain", "normal", "neutral"],
    color: [180, 185, 195],
    glow: [235, 235, 235],
    effect: "Basic attack boost",
  },
};

const RARITIES = {
  Common: {
    probability: 0.2,
    baseAttackPower: 10,
    baseAttackSpeed: 1,
    style: "simple silhouette, restrained detail, minimal glow",
  },
  Rare: {
    probability: 0.4,
    baseAttackPower: 18,
    baseAttackSpeed: 1.08,
    style: "clear custom details, polished metal, visible magical accent",
  },
  Epic: {
    probability: 0.3,
    baseAttackPower: 29,
    baseAttackSpeed: 1.18,
    style: "complex silhouette, strong magical aura, ornate details",
  },
  Legendary: {
    probability: 0.1,
    baseAttackPower: 44,
    baseAttackSpeed: 1.32,
    style: "mythic silhouette, overwhelming energy, intricate legendary craftsmanship",
  },
};

const WEAPON_TYPES = {
  Greatsword: {
    keywords: ["greatsword", "two-handed sword", "large sword", "massive sword", "대검", "양손검", "큰검"],
    shape: "massive two-handed blade with a heavy guard",
  },
  Longsword: {
    keywords: ["longsword", "long sword", "장검", "롱소드"],
    shape: "long balanced blade with a refined guard",
  },
  Dagger: {
    keywords: ["dagger", "knife", "dirk", "단검", "나이프", "암살검"],
    shape: "short sharp blade with a compact handle",
  },
  Axe: {
    keywords: ["axe", "battleaxe", "hatchet", "도끼", "전투도끼"],
    shape: "heavy chopping blade with a thick handle",
  },
  Spear: {
    keywords: ["spear", "lance", "pike", "창", "랜스"],
    shape: "long shaft with a piercing head",
  },
  Bow: {
    keywords: ["bow", "longbow", "crossbow", "활", "장궁", "석궁"],
    shape: "curved bow with a magical string and energy arrow",
  },
  Staff: {
    keywords: ["staff", "wand", "rod", "지팡이", "스태프", "스테프", "마법 지팡이", "마법지팡이", "완드", "마법봉"],
    shape: "long magical rod with a crystal focus",
  },
  Sword: {
    keywords: ["sword", "blade", "katana", "sabre", "검", "칼", "블레이드"],
    shape: "sharp metallic blade with a glowing edge",
  },
};

const SPECIFICITY_TERMS = [
  "ancient", "broken", "cracked", "engraved", "ornate", "jagged", "curved", "serrated",
  "floating", "transparent", "glowing", "smoky", "rune", "runes", "chain", "crystal",
  "bone", "silver", "gold", "obsidian", "steel", "wood", "leather", "blood", "dragon",
  "angel", "demon", "king", "guardian", "assassin", "temple", "ruin", "moon", "sun",
  "blue", "red", "green", "black", "white", "purple", "yellow", "orange",
  "품은", "감싼", "휘감은", "깃든", "새겨진", "갈라진", "부서진", "고대", "푸른", "붉은",
  "검은", "하얀", "황금", "은빛", "수정", "룬", "사슬", "용", "뼈", "피", "왕", "수호자",
  "암살자", "사원", "폐허", "달", "태양", "불안정한", "저주받은", "성스러운",
];

const RARITY_WORDS = ["common", "rare", "epic", "legendary", "heroic", "mythic"];
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "with", "to", "for", "in", "on", "by", "from",
  "make", "create", "generate", "weapon", "item", "please",
  "무기", "아이템", "만들어줘", "생성", "생성해줘",
]);

const MODIFIERS = [
  {
    id: "sharp",
    displayName: "Keen",
    keywords: ["예리한", "날카로운", "sharp", "keen", "razor"],
    bonusAttackPower: 12,
    bonusAttackSpeed: 0,
    specialEffect: "Additional attack power",
  },
  {
    id: "piercing",
    displayName: "Piercing",
    keywords: ["관통성", "관통", "꿰뚫는", "piercing", "penetrating"],
    bonusAttackPower: 7,
    bonusAttackSpeed: 0,
    specialEffect: "Pierces enemy defense",
  },
  {
    id: "swift",
    displayName: "Swift",
    keywords: ["신속한", "빠른", "민첩한", "재빠른", "swift", "fast", "quick", "agile"],
    bonusAttackPower: 0,
    bonusAttackSpeed: 0.2,
    specialEffect: "Attack speed increase",
  },
  {
    id: "heavy",
    displayName: "Heavy",
    keywords: ["묵직한", "무거운", "heavy", "massive"],
    bonusAttackPower: 18,
    bonusAttackSpeed: -0.08,
    specialEffect: "High impact damage",
  },
  {
    id: "unstable",
    displayName: "Unstable",
    keywords: ["불안정한", "폭주하는", "unstable", "volatile"],
    bonusAttackPower: 10,
    bonusAttackSpeed: 0.08,
    specialEffect: "Unstable energy burst",
  },
];

function normalizePrompt(prompt) {
  return String(prompt || "").trim();
}

function tokenize(prompt) {
  return prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countMatches(prompt, terms) {
  const lower = prompt.toLowerCase();
  return terms.filter((term) => lower.includes(term)).length;
}

function calculateDetailScore(prompt) {
  const tokens = tokenize(prompt).filter((token) => !RARITY_WORDS.includes(token));
  const meaningfulTokens = tokens.filter((token) => !STOP_WORDS.has(token));
  const uniqueTokens = new Set(meaningfulTokens);
  const commaClauses = Math.min((prompt.match(/[,;]/g) || []).length, 4);
  const visualTerms = Math.min(countMatches(prompt, SPECIFICITY_TERMS), 10);
  const hasRelationshipText =
    /\b(wrapped|covered|made|forged|carved|surrounded|infused|attached|around|inside)\b/i.test(prompt) ||
    ["품은", "감싼", "휘감은", "깃든", "새겨진", "둘러싼", "붙은", "박힌"].some((term) => prompt.includes(term));
  const hasMoodText =
    /\b(silent|cursed|holy|ancient|royal|forgotten|unstable|violent|elegant)\b/i.test(prompt) ||
    ["고대", "저주", "성스러운", "왕실", "잊혀진", "불안정한", "난폭한", "우아한"].some((term) => prompt.includes(term));

  let score = 0;
  score += Math.min(uniqueTokens.size * 5, 40);
  score += visualTerms * 5;
  score += commaClauses * 5;
  if (hasRelationshipText) score += 10;
  if (hasMoodText) score += 8;
  if (prompt.length > 80) score += 10;
  if (prompt.length > 150) score += 10;

  return Math.max(0, Math.min(100, score));
}

function rollRarity() {
  const roll = Math.random();
  if (roll < RARITIES.Common.probability) return "Common";
  if (roll < RARITIES.Common.probability + RARITIES.Rare.probability) return "Rare";
  if (roll < RARITIES.Common.probability + RARITIES.Rare.probability + RARITIES.Epic.probability) return "Epic";
  return "Legendary";
}

function pickElement(prompt) {
  const p = prompt.toLowerCase();
  const match = Object.entries(ELEMENTS)
    .map(([name, data]) => ({
      name,
      score: data.keywords.filter((keyword) => p.includes(keyword)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  return match ? match.name : "Neutral";
}

function pickWeaponType(prompt) {
  const p = prompt.toLowerCase();
  const match = Object.entries(WEAPON_TYPES)
    .map(([name, data]) => ({
      name,
      score: data.keywords.filter((keyword) => p.includes(keyword)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  return match ? match.name : "Sword";
}

function extractVisualDescription(prompt, element, weaponType) {
  const lower = prompt.toLowerCase();
  const blocked = new Set([
    ...RARITY_WORDS,
    ...ELEMENTS[element].keywords,
    ...WEAPON_TYPES[weaponType].keywords.flatMap((term) => term.split(/\s+/)),
  ]);
  const meaningful = tokenize(prompt)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !blocked.has(token))
    .slice(0, 28);

  if (meaningful.length > 0) {
    return meaningful.join(" ");
  }

  if (lower.includes(element.toLowerCase()) || lower.includes(weaponType.toLowerCase())) {
    return `A focused ${element.toLowerCase()} ${weaponType.toLowerCase()} with clean fantasy game readability`;
  }

  return "A readable fantasy weapon silhouette with clear material, energy, and attachment details";
}

function pickModifier(prompt) {
  const p = prompt.toLowerCase();
  return MODIFIERS.find((modifier) =>
    modifier.keywords.some((keyword) => p.includes(keyword))
  ) || null;
}

function getRarityStatMultiplier(rarity) {
  if (rarity === "Legendary") return 2.2;
  if (rarity === "Epic") return 1.65;
  if (rarity === "Rare") return 1.25;
  return 1;
}

function buildName(element, rarity, weaponType, modifier) {
  const baseName = `${rarity} ${element} ${weaponType}`;
  return modifier ? `${modifier.displayName} ${baseName}` : baseName;
}

function buildEffect(element, rarity, modifierStats) {
  const base = ELEMENTS[element].effect;
  const rarityEffect =
    rarity === "Legendary"
      ? `${base} (legendary enhanced)`
      : rarity === "Epic"
      ? `${base} (epic enhanced)`
      : rarity === "Rare"
      ? `${base} (rare enhanced)`
      : base;

  return modifierStats.modifierName
    ? `${rarityEffect}; ${modifierStats.specialEffect}`
    : rarityEffect;
}

function buildModifierStats(modifier, rarity) {
  if (!modifier) {
    return {
      modifierId: "",
      modifierName: "",
      specialEffect: "",
      bonusAttackPower: 0,
      bonusAttackSpeed: 0,
    };
  }

  const multiplier = getRarityStatMultiplier(rarity);

  return {
    modifierId: modifier.id,
    modifierName: modifier.displayName,
    specialEffect: modifier.specialEffect,
    bonusAttackPower: Math.round(modifier.bonusAttackPower * multiplier),
    bonusAttackSpeed: Number((modifier.bonusAttackSpeed * multiplier).toFixed(2)),
  };
}

function buildCombatStats(rarity, detailScore, modifierStats) {
  const rarityData = RARITIES[rarity];
  const detailBonus = Math.floor(detailScore / 20);
  const attackPower = rarityData.baseAttackPower + detailBonus + modifierStats.bonusAttackPower;
  const attackSpeed = Number((rarityData.baseAttackSpeed + modifierStats.bonusAttackSpeed).toFixed(2));

  return {
    baseAttackPower: rarityData.baseAttackPower,
    attackPower,
    attackSpeed,
  };
}

function buildImagePrompt({ prompt, element, rarity, weaponType, visualDescription, detailScore, modifierStats }) {
  const style = RARITIES[rarity].style;
  const shape = WEAPON_TYPES[weaponType].shape;
  const effect = ELEMENTS[element].effect;

  return [
    `User prompt: ${prompt}`,
    `Create a ${rarity} ${element} ${weaponType}.`,
    `Prompt specificity score: ${detailScore}/100. Higher score means more ornate and powerful visual treatment.`,
    `Abstract visual description: ${visualDescription}.`,
    `Style: ${style}.`,
    `Base shape: ${shape}.`,
    `Elemental effect: ${effect}.`,
    modifierStats.modifierName
      ? `Modifier: ${modifierStats.modifierName}. Gameplay effect: ${modifierStats.specialEffect}.`
      : "Modifier: none.",
    rarity === "Epic" || rarity === "Legendary"
      ? "For Epic or Legendary rarity, do not preserve a basic template. Freely design a unique fantasy weapon from the prompt, while keeping the requested weapon category recognizable."
      : "Use the abstract visual description as the main art direction, while keeping a readable base weapon silhouette.",
    "Composition: fantasy 2D pixel-art weapon icon, centered single asset, no text, no UI, transparent background.",
    "Pixel art direction: crisp silhouette, chunky highlights, readable outline, magical particles, rune accents, and rarity-based ornamentation.",
    "Output: square 2D pixel-art icon suitable for attaching to a Unity Player object as a sprite.",
  ].join("\n");
}

async function buildWeapon(prompt) {
  const normalizedPrompt = normalizePrompt(prompt);
  const element = pickElement(normalizedPrompt);
  const weaponType = pickWeaponType(normalizedPrompt);
  const detailScore = calculateDetailScore(normalizedPrompt);
  const rarity = rollRarity();
  const visualDescription = extractVisualDescription(normalizedPrompt, element, weaponType);
  const modifier = pickModifier(normalizedPrompt);
  const modifierStats = buildModifierStats(modifier, rarity);
  const combatStats = buildCombatStats(rarity, detailScore, modifierStats);
  const name = buildName(element, rarity, weaponType, modifier);
  const effect = buildEffect(element, rarity, modifierStats);
  const imagePrompt = buildImagePrompt({
    prompt: normalizedPrompt,
    element,
    rarity,
    weaponType,
    visualDescription,
    detailScore,
    modifierStats,
  });
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const image = await generateWeaponImage({
    imagePrompt,
    element,
    rarity,
    weaponType,
    visualDescription,
    detailScore,
    modifierStats,
  });
  generatedImages.set(id, image);

  return {
    name,
    element,
    rarity,
    weaponType,
    effect,
    visualDescription,
    detailScore,
    modifierId: modifierStats.modifierId,
    modifierName: modifierStats.modifierName,
    specialEffect: modifierStats.specialEffect,
    baseAttackPower: combatStats.baseAttackPower,
    attackPower: combatStats.attackPower,
    attackSpeed: combatStats.attackSpeed,
    bonusAttackPower: modifierStats.bonusAttackPower,
    bonusAttackSpeed: modifierStats.bonusAttackSpeed,
    imageUrl: `http://localhost:${PORT}/weapon-image/${id}.png`,
    imagePrompt,
    promptUsed: normalizedPrompt,
  };
}

async function generateWeaponImage({ imagePrompt, element, rarity, weaponType, visualDescription, detailScore, modifierStats }) {
  const shouldUseAIImage = rarity === "Epic" || rarity === "Legendary";

  if (shouldUseAIImage && process.env.OPENAI_API_KEY) {
    try {
      return await generateOpenAIImage(imagePrompt);
    } catch (err) {
      console.warn("OpenAI image generation failed. Falling back to mock PNG:", err.message);
    }
  }

  return createWeaponPng({ element, rarity, weaponType, visualDescription, detailScore, modifierStats });
}

async function generateOpenAIImage(imagePrompt) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: imagePrompt,
      size: "1024x1024",
      quality: "low",
      output_format: "png",
      background: "transparent",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI API error ${response.status}`);
  }

  const base64Image = payload.data?.[0]?.b64_json;
  if (!base64Image) {
    throw new Error("OpenAI response did not include b64_json image data");
  }

  return Buffer.from(base64Image, "base64");
}

function createWeaponPng({ element, rarity, weaponType, visualDescription, detailScore, modifierStats }) {
  const width = 256;
  const height = 256;
  const pixels = Buffer.alloc(width * height * 4);
  const palette = ELEMENTS[element] || ELEMENTS.Neutral;
  const blade = palette.color;
  const glow = palette.glow;
  const outline = [28, 30, 38];
  const metal = lighten(blade, 72);
  const shadow = darken(blade, 54);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      pixels[idx] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 0;
    }
  }

  const detailLevel = getDetailLevel(rarity, detailScore);
  drawPixelAura(pixels, width, height, 128, 128, weaponType === "Greatsword" ? 96 : 78, glow, rarity, detailLevel);
  drawWeaponShape(pixels, width, height, weaponType, {
    blade,
    glow,
    outline,
    metal,
    shadow,
    rarity,
    detailLevel,
    visualDescription,
    modifierStats,
  });
  drawRarityParticles(pixels, width, height, glow, rarity, detailLevel);

  return encodePng(width, height, pixels);
}

function getDetailLevel(rarity, detailScore) {
  const rarityBase = { Legendary: 4, Epic: 3, Rare: 2, Common: 1 }[rarity] || 1;
  return Math.max(rarityBase, Math.min(4, Math.floor(detailScore / 25) + 1));
}

function drawPixelAura(pixels, width, height, cx, cy, radius, color, rarity, detailLevel) {
  const alphaBoost = { Legendary: 185, Epic: 145, Rare: 105, Common: 70 }[rarity] || 70;
  const step = 4;
  for (let y = cy - radius; y <= cy + radius; y += step) {
    for (let x = cx - radius; x <= cx + radius; x += step) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const alpha = Math.floor((1 - dist / radius) * alphaBoost);
      drawRectAlpha(pixels, width, height, x, y, step, step, color, alpha);
    }
  }

  if (detailLevel >= 3) {
    drawDiamond(pixels, width, height, cx, cy, radius + 8, color, Math.floor(alphaBoost * 0.24));
  }
}

function drawWeaponShape(pixels, width, height, weaponType, art) {
  const { blade, glow, outline, metal, shadow, detailLevel, modifierStats } = art;
  if (weaponType === "Bow") {
    drawLine(pixels, width, 92, 42, 92, 214, outline, 12);
    drawLine(pixels, width, 96, 42, 96, 214, blade, 8);
    drawLine(pixels, width, 98, 54, 144, 92, metal, 4);
    drawLine(pixels, width, 98, 202, 144, 164, metal, 4);
    drawLine(pixels, width, 96, 42, 162, 128, glow, 3);
    drawLine(pixels, width, 96, 214, 162, 128, glow, 3);
    drawLine(pixels, width, 162, 128, 210, 128, [230, 230, 235], 4);
    drawTriangle(pixels, width, height, 210, 128, 194, 120, 194, 136, glow);
    if (detailLevel >= 2) drawRuneBand(pixels, width, height, 86, 116, 18, glow);
    return;
  }

  if (weaponType === "Spear") {
    drawLine(pixels, width, 126, 222, 126, 68, outline, 11);
    drawLine(pixels, width, 126, 218, 126, 68, [110, 70, 45], 7);
    drawTriangle(pixels, width, height, 126, 22, 94, 82, 158, 82, outline);
    drawTriangle(pixels, width, height, 126, 28, 100, 78, 152, 78, blade);
    drawLine(pixels, width, 126, 28, 126, 78, metal, 3);
    drawLine(pixels, width, 104, 90, 148, 90, glow, 6);
    if (detailLevel >= 3) drawRuneBand(pixels, width, height, 118, 124, 22, glow);
    return;
  }

  if (weaponType === "Axe") {
    drawLine(pixels, width, 122, 218, 122, 58, outline, 12);
    drawLine(pixels, width, 122, 218, 122, 58, [110, 70, 45], 8);
    drawTriangle(pixels, width, height, 122, 48, 64, 92, 122, 136, outline);
    drawTriangle(pixels, width, height, 122, 48, 180, 92, 122, 136, outline);
    drawTriangle(pixels, width, height, 122, 52, 70, 92, 122, 130, blade);
    drawTriangle(pixels, width, height, 122, 52, 174, 92, 122, 130, blade);
    drawLine(pixels, width, 84, 92, 160, 92, metal, 3);
    drawLine(pixels, width, 74, 92, 170, 92, glow, 3);
    if (detailLevel >= 2) drawGem(pixels, width, height, 122, 70, glow, blade);
    return;
  }

  if (weaponType === "Staff") {
    drawLine(pixels, width, 126, 226, 126, 58, outline, 13);
    drawLine(pixels, width, 126, 224, 126, 58, [96, 58, 38], 9);
    drawLine(pixels, width, 130, 220, 130, 62, [160, 110, 70], 3);
    drawCircle(pixels, width, height, 126, 44, 26, outline);
    drawCircle(pixels, width, height, 126, 44, 22, glow);
    drawDiamond(pixels, width, height, 126, 44, 14, metal, 235);
    drawCircle(pixels, width, height, 126, 44, 8, blade);
    drawLine(pixels, width, 94, 78, 158, 78, outline, 8);
    drawLine(pixels, width, 98, 78, 154, 78, glow, 4);
    drawLine(pixels, width, 102, 104, 150, 104, [230, 230, 235], 3);
    if (detailLevel >= 2) drawRuneBand(pixels, width, height, 116, 126, 24, glow);
    if (detailLevel >= 3) drawOrbitalPixels(pixels, width, height, 126, 44, glow);
    return;
  }

  const halfWidth = weaponType === "Greatsword" ? 24 : weaponType === "Dagger" ? 9 : 15;
  const top = weaponType === "Dagger" ? 72 : 28;
  const bottom = weaponType === "Greatsword" ? 180 : 172;
  drawTriangle(pixels, width, height, 128, top - 7, 128 - halfWidth - 7, bottom + 5, 128 + halfWidth + 7, bottom + 5, outline);
  drawTriangle(pixels, width, height, 128, top, 128 - halfWidth, bottom, 128 + halfWidth, bottom, blade);
  drawTriangle(pixels, width, height, 128, top + 8, 128 - Math.max(4, halfWidth - 9), bottom - 10, 128, bottom - 10, metal);
  drawLine(pixels, width, 128, top + 8, 128, bottom, [245, 245, 255], modifierStats?.modifierId === "sharp" ? 5 : 3);
  drawLine(pixels, width, 84, bottom + 8, 172, bottom + 8, outline, 12);
  drawLine(pixels, width, 86, bottom + 8, 170, bottom + 8, glow, 8);
  drawLine(pixels, width, 128, bottom + 8, 128, 224, [120, 80, 50], 10);
  drawCircle(pixels, width, height, 128, 226, 12, glow);
  if (detailLevel >= 2) drawGem(pixels, width, height, 128, bottom + 8, glow, blade);
  if (detailLevel >= 3) drawRuneBand(pixels, width, height, 116, 138, 24, glow);
}

function drawTriangle(pixels, width, height, ax, ay, bx, by, cx, cy, color) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = edge(ax, ay, bx, by, cx, cy);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w0 = edge(bx, by, cx, cy, x, y);
      const w1 = edge(cx, cy, ax, ay, x, y);
      const w2 = edge(ax, ay, bx, by, x, y);
      if ((area >= 0 && w0 >= 0 && w1 >= 0 && w2 >= 0) || (area < 0 && w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        setPixel(pixels, width, x, y, color[0], color[1], color[2], 255);
      }
    }
  }
}

function drawRectAlpha(pixels, width, height, x, y, w, h, color, alpha) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      blendPixel(pixels, width, xx, yy, color[0], color[1], color[2], alpha);
    }
  }
}

function drawRect(pixels, width, height, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      setPixel(pixels, width, xx, yy, color[0], color[1], color[2], 255);
    }
  }
}

function drawDiamond(pixels, width, height, cx, cy, radius, color, alpha = 255) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      if (dist <= radius) {
        if (alpha >= 255) {
          setPixel(pixels, width, x, y, color[0], color[1], color[2], 255);
        } else {
          blendPixel(pixels, width, x, y, color[0], color[1], color[2], alpha);
        }
      }
    }
  }
}

function drawGem(pixels, width, height, cx, cy, glow, blade) {
  drawDiamond(pixels, width, height, cx, cy, 11, [28, 30, 38]);
  drawDiamond(pixels, width, height, cx, cy, 8, glow);
  drawDiamond(pixels, width, height, cx - 2, cy - 2, 4, lighten(blade, 90));
}

function drawRuneBand(pixels, width, height, x, y, length, color) {
  for (let i = 0; i < length; i += 8) {
    drawRect(pixels, width, height, x + i, y, 4, 4, color);
    drawRect(pixels, width, height, x + i + 2, y + 5, 2, 7, color);
  }
}

function drawOrbitalPixels(pixels, width, height, cx, cy, color) {
  const points = [
    [cx - 32, cy - 8],
    [cx + 34, cy + 6],
    [cx - 18, cy + 28],
    [cx + 18, cy - 28],
  ];
  for (const [x, y] of points) {
    drawRectAlpha(pixels, width, height, x, y, 8, 8, color, 190);
  }
}

function drawRarityParticles(pixels, width, height, color, rarity, detailLevel) {
  const particleCount = { Legendary: 18, Epic: 12, Rare: 8, Common: 4 }[rarity] || 4;
  for (let i = 0; i < particleCount; i += 1) {
    const angle = (i / particleCount) * Math.PI * 2;
    const radius = 54 + (i % Math.max(1, detailLevel)) * 13;
    const x = Math.round(128 + Math.cos(angle) * radius);
    const y = Math.round(128 + Math.sin(angle) * radius * 0.72);
    const size = rarity === "Legendary" && i % 3 === 0 ? 6 : 4;
    drawRectAlpha(pixels, width, height, x, y, size, size, color, 160);
  }
}

function edge(ax, ay, bx, by, cx, cy) {
  return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
}

function drawLine(pixels, width, x0, y0, x1, y1, color, thickness) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);
    drawCircle(pixels, width, 256, x, y, thickness, color);
  }
}

function drawCircle(pixels, width, height, cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, width, x, y, color[0], color[1], color[2], 255);
      }
    }
  }
}

function setPixel(pixels, width, x, y, r, g, b, a) {
  const idx = (y * width + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function lighten(color, amount) {
  return color.map((value) => Math.min(255, value + amount));
}

function darken(color, amount) {
  return color.map((value) => Math.max(0, value - amount));
}

function blendPixel(pixels, width, x, y, r, g, b, a) {
  const idx = (y * width + x) * 4;
  const currentA = pixels[idx + 3] / 255;
  const nextA = a / 255;
  const outA = nextA + currentA * (1 - nextA);
  if (outA <= 0) return;

  pixels[idx] = Math.round((r * nextA + pixels[idx] * currentA * (1 - nextA)) / outA);
  pixels[idx + 1] = Math.round((g * nextA + pixels[idx + 1] * currentA * (1 - nextA)) / outA);
  pixels[idx + 2] = Math.round((b * nextA + pixels[idx + 2] * currentA * (1 - nextA)) / outA);
  pixels[idx + 3] = Math.round(outA * 255);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0]),
    ])),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = uint32(data.length);
  const crc = uint32(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendPng(res, payload) {
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/weapon-image/")) {
    const id = req.url.slice("/weapon-image/".length).replace(/\.png$/, "");
    const image = generatedImages.get(id);
    if (!image) {
      sendJson(res, 404, { error: "image not found" });
      return;
    }
    sendPng(res, image);
    return;
  }

  if (req.method === "POST" && req.url === "/generate-weapon") {
    try {
      const body = await parseBody(req);
      const prompt = normalizePrompt(body.prompt);
      if (!prompt) {
        sendJson(res, 400, { error: "prompt is required" });
        return;
      }

      sendJson(res, 200, await buildWeapon(prompt));
      return;
    } catch (err) {
      sendJson(res, 400, { error: err.message || "Bad request" });
      return;
    }
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Weapon API server running on http://localhost:${PORT}`);
});
