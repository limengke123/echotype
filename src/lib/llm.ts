import type { ChatMessage, LlmConfig } from "./types";

/** Where a stock Ollama listens. */
const LOCAL_OLLAMA = "http://127.0.0.1:11434";

/**
 * Vite's dev/preview server exposes a same-origin `/llm` proxy, so the browser
 * never has to deal with CORS. A static build (GitHub Pages) has no such
 * luxury and has to call Ollama directly — the user then needs
 * `OLLAMA_ORIGINS=<their origin> ollama serve`.
 */
export const HAS_DEV_PROXY = Boolean(import.meta.env?.DEV);

export const LOCAL_TARGET_LABEL = HAS_DEV_PROXY
  ? "内置代理 → 127.0.0.1:11434"
  : "直连 127.0.0.1:11434";

/**
 * Endpoint resolution.
 *
 * An empty `baseUrl` means "the local Ollama", reached through the dev proxy
 * when one exists. A non-empty `baseUrl` is used as-is, with `/v1` appended
 * only when missing.
 */
export function endpointCandidates(baseUrl: string): string[] {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) {
    return HAS_DEV_PROXY
      ? ["/llm/v1/chat/completions", "/llm/chat/completions"]
      : [`${LOCAL_OLLAMA}/v1/chat/completions`, `${LOCAL_OLLAMA}/chat/completions`];
  }
  if (/\/v1$/i.test(base)) return [`${base}/chat/completions`];
  return [`${base}/v1/chat/completions`, `${base}/chat/completions`];
}

function isLocalTarget(url: string): boolean {
  return url.startsWith("/llm") || url.startsWith(LOCAL_OLLAMA);
}

/** True when the page is not being served from this machine. */
function isRemotePage(): boolean {
  if (typeof location === "undefined") return false;
  return !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
}

function headers(config: LlmConfig): Record<string, string> {
  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey.trim()) result.Authorization = `Bearer ${config.apiKey.trim()}`;
  return result;
}

function localModelHint(): string {
  if (isRemotePage()) {
    return "连不上本机的 Ollama。如果它已经在运行，多半是跨域或私有网络被浏览器拦下了：用 `OLLAMA_ORIGINS=" +
      (typeof location !== "undefined" ? location.origin : "https://<站点域名>") +
      " ollama serve` 重启一次试试；不行就本地 `npm run dev` 打开（本地有内置代理，最稳）。";
  }
  return "本地 Ollama（127.0.0.1:11434）没有响应。先运行 `ollama serve`，或在设置里填写其他 OpenAI 兼容服务地址。";
}

const REASONING_ONLY_MESSAGE =
  "这个模型只输出了「思考过程」，没有正文——多半是推理型模型（qwen3、deepseek-r1 等），或 Ollama 里跑不动的 MLX 模型。换一个普通模型试试，比如 qwen2.5:7b。";

function fatalError(message: string): Error {
  const error = new Error(message);
  (error as Error & { fatal?: boolean }).fatal = true;
  return error;
}

async function describeFailure(response: Response, url: string): Promise<string> {
  const text = await response.text().catch(() => "");
  let detail = text.trim();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === "string") detail = parsed.error;
    else if (parsed.error?.message) detail = parsed.error.message;
    else if (parsed.message) detail = parsed.message;
  } catch {
    /* keep raw text */
  }

  // 502/503/504 from the proxy (or a refused socket) means nothing is listening.
  if (response.status >= 500 && isLocalTarget(url)) return localModelHint();

  const clipped = detail.length > 240 ? `${detail.slice(0, 240)}…` : detail;
  return `${response.status} ${response.statusText}${clipped ? ` — ${clipped}` : ""}`;
}

type StreamOptions = {
  config: LlmConfig;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
};

type StreamResult = { text: string; reasoning: number };

async function readStream(response: Response, onDelta?: (delta: string) => void): Promise<StreamResult> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("event-stream") || !response.body) {
    const json = (await response.json()) as {
      choices?: {
        message?: { content?: string; reasoning?: string; reasoning_content?: string };
        text?: string;
      }[];
    };
    const message = json.choices?.[0]?.message;
    const text = message?.content ?? json.choices?.[0]?.text ?? "";
    const reasoning = (message?.reasoning ?? message?.reasoning_content ?? "").length;
    if (text) onDelta?.(text);
    return { text, reasoning };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let reasoning = 0;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: {
            delta?: { content?: string; reasoning?: string; reasoning_content?: string };
            text?: string;
          }[];
        };
        const delta = parsed.choices?.[0]?.delta;
        const content = delta?.content ?? parsed.choices?.[0]?.text ?? "";
        if (content) {
          full += content;
          onDelta?.(content);
        } else {
          // Thinking models stream the chain of thought into a separate field.
          reasoning += (delta?.reasoning ?? delta?.reasoning_content ?? "").length;
        }
      } catch {
        /* a partial JSON line: ignore, the next chunk will complete it */
      }
    }
  }

  return { text: full, reasoning };
}

/** Streams a chat completion, returning the full text. */
export async function streamChat({ config, messages, signal, onDelta }: StreamOptions): Promise<string> {
  if (!config.model.trim()) {
    throw new Error("还没有填模型名。打开设置填一个，比如 qwen2.5:7b。");
  }

  const urls = endpointCandidates(config.baseUrl);
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers(config),
        body: JSON.stringify({
          model: config.model.trim(),
          messages,
          stream: true,
          temperature: 0.9,
          top_p: 0.95,
        }),
        signal,
      });

      if (!response.ok) {
        lastError = new Error(await describeFailure(response, url));
        continue;
      }

      const result = await readStream(response, onDelta);
      if (!result.text.trim() && result.reasoning > 0) {
        // Do not retry the fallback URL: the model itself is the problem.
        throw fatalError(REASONING_ONLY_MESSAGE);
      }
      return result.text;
    } catch (error) {
      if (signal?.aborted) throw error;
      if ((error as { fatal?: boolean }).fatal) throw error;
      if (!config.baseUrl.trim() && error instanceof TypeError) {
        lastError = new Error(localModelHint());
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw new Error(
    lastError
      ? `连接本地模型失败：${lastError.message}`
      : "连接本地模型失败，请检查 Ollama / LM Studio 是否在运行。",
  );
}

/** Best-effort model list so the settings panel can offer a dropdown. */
export async function listModels(config: LlmConfig, signal?: AbortSignal): Promise<string[]> {
  const base = config.baseUrl.trim().replace(/\/+$/, "");

  const attempts: { url: string; pick: (json: unknown) => string[] }[] = base
    ? [
        {
          url: `${base}/v1/models`,
          pick: (json) => extractOpenAiModels(json),
        },
        {
          url: `${base}/models`,
          pick: (json) => extractOpenAiModels(json),
        },
      ]
    : [
        HAS_DEV_PROXY
          ? { url: "/llm/api/tags", pick: (json) => extractOllamaModels(json) }
          : { url: `${LOCAL_OLLAMA}/api/tags`, pick: (json) => extractOllamaModels(json) },
        {
          url: HAS_DEV_PROXY ? "/llm/v1/models" : `${LOCAL_OLLAMA}/v1/models`,
          pick: (json) => extractOpenAiModels(json),
        },
      ];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        headers: headers(config),
        signal,
      });
      if (!response.ok) continue;
      const json = (await response.json()) as unknown;
      const models = attempt.pick(json);
      if (models.length > 0) return models;
    } catch {
      /* try the next shape */
    }
  }

  return [];
}

function extractOllamaModels(json: unknown): string[] {
  const list = (json as { models?: { name?: string }[] }).models;
  if (!Array.isArray(list)) return [];
  return list.map((item) => item.name ?? "").filter(Boolean).sort();
}

function extractOpenAiModels(json: unknown): string[] {
  const list = (json as { data?: { id?: string }[] }).data;
  if (!Array.isArray(list)) return [];
  return list.map((item) => item.id ?? "").filter(Boolean).sort();
}
