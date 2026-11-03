import { useCallback, useEffect, useState } from "react";
import type { LlmConfig, Settings } from "../lib/types";
import { loadSettings, saveSettings } from "../lib/storage";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const patch = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchLlm = useCallback((partial: Partial<LlmConfig>) => {
    setSettings((prev) => ({ ...prev, llm: { ...prev.llm, ...partial } }));
  }, []);

  return { settings, patch, patchLlm };
}
