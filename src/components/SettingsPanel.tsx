import { useEffect, useState } from "react";
import type { LlmConfig, Settings, Strictness } from "../lib/types";
import { STRICTNESS_LABELS } from "../lib/grading";
import { HAS_DEV_PROXY, listModels } from "../lib/llm";
import { clampRate, useSpeaker } from "../hooks/useSpeaker";
import { IconClose, IconRefresh, IconSpeaker } from "./Icons";

type Props = {
  open: boolean;
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
  onLlmChange: (partial: Partial<LlmConfig>) => void;
  onClose: () => void;
  onClearHistory: () => void;
};

const STRICTNESS_ORDER: Strictness[] = ["loose", "standard", "strict"];
const PREVIEW_SENTENCE = "The quick brown fox jumps over the lazy dog.";

export function SettingsPanel({
  open,
  settings,
  onChange,
  onLlmChange,
  onClose,
  onClearHistory,
}: Props) {
  const speaker = useSpeaker();
  const [models, setModels] = useState<string[]>([]);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const probe = async () => {
    setProbing(true);
    setProbeError(null);
    try {
      const found = await listModels(settings.llm);
      setModels(found);
      if (found.length === 0) {
        setProbeError("没找到模型。确认 Ollama 正在运行，或者把模型名手填进去。");
      }
    } catch (caught) {
      setProbeError((caught as Error).message);
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="设置">
      <button type="button" className="overlay-backdrop" aria-label="关闭" onClick={onClose} />

      <div className="settings-panel">
        <header className="settings-head">
          <h2>设置</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭设置">
            <IconClose size={18} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-group">
            <h3>朗读</h3>

            <div className="settings-row">
              <div className="settings-label">
                <span>音色</span>
                <span className="settings-hint">只用系统里的英文语音</span>
              </div>
              <div className="settings-control">
                <select
                  value={settings.voiceURI}
                  onChange={(event) => onChange({ voiceURI: event.target.value })}
                >
                  <option value="">系统默认</option>
                  {speaker.voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    void speaker.speak(PREVIEW_SENTENCE, {
                      rate: settings.rate,
                      voiceURI: settings.voiceURI,
                    })
                  }
                >
                  <IconSpeaker size={15} />
                  试听
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <span>语速</span>
                <span className="settings-hint">{settings.rate.toFixed(1)}×</span>
              </div>
              <div className="settings-control">
                <input
                  type="range"
                  min={0.6}
                  max={1.2}
                  step={0.1}
                  value={settings.rate}
                  onChange={(event) => onChange({ rate: clampRate(Number(event.target.value)) })}
                />
              </div>
            </div>
          </section>

          <section className="settings-group">
            <h3>判定</h3>
            <div className="segmented">
              {STRICTNESS_ORDER.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={settings.strictness === value ? "is-active" : ""}
                  onClick={() => onChange({ strictness: value })}
                >
                  <span>{STRICTNESS_LABELS[value].name}</span>
                  <small>{STRICTNESS_LABELS[value].hint}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-group">
            <h3>练习</h3>

            <Toggle
              label="自动朗读新句子"
              hint="进入下一句时自动播放"
              checked={settings.autoPlay}
              onChange={(checked) => onChange({ autoPlay: checked })}
            />
            <Toggle
              label="答对后自动进入下一句"
              hint="不用再按 Enter"
              checked={settings.autoAdvance}
              onChange={(checked) => onChange({ autoAdvance: checked })}
            />
            <Toggle
              label="错句回炉"
              hint="答错的句子在本次练习结束前再考一次"
              checked={settings.retryWrong}
              onChange={(checked) => onChange({ retryWrong: checked })}
            />
            <Toggle
              label="隐藏进度数字"
              hint="只看进度条，减少压力"
              checked={settings.hideProgress}
              onChange={(checked) => onChange({ hideProgress: checked })}
            />
          </section>

          <section className="settings-group">
            <h3>本地大模型</h3>
            <p className="settings-note">
              {HAS_DEV_PROXY ? (
                <>
                  留空默认走内置代理，连本机 Ollama（127.0.0.1:11434）。填写{" "}
                  <code>http://127.0.0.1:1234/v1</code> 这类地址可直连 LM Studio 等 OpenAI 兼容服务。
                </>
              ) : (
                <>
                  页面部署在线上，没有内置代理，会直连本机 Ollama。请用{" "}
                  <code>OLLAMA_ORIGINS={typeof location !== "undefined" ? location.origin : "<站点域名>"} ollama serve</code>{" "}
                  启动，否则浏览器会拦下跨域请求。
                </>
              )}
            </p>

            <label className="field">
              <span>Base URL</span>
              <input
                value={settings.llm.baseUrl}
                onChange={(event) => onLlmChange({ baseUrl: event.target.value })}
                placeholder="留空 = 内置 Ollama 代理"
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>模型</span>
              <div className="input-with-action">
                <input
                  value={settings.llm.model}
                  onChange={(event) => onLlmChange({ model: event.target.value })}
                  placeholder="qwen2.5:7b"
                  list="echotype-models"
                  spellCheck={false}
                />
                <datalist id="echotype-models">
                  {models.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
                <button type="button" className="btn btn-sm" onClick={probe} disabled={probing}>
                  <IconRefresh size={14} />
                  {probing ? "检测中" : "检测"}
                </button>
              </div>
            </label>

            <label className="field">
              <span>API Key（可选）</span>
              <input
                value={settings.llm.apiKey}
                onChange={(event) => onLlmChange({ apiKey: event.target.value })}
                placeholder="本地模型一般不需要"
                type="password"
                spellCheck={false}
              />
            </label>

            {probeError && <p className="error">{probeError}</p>}
          </section>

          <section className="settings-group">
            <h3>外观</h3>
            <div className="segmented compact">
              <button
                type="button"
                className={settings.theme === "dark" ? "is-active" : ""}
                onClick={() => onChange({ theme: "dark" })}
              >
                <span>深色</span>
              </button>
              <button
                type="button"
                className={settings.theme === "light" ? "is-active" : ""}
                onClick={() => onChange({ theme: "light" })}
              >
                <span>浅色</span>
              </button>
            </div>
          </section>

          <section className="settings-group">
            <h3>数据</h3>
            <div className="settings-row">
              <div className="settings-label">
                <span>练习记录</span>
                <span className="settings-hint">只保存在这台设备上</span>
              </div>
              <div className="settings-control">
                <button type="button" className="btn btn-sm btn-danger" onClick={onClearHistory}>
                  清除记录
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

type ToggleProps = {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <div className="settings-row is-clickable">
      <div className="settings-label">
        <span>{label}</span>
        <span className="settings-hint">{hint}</span>
      </div>
      <div className="settings-control">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className={`switch ${checked ? "is-on" : ""}`}
          onClick={() => onChange(!checked)}
        >
          <span className="switch-knob" />
        </button>
      </div>
    </div>
  );
}
