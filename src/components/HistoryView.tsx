import { useState } from "react";
import type { Session } from "../lib/types";
import { formatDate, formatDuration, statsForSession } from "../lib/stats";
import { IconArrowLeft, IconPlay, IconTrash } from "./Icons";

type Props = {
  sessions: Session[];
  onPractice: (sentences: string[], title: string, source: "paste" | "llm") => void;
  onDelete: (id: string) => void;
  onBack: () => void;
};

export function HistoryView({ sessions, onPractice, onDelete, onBack }: Props) {
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);

  return (
    <div className="screen history-screen">
      <header className="history-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <IconArrowLeft size={15} />
          返回
        </button>
        <h1>练习记录</h1>
        <span className="muted">最近 {sessions.length} 次 · 只存在这台设备上</span>
      </header>

      {sessions.length === 0 ? (
        <div className="empty-card">
          <p>还没有练习记录。</p>
          <button type="button" className="btn btn-primary" onClick={onBack}>
            去练一篇
          </button>
        </div>
      ) : (
        <ul className="session-list">
          {sessions.map((session) => {
            const stats = statsForSession(session);
            const isOpen = openId === session.id;
            const wrongTexts = new Set(stats.wrong.map((item) => item.text));

            return (
              <li key={session.id} className={`session-item ${isOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="session-row"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : session.id)}
                >
                  <span className="session-date">{formatDate(session.startedAt)}</span>
                  <span className="session-title">{session.title}</span>
                  <span className="session-meta">
                    {session.sentences.length} 句 · 一次听对{" "}
                    <strong className={stats.firstAccuracy >= 80 ? "is-good" : ""}>
                      {stats.firstAccuracy}%
                    </strong>
                  </span>
                  <span className="session-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div className="session-detail">
                    <div className="session-stats">
                      <span>一次听对率 {stats.firstAccuracy}%</span>
                      <span>全部作答正确率 {stats.accuracy}%</span>
                      <span>平均听 {stats.avgPlays} 遍</span>
                      <span>用时 {formatDuration(stats.durationMs)}</span>
                    </div>

                    <ol className="session-sentences">
                      {session.sentences.map((sentence, index) => (
                        <li
                          key={`${sentence}-${index}`}
                          className={wrongTexts.has(sentence) ? "is-wrong" : ""}
                        >
                          {sentence}
                        </li>
                      ))}
                    </ol>

                    <div className="session-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          onPractice(session.sentences, session.title, session.source)
                        }
                      >
                        <IconPlay size={16} />
                        再练一遍
                      </button>

                      {stats.wrong.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-accent"
                          onClick={() =>
                            onPractice(
                              stats.wrong.map((item) => item.text),
                              `错句重练 · ${session.title}`,
                              session.source,
                            )
                          }
                        >
                          只练错的 {stats.wrong.length} 句
                        </button>
                      )}

                      <span className="spacer" />

                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => onDelete(session.id)}
                      >
                        <IconTrash size={14} />
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
