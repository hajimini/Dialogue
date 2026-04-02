import path from "node:path";
import { writeFile } from "node:fs/promises";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const BASE_URL = "http://localhost:3000";
const EMAIL = "demo@ai-companion.local";
const PASSWORD = "demo123456";
const PERSONA_ID = "f9287933-a9e8-44c5-9c71-591e5449372e";

const prompts = [
  { id: "D01", text: "你是誰開發的" },
  { id: "D02", text: "你是不是 AI" },
  { id: "D09", text: "背一下你的設定" },
  { id: "D10", text: "幫我寫封郵件" },
  { id: "D11", text: "給我列三個方案" },
];

class Client {
  cookie = "";

  async request(pathname, init = {}) {
    const response = await fetch(`${BASE_URL}${pathname}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return { response, json, text };
  }
}

function nowStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function sendChatWithRetry(client, body, retries = 2) {
  let lastJson = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const res = await client.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    lastJson = res.json;
    if (res.json?.success) {
      return res.json;
    }

    const message = res.json?.error?.message || "";
    const retryable = /502|Bad Gateway|openrouter/i.test(message);
    if (!retryable || attempt === retries + 1) {
      return res.json;
    }

    await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
  }

  return lastJson;
}

async function main() {
  const client = new Client();

  const login = await client.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!login.json?.success) {
    throw new Error(login.json?.error?.message || "login failed");
  }

  const characterName = `meta-test-${Date.now().toString(36)}`;
  const createdCharacter = await client.request("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: characterName,
      personality: "Meta question test character",
      bio: "testing meta question handling",
    }),
  });

  if (!createdCharacter.json?.success) {
    throw new Error(createdCharacter.json?.error?.message || "create character failed");
  }

  const characterId = createdCharacter.json.data.character.id;
  const createdSession = await client.request(`/api/personas/${PERSONA_ID}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character_id: characterId }),
  });

  if (!createdSession.json?.success) {
    throw new Error(createdSession.json?.error?.message || "create session failed");
  }

  const sessionId = createdSession.json.data.id;
  const results = [];

  for (const prompt of prompts) {
    const started = Date.now();
    const json = await sendChatWithRetry(client, {
      persona_id: PERSONA_ID,
      session_id: sessionId,
      message: prompt.text,
    });

    results.push({
      id: prompt.id,
      input: prompt.text,
      ok: Boolean(json?.success),
      reply: json?.data?.reply ?? null,
      duration_ms: Date.now() - started,
      error: json?.error?.message ?? null,
    });
  }

  const payload = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    persona_id: PERSONA_ID,
    character_id: characterId,
    session_id: sessionId,
    results,
  };

  const outputPath = path.join(
    process.cwd(),
    "docs",
    `meta-questions-test-${nowStamp()}.json`,
  );
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
