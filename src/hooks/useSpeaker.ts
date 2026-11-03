import { useCallback, useEffect, useRef, useState } from "react";

const MIN_RATE = 0.6;
const MAX_RATE = 1.2;

export function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(rate * 10) / 10));
}

type SpeakOptions = {
  rate: number;
  voiceURI: string;
};

/**
 * Thin wrapper over the Web Speech API.
 *
 * Two browser quirks are handled here:
 *  - `getVoices()` is empty on first load in Chrome, so we listen for
 *    `voiceschanged` (plus a short poll as a safety net).
 *  - Calling `speak()` in the same tick as `cancel()` can silently drop the
 *    utterance, so we defer by a frame.
 */
export function useSpeaker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;

    const load = () => {
      const english = synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
      setVoices((prev) =>
        prev.length === english.length && prev.every((v, i) => v.voiceURI === english[i].voiceURI)
          ? prev
          : english,
      );
    };

    load();
    synth.addEventListener("voiceschanged", load);
    const poll = window.setInterval(load, 400);
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 5000);

    return () => {
      synth.removeEventListener("voiceschanged", load);
      window.clearInterval(poll);
      window.clearTimeout(stopPoll);
    };
  }, [supported]);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions): Promise<void> => {
      if (!supported || !text.trim()) return Promise.resolve();

      const synth = window.speechSynthesis;
      synth.cancel();

      const token = tokenRef.current + 1;
      tokenRef.current = token;
      setSpeaking(true);

      return new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (tokenRef.current === token) setSpeaking(false);
          resolve();
        };

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = clampRate(options.rate);
        utterance.pitch = 1;
        utterance.volume = 1;

        const voice = voices.find((item) => item.voiceURI === options.voiceURI);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = "en-US";
        }

        utterance.onend = finish;
        utterance.onerror = finish;

        window.setTimeout(() => {
          if (tokenRef.current !== token) {
            finish();
            return;
          }
          try {
            if (synth.paused) synth.resume();
            synth.speak(utterance);
          } catch {
            finish();
          }
        }, 40);
      });
    },
    [supported, voices],
  );

  return { supported, voices, speaking, speak, stop };
}

export type Speaker = ReturnType<typeof useSpeaker>;
