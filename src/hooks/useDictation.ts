import { useCallback, useRef, useState } from "react";
import type { Attempt, DiffOp, SentenceItem, Settings } from "../lib/types";
import { isCorrect } from "../lib/grading";
import { diffWords } from "../lib/diff";

export type Phase = "answering" | "reviewing" | "done";

export type Review = {
  correct: boolean;
  ops: DiffOp[];
};

export type DictationApi = {
  queue: SentenceItem[];
  index: number;
  current: SentenceItem | null;
  phase: Phase;
  input: string;
  plays: number;
  hintLevel: number;
  attempts: Attempt[];
  review: Review | null;
  progress: number;
  startedAt: number;
  setInput: (value: string) => void;
  notePlay: () => void;
  revealHint: () => void;
  submit: () => void;
  next: () => void;
  finishNow: () => void;
};

function toQueueItem(text: string, index: number): SentenceItem {
  return { key: `s${index}`, text, round: 0, originIndex: index };
}

export function useDictation(sentences: string[], settings: Settings): DictationApi {
  const [queue, setQueue] = useState<SentenceItem[]>(() =>
    sentences.map((text, index) => toQueueItem(text, index)),
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(sentences.length === 0 ? "done" : "answering");
  const [input, setInput] = useState("");
  const [plays, setPlays] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [review, setReview] = useState<Review | null>(null);

  const attemptStartRef = useRef(Date.now());
  const startedAtRef = useRef(Date.now());

  const current = queue[index] ?? null;

  const restartSentenceClock = useCallback(() => {
    attemptStartRef.current = Date.now();
  }, []);

  const submit = useCallback(() => {
    if (phase !== "answering") return;

    const item = queue[index];
    if (!item) return;

    const correct = isCorrect(item.text, input, settings.strictness);
    const attempt: Attempt = {
      key: item.key,
      text: item.text,
      input,
      correct,
      round: item.round,
      plays,
      hints: hintLevel,
      ms: Date.now() - attemptStartRef.current,
    };

    setAttempts((prev) => [...prev, attempt]);
    setReview({ correct, ops: diffWords(item.text, input) });
    setPhase("reviewing");

    if (!correct && settings.retryWrong && item.round === 0) {
      setQueue((prev) => [...prev, { ...item, key: `${item.key}-again`, round: 1 }]);
    }
  }, [phase, queue, index, input, plays, hintLevel, settings.strictness, settings.retryWrong]);

  const next = useCallback(() => {
    if (index + 1 >= queue.length) {
      setReview(null);
      setPhase("done");
      return;
    }

    setIndex(index + 1);
    setInput("");
    setPlays(0);
    setHintLevel(0);
    setReview(null);
    setPhase("answering");
    restartSentenceClock();
  }, [index, queue.length, restartSentenceClock]);

  const finishNow = useCallback(() => {
    setReview(null);
    setPhase("done");
  }, []);

  const notePlay = useCallback(() => setPlays((prev) => prev + 1), []);
  const revealHint = useCallback(() => setHintLevel((prev) => Math.min(2, prev + 1)), []);

  const progress = queue.length > 0 ? index / queue.length : 0;

  return {
    queue,
    index,
    current,
    phase,
    input,
    plays,
    hintLevel,
    attempts,
    review,
    progress,
    startedAt: startedAtRef.current,
    setInput,
    notePlay,
    revealHint,
    submit,
    next,
    finishNow,
  };
}
