import { snippetCompletion } from '@codemirror/autocomplete';
import { indexDbml, findTable, tableAtOffset } from './dbmlIndex.js';

// Types worth suggesting, grouped so the list reads in a sensible order rather
// than alphabetically. `detail` shows up greyed next to each suggestion.
const TYPES = [
  ['integer', 'whole number'],
  ['bigint', '64-bit integer'],
  ['smallint', '16-bit integer'],
  ['serial', 'auto-increment integer'],
  ['decimal(10,2)', 'exact numeric'],
  ['numeric', 'exact numeric'],
  ['real', 'floating point'],
  ['double', 'floating point'],
  ['boolean', 'true / false'],
  ['varchar', 'variable-length text'],
  ['varchar(255)', 'bounded text'],
  ['char(1)', 'fixed-length text'],
  ['text', 'unbounded text'],
  ['uuid', '128-bit identifier'],
  ['json', 'JSON document'],
  ['jsonb', 'binary JSON'],
  ['date', 'calendar date'],
  ['time', 'time of day'],
  ['timestamp', 'date and time'],
  ['timestamptz', 'date, time and zone'],
  ['bytea', 'binary data'],
];

const COLUMN_SETTINGS = [
  ['pk', 'primary key'],
  ['unique', 'unique constraint'],
  ['not null', 'rejects null'],
  ['increment', 'auto-increments'],
  ['default: ', 'default value'],
  ['note: ', 'column comment'],
  ['ref: > ', 'inline relationship'],
];

const REF_SETTINGS = [
  ['delete: cascade', 'on delete'],
  ['update: cascade', 'on update'],
  ['delete: restrict', 'on delete'],
  ['delete: set null', 'on delete'],
];

const RELATIONS = [
  ['>', 'many to one'],
  ['<', 'one to many'],
  ['-', 'one to one'],
  ['<>', 'many to many'],
];

const TOP_LEVEL = [
  snippetCompletion('Table ${name} {\n  id integer [pk, increment]\n  ${column} ${type}\n}', {
    label: 'Table',
    detail: 'new table',
    type: 'class',
    boost: 60,
  }),
  snippetCompletion('Ref: ${from_table}.${column} > ${to_table}.id', {
    label: 'Ref',
    detail: 'new relationship',
    type: 'keyword',
    boost: 55,
  }),
  snippetCompletion('Enum ${name} {\n  ${value}\n}', {
    label: 'Enum',
    detail: 'new enum',
    type: 'enum',
    boost: 50,
  }),
  snippetCompletion('TableGroup ${name} {\n  ${table}\n}', {
    label: 'TableGroup',
    detail: 'group tables',
    type: 'namespace',
  }),
  snippetCompletion("Project ${name} {\n  database_type: '${PostgreSQL}'\n  Note: '${description}'\n}", {
    label: 'Project',
    detail: 'project metadata',
    type: 'namespace',
  }),
];

const pairs = (list, type) =>
  list.map(([label, detail]) => ({ label, detail, type }));

/**
 * Context-aware DBML completions.
 *
 * The suggestion set depends on where the cursor is:
 *   `users.` ............ columns of `users`
 *   inside [ ] .......... column settings, or tables after `ref:`
 *   after a column name . data types and enum names
 *   inside a table body . nothing pushy, just types once a name is typed
 *   `Ref: ` ............. table names
 *   top level ........... block snippets
 */
export function dbmlCompletions(context) {
  const { state, pos } = context;
  const doc = state.doc.toString();
  const line = state.doc.lineAt(pos);
  const lineText = line.text;
  const beforeCursor = lineText.slice(0, pos - line.from);

  // Never interrupt a comment or a string literal.
  if (/(^|[^:])\/\//.test(beforeCursor) || isInsideString(beforeCursor)) return null;

  const index = indexDbml(doc);
  const inBrackets = isInsideBrackets(beforeCursor);

  // 1. `table.` -> that table's columns.
  const dotted = /(?:^|[\s[(,:>~<-])([\w"]+)\.(\w*)$/.exec(beforeCursor);
  if (dotted) {
    const table = findTable(index, dotted[1].replace(/"/g, ''));
    if (table) {
      return {
        from: pos - dotted[2].length,
        options: table.columns.map((col, i) => ({
          label: col.name,
          detail: col.type,
          type: 'property',
          boost: table.columns.length - i,
        })),
        validFor: /^\w*$/,
      };
    }
    return null;
  }

  // 2. Inside [ ]: settings, or a table list right after `ref:`.
  if (inBrackets) {
    const word = context.matchBefore(/[\w ]*/);
    const from = wordStart(beforeCursor, pos);

    if (/ref:\s*[<>~-]*\s*\w*$/i.test(beforeCursor)) {
      return { from, options: tableOptions(index), validFor: /^[\w.]*$/ };
    }

    const isRefBlock = /^\s*ref\b/i.test(lineText);
    return {
      from,
      options: pairs(isRefBlock ? REF_SETTINGS : COLUMN_SETTINGS, 'property'),
      validFor: /^[\w ]*$/,
    };
  }

  // 3. A `Ref:` line outside brackets wants table names, or a relation operator
  //    once the left-hand side is complete.
  if (/^\s*ref\b/i.test(lineText)) {
    if (/^\s*ref[^:]*:\s*[\w.]+\.[\w]+\s+$/i.test(beforeCursor)) {
      return { from: pos, options: pairs(RELATIONS, 'operator'), validFor: /^$/ };
    }
    return {
      from: wordStart(beforeCursor, pos),
      options: tableOptions(index),
      validFor: /^[\w.]*$/,
    };
  }

  const insideTable = tableAtOffset(doc, pos);

  // 4. Inside a table body, once a column name is typed, suggest its type.
  if (insideTable) {
    const typePosition = /^\s*(?:"[^"]+"|[A-Za-z_]\w*)\s+(\w*)$/.exec(beforeCursor);
    if (typePosition) {
      return {
        from: pos - typePosition[1].length,
        options: [
          ...pairs(TYPES, 'type'),
          ...index.enums.map((e) => ({
            label: e.name,
            detail: `enum (${e.values.slice(0, 3).join(', ')}${e.values.length > 3 ? ', ...' : ''})`,
            type: 'enum',
            boost: 40,
          })),
        ],
        validFor: /^[\w(),]*$/,
      };
    }
    // A bare word at the start of a line is a new column name. Nothing useful
    // to suggest, and popping up a list would fight the user's typing.
    return null;
  }

  // 5. Top level: block snippets.
  const word = context.matchBefore(/\w*/);
  if (!word && !context.explicit) return null;
  return {
    from: word ? word.from : pos,
    options: TOP_LEVEL,
    validFor: /^\w*$/,
  };
}

function tableOptions(index) {
  return index.tables.map((t) => ({
    label: t.name,
    detail: `${t.columns.length} ${t.columns.length === 1 ? 'column' : 'columns'}`,
    type: 'class',
  }));
}

function wordStart(beforeCursor, pos) {
  const match = /[\w.]*$/.exec(beforeCursor);
  return pos - (match ? match[0].length : 0);
}

function isInsideBrackets(beforeCursor) {
  return beforeCursor.lastIndexOf('[') > beforeCursor.lastIndexOf(']');
}

function isInsideString(beforeCursor) {
  let quote = null;
  for (let i = 0; i < beforeCursor.length; i += 1) {
    const ch = beforeCursor[i];
    if (quote) {
      if (ch === quote && beforeCursor[i - 1] !== '\\') quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    }
  }
  return quote !== null;
}
