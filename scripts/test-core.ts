/**
 * Plain-Node sanity checks for the framework-free logic layer.
 *
 * Run with `npm run test:core` (esbuild bundles it, so no extra deps).
 */
import { splitSentences, countWords, estimateMinutes } from "../src/lib/splitter.ts";
import { buildHint, isCorrect, normalizeAnswer } from "../src/lib/grading.ts";
import { diffWords, summariseDiff } from "../src/lib/diff.ts";
import { buildMessages, sentencesFromLlm } from "../src/lib/prompts.ts";
import { computeStats, formatDuration } from "../src/lib/stats.ts";
import { looksLikeChainOfThought } from "../src/lib/llm.ts";

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`✗ ${name}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

function ok(name: string, condition: boolean, detail = "") {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`✗ ${name}${detail ? `\n    ${detail}` : ""}`);
  }
}

/* ---------------- splitting ---------------- */

check(
  "splits three plain sentences",
  splitSentences("Hello world. How are you? I am fine!"),
  ["Hello world.", "How are you?", "I am fine!"],
);

check(
  "keeps titles and country abbreviations together",
  splitSentences("Dr. Smith lives in the U.S. He works at Acme Inc. It is fine."),
  ["Dr. Smith lives in the U.S. He works at Acme Inc.", "It is fine."],
);

check(
  "does not split decimal numbers",
  splitSentences("The price is 3.14 dollars. It is cheap."),
  ["The price is 3.14 dollars.", "It is cheap."],
);

check(
  "does not split lowercase continuation after e.g.",
  splitSentences("I like citrus fruit, e.g. lemons and limes. They are sour."),
  ["I like citrus fruit, e.g. lemons and limes.", "They are sour."],
);

check(
  "handles closing quotes",
  splitSentences('He said "Stop!" Then he left.'),
  ['He said "Stop!"', "Then he left."],
);

check(
  "strips markdown bullets and numbering",
  splitSentences("1. First one.\n2. Second one."),
  ["First one.", "Second one."],
);

check(
  "rejoins hard-wrapped lines",
  splitSentences("This sentence was\nwrapped across lines. And so\nwas this one."),
  ["This sentence was wrapped across lines.", "And so was this one."],
);

check("ignores blank input", splitSentences("   \n\n  "), []);

check("drops fragments without letters", splitSentences("123. 456."), []);

const long = splitSentences(
  "This is a deliberately long sentence that goes on and on about nothing in particular, because it keeps adding clauses, and then more clauses, until it has comfortably exceeded the maximum length that anybody would want to listen to in a single go, which is why the splitter is supposed to break it apart somewhere sensible.",
);
ok("splits over-long sentences", long.length >= 2, `got ${long.length} parts`);
ok("keeps every part under the cap", long.every((s) => s.length <= 195), long.map((s) => s.length).join(","));

/* ---------------- grading ---------------- */

check("loose ignores case and punctuation", isCorrect("Hello, World!", "hello world", "loose"), true);
check("loose ignores curly quotes", isCorrect("It’s fine.", "it's fine", "loose"), true);
check("loose still fails on real typos", isCorrect("Hello, World!", "hello wurld", "loose"), false);
check("standard needs punctuation", isCorrect("Hello, World!", "hello world", "standard"), false);
check("standard accepts lowercase version", isCorrect("Hello, World!", "hello, world!", "standard"), true);
check("strict needs capitalisation", isCorrect("Hello.", "hello.", "strict"), false);
check("strict normalises curly quotes", isCorrect("It’s fine.", "It's fine.", "strict"), true);
check("empty answer is wrong", isCorrect("Hello.", "   ", "loose"), false);
check("loose strips apostrophes", normalizeAnswer("Don't stop.", "loose"), "dont stop");
check("standard keeps apostrophes", normalizeAnswer("Don't stop.", "standard"), "don't stop.");

const hint = buildHint("The cat sat.");
check("hint word count", hint.words, 3);
check("hint skeleton shape", hint.skeleton, "T··  c··  s···");

/* ---------------- diff ---------------- */

check("identical text has no differences", summariseDiff(diffWords("The cat sat.", "The cat sat.")).total, 0);

const typo = diffWords("The cat sat.", "The cat sit.");
check("typo becomes one replace", summariseDiff(typo).replaced, 1);
ok(
  "typo highlights the differing characters",
  typo.some((op) => op.type === "replace" && op.spans.some((span) => span.type === "del" && span.text === "a")),
  JSON.stringify(typo),
);

const dropped = diffWords("The cat sat on the mat.", "The cat sat.");
check("dropped words are missing", summariseDiff(dropped).missing, 3);

const added = diffWords("The cat sat.", "The cat sat on the mat.");
check("extra words are extra", summariseDiff(added).extra, 3);

const caseOnly = diffWords("Hello there.", "hello there.");
check("case difference is treated as equal", summariseDiff(caseOnly).total, 0);

/* ---------------- llm output parsing ---------------- */

check(
  "parses numbered llm output",
  sentencesFromLlm("1. First line here.\n2. Second line here.\n3. Third line here."),
  ["First line here.", "Second line here.", "Third line here."],
);

check(
  "falls back to punctuation splitting for prose",
  sentencesFromLlm("One thing happened. Then another thing happened. Nothing else."),
  ["One thing happened.", "Then another thing happened.", "Nothing else."],
);

const messages = buildMessages({ topic: "travel", level: "B1", sentenceCount: 6, targetWords: "" });
check("prompt has system and user", messages.length, 2);
ok("prompt mentions the count", messages[1].content.includes("6 sentences"));
ok("system prompt forbids numbering", messages[0].content.toLowerCase().includes("no numbering"));

/* ---------------- stats ---------------- */

const attempts = [
  { key: "a", text: "One.", input: "one.", correct: true, round: 0, plays: 1, hints: 0, ms: 100 },
  { key: "b", text: "Two.", input: "tow.", correct: false, round: 0, plays: 3, hints: 1, ms: 200 },
  { key: "b", text: "Two.", input: "two.", correct: true, round: 1, plays: 1, hints: 0, ms: 150 },
];

const stats = computeStats(attempts, 2, 12_000);
check("counts total attempts", stats.attempts, 3);
check("first-round accuracy", stats.firstAccuracy, 50);
check("overall accuracy", stats.accuracy, 67);
check("average plays", stats.avgPlays, 1.7);
check("collects the wrong sentence once", stats.wrong.length, 1);
check("formats duration", formatDuration(12_000), "12 秒");
check("formats long duration", formatDuration(95_000), "1 分 35 秒");

/* ---------------- reasoning channel ---------------- */

const materialFromReasoning =
  "I walk to the park every morning for exercise.\n" +
  "She likes to read books in her cozy living room.\n" +
  "We should go to the cinema this weekend.";

ok(
  "plain material in the reasoning channel is accepted",
  looksLikeChainOfThought(materialFromReasoning) === false,
  materialFromReasoning,
);

ok(
  "a chain of thought is rejected",
  looksLikeChainOfThought("Let me think about this. The user wants eight short sentences for dictation."),
);

ok(
  "a planning preamble is rejected",
  looksLikeChainOfThought("Here are the sentences you asked for:\n1. First one.\n2. Second one."),
);

ok(
  "material starting with an ordinary verb is accepted",
  looksLikeChainOfThought("Let me explain the rules to the new players at the club.") === false,
);

/* ---------------- misc ---------------- */

check("counts words", countWords(["one two", "three"]), 3);
ok("estimates at least a minute", estimateMinutes(["one two three"]) >= 1);

/* ---------------- summary ---------------- */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
