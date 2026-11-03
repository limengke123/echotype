import { useMemo } from "react";
import type { Session, Settings } from "../lib/types";
import { formatDuration, statsForSession } from "../lib/stats";
import { DiffView } from "./DiffView";
import { useSpeaker } from "../hooks/useSpeaker";
import { IconSpeaker } from "./Icons";

type Props = {
  session: Session;
  settings: Settings;
  onAgain: () => void;
  onRetryWrong: () => void;
  onNew: () => void;
};

export function StatsView({ session, settings, onAgain, onRetryWrong, onNew }: Props) {
  const speaker = useSpeaker();
  const stats = useMemo(() => statsForSession(session), [session]);
  const hasWrong = stats.wrong.length > 0;

  return (
    <div className="screen stats-screen">
      <section className="result-hero">
        <span className={`result-badge ${stats.firstAccuracy >= 80 ? "is-great" : ""}`}>
          {stats.firstAccuracy}%
        </span>
        <div>
          <h1>练习完成</h1>
          <p className="muted">
            {session.sentences.length} 句 · {stats.attempts} 次作答 · 用时{" "}
            {formatDuration(stats.durationMs)}
          </p>
        </div>
      </section>

      <div className="metric-grid">
        <div className="metric">
          <span className="metric-value">{stats.firstAccuracy}%</span>
          <span className="metric-label">一次听对率</span>
        </div>
        <div className="metric">
          <span className="metric-value">{stats.accuracy}%</span>
          <span className="metric-label">全部作答正确率</span>
        </div>
        <div className="metric">
          <span className="metric-value">{stats.avgPlays}</span>
          <span className="metric-label">平均每句听几遍</span>
        </div>
        <div className="metric">
          <span className="metric-value">{stats.hints}</span>
          <span className="metric-label">使用提示次数</span>
        </div>
      </div>

      {hasWrong ? (
        <section className="wrong-list">
          <h2>
            需要再听的句子<span className="count">{stats.wrong.length}</span>
          </h2>
          <ul>
            {stats.wrong.map((item, index) => (
              <li key={`${item.text}-${index}`}>
                <button
                  type="button"
                  className="mini-play"
                  aria-label="朗读这句"
                  onClick={() =>
                    void speaker.speak(item.text, {
                      rate: settings.rate,
                      voiceURI: settings.voiceURI,
                    })
                  }
                >
                  <IconSpeaker size={16} />
                </button>

                <div className="wrong-body">
                  <div className="wrong-expected">
                    <DiffView ops={item.ops} variant="expected" />
                  </div>
                  {item.input.trim() !== "" ? (
                    <div className="wrong-input">
                      你写的是：<DiffView ops={item.ops} variant="actual" />
                    </div>
                  ) : (
                    <div className="wrong-input">你留空了</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="perfect">
          <p>全部一次听对，厉害。</p>
        </section>
      )}

      <div className="result-actions">
        {hasWrong && (
          <button type="button" className="btn btn-accent" onClick={onRetryWrong}>
            只练错的 {stats.wrong.length} 句
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          再练一遍
        </button>
        <button type="button" className="btn" onClick={onNew}>
          换一篇
        </button>
      </div>
    </div>
  );
}
