// Node-runnable checks for the parse -> graph pipeline: `npm test` in client/.
import { parseDbml } from './dbmlParser.js';
import { buildGraph } from './buildGraph.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

const good = `
Table users {
  id integer [pk, increment]
  email varchar [unique, not null]
  role varchar [default: 'member']
}
Table posts {
  id integer [pk]
  user_id integer [not null, ref: > users.id]
  title varchar
}
Table profiles {
  id integer [pk]
  user_id integer [unique]
}
Table tags {
  id integer [pk]
}
Ref: profiles.user_id - users.id
Ref: posts.id <> tags.id
`;

const r = await parseDbml(good);
check('valid schema parses', r.ok, true);
check('table count', r.schema.tables.length, 4);
check('ref count (incl. inline ref)', r.schema.refs.length, 3);

const users = r.schema.tables.find((t) => t.name === 'users');
check('pk flag', users.fields[0].pk, true);
check('increment flag', users.fields[0].increment, true);
check('type name', users.fields[1].type, 'varchar');
check('not null flag', users.fields[1].notNull, true);
check('unique flag', users.fields[1].unique, true);
check('default value', users.fields[2].default, 'member');

const types = r.schema.refs.map((x) => x.type).sort();
check('relation types', types, ['many-to-many', 'one-to-many', 'one-to-one']);

// inline [ref: > users.id] must be expanded — the raw peg grammar alone wouldn't
const inline = r.schema.refs.find((x) => x.source.table === 'posts' && x.source.columns[0] === 'user_id');
check('inline ref expanded to posts->users', !!inline, true);
check('inline ref type', inline?.type, 'one-to-many');

// --- graph building ---
const { nodes, edges, positions } = buildGraph(r.schema, {}, {});
check('node count', nodes.length, 4);
check('edge count', edges.length, 3);
check('all nodes use custom type', nodes.every((n) => n.type === 'table'), true);
check('dagre gave distinct positions', new Set(nodes.map((n) => `${n.position.x},${n.position.y}`)).size, 4);
check('every edge endpoint resolves to a node',
  edges.every((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)), true);
check('handles are column-scoped', edges.every((e) => /__(source|target)__(left|right)$/.test(e.sourceHandle) && /__(source|target)__(left|right)$/.test(e.targetHandle)), true);
check('relation labels', edges.map((e) => e.label).sort(), ['1:1', '1:N', 'N:N']);
check('linked columns flagged on node', nodes.find((n) => n.id === 'users').data.relatedColumns.has('id'), true);

// saved layout wins over dagre
const saved = { users: { x: 999, y: 111 } };
const g2 = buildGraph(r.schema, saved, {});
check('saved position wins', g2.positions.users, { x: 999, y: 111 });

// existing session position wins over a fresh dagre pass (no reshuffle)
const prev = { posts: { x: 42, y: 43 } };
const g3 = buildGraph(r.schema, {}, prev);
check('previous session position kept', g3.positions.posts, { x: 42, y: 43 });

// a brand new table still gets an auto position while others stay put
const withNew = await parseDbml(good + '\nTable audit {\n  id integer [pk]\n}\n');
const g4 = buildGraph(withNew.schema, saved, prev);
check('new table got auto-positioned', Number.isFinite(g4.positions.audit.x), true);
check('  ...while saved stayed', g4.positions.users, { x: 999, y: 111 });
check('  ...and session pos stayed', g4.positions.posts, { x: 42, y: 43 });

// --- error handling ---
const bad = await parseDbml('Table broken {\n  id integer\n');
check('syntax error reported', bad.ok, false);
check('  error has a line number', typeof bad.error.line, 'number');
check('  error has a message', bad.error.message.length > 0, true);

const dup = await parseDbml('Table a {\n  id integer\n}\nTable a {\n  id integer\n}\n');
check('duplicate table name is an error', dup.ok, false);

const empty = await parseDbml('   ');
check('empty input is not an error', empty.ok, true);
check('  empty input yields no tables', empty.schema.tables.length, 0);

const commentOnly = await parseDbml('// just a comment\n');
check('comment-only input parses', commentOnly.ok, true);

console.log(failures === 0 ? '\nAll pipeline checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
