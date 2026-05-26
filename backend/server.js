const http = require("http");
const zlib = require("zlib");

const PORT = Number(process.env.PORT || 3000);
const generatedImages = new Map();
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";

const ELEMENTS = {
  Lightning: { color: [245, 220, 80], glow: [80, 180, 255], effect: "적중 시 연쇄 번개 발동" },
  Fire: { color: [255, 95, 45], glow: [255, 190, 70], effect: "적중 시 화상 부여" },
  Ice: { color: [115, 220, 255], glow: [220, 255, 255], effect: "적중 시 둔화 부여" },
  Poison: { color: [100, 230, 95], glow: [190, 255, 90], effect: "적중 시 중독 중첩" },
  Wind: { color: [120, 235, 190], glow: [220, 255, 230], effect: "공격 속도 증가" },
  Light: { color: [255, 245, 175], glow: [255, 255, 255], effect: "치유 파동 발동" },
  Dark: { color: [95, 45, 155], glow: [205, 80, 255], effect: "생명력 흡수" },
  Neutral: { color: [180, 185, 195], glow: [235, 235, 235], effect: "기본 공격력 증가" },
};

function normalizePrompt(prompt) {
  return String(prompt || "").trim();
}

function pickRarity(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("전설") || p.includes("legendary")) return "Legendary";
  if (p.includes("영웅") || p.includes("epic") || p.includes("heroic")) return "Epic";
  if (p.includes("희귀") || p.includes("rare")) return "Rare";
  return "Common";
}

function pickElement(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("번개") || p.includes("뇌전") || p.includes("lightning") || p.includes("thunder")) return "Lightning";
  if (p.includes("불") || p.includes("화염") || p.includes("fire") || p.includes("flame")) return "Fire";
  if (p.includes("얼음") || p.includes("빙") || p.includes("ice") || p.includes("frost")) return "Ice";
  if (p.includes("독") || p.includes("poison") || p.includes("venom")) return "Poison";
  if (p.includes("바람") || p.includes("wind")) return "Wind";
  if (p.includes("빛") || p.includes("holy") || p.includes("light")) return "Light";
  if (p.includes("어둠") || p.includes("암흑") || p.includes("dark") || p.includes("shadow")) return "Dark";
  return "Neutral";
}

function pickWeaponType(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("대검") || p.includes("greatsword")) return "Greatsword";
  if (p.includes("장검") || p.includes("longsword")) return "Longsword";
  if (p.includes("단검") || p.includes("dagger")) return "Dagger";
  if (p.includes("도끼") || p.includes("axe")) return "Axe";
  if (p.includes("창") || p.includes("spear")) return "Spear";
  if (p.includes("활") || p.includes("bow")) return "Bow";
  if (p.includes("지팡이") || p.includes("staff")) return "Staff";
  if (p.includes("검") || p.includes("sword")) return "Sword";
  return "Sword";
}

function buildName(element, rarity, weaponType) {
  const rarityPrefix = {
    Legendary: "Legendary",
    Epic: "Epic",
    Rare: "Rare",
    Common: "Common",
  }[rarity];

  return `${rarityPrefix} ${element} ${weaponType}`;
}

function buildEffect(element, rarity) {
  const base = ELEMENTS[element].effect;
  if (rarity === "Legendary") return `${base} (전설 강화)`;
  if (rarity === "Epic") return `${base} (영웅 강화)`;
  if (rarity === "Rare") return `${base} (희귀 강화)`;
  return base;
}

function buildImagePrompt(prompt, element, rarity, weaponType) {
  return [
    `User prompt: ${prompt}`,
    `Create a ${rarity} ${element} ${weaponType}.`,
    "Style: fantasy game weapon icon, centered single asset, no text, no UI, no background.",
    `Core visual: ${element} energy wrapped around a ${weaponType}.`,
    "Output: square 2D icon suitable for attaching to a Unity Player object as a sprite.",
  ].join("\n");
}

async function buildWeapon(prompt) {
  const normalizedPrompt = normalizePrompt(prompt);
  const rarity = pickRarity(normalizedPrompt);
  const element = pickElement(normalizedPrompt);
  const weaponType = pickWeaponType(normalizedPrompt);
  const name = buildName(element, rarity, weaponType);
  const effect = buildEffect(element, rarity);
  const imagePrompt = buildImagePrompt(normalizedPrompt, element, rarity, weaponType);
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const image = await generateWeaponImage({ imagePrompt, element, rarity, weaponType });
  generatedImages.set(id, image);

  return {
    name,
    element,
    rarity,
    weaponType,
    effect,
    imageUrl: `http://localhost:${PORT}/weapon-image/${id}.png`,
    imagePrompt,
    promptUsed: normalizedPrompt,
  };
}

async function generateWeaponImage({ imagePrompt, element, rarity, weaponType }) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateOpenAIImage(imagePrompt);
    } catch (err) {
      console.warn("OpenAI image generation failed. Falling back to mock PNG:", err.message);
    }
  }

  return createWeaponPng({ element, rarity, weaponType });
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

function createWeaponPng({ element, rarity, weaponType }) {
  const width = 256;
  const height = 256;
  const pixels = Buffer.alloc(width * height * 4);
  const palette = ELEMENTS[element] || ELEMENTS.Neutral;
  const blade = palette.color;
  const glow = palette.glow;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      pixels[idx] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 0;
    }
  }

  drawGlow(pixels, width, height, 128, 128, weaponType === "Greatsword" ? 92 : 72, glow, rarity);
  drawWeaponShape(pixels, width, height, weaponType, blade, glow);

  return encodePng(width, height, pixels);
}

function drawGlow(pixels, width, height, cx, cy, radius, color, rarity) {
  const alphaBoost = { Legendary: 190, Epic: 160, Rare: 130, Common: 100 }[rarity] || 100;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const alpha = Math.floor((1 - dist / radius) * alphaBoost);
      blendPixel(pixels, width, x, y, color[0], color[1], color[2], alpha);
    }
  }
}

function drawWeaponShape(pixels, width, height, weaponType, blade, glow) {
  if (weaponType === "Bow") {
    drawLine(pixels, width, 96, 42, 96, 214, blade, 8);
    drawLine(pixels, width, 96, 42, 162, 128, glow, 3);
    drawLine(pixels, width, 96, 214, 162, 128, glow, 3);
    drawLine(pixels, width, 162, 128, 204, 128, [230, 230, 235], 3);
    return;
  }

  if (weaponType === "Spear") {
    drawLine(pixels, width, 126, 218, 126, 68, [110, 70, 45], 7);
    drawTriangle(pixels, width, height, 126, 28, 100, 78, 152, 78, blade);
    drawLine(pixels, width, 126, 28, 126, 78, glow, 3);
    return;
  }

  if (weaponType === "Axe") {
    drawLine(pixels, width, 122, 218, 122, 58, [110, 70, 45], 8);
    drawTriangle(pixels, width, height, 122, 52, 70, 92, 122, 130, blade);
    drawTriangle(pixels, width, height, 122, 52, 174, 92, 122, 130, blade);
    drawLine(pixels, width, 74, 92, 170, 92, glow, 3);
    return;
  }

  const halfWidth = weaponType === "Greatsword" ? 24 : weaponType === "Dagger" ? 9 : 15;
  const top = weaponType === "Dagger" ? 72 : 28;
  const bottom = weaponType === "Greatsword" ? 180 : 172;
  drawTriangle(pixels, width, height, 128, top, 128 - halfWidth, bottom, 128 + halfWidth, bottom, blade);
  drawLine(pixels, width, 128, top + 8, 128, bottom, [245, 245, 255], 3);
  drawLine(pixels, width, 86, bottom + 8, 170, bottom + 8, glow, 8);
  drawLine(pixels, width, 128, bottom + 8, 128, 224, [120, 80, 50], 10);
  drawCircle(pixels, width, height, 128, 226, 12, glow);
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
