/** Shared domain types for EchoType. */

export type Strictness = "loose" | "standard" | "strict";

/** A single character span produced by the char-level diff. */
export type CharSpan = {
  /** `equal` = identical, `del` = only in the expected text, `ins` = only in the typed text. */
  type: "equal" | "del" | "ins";
  text: string;
};

export type DiffOp =
  | { type: "equal"; text: string }
  | { type: "missing"; text: string }
  | { type: "extra"; text: string }
  | { type: "replace"; expected: string; actual: string; spans: CharSpan[] };

/** One entry in the practice queue. `round > 0` means it is a re-listen. */
export type SentenceItem = {
  key: string;
  text: string;
  round: number;
  originIndex: number;
};

export type Attempt = {
  key: string;
  text: string;
  input: string;
  correct: boolean;
  round: number;
  plays: number;
  hints: number;
  ms: number;
};

export type CefrLevel = "A2" | "B1" | "B2" | "C1";

export type Script = {
  id: string;
  title: string;
  source: "paste" | "llm";
  sentences: string[];
  createdAt: number;
};

export type Session = {
  id: string;
  title: string;
  source: "paste" | "llm";
  sentences: string[];
  attempts: Attempt[];
  startedAt: number;
  finishedAt: number;
};

export type LlmConfig = {
  /** Empty string = use the built-in `/llm` proxy that targets local Ollama. */
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type Settings = {
  strictness: Strictness;
  /** Speech rate, 0.6 – 1.2. */
  rate: number;
  voiceURI: string;
  autoPlay: boolean;
  autoAdvance: boolean;
  retryWrong: boolean;
  hideProgress: boolean;
  theme: "dark" | "light";
  llm: LlmConfig;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
