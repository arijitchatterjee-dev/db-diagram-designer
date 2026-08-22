import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { forceLinting, linter, lintGutter } from '@codemirror/lint';
import { WarningOctagon, Sparkle } from '@phosphor-icons/react';
import { dbmlLanguage } from '../../utils/dbmlLanguage';
import { dbmlCompletions } from '../../utils/dbmlCompletion';
import { editorTheme, editorHighlight } from '../../utils/editorTheme';

/**
 * Turns the current parse error into a CodeMirror diagnostic so the offending
 * text is underlined in place, instead of only being named in a banner.
 */
function useParseLinter(parseError) {
  // Read through a ref: rebuilding the extension on every error would tear down
  // and rebuild the editor state mid-keystroke.
  const errorRef = useRef(parseError);
  errorRef.current = parseError;

  return useMemo(
    () =>
      linter(
        (view) => {
          const error = errorRef.current;
          if (!error || error.line == null) return [];

          const lineCount = view.state.doc.lines;
          const line = view.state.doc.line(Math.min(Math.max(error.line, 1), lineCount));
          // Point at the first non-space character so the squiggle lands on the
          // token rather than the indent.
          const start = line.from + (line.text.match(/^\s*/)?.[0].length ?? 0);

          return [
            {
              from: start,
              to: Math.max(line.to, start + 1),
              severity: 'error',
              message: error.message,
            },
          ];
        },
        { delay: 150 }
      ),
    []
  );
}

export default function DbmlEditor({ value, onChange, parseError, onEditorReady }) {
  const parseLinter = useParseLinter(parseError);
  const viewRef = useRef(null);

  const extensions = useMemo(
    () => [
      dbmlLanguage,
      // basicSetup registers its own highlighter; earlier extensions win in
      // CodeMirror, so ours has to be raised explicitly or identifiers keep
      // the stock grey instead of our palette.
      Prec.highest(editorHighlight),
      EditorView.lineWrapping,
      autocompletion({
        override: [dbmlCompletions],
        activateOnTyping: true,
        closeOnBlur: true,
        maxRenderedOptions: 30,
        icons: false,
      }),
      lintGutter(),
      parseLinter,
    ],
    [parseLinter]
  );

  // The parse is async, so a result can land with no accompanying doc change.
  // The linter only re-runs on doc changes by itself, hence the explicit kick.
  useEffect(() => {
    if (viewRef.current) forceLinting(viewRef.current);
  }, [parseError]);

  return (
    <div className="editor">
      <div className="editor__pane">
        <CodeMirror
          value={value}
          height="100%"
          // Must go through the prop: the default is 'light', which injects a
          // white-background theme alongside ours.
          theme={editorTheme}
          extensions={extensions}
          onChange={onChange}
          onCreateEditor={(view) => {
            viewRef.current = view;
            onEditorReady?.(view);
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            autocompletion: false,
            bracketMatching: true,
            closeBrackets: true,
            history: true,
            searchKeymap: true,
          }}
        />
      </div>

      <footer className={`editor__status${parseError ? ' is-error' : ''}`}>
        {parseError ? (
          <>
            <WarningOctagon size={14} weight="fill" className="editor__status-icon" />
            {parseError.line != null && (
              <span className="editor__status-line">Line {parseError.line}</span>
            )}
            <span className="editor__status-msg" title={parseError.message}>
              {parseError.message}
            </span>
            <span className="editor__status-note">Diagram shows your last valid schema</span>
          </>
        ) : (
          <>
            <Sparkle size={14} weight="fill" className="editor__status-icon" />
            <span className="editor__status-msg">Schema is valid</span>
            <span className="editor__status-note">
              <kbd>Ctrl</kbd>
              <kbd>Space</kbd> for suggestions
            </span>
          </>
        )}
      </footer>
    </div>
  );
}
