import { useCallback, useState } from 'react';
import { CaretDown, Check, Export, FileMd, Printer, Sparkle } from '@phosphor-icons/react';
import { useDismissable } from '../../utils/useDismissable';
import { downloadText, slugify } from '../../utils/download';

/**
 * The three ways a plan leaves this app.
 *
 * The prompt goes to the clipboard because that is where it is going next
 * anyway. The document downloads because it belongs in the repository. The PDF
 * goes through the browser's own print dialog, which renders text better than
 * a bundled PDF library would and costs nothing to ship.
 */
export default function ExportMenu({ projectName, buildPrompt, buildDocument }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const close = useCallback(() => setOpen(false), []);
  const menu = useDismissable(open, close);

  async function copyPrompt() {
    close();
    setError(null);
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access can be refused outright, and failing silently would
      // leave someone pasting whatever was there before.
      setError('The browser refused clipboard access. Use the Markdown download instead.');
    }
  }

  function downloadMarkdown() {
    close();
    downloadText(buildDocument(), `${slugify(projectName)}-plan.md`, 'text/markdown');
  }

  function print() {
    close();
    // The print stylesheet swaps the app for the printable document, so this
    // prints the plan rather than a screenshot of the editor.
    window.print();
  }

  return (
    <div className="menu export" ref={menu}>
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {copied ? <Check size={14} weight="bold" /> : <Export size={14} weight="bold" />}
        {copied ? 'Copied' : 'Export'}
        <CaretDown size={10} weight="bold" />
      </button>

      {open && (
        <div className="menu__panel" role="menu">
          <button type="button" className="menu__item" role="menuitem" onClick={copyPrompt}>
            <span className="menu__icon">
              <Sparkle size={14} weight="fill" />
            </span>
            <span className="menu__text">
              Copy handoff prompt
              <small>The whole plan, shaped as instructions for an agent</small>
            </span>
          </button>

          <button type="button" className="menu__item" role="menuitem" onClick={downloadMarkdown}>
            <span className="menu__icon">
              <FileMd size={14} weight="bold" />
            </span>
            <span className="menu__text">
              Download Markdown
              <small>Commit it next to the code</small>
            </span>
          </button>

          <button type="button" className="menu__item" role="menuitem" onClick={print}>
            <span className="menu__icon">
              <Printer size={14} weight="bold" />
            </span>
            <span className="menu__text">
              Print or save as PDF
              <small>Through the browser, so the text stays selectable</small>
            </span>
          </button>
        </div>
      )}

      {error && (
        <p className="export__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
