import type { Attempt, DiffOp, Session } from "./types";
import { diffWords } from "./diff.ts";

export type WrongSentence = {
  text: string;
  input: string;
  ops: DiffOp[];
};

export type SessionStats = {
  /** Total answers given, including retries. */
  attempts: number;
  /** Number of sentences in the original text. */
  total: number;
  correctAll: number;
  correctFirst: number;
  accuracy: number;
  firstAccuracy: number;
  avgPlays: number;
  hints: number;
  durationMs: number;
  wrong: WrongSentence[];
};

function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function computeStats(attempts: Attempt[], total: number, durationMs: number): SessionStats {
  const correctAll = attempts.filter((a) => a.correct).length;
  const firstRound = attempts.filter((a) => a.round === 0);
  const correctFirst = firstRound.filter((a) => a.correct).length;

  const plays = attempts.reduce((sum, a) => sum + a.plays, 0);
  const hints = attempts.reduce((sum, a) => sum + a.hints, 0);

  const wrongBySentence = new Map<string, Attempt>();
  for (const attempt of attempts) {
    if (attempt.round !== 0 || attempt.correct) continue;
    if (!wrongBySentence.has(attempt.text)) wrongBySentence.set(attempt.text, attempt);
  }

  return {
    attempts: attempts.length,
    total,
    correctAll,
    correctFirst,
    accuracy: ratio(correctAll, attempts.length),
    firstAccuracy: ratio(correctFirst, total),
    avgPlays: attempts.length > 0 ? Math.round((plays / attempts.length) * 10) / 10 : 0,
    hints,
    durationMs,
    wrong: [...wrongBySentence.values()].map((attempt) => ({
      text: attempt.text,
      input: attempt.input,
      ops: diffWords(attempt.text, attempt.input),
    })),
  };
}

export function statsForSession(session: Session): SessionStats {
  const finishedAt = session.finishedAt ?? Date.now();
  return computeStats(session.attempts, session.sentences.length, finishedAt - session.startedAt);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${String(seconds).padStart(2, "0")} 秒`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
