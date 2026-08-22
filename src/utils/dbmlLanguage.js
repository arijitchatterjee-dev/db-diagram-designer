import { StreamLanguage } from '@codemirror/language';

const KEYWORDS = /^(Table|TableGroup|Ref|Enum|Project|Note|indexes|as)\b/i;
const SETTINGS = /^(pk|primary key|increment|unique|not null|null|default|note|ref|name|type)\b/i;
const TYPES =
  /^(int|integer|bigint|smallint|tinyint|serial|bigserial|decimal|numeric|real|double|float|money|bool|boolean|char|varchar|text|json|jsonb|uuid|date|time|timestamp|timestamptz|datetime|blob|bytea|enum)\b/i;

// A deliberately small tokenizer: enough to make DBML readable in the editor
// without pulling in a full grammar package.
export const dbmlLanguage = StreamLanguage.define({
  name: 'dbml',

  startState() {
    return { inBlockComment: false, inSettings: false };
  },

  token(stream, state) {
    if (state.inBlockComment) {
      if (stream.match(/.*?\*\//)) state.inBlockComment = false;
      else stream.skipToEnd();
      return 'comment';
    }

    if (stream.eatSpace()) return null;

    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      state.inBlockComment = true;
      return 'comment';
    }

    // Strings: '...', "...", and DBML's ''' multi-line note blocks.
    if (stream.match("'''")) {
      stream.skipToEnd();
      return 'string';
    }
    const quote = stream.peek();
    if (quote === "'" || quote === '"' || quote === '`') {
      stream.next();
      let escaped = false;
      let ch;
      while ((ch = stream.next()) != null) {
        if (ch === quote && !escaped) break;
        escaped = !escaped && ch === '\\';
      }
      return 'string';
    }

    if (stream.match(/^[[]/)) {
      state.inSettings = true;
      return 'bracket';
    }
    if (stream.match(/^]/)) {
      state.inSettings = false;
      return 'bracket';
    }
    if (stream.match(/^[{}()]/)) return 'bracket';

    // Relationship operators: >, <, -, <>
    if (stream.match(/^(<>|[<>-])/)) return 'operator';

    if (stream.match(/^\d+(\.\d+)?/)) return 'number';

    if (state.inSettings && stream.match(SETTINGS)) return 'keyword';
    if (stream.match(KEYWORDS)) return 'keyword';
    if (stream.match(TYPES)) return 'typeName';

    if (stream.match(/^[A-Za-z_][\w.]*/)) return 'variableName';

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', "'", '"'] },
  },
});
