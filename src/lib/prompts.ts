import type { CefrLevel, ChatMessage } from "./types";
import { splitSentences } from "./splitter.ts";

export const LEVELS: { value: CefrLevel; label: string }[] = [
  { value: "A2", label: "A2 · 初级" },
  { value: "B1", label: "B1 · 中级" },
  { value: "B2", label: "B2 · 中高级" },
  { value: "C1", label: "C1 · 高级" },
];

export const TOPICS = [
  "日常对话",
  "校园生活",
  "旅行见闻",
  "职场沟通",
  "科技新闻",
  "自然科普",
  "短篇故事",
  "观点评论",
];

export type GenerationOptions = {
  topic: string;
  level: CefrLevel;
  sentenceCount: number;
  targetWords: string;
};

const SYSTEM_PROMPT = `You write English listening-practice material for a dictation app.
The learner hears one line at a time and types it back, so readability by a text-to-speech voice matters more than literary style.

Hard rules:
- Output ONLY the sentences, one per line. Nothing else.
- Every line is one complete sentence ending with a period, question mark or exclamation mark.
- No numbering, no bullets, no markdown, no quotation marks wrapping the lines, no title, no explanation.
- 8 to 20 words per sentence.
- Natural, spoken-sounding English. Contractions are welcome.
- Avoid abbreviations (Mr., e.g., U.S.), symbols, emoji and digits with units — they sound wrong when read aloud.
- Use common, everyday vocabulary unless the level asks otherwise.
- Do not repeat the same sentence structure over and over.`;

export function buildMessages(options: GenerationOptions): ChatMessage[] {
  const lines = [
    `Topic: ${options.topic || "everyday life"}`,
    `Learner level: CEFR ${options.level}`,
    `Write exactly ${options.sentenceCount} sentences.`,
  ];

  if (options.targetWords.trim()) {
    lines.push(
      `Weave these words in naturally where they fit: ${options.targetWords.trim()}. Do not force them or list them.`,
    );
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: lines.join("\n") },
  ];
}

const BULLET_PREFIX = /^\s*(?:[-*•]|\d{1,2}[.)])\s*/;

/**
 * LLM output is expected to be one sentence per line, but models love to add
 * numbering or a leading title. If the output does not look line-per-sentence,
 * fall back to the normal punctuation splitter.
 */
export function sentencesFromLlm(raw: string): string[] {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(BULLET_PREFIX, "").replace(/^["“]|["”]$/g, "").trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const terminated = lines.filter((line) => /[.!?…]["'”’)\]]*$/.test(line)).length;
  if (terminated / lines.length >= 0.6) {
    // A model may still emit several sentences on a single line, so re-split
    // each line before trusting it.
    return lines.flatMap((line) => splitSentences(line)).filter((line) => /\p{L}/u.test(line));
  }

  return splitSentences(raw);
}
