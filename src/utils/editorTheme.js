import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Skinned to the app's own tokens instead of a stock theme, so the editor reads
// as one surface with the rest of the workbench.
const c = {
  bg: '#0e1116',
  gutter: '#697184',
  gutterActive: '#c3cad6',
  text: '#e7eaf0',
  caret: '#f5a524',
  selection: '#26456b',
  activeLine: '#151a22',
  keyword: '#f5a524',
  type: '#6fb3e8',
  string: '#8fce9b',
  number: '#e0a3d2',
  comment: '#5d6675',
  operator: '#d78a6a',
  bracket: '#9099a9',
  name: '#dfe4ec',
};

export const editorTheme = EditorView.theme(
  {
    '&': {
      color: c.text,
      backgroundColor: c.bg,
      fontSize: '13px',
      height: '100%',
    },
    '.cm-content': {
      fontFamily: "'Geist Mono Variable', ui-monospace, 'Cascadia Code', Consolas, monospace",
      padding: '14px 0 40vh 0',
      caretColor: c.caret,
      lineHeight: '1.7',
    },
    '.cm-scroller': { overflow: 'auto' },
    '&.cm-focused': { outline: 'none' },

    '.cm-gutters': {
      backgroundColor: c.bg,
      color: c.gutter,
      border: 'none',
      paddingRight: '4px',
      fontFamily: "'Geist Mono Variable', ui-monospace, Consolas, monospace",
      fontSize: '11.5px',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 16px', minWidth: '38px' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: c.gutterActive },
    '.cm-foldGutter .cm-gutterElement': { color: c.gutter, opacity: 0.6 },

    '.cm-activeLine': { backgroundColor: c.activeLine },
    '.cm-cursor, .cm-dropCursor': { borderLeftWidth: '2px', borderLeftColor: c.caret },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: c.selection,
    },
    '.cm-selectionMatch': { backgroundColor: '#2a3444' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: '#23303f',
      outline: '1px solid #3d4757',
      color: 'inherit',
    },

    // Autocomplete popup.
    '.cm-tooltip': {
      backgroundColor: '#171b23',
      border: '1px solid #2e3644',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      fontFamily: "'Geist Mono Variable', ui-monospace, Consolas, monospace",
      fontSize: '12.5px',
      maxHeight: '16em',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
      padding: '5px 10px',
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: '#233149',
      color: c.text,
    },
    '.cm-completionLabel': { color: c.text },
    '.cm-completionMatchedText': {
      textDecoration: 'none',
      color: c.caret,
      fontWeight: '600',
    },
    '.cm-completionDetail': {
      marginLeft: 'auto',
      color: '#818b9c',
      fontStyle: 'normal',
      fontSize: '11px',
      fontFamily: "'Geist Variable', system-ui, sans-serif",
    },
    '.cm-completionIcon': { display: 'none' },

    // Inline diagnostics from the parser.
    '.cm-diagnostic': {
      fontFamily: "'Geist Variable', system-ui, sans-serif",
      fontSize: '12px',
      padding: '6px 10px',
      borderLeft: 'none',
    },
    '.cm-diagnostic-error': { borderLeft: '3px solid #e5484d' },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      textDecoration: 'underline wavy #e5484d',
      textUnderlineOffset: '3px',
    },
    '.cm-lint-marker-error': { content: 'none' },
  },
  { dark: true }
);

export const editorHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: c.keyword, fontWeight: '600' },
    { tag: tags.typeName, color: c.type },
    { tag: tags.string, color: c.string },
    { tag: tags.number, color: c.number },
    { tag: tags.comment, color: c.comment, fontStyle: 'italic' },
    { tag: tags.operator, color: c.operator, fontWeight: '600' },
    { tag: tags.bracket, color: c.bracket },
    { tag: tags.variableName, color: c.name },
  ])
);
