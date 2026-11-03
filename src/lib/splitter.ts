/**
 * Turns pasted prose (or LLM output) into a clean list of dictation sentences.
 *
 * This is deliberately opinionated: the goal is "one sentence = one listening
 * turn", so markdown noise is stripped, wrapped lines are re-joined, and
 * abbreviations such as `Mr.` / `e.g.` / `U.S.` do not split a sentence.
 */

/** Sentences longer than this are split again so nobody listens for 40 seconds. */
export const MAX_SENTENCE_LENGTH = 190;

const TERMINATORS = ".!?…";

/**
 * Tokens that end with a dot but essentially never end a sentence, even when a
 * capital letter follows ("Dr. Smith", "the U.S. Army", "7 p.m. Sharp").
 */
const NEVER_SPLITS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "st", "mt", "sgt", "capt", "rev",
  "gen", "col", "lt", "hon", "pres",
  "e.g", "i.e", "u.s", "u.k", "u.n", "a.m", "p.m", "vs", "approx", "dept",
  "est", "fig", "vol", "al",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept",
  "oct", "nov", "dec", "mon", "tue", "tues", "wed", "thu", "thur", "thurs",
  "fri", "sat", "sun",
]);

/**
 * Abbreviations that mostly DO close a sentence when a capital follows, e.g.
 * "He works at Acme Inc. It is fine."
 */
const OFTEN_ENDS = new Set(["etc", "inc", "ltd", "co", "corp", "jr", "no"]);

function stripMarkdown(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/^[ \t]{0,3}[-*+•][ \t]+/gm, "")
    .replace(/^[ \t]{0,3}\d{1,3}[.)][ \t]+/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1");
}

/**
 * Decides whether the terminator we just consumed really ends a sentence.
 *
 * `chunk` is everything collected so far (ending with the terminator and any
 * closing quotes), `rest` is the remainder of the paragraph.
 */
function isBoundary(chunk: string, rest: string): boolean {
  const withoutClosers = chunk.replace(/["'”’)\]]+$/, "");
  const dotRun = /\.+$/.exec(withoutClosers);

  // `!`, `?` and `…` always end a sentence.
  if (!dotRun) return true;

  const nextChar = rest.replace(/^[\s"'“”‘’(\[]+/, "").charAt(0);
  if (!nextChar) return true;

  // A lowercase continuation means the dot belonged to something like `e.g.`
  // or a wrapped line — keep collecting.
  if (!/[A-Z0-9"'“”‘’(\[\-—–]/.test(nextChar)) return false;

  // `3.14` — a dot between digits with no space after it is a decimal point.
  if (/[0-9]/.test(nextChar) && !/^\s/.test(rest)) return false;

  const before = withoutClosers.slice(0, -dotRun[0].length);
  const wordMatch = /([\p{L}.]+)$/u.exec(before);
  if (!wordMatch) return true;

  const token = wordMatch[1];
  const lower = token.toLowerCase();

  if (NEVER_SPLITS.has(lower)) return false;
  if (OFTEN_ENDS.has(lower)) return true;
  // Single capital letter = an initial, as in "J. K. Rowling".
  if (/^\p{L}$/u.test(token)) return false;

  return true;
}

function splitParagraph(paragraph: string): string[] {
  const out: string[] = [];
  let buf = "";

  for (let i = 0; i < paragraph.length; i += 1) {
    const ch = paragraph[i];
    buf += ch;
    if (!TERMINATORS.includes(ch)) continue;

    let j = i + 1;
    // Swallow runs like "?!" or "...".
    while (j < paragraph.length && (TERMINATORS.includes(paragraph[j]) || paragraph[j] === ".")) {
      buf += paragraph[j];
      j += 1;
    }
    // Swallow closing quotes/brackets that belong to this sentence.
    while (j < paragraph.length && /["'”’)\]]/.test(paragraph[j])) {
      buf += paragraph[j];
      j += 1;
    }

    i = j - 1;
    if (isBoundary(buf, paragraph.slice(j))) {
      out.push(buf);
      buf = "";
    }
  }

  if (buf.trim()) out.push(buf);
  return out;
}

const WRAPPING_OPEN = /^["'“”‘’(\[]/u;
const WRAPPING_CLOSE = /["'”’)\]]$/u;

function cleanSentence(sentence: string): string {
  let cleaned = sentence.replace(/\s+/g, " ").replace(/^[-–—\s]+/u, "").trim();

  // Only unwrap quotes/brackets when they actually wrap the whole sentence.
  // Otherwise the closing quote of `He said "Stop!"` would be eaten.
  if (WRAPPING_OPEN.test(cleaned) && WRAPPING_CLOSE.test(cleaned)) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/** Picks the nicest place to cut an over-long sentence, or -1 if none exists. */
function findCut(sentence: string): number {
  const mid = sentence.length / 2;
  for (const pattern of [/[;:]/g, /,/g]) {
    const positions: number[] = [];
    for (const match of sentence.matchAll(pattern)) {
      if (match.index !== undefined) positions.push(match.index);
    }
    const usable = positions.filter((p) => p > sentence.length * 0.3 && p < sentence.length * 0.85);
    if (usable.length > 0) {
      usable.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      return usable[0];
    }
  }
  return -1;
}

function splitLong(sentence: string): string[] {
  if (sentence.length <= MAX_SENTENCE_LENGTH) return [sentence];
  const cut = findCut(sentence);
  if (cut <= 0) return [sentence];
  const head = sentence.slice(0, cut + 1).trim();
  const tail = sentence.slice(cut + 1).trim();
  const parts = [...splitLong(head), ...splitLong(tail)];
  return parts.filter((p) => /\p{L}/u.test(p));
}

export function splitSentences(raw: string): string[] {
  if (!raw.trim()) return [];
  const cleaned = stripMarkdown(raw);
  const blocks = cleaned.split(/\n{2,}/);
  const chunks: string[] = [];

  for (const block of blocks) {
    // Re-join hard-wrapped lines inside a paragraph; real sentence ends are
    // recovered by the punctuation pass below.
    const paragraph = block.replace(/\s*\n\s*/g, " ").trim();
    if (!paragraph) continue;
    chunks.push(...splitParagraph(paragraph));
  }

  const sentences: string[] = [];
  for (const chunk of chunks) {
    const cleanedSentence = cleanSentence(chunk);
    if (!cleanedSentence || !/\p{L}/u.test(cleanedSentence)) continue;
    sentences.push(...splitLong(cleanedSentence));
  }
  return sentences;
}

export function countWords(sentences: string[]): number {
  return sentences.join(" ").split(/\s+/).filter(Boolean).length;
}

/** Rough wall-clock estimate: speaking time plus typing time. */
export function estimateMinutes(sentences: string[]): number {
  const words = countWords(sentences);
  if (words === 0) return 0;
  const speakingMinutes = words / 150;
  return Math.max(1, Math.round(speakingMinutes * 2.6));
}

/** A short abbreviation of the sentence used as a title. */
export function titleFromText(sentences: string[]): string {
  const first = sentences[0] ?? "";
  const words = first.split(/\s+/).slice(0, 6).join(" ");
  const title = words.length > 42 ? `${words.slice(0, 42)}…` : words;
  return title || "未命名练习";
}
