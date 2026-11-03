import { useEffect, useMemo, useRef, useState } from "react";
import type { CefrLevel, Session, Settings } from "../lib/types";
import { countWords, estimateMinutes, splitSentences, titleFromText } from "../lib/splitter";
import { LEVELS, TOPICS, buildMessages, sentencesFromLlm } from "../lib/prompts";
import { LOCAL_TARGET_LABEL, streamChat } from "../lib/llm";
import { formatDate, statsForSession } from "../lib/stats";
import { IconSparkles } from "./Icons";

const SAMPLE_TEXT = `The first time I tried to cook for my roommates, I burned the rice so badly that the smoke alarm went off. Everyone stood in the hallway laughing while I waved a towel at the ceiling. I wanted to disappear, but by the end of the night we were eating takeout on the floor and telling stories about our worst kitchen disasters. It turned out that nobody remembered the failed dinner. They only remembered how hard we laughed.`;

type Props = {
  settings: Settings;
  sessions: Session[];
  onStart: (sentences: string[], title: string, source: "paste" | "llm") => void;
  onOpenSettings: () => void;
};

export function SetupView({ settings, sessions, onStart, onOpenSettings }: Props) {
  const [mode, setMode] = useState<"paste" | "llm">("paste");
  const [raw, setRaw] = useState("");
  const [topic, setTopic] = useState("日常对话");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [sentenceCount, setSentenceCount] = useState(8);
  const [targetWords, setTargetWords] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [generated, setGenerated] = useState(false);

  // Reasoning-style models only send their text at the very end, so show a
  // ticking counter instead of a silent "生成中…".
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [generating]);

  const sentences = useMemo(() => splitSentences(raw), [raw]);
  const words = useMemo(() => countWords(sentences), [sentences]);
  const minutes = useMemo(() => estimateMinutes(sentences), [sentences]);

  const generate = async () => {
    if (generating) return;
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setError(null);
    setRaw("");
    setGenerated(false);

    let accumulated = "";
    try {
      const text = await streamChat({
        config: settings.llm,
        messages: buildMessages({ topic, level, sentenceCount, targetWords }),
        signal: controller.signal,
        onDelta: (delta) => {
          accumulated += delta;
          setRaw(accumulated);
        },
      });

      const source = text || accumulated;
      const cleaned = sentencesFromLlm(source);
      if (cleaned.length === 0) {
        setError("模型没有返回可用的句子，换个模型或者再试一次。");
        setRaw(source);
        return;
      }
      setRaw(cleaned.join("\n"));
      setGenerated(true);
    } catch (caught) {
      if ((caught as Error).name === "AbortError") return;
      setError((caught as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  const start = () => {
    if (sentences.length === 0) return;
    onStart(sentences, titleFromText(sentences), generated ? "llm" : "paste");
  };

  const llmTarget = settings.llm.baseUrl.trim() || LOCAL_TARGET_LABEL;

  return (
    <div className="screen setup-screen">
      <section className="hero">
        <h1>
          听一句，<span className="accent">写一句</span>。
        </h1>
        <p>程序把英文逐句念出来，你把它打回去，立刻看到差在哪里。</p>
      </section>

      <section className="card">
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "paste"}
            className={mode === "paste" ? "is-active" : ""}
            onClick={() => setMode("paste")}
          >
            粘贴文本
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "llm"}
            className={mode === "llm" ? "is-active" : ""}
            onClick={() => setMode("llm")}
          >
            AI 生成
          </button>
        </div>

        {mode === "llm" && (
          <div className="generator">
            <div className="chips">
              {TOPICS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip ${topic === item ? "is-active" : ""}`}
                  onClick={() => setTopic(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="gen-grid">
              <label className="field">
                <span>题材</span>
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="比如：面试、咖啡店、太空探索"
                />
              </label>

              <label className="field">
                <span>难度</span>
                <select value={level} onChange={(event) => setLevel(event.target.value as CefrLevel)}>
                  {LEVELS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>句子数</span>
                <select
                  value={sentenceCount}
                  onChange={(event) => setSentenceCount(Number(event.target.value))}
                >
                  {[5, 8, 10, 12, 15, 20].map((value) => (
                    <option key={value} value={value}>
                      {value} 句
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>目标词（可选）</span>
                <input
                  value={targetWords}
                  onChange={(event) => setTargetWords(event.target.value)}
                  placeholder="commute, budget, awkward"
                />
              </label>
            </div>

            <div className="generator-actions">
              <span className="model-line">
                模型 <code>{settings.llm.model || "未设置"}</code>
                <span className="muted">· {llmTarget}</span>
                <button type="button" className="link" onClick={onOpenSettings}>
                  设置
                </button>
              </span>

              <span className="spacer" />

              {generating ? (
                <button type="button" className="btn btn-ghost" onClick={stopGenerating}>
                  停止
                </button>
              ) : null}

              <button type="button" className="btn btn-accent" onClick={generate} disabled={generating}>
                <IconSparkles size={16} />
                {generating ? `生成中… ${elapsed}s` : "生成文本"}
              </button>
            </div>
          </div>
        )}

        <textarea
          className="text-input"
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setGenerated(false);
          }}
          placeholder={
            mode === "llm"
              ? "点「生成文本」让本地模型出题，生成后可以在这里直接修改…"
              : "把一段英文贴进来。可以是文章、台词、播客转写稿，程序会自动拆成一句一句。"
          }
          spellCheck={false}
        />

        <div className="card-foot">
          <span className="stats-line">
            {sentences.length} 句 · {words} 词 · 约 {minutes} 分钟
          </span>

          <span className="spacer" />

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setRaw(SAMPLE_TEXT);
              setGenerated(false);
            }}
          >
            示例
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setRaw("");
              setGenerated(false);
            }}
            disabled={raw === ""}
          >
            清空
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="btn btn-primary btn-xl"
        onClick={start}
        disabled={sentences.length === 0}
      >
        开始练习
        {sentences.length > 0 && <span className="btn-sub">· {sentences.length} 句</span>}
      </button>

      {sessions.length > 0 && (
        <section className="history">
          <h2>最近练习</h2>
          <ul>
            {sessions.slice(0, 5).map((session) => {
              const stats = statsForSession(session);
              return (
                <li key={session.id}>
                  <span className="history-title">{session.title}</span>
                  <span className="history-meta">
                    {session.sentences.length} 句 · 一次听对 {stats.firstAccuracy}% ·{" "}
                    {formatDate(session.startedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
