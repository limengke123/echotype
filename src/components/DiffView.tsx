import type { DiffOp } from "../lib/types";

type Props = {
  ops: DiffOp[];
  /** `expected` shows the original sentence, `actual` shows what the user typed. */
  variant: "expected" | "actual";
};

export function DiffView({ ops, variant }: Props) {
  if (ops.length === 0) return <span className="diff-empty">（空）</span>;

  return (
    <span className="diff">
      {ops.map((op, index) => {
        const key = `${op.type}-${index}`;

        if (op.type === "equal") {
          return (
            <span key={key} className="tok">
              {op.text}
            </span>
          );
        }

        if (op.type === "missing") {
          if (variant === "actual") return null;
          return (
            <span key={key} className="tok tok-missing">
              {op.text}
            </span>
          );
        }

        if (op.type === "extra") {
          if (variant === "expected") return null;
          return (
            <span key={key} className="tok tok-extra">
              {op.text}
            </span>
          );
        }

        return (
          <span key={key} className="tok tok-replace">
            {op.spans.map((span, spanIndex) => {
              if (span.type === "equal") {
                return <span key={spanIndex}>{span.text}</span>;
              }
              if (span.type === "del") {
                if (variant === "actual") return null;
                return (
                  <mark key={spanIndex} className="char-del">
                    {span.text}
                  </mark>
                );
              }
              if (variant === "expected") return null;
              return (
                <mark key={spanIndex} className="char-ins">
                  {span.text}
                </mark>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}
