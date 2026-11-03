import type { Session, Settings } from "./types";

const SETTINGS_KEY = "echotype.settings.v1";
const SESSIONS_KEY = "echotype.sessions.v1";
const MAX_SESSIONS = 30;

export const DEFAULT_SETTINGS: Settings = {
  strictness: "loose",
  rate: 0.9,
  voiceURI: "",
  autoPlay: true,
  autoAdvance: true,
  retryWrong: true,
  hideProgress: false,
  theme: "dark",
  llm: {
    baseUrl: "",
    model: "qwen2.5:7b",
    apiKey: "",
  },
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private mode — practice still works, it just will not persist */
  }
}

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(SETTINGS_KEY);
  if (!stored) return DEFAULT_SETTINGS;

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    llm: { ...DEFAULT_SETTINGS.llm, ...(stored.llm ?? {}) },
  };
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function loadSessions(): Session[] {
  const stored = readJson<Session[]>(SESSIONS_KEY);
  return Array.isArray(stored) ? stored : [];
}

export function saveSession(session: Session): Session[] {
  const sessions = [session, ...loadSessions()].slice(0, MAX_SESSIONS);
  writeJson(SESSIONS_KEY, sessions);
  return sessions;
}

export function clearSessions(): void {
  writeJson(SESSIONS_KEY, []);
}
