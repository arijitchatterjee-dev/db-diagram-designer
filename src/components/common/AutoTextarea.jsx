import { useLayoutEffect, useRef } from 'react';

/**
 * A textarea that grows to fit what you typed.
 *
 * The plan document scrolls already. A second scrollbar inside a four-line box
 * meant the top of your own answer was hidden the moment it got long, which is
 * exactly when you most want to read it back.
 *
 * Measuring needs the height reset first: scrollHeight of an element already
 * tall enough for its content just reports the height it was given.
 */
export default function AutoTextarea({ value, className = '', ...rest }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea ref={ref} value={value} className={`textarea--auto ${className}`.trim()} {...rest} />
  );
}
