import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  onSubmit?: () => void;
  disabled?: boolean;
};

/**
 * The typing surface for a dictated sentence.
 *
 * This is a real `<textarea>` — native caret placement, selection, IME and
 * undo all behave the way people expect. It auto-grows instead of scrolling,
 * so a long sentence wraps onto the next line without a scrollbar.
 */
export function TypeArea({ value, onChange, inputRef, placeholder, onSubmit, disabled }: Props) {
  const [focused, setFocused] = useState(false);
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const assignRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      inputRef.current = node;
    },
    [inputRef],
  );

  const resize = useCallback(() => {
    const element = innerRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  return (
    <div
      className={`typearea ${focused ? "is-focused" : ""} ${disabled ? "is-disabled" : ""}`}
      onMouseDown={(event) => {
        // Clicks on the padding around the text only focus the field; clicks on
        // the text keep the browser's native caret placement.
        if (event.target === innerRef.current) return;
        event.preventDefault();
        innerRef.current?.focus();
      }}
    >
      <textarea
        ref={assignRef}
        className="typearea-input"
        value={value}
        rows={1}
        onChange={(event) => onChange(event.target.value.replace(/\r?\n/g, " "))}
        onKeyDown={(event) => {
          // One sentence, one line: Enter always submits, never inserts a break.
          if (event.key !== "Enter") return;
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          onSubmit?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="输入你听到的句子"
      />
    </div>
  );
}
