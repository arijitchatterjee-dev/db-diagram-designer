// Node-runnable checks for the DBML index + autocomplete: `npm test` in client/.
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { indexDbml, findTable, tableAtOffset } from './dbmlIndex.js';
import { dbmlCompletions } from './dbmlCompletion.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

// `|` marks the cursor.
function complete(text, explicit = false) {
  const pos = text.indexOf('|');
  const doc = text.replace('|', '');
  const state = EditorState.create({ doc });
  const result = dbmlCompletions(new CompletionContext(state, pos, explicit));
  return result ? result.options.map((o) => o.label) : null;
}

const SCHEMA = `Table users as U {
  id integer [pk, increment]
  email varchar [unique]
  indexes {
    (email) [name: 'idx_email']
  }
  Note: 'people'
}

Enum order_status {
  pending
  shipped
}

Table orders {
  id integer [pk]
  user_id integer
  status order_status
}
`;

// --- the tolerant index ---
const idx = indexDbml(SCHEMA);
check('indexes both tables', idx.tables.map((t) => t.name), ['users', 'orders']);
check('captures the alias', idx.tables[0].alias, 'U');
check('columns of users', idx.tables[0].columns.map((c) => c.name), ['id', 'email']);
check('  ...excludes indexes block contents', idx.tables[0].columns.some((c) => c.name === '(email)'), false);
check('  ...excludes Note line', idx.tables[0].columns.some((c) => c.name.toLowerCase() === 'note'), false);
check('column types kept', idx.tables[0].columns[1].type, 'varchar');
check('indexes the enum', idx.enums.map((e) => e.name), ['order_status']);
check('enum values', idx.enums[0].values, ['pending', 'shipped']);
check('lookup by name', findTable(idx, 'orders')?.name, 'orders');
check('lookup by alias', findTable(idx, 'U')?.name, 'users');

// The whole point: it still works on a document that does not parse.
const broken = indexDbml('Table users {\n  id integer\n  email varchar\n\nTable posts {\n  id integer\n');
check('indexes a broken document', broken.tables.length > 0, true);
check('  ...and still finds columns', broken.tables[0].columns.map((c) => c.name), ['id', 'email']);

check('inside a table body', tableAtOffset(SCHEMA, SCHEMA.indexOf('email varchar'))?.name, 'users');
check('outside any table body', tableAtOffset(SCHEMA, SCHEMA.indexOf('Enum order_status')), null);

// --- context-aware completions ---
const cols = complete(`${SCHEMA}\nRef: orders.user_id > users.|`);
check('after `users.` suggests its columns', cols, ['id', 'email']);

const aliasCols = complete(`${SCHEMA}\nRef: orders.user_id > U.|`);
check('alias resolves to columns too', aliasCols, ['id', 'email']);

const partial = complete(`${SCHEMA}\nRef: orders.user_id > users.em|`);
check('partial column still suggests', partial, ['id', 'email']);

const tablesAfterRef = complete(`${SCHEMA}\nRef: |`);
check('`Ref:` suggests tables', tablesAfterRef, ['users', 'orders']);

const rel = complete(`${SCHEMA}\nRef: orders.user_id |`);
check('after the left side suggests relations', rel, ['>', '<', '-', '<>']);

const settings = complete('Table t {\n  id integer [|\n}');
check('inside [ ] suggests settings', settings, ['pk', 'unique', 'not null', 'increment', 'default: ', 'note: ', 'ref: > ']);

// `c` is the table being defined; self-referencing rows are legal DBML.
const inlineRefTables = complete(`${SCHEMA}\nTable c {\n  user_id integer [ref: > |]\n}`);
check('`ref: >` inside [ ] suggests tables', inlineRefTables, ['users', 'orders', 'c']);

const typeList = complete(`${SCHEMA}\nTable c {\n  created_at |\n}`);
check('after a column name suggests types', typeList?.slice(0, 3), ['integer', 'bigint', 'smallint']);
check('  ...and includes enums defined in the doc', typeList?.includes('order_status'), true);

const partialType = complete(`${SCHEMA}\nTable c {\n  created_at times|\n}`);
check('partial type still suggests', partialType?.includes('timestamp'), true);

const topLevel = complete('Ta|');
check('top level suggests block snippets', topLevel, ['Table', 'Ref', 'Enum', 'TableGroup', 'Project']);

check('new column name is not interrupted', complete('Table t {\n  ema|\n}'), null);
check('comments are left alone', complete('Table t {\n  // note ab|\n}'), null);
check('strings are left alone', complete("Table t {\n  id integer [note: 'hello wo|']\n}"), null);

console.log(failures === 0 ? '\nAll completion checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
