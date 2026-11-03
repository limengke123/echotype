import { useEffect, useState } from "react";
import type { Attempt, Script, Session } from "./lib/types";
import { useSettings } from "./hooks/useSettings";
import { clearSessions, loadSessions, saveSession } from "./lib/storage";
import { statsForSession } from "./lib/stats";
import { SetupView } from "./components/SetupView";
import { PracticeView } from "./components/PracticeView";
import { StatsView } from "./components/StatsView";
import { SettingsPanel } from "./components/SettingsPanel";
import { IconGear, IconWave } from "./components/Icons";

type Screen = "setup" | "practice" | "stats";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const { settings, patch, patchLlm } = useSettings();

  const [screen, setScreen] = useState<Screen>("setup");
  const [script, setScript] = useState<Script | null>(null);
  const [runId, setRunId] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const startPractice = (sentences: string[], title: string, source: "paste" | "llm") => {
    setScript({
      id: newId(),
      title,
      source,
      sentences,
      createdAt: Date.now(),
    });
    setSession(null);
    setRunId((value) => value + 1);
    setScreen("practice");
  };

  const finishPractice = (attempts: Attempt[], startedAt: number) => {
    if (!script) return;

    const finished: Session = {
      id: newId(),
      title: script.title,
      source: script.source,
      sentences: script.sentences,
      attempts,
      startedAt,
      finishedAt: Date.now(),
    };

    setSession(finished);
    setSessions(saveSession(finished));
    setScreen("stats");
  };

  const backToSetup = () => {
    setScreen("setup");
    setSession(null);
  };

  const exitPractice = () => {
    if (window.confirm("退出会丢弃这一轮的进度，确定吗？")) backToSetup();
  };

  const retryWrong = () => {
    if (!session) return;
    const stats = statsForSession(session);
    const wrong = stats.wrong.map((item) => item.text);
    if (wrong.length === 0) return;
    startPractice(wrong, `错句重练 · ${session.title}`, session.source);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <IconWave size={16} />
          </span>
          <span className="brand-name">EchoType</span>
          <span className="brand-tag">英文听写</span>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          aria-label="打开设置"
        >
          <IconGear size={18} />
        </button>
      </header>

      <main className="main">
        {screen === "setup" && (
          <SetupView
            settings={settings}
            sessions={sessions}
            onStart={startPractice}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {screen === "practice" && script && (
          <PracticeView
            key={runId}
            sentences={script.sentences}
            settings={settings}
            onFinish={finishPractice}
            onExit={exitPractice}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {screen === "stats" && session && (
          <StatsView
            session={session}
            settings={settings}
            onAgain={() => {
              setRunId((value) => value + 1);
              setScreen("practice");
            }}
            onRetryWrong={retryWrong}
            onNew={backToSetup}
          />
        )}
      </main>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={patch}
        onLlmChange={patchLlm}
        onClose={() => setSettingsOpen(false)}
        onClearHistory={() => {
          clearSessions();
          setSessions([]);
        }}
      />
    </div>
  );
}
