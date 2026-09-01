import { ArrowClockwise, CircleNotch, Sparkle, Trash } from '@phosphor-icons/react';

/**
 * The optional half of the hybrid.
 *
 * Everything above this on the page came from rules that ran locally. This is
 * prose about those decisions, fetched only when asked for, and the section is
 * written so that never asking for it reads as a choice rather than a missing
 * feature.
 */
export default function PlanReasoning({ reasoning, busy, unavailable, error, onExplain, onClear }) {
  const paragraphs = (reasoning ?? '').split(/\n{2,}/).filter((block) => block.trim());

  return (
    <>
      {unavailable ? (
        <p className="doc__hint">
          Not configured on this server. Everything on this page comes from the rules
          engine, which runs in your browser and needs nothing. Set{' '}
          <code>ANTHROPIC_API_KEY</code> in <code>server/.env</code> to add this.
        </p>
      ) : (
        <p className="doc__hint">
          Claude reads the decisions above and writes about what they mean together,
          what they cost, and what the rules did not catch. It cannot change any of
          them.
        </p>
      )}

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      {paragraphs.length > 0 && (
        <article className="reasoning">
          {paragraphs.map((block, index) =>
            block.startsWith('#') ? (
              <h4 key={index}>{block.replace(/^#+\s*/, '')}</h4>
            ) : (
              <p key={index}>{block}</p>
            )
          )}
        </article>
      )}

      {!unavailable && (
        <div className="reasoning__actions">
          <button type="button" className="btn btn--sm" onClick={onExplain} disabled={busy}>
            {busy ? (
              <CircleNotch size={14} weight="bold" className="spin" />
            ) : paragraphs.length ? (
              <ArrowClockwise size={14} weight="bold" />
            ) : (
              <Sparkle size={14} weight="fill" />
            )}
            {busy ? 'Thinking' : paragraphs.length ? 'Write it again' : 'Explain in depth'}
          </button>

          {paragraphs.length > 0 && !busy && (
            <button type="button" className="linkish" onClick={onClear}>
              <Trash size={12} weight="bold" />
              Remove
            </button>
          )}

          {!paragraphs.length && !busy && (
            <span className="doc__hint">One API call, only when you press it.</span>
          )}
        </div>
      )}
    </>
  );
}
