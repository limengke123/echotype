import type { Strictness } from "./types";

/**
 * Three grading modes:
 *  - loose    ignore case, punctuation and extra spaces
 *  - standard ignore case, punctuation must match
 *  - strict   exact characters (only whitespace / quote glyphs are normalised)
 */
export const STRICTNESS_LABELS: Record<Strictness, { name: string; hint: string }> = {
  loose: { name: "宽松", hint: "忽略大小写与标点" },
  standard: { name: "标准", hint: "忽略大小写，标点要对" },
  strict: { name: "严格", hint: "大小写和标点都要对" },
};

const QUOTES: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "′": "'",
  "″": '"',
  "`": "'",
  "´": "'",
};

const DASHES: Record<string, string> = {
  "—": "-",
  "–": "-",
  "−": "-",
  "‐": "-",
  "‑": "-",
};

function canonicalise(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFKC")) {
    out += QUOTES[ch] ?? DASHES[ch] ?? ch;
  }
  return out
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAnswer(input: string, level: Strictness): string {
  const base = canonicalise(input);
  if (level === "strict") return base;
  if (level === "standard") return base.toLowerCase();

  return base
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrect(expected: string, actual: string, level: Strictness): boolean {
  const typed = normalizeAnswer(actual, level);
  if (!typed) return false;
  return normalizeAnswer(expected, level) === typed;
}

export type HintInfo = {
  words: number;
  chars: number;
  skeleton: string;
};

/** Progressively stronger hints, revealed by pressing Tab during practice. */
export function buildHint(sentence: string): HintInfo {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  const skeleton = tokens
    .map((token) => {
      const visible = token.length - 1;
      return token.charAt(0) + "·".repeat(Math.max(1, Math.min(visible, 9)));
    })
    .join("  ");

  return {
    words: tokens.length,
    chars: sentence.replace(/\s/g, "").length,
    skeleton,
  };
}
