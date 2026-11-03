import type { DiffOp } from "../lib/types";
import { summariseDiff } from "../lib/diff";
import { DiffView } from "./DiffView";
import { IconCheck, IconClose, IconSpeaker } from "./Icons";

type Props = {
  correct: boolean;
  ops: DiffOp[];
  input: string;
  isLast: boolean;
  autoAdvance: boolean;
  onReplay: () => void;
  onNext: () => void;
};

export function ReviewPanel({ correct, ops, input, isLast, autoAdvance, onReplay, onNext }: Props) {
  const summary = summariseDiff(ops);

  return (
    <div className={`review ${correct ? "is-correct" : "is-wrong"}`}>
      <div className="review-head">
        <span className="review-badge">
          {correct ? <IconCheck size={15} /> : <IconClose size={15} />}
          {correct ? "完全正确" : "有出入"}
        </span>
        {!correct && (
          <span className="review-summary">
            {[
              summary.missing > 0 ? `漏 ${summary.missing}` : null,
              summary.replaced > 0 ? `错 ${summary.replaced}` : null,
              summary.extra > 0 ? `多 ${summary.extra}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        {correct && autoAdvance && <span className="review-auto">即将进入下一句…</span>}
      </div>

      <div className="review-row">
        <span className="review-label">你写的</span>
        <div className="review-text">
          <DiffView ops={ops} variant="actual" />
          {input.trim() === "" && <span className="diff-empty">（空）</span>}
        </div>
      </div>

      <div className="review-row">
        <span className="review-label">原文</span>
        <div className="review-text">
          <DiffView ops={ops} variant="expected" />
        </div>
      </div>

      <div className="review-actions">
        <button type="button" className="btn" onClick={onReplay}>
          <IconSpeaker size={17} />
          重听
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          {isLast ? "查看成绩" : "下一句"}
          <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}
