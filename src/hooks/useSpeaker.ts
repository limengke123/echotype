import { useCallback, useEffect, useRef, useState } from "react";

const MIN_RATE = 0.6;
const MAX_RATE = 1.2;

export function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(rate * 10) / 10));
}

/** Chrome ships a handful of "Google ..." voices; those are the only ones we offer. */
export function isGoogleVoice(voice: SpeechSynthesisVoice): boolean {
  return /google/i.test(voice.name) && voice.lang.toLowerCase().startsWith("en");
}

/**
 * Resolves the voice to speak with. An explicit `voiceURI` wins; otherwise we
 * default to Google's US English voice, then any Google voice.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  voiceURI: string,
): SpeechSynthesisVoice | undefined {
  if (voiceURI) {
    const exact = voices.find((voice) => voice.voiceURI === voiceURI);
    if (exact) return exact;
  }

  return (
    voices.find((voice) => /^google us english$/i.test(voice.name)) ??
    voices.find((voice) => /google/i.test(voice.name) && /^en[-_]us$/i.test(voice.lang)) ??
    voices[0]
  );
}

type SpeakOptions = {
  rate: number;
  voiceURI: string;
};

/**
 * Thin wrapper over the Web Speech API.
 *
 * Browser quirks handled here:
 *  - `getVoices()` is empty on the first tick in Chrome. Speaking before the
 *    list arrives makes the first utterance fall back to the system voice,
 *    which sounds nothing like the Google one — so we hold `speak()` until the
 *    voices (or a short timeout) are in.
 *  - Calling `speak()` in the same tick as `cancel()` can silently drop the
 *    utterance, so we defer by a frame.
 */
export function useSpeaker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [ready, setReady] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const tokenRef = useRef(0);
  // `speak()` reads voices through a ref so a callback captured before the
  // list arrived still picks the Google voice later.
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const readyRef = useRef(false);
  const waitersRef = useRef<(() => void)[]>([]);
  const warmedRef = useRef(false);

  const markReady = useCallback(() => {
    readyRef.current = true;
    setReady(true);
    const waiters = waitersRef.current;
    waitersRef.current = [];
    for (const resolve of waiters) resolve();
  }, []);

  useEffect(() => {
    if (!supported) {
      markReady();
      return;
    }

    const synth = window.speechSynthesis;
    const load = () => {
      const google = synth.getVoices().filter(isGoogleVoice);
      const changed =
        google.length !== voicesRef.current.length ||
        !google.every((voice, index) => voice.voiceURI === voicesRef.current[index]?.voiceURI);

      if (changed) {
        voicesRef.current = google;
        setVoices(google);
      }
      if (google.length > 0) markReady();
    };

    load();
    synth.addEventListener("voiceschanged", load);

    const poll = window.setInterval(load, 250);
    // Do not hang the first sentence forever on a browser without Google voices.
    const giveUp = window.setTimeout(markReady, 1500);
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 6000);

    return () => {
      synth.removeEventListener("voiceschanged", load);
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      window.clearTimeout(stopPoll);
    };
  }, [supported, markReady]);

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

  /** Polls briefly for voices that show up right after the first speak starts. */
  const waitForVoices = useCallback(async (timeoutMs: number) => {
    if (voicesRef.current.length > 0) return;
    await new Promise<void>((resolve) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (voicesRef.current.length > 0 || Date.now() - startedAt > timeoutMs) {
          window.clearInterval(timer);
          resolve();
        }
      }, 80);
    });
  }, []);

  /**
   * Chrome's Google voices are synthesised remotely. The very first utterance
   * pays for connecting to that service and often comes out clipped or odd,
   * which is exactly the "first listen sounds weird, replays are fine"
   * symptom. Speaking a silent throwaway line once per page warms it up.
   */
  const warmUp = useCallback(async (voiceURI: string) => {
    if (warmedRef.current || !supported) return;
    warmedRef.current = true;

    const synth = window.speechSynthesis;
    const voice = pickVoice(voicesRef.current, voiceURI);
    if (!voice) return;

    const utterance = new SpeechSynthesisUtterance("Okay.");
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1.2;
    utterance.volume = 0;

    try {
      synth.speak(utterance);
    } catch {
      return;
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
    synth.cancel();
  }, [supported]);

  const speak = useCallback(
    async (text: string, options: SpeakOptions): Promise<void> => {
      if (!supported || !text.trim()) return;

      // Wait for the voice list: the very first utterance must not fall back to
      // the system voice, or it sounds completely different from the replays.
      if (!readyRef.current) {
        await new Promise<void>((resolve) => waitersRef.current.push(resolve));
      }

      // The very first play may still race an empty voice list; give it a
      // short, one-off grace period before falling back to the system voice.
      if (!warmedRef.current) await waitForVoices(600);

      await warmUp(options.voiceURI);

      const synth = window.speechSynthesis;
      synth.cancel();

      const token = tokenRef.current + 1;
      tokenRef.current = token;
      setSpeaking(true);

      await new Promise<void>((resolve) => {
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

        const voice = pickVoice(voicesRef.current, options.voiceURI);
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
    [supported, warmUp, waitForVoices],
  );

  return { supported, voices, speaking, ready, speak, stop };
}

export type Speaker = ReturnType<typeof useSpeaker>;
