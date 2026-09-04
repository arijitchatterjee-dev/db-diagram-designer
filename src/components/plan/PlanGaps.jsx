import { CheckCircle, Warning } from '@phosphor-icons/react';

/**
 * What is still open, and where to go to close it.
 *
 * The wizard's review step reprinted the whole plan. In a document where every
 * section is one click away that is just a second copy to keep in sync; what is
 * actually worth saying at the end is what is missing.
 */
export default function PlanGaps({ gaps, onGo }) {
  if (gaps.length === 0) {
    return (
      <p className="pgaps__ok">
        <CheckCircle size={15} weight="fill" />
        Nothing left open. The plan answers every question it asks.
      </p>
    );
  }

  return (
    <ul className="pgaps">
      {gaps.map((gap) => (
        <li key={gap.text}>
          <Warning size={14} weight="fill" />
          <span>{gap.text}</span>
          {gap.step != null && (
            <button type="button" className="pgaps__go" onClick={() => onGo(gap.step)}>
              Fix
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
