import { Link } from 'react-router-dom';
import styled from 'styled-components';

/**
 * The primary action on a list row — Edit, Plan, Arrange.
 *
 * On hover the icon flies off to the right and the label goes with it, which is
 * where the whole effect comes from. Two things make that work at this size:
 * `overflow: hidden` so the label leaves rather than pushing the row wide, and
 * a fixed width so the button does not resize as its contents move.
 *
 * Renders a link when given `to` and a button otherwise, because half the
 * places this appears navigate and the other half open a dialog — and a link
 * that is really a button loses middle-click and "open in new tab".
 */
export default function TableBtn({ icon, children, to, onClick, title, disabled, ...rest }) {
  const inner = (
    <>
      <span className="tbtn__icon">{icon}</span>
      <span className="tbtn__label">{children}</span>
    </>
  );

  return (
    <Wrapper>
      {to ? (
        <Link to={to} className="tbtn" title={title} {...rest}>
          {inner}
        </Link>
      ) : (
        <button type="button" className="tbtn" onClick={onClick} title={title} disabled={disabled} {...rest}>
          {inner}
        </button>
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: inline-flex;

  .tbtn {
    /* Fixed rather than content-sized: the label slides out on hover, and a
       button that shrank as it left would drag the rest of the row with it. */
    width: 88px;
    height: 28px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    border: 1px solid var(--accent);
    border-radius: var(--r-sm);
    background: var(--accent);
    color: var(--on-accent);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    cursor: pointer;
    transition: background 0.2s var(--ease), border-color 0.2s var(--ease), transform 0.2s var(--ease);
  }
  .tbtn:hover {
    background: var(--accent-hi);
    border-color: var(--accent-hi);
    text-decoration: none;
  }
  .tbtn:active {
    transform: scale(0.96);
  }
  .tbtn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tbtn__icon {
    display: grid;
    place-items: center;
    flex: none;
    transform-origin: center;
    transition: transform 0.3s ease-in-out;
  }
  .tbtn__label {
    display: block;
    transition: transform 0.3s ease-in-out;
  }

  /* Tuned to this button's width rather than the 5em the effect was written
     for: at 88px that would fling the label out long before the icon crossed. */
  .tbtn:hover:not(:disabled) .tbtn__icon {
    transform: translateX(3.4em) rotate(45deg) scale(1.1);
  }
  .tbtn:hover:not(:disabled) .tbtn__label {
    transform: translateX(4.6em);
  }
  .tbtn:hover:not(:disabled) .tbtn__icon,
  .tbtn:focus-visible .tbtn__icon {
    animation: tbtn-fly 0.6s ease-in-out infinite alternate;
  }

  @keyframes tbtn-fly {
    from {
      transform: translateX(3.4em) rotate(45deg) scale(1.1) translateY(0.1em);
    }
    to {
      transform: translateX(3.4em) rotate(45deg) scale(1.1) translateY(-0.1em);
    }
  }

  /* The flight is decoration. Someone who asked for less motion still gets the
     colour change and the press. */
  @media (prefers-reduced-motion: reduce) {
    .tbtn__icon,
    .tbtn__label {
      transition: none;
    }
    .tbtn:hover:not(:disabled) .tbtn__icon,
    .tbtn:hover:not(:disabled) .tbtn__label {
      transform: none;
      animation: none;
    }
  }
`;
