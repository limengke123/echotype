import type { CharSpan, DiffOp } from "./types";

function tokenize(text: string): string[] {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
}

/** Comparison key: case- and punctuation-insensitive so "Hello," matches "hello". */
function tokenKey(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

/** LCS over code points, rendered relative to `expected`. */
export function charDiff(expected: string, actual: string): CharSpan[] {
  const a = Array.from(expected);
  const b = Array.from(actual);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const spans: CharSpan[] = [];
  const push = (type: CharSpan["type"], text: string) => {
    const last = spans[spans.length - 1];
    if (last && last.type === type) last.text += text;
    else spans.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("del", a[i]);
      i += 1;
    } else {
      push("ins", b[j]);
      j += 1;
    }
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("ins", b[j++]);

  return spans;
}

type Pair = { expected?: string; actual?: string };

function alignWords(a: string[], b: string[]): Pair[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        tokenKey(a[i]) === tokenKey(b[j])
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const pairs: Pair[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tokenKey(a[i]) === tokenKey(b[j])) {
      pairs.push({ expected: a[i], actual: b[j] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pairs.push({ expected: a[i] });
      i += 1;
    } else {
      pairs.push({ actual: b[j] });
      j += 1;
    }
  }
  while (i < n) pairs.push({ expected: a[i++] });
  while (j < m) pairs.push({ actual: b[j++] });
  return pairs;
}

/**
 * Word-level diff. Deletions and insertions that sit next to each other are
 * paired up as `replace` ops so the UI can show a character-level highlight.
 */
export function diffWords(expected: string, actual: string): DiffOp[] {
  const ops: DiffOp[] = [];
  const pendingMissing: string[] = [];
  const pendingExtra: string[] = [];

  const flush = () => {
    const count = Math.max(pendingMissing.length, pendingExtra.length);
    for (let i = 0; i < count; i += 1) {
      const want = pendingMissing[i];
      const got = pendingExtra[i];
      if (want !== undefined && got !== undefined) {
        ops.push({ type: "replace", expected: want, actual: got, spans: charDiff(want, got) });
      } else if (want !== undefined) {
        ops.push({ type: "missing", text: want });
      } else if (got !== undefined) {
        ops.push({ type: "extra", text: got });
      }
    }
    pendingMissing.length = 0;
    pendingExtra.length = 0;
  };

  for (const pair of alignWords(tokenize(expected), tokenize(actual))) {
    if (pair.expected !== undefined && pair.actual !== undefined) {
      flush();
      ops.push({ type: "equal", text: pair.expected });
    } else if (pair.expected !== undefined) {
      pendingMissing.push(pair.expected);
    } else if (pair.actual !== undefined) {
      pendingExtra.push(pair.actual);
    }
  }
  flush();

  return ops;
}

export type DiffSummary = {
  missing: number;
  extra: number;
  replaced: number;
  total: number;
};

export function summariseDiff(ops: DiffOp[]): DiffSummary {
  let missing = 0;
  let extra = 0;
  let replaced = 0;
  for (const op of ops) {
    if (op.type === "missing") missing += 1;
    else if (op.type === "extra") extra += 1;
    else if (op.type === "replace") replaced += 1;
  }
  return { missing, extra, replaced, total: missing + extra + replaced };
}
