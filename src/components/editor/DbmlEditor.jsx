import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { dbmlLanguage } from '../../utils/dbmlLanguage';

const wrapping = EditorView.lineWrapping;

export default function DbmlEditor({ value, onChange, parseError }) {
  const extensions = useMemo(() => [dbmlLanguage, wrapping], []);

  return (
    <div className="editor">
      <div className="editor__scroll">
        <CodeMirror
          value={value}
          height="100%"
          theme="dark"
          extensions={extensions}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            autocompletion: false,
            bracketMatching: true,
            closeBrackets: true,
          }}
        />
      </div>

      {/* Non-blocking: the diagram keeps showing the last good parse. */}
      {parseError && (
        <div className="editor__error" role="status">
          <strong>Syntax error</strong>
          {parseError.line != null && <span className="editor__error-line">line {parseError.line}</span>}
          <span className="editor__error-msg">{parseError.message}</span>
        </div>
      )}
    </div>
  );
}
