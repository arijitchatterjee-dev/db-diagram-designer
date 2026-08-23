// Node-runnable checks for the parse -> graph pipeline: `npm test` in client/.
import { parseDbml } from './dbmlParser.js';
import { buildGraph, enumNodeId, handleSides } from './buildGraph.js';
import { estimateNodeWidth } from './autoLayout.js';

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

// --- enums on the canvas ---
const withEnums = await parseDbml(`
Enum order_status {
  pending
  shipped
}
Enum unused_kind {
  a
  b
}
Table orders {
  id integer [pk]
  status order_status [not null]
  a_very_long_column_name_indeed varchar(255)
}
Table users {
  id integer [pk]
}
`);
check('enum schema parses', withEnums.ok, true);
check('both enums captured', withEnums.schema.enums.map((e) => e.name), ['order_status', 'unused_kind']);

const ge = buildGraph(withEnums.schema, {}, {});
const enumNodes = ge.nodes.filter((n) => n.type === 'enum');
check('enums become nodes', enumNodes.length, 2);
check('enum ids are namespaced', enumNodes.map((n) => n.id).sort(), [enumNodeId('order_status'), enumNodeId('unused_kind')]);
check('an enum node never collides with a table node', new Set(ge.nodes.map((n) => n.id)).size, ge.nodes.length);
check('enum values carried through', enumNodes.find((n) => n.id === enumNodeId('order_status')).data.enumDef.values, ['pending', 'shipped']);

const enumEdges = ge.edges.filter((e) => e.data.kind === 'enum');
check('a column typed as an enum links to it', enumEdges.length, 1);
check('  ...from the right column', enumEdges[0].sourceHandle, 'status__source__right');
check('  ...to the enum node', enumEdges[0].target, enumNodeId('order_status'));
check('referenced enum marked used', enumNodes.find((n) => n.id === enumNodeId('order_status')).data.used, true);
check('unreferenced enum marked unused', enumNodes.find((n) => n.id === enumNodeId('unused_kind')).data.used, false);

const ordersNode = ge.nodes.find((n) => n.id === 'orders');
check('enum column flagged on the table node', ordersNode.data.enumColumns.has('status'), true);
check('plain column not flagged', ordersNode.data.enumColumns.has('id'), false);

// --- node width follows content ---
const narrow = { name: 't', fields: [{ name: 'id', type: 'int' }] };
const wide = {
  name: 't',
  fields: [{ name: 'a_very_long_column_name_indeed', type: 'character varying(255)' }],
};
check('short table keeps the base width', estimateNodeWidth(narrow), 260);
check('long column names widen the node', estimateNodeWidth(wide) > 260, true);
check('  ...but stay bounded', estimateNodeWidth(wide) <= 460, true);
check('width reaches the node', ordersNode.data.width, ordersNode.width);

// --- live edge routing ---
const left = { x: 0, y: 0, width: 260 };
const right = { x: 900, y: 0, width: 260 };
check('target to the right exits right', handleSides(left, right), { source: 'right', target: 'left' });
check('target to the left exits left', handleSides(right, left), { source: 'left', target: 'right' });
// Centres, not left edges: a wide node whose left edge is further left can
// still sit to the right of a narrow one.
check('sides compare centres, not left edges',
  handleSides({ x: 0, y: 0, width: 460 }, { x: 100, y: 0, width: 180 }),
  { source: 'left', target: 'right' });

check('ref edges carry both columns for re-routing',
  edges.every((e) => typeof e.data.sourceColumn === 'string' && typeof e.data.targetColumn === 'string'), true);

// --- indexes, groups, notes, project meta ---
const rich = await parseDbml(`
Project shop {
  database_type: 'PostgreSQL'
  Note: 'A little shop'
}
Table users {
  id integer [pk]
  email varchar [note: 'login handle']
  tenant_id integer
  created_at timestamp

  indexes {
    (email) [unique, name: 'idx_users_email']
    (tenant_id, created_at) [name: 'idx_users_tenant_time']
    \`lower(email)\` [name: 'idx_users_lower_email']
  }

  Note: 'People who can sign in'
}
Table orders {
  id integer [pk]
  user_id integer [ref: > users.id]
}
TableGroup billing {
  orders
  users
}
`);
check('rich document parses', rich.ok, true);

const richUsers = rich.schema.tables.find((t) => t.name === 'users');
check('indexes parsed', richUsers.indexes.length, 3);
check('index name kept', richUsers.indexes[0].name, 'idx_users_email');
check('unique index flagged', richUsers.indexes[0].unique, true);
check('composite index keeps column order', richUsers.indexes[1].columns, ['tenant_id', 'created_at']);
check('expression index kept as an expression', richUsers.indexes[2].columns, ['(lower(email))']);
check('table note parsed', richUsers.note, 'People who can sign in');
check('column note parsed', richUsers.fields.find((f) => f.name === 'email').note, 'login handle');
check('table knows its group', richUsers.groupName, 'billing');

check('project block parsed', rich.schema.project, {
  name: 'shop',
  note: 'A little shop',
  databaseType: 'PostgreSQL',
});

check('table group parsed', rich.schema.groups.length, 1);
check('  ...with its members', rich.schema.groups[0].tables.sort(), ['orders', 'users']);

const gr = buildGraph(rich.schema, {}, {});
check('groups come back from buildGraph', gr.groups.length, 1);
check('groups are not nodes', gr.nodes.every((n) => n.type !== 'group'), true);
check('indexes make the node taller',
  gr.nodes.find((n) => n.id === 'users').height > gr.nodes.find((n) => n.id === 'orders').height, true);

// A group naming a table that no longer exists shouldn't produce an empty box.
const gs = buildGraph(
  { tables: [], refs: [], enums: [], groups: [{ name: 'ghosts', note: null, tables: ['a'] }] },
  {},
  {}
);
check('a group with no live members is dropped', gs.groups.length, 0);

// A table with no `indexes` block must still size like before.
const plain = await parseDbml('Table t {\n  id integer [pk]\n}\n');
check('no indexes block means no index rows', plain.schema.tables[0].indexes, []);

console.log(failures === 0 ? '\nAll pipeline checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
