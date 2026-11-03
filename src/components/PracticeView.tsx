import { useCallback, useEffect, useRef } from "react";
import type { Settings } from "../lib/types";
import type { Attempt } from "../lib/types";
import { buildHint } from "../lib/grading";
import { useSpeaker } from "../hooks/useSpeaker";
import { useDictation } from "../hooks/useDictation";
import { ReviewPanel } from "./ReviewPanel";
import { IconPlay, IconSpeaker } from "./Icons";

type Props = {
  sentences: string[];
  settings: Settings;
  onFinish: (attempts: Attempt[], startedAt: number) => void;
  onExit: () => void;
  onOpenSettings: () => void;
};

export function PracticeView({ sentences, settings, onFinish, onExit, onOpenSettings }: Props) {
  const speaker = useSpeaker();
  const dictation = useDictation(sentences, settings);

  const apiRef = useRef(dictation);
  apiRef.current = dictation;

  const spokenKeyRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  const { current, phase, index, queue, plays, hintLevel, input, review } = dictation;

  const replay = useCallback(() => {
    const item = apiRef.current.current;
    if (!item) return;
    apiRef.current.notePlay();
    void speaker.speak(item.text, { rate: settings.rate, voiceURI: settings.voiceURI });
  }, [speaker, settings.rate, settings.voiceURI]);

  const handleSubmit = useCallback(() => {
    const api = apiRef.current;
    if (api.phase !== "answering") return;
    speaker.stop();
    api.submit();
  }, [speaker]);

  // Auto-play the first listen of every new sentence.
  useEffect(() => {
    const item = dictation.current;
    if (!item || phase === "done") return;
    if (spokenKeyRef.current === item.key) return;
    spokenKeyRef.current = item.key;

    inputRef.current?.focus();

    if (!settings.autoPlay) return;
    apiRef.current.notePlay();
    void speaker.speak(item.text, { rate: settings.rate, voiceURI: settings.voiceURI });
    // Deliberately keyed on the sentence only: changing the rate must not re-speak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key, phase]);

  // Hand the finished session to the stats screen exactly once.
  useEffect(() => {
    if (phase !== "done" || finishedRef.current) return;
    finishedRef.current = true;
    speaker.stop();
    onFinish(dictation.attempts, dictation.startedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Correct answer + auto-advance on: move along after a beat.
  useEffect(() => {
    if (phase !== "reviewing" || !review?.correct || !settings.autoAdvance) return;
    const timer = window.setTimeout(() => apiRef.current.next(), 1300);
    return () => window.clearTimeout(timer);
  }, [phase, review, settings.autoAdvance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;

      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const api = apiRef.current;

      switch (event.key) {
        case "Enter": {
          if (inField && target?.tagName === "TEXTAREA") return;
          event.preventDefault();
          if (api.phase === "reviewing") {
            speaker.stop();
            api.next();
          } else if (api.phase === "answering") {
            handleSubmit();
          }
          break;
        }
        case "Tab": {
          event.preventDefault();
          if (api.phase === "answering") api.revealHint();
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          replay();
          break;
        }
        case "Escape": {
          speaker.stop();
          break;
        }
        case " ": {
          if (inField && api.input === "" && api.phase === "answering") {
            event.preventDefault();
            replay();
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSubmit, replay, speaker]);

  const hint = current ? buildHint(current.text) : null;
  const total = queue.length;
  const progress = total > 0 ? Math.min(100, ((index + (phase === "reviewing" ? 1 : 0)) / total) * 100) : 0;
  const isLast = index + 1 >= total;

  if (!current) {
    return (
      <div className="screen">
        <p className="empty-state">没有可练习的句子。</p>
        <button type="button" className="btn" onClick={onExit}>
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="screen practice-screen">
      <div className="practice-head">
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          退出
        </button>

        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          {!settings.hideProgress && (
            <span className="progress-label">
              第 {index + 1} / {total} 句{current.round > 0 ? " · 重练" : ""}
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            speaker.stop();
            apiRef.current.finishNow();
          }}
        >
          结束
        </button>
      </div>

      <div className="stage">
        <button
          type="button"
          className={`play-button ${speaker.speaking ? "is-speaking" : ""}`}
          onClick={replay}
          aria-label="重听这一句"
        >
          <span className="ring" />
          <span className="ring ring-2" />
          {speaker.speaking ? (
            <span className="bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <IconPlay size={34} />
          )}
        </button>

        <div className="stage-meta">
          <span>已听 {plays} 次</span>
          <span className="sep">·</span>
          <span>{settings.rate.toFixed(1)}× 语速</span>
          <span className="sep">·</span>
          <button type="button" className="link" onClick={onOpenSettings}>
            调整
          </button>
        </div>

        {speaker.supported ? null : (
          <p className="warn-text">当前浏览器不支持语音合成，请换用 Chrome / Edge / Safari。</p>
        )}
      </div>

      {hintLevel > 0 && hint && (
        <div className="hint">
          <span className="hint-tag">提示 {hintLevel}/2</span>
          <span className="hint-body">
            {hintLevel === 1
              ? `${hint.words} 个单词 · ${hint.chars} 个字符`
              : hint.skeleton}
          </span>
        </div>
      )}

      {phase === "answering" ? (
        <div className="answer">
          <input
            ref={inputRef}
            className="answer-input"
            value={input}
            onChange={(event) => dictation.setInput(event.target.value)}
            placeholder="听到什么就写什么…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          <div className="answer-actions">
            <span className="keyboard-hints">
              <kbd>Enter</kbd> 提交
              <kbd>Tab</kbd> 提示
              <kbd>↑</kbd> 重听
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={input.trim() === ""}
            >
              提交
            </button>
          </div>
        </div>
      ) : review ? (
        <ReviewPanel
          correct={review.correct}
          ops={review.ops}
          input={input}
          isLast={isLast}
          autoAdvance={settings.autoAdvance}
          onReplay={replay}
          onNext={() => {
            speaker.stop();
            apiRef.current.next();
          }}
        />
      ) : null}

      <div className="practice-foot">
        <IconSpeaker size={14} />
        <span>点圆形按钮、按 ↑ 或空格（未输入时）都可以重听</span>
      </div>
    </div>
  );
}
