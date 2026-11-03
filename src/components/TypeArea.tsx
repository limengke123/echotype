import { useEffect, useState, type RefObject } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  placeholder: string;
  disabled?: boolean;
};

/**
 * The typing surface for a dictated sentence.
 *
 * A real (but invisible) `<input>` owns the state, the caret and the IME, while
 * the visible layer draws every typed letter as a tile. Clicking anywhere puts
 * the caret at the end — that is what a dictation flow needs, and it keeps the
 * invisible input's layout from disagreeing with the tiles.
 */
export function TypeArea({ value, onChange, inputRef, placeholder, disabled }: Props) {
  const [caret, setCaret] = useState(value.length);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value === "") setCaret(0);
  }, [value]);

  const focusAtEnd = () => {
    const input = inputRef.current;
    if (!input || disabled) return;
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange(end, end);
    setCaret(end);
  };

  const letters = Array.from(value);
  const nodes: React.ReactNode[] = [];

  letters.forEach((letter, index) => {
    if (index === caret) nodes.push(<span key={`caret-${index}`} className="caret" aria-hidden="true" />);
    nodes.push(
      <span
        key={index}
        className={letter === " " ? "letter is-space" : "letter"}
        aria-hidden="true"
      >
        {letter === " " ? "" : letter}
      </span>,
    );
  });

  if (caret >= letters.length) {
    nodes.push(<span key="caret-end" className="caret" aria-hidden="true" />);
  }

  return (
    <div
      className={`typearea ${focused ? "is-focused" : ""} ${disabled ? "is-disabled" : ""}`}
      onClick={focusAtEnd}
    >
      <input
        ref={inputRef}
        className="typearea-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => {
          const target = event.target as HTMLInputElement;
          setCaret(target.selectionStart ?? target.value.length);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="输入你听到的句子"
      />

      <div className="typearea-display">
        {value === "" ? (
          <span className="typearea-placeholder">{placeholder}</span>
        ) : (
          nodes
        )}
      </div>
    </div>
  );
}
