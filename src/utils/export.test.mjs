// Checks for the export/import layer: `npm test` in client/.
import { parseDbml } from './dbmlParser.js';
import { buildGraph } from './buildGraph.js';
import { EXPORT_TARGETS, IMPORT_SOURCES, exportSchema, importSql } from './dbmlExport.js';
import { buildDiagramSvg } from './diagramImage.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

const source = `
Enum order_status {
  pending
  shipped
}
Table users {
  id integer [pk, increment]
  email varchar(255) [unique, not null]

  indexes {
    (email) [unique, name: 'idx_users_email']
  }
  Note: 'People who can sign in'
}
Table orders {
  id integer [pk]
  user_id integer [not null, ref: > users.id]
  status order_status
}
TableGroup billing {
  orders
}
`;

// --- SQL export ---
const pg = await exportSchema(source, 'postgres');
check('postgres export succeeds', pg.ok, true);
check('  ...creates the tables', /CREATE TABLE "users"/.test(pg.text) && /CREATE TABLE "orders"/.test(pg.text), true);
check('  ...creates the enum type', /CREATE TYPE "order_status"/.test(pg.text), true);
check('  ...creates the index', /CREATE UNIQUE INDEX "idx_users_email"/.test(pg.text), true);
check('  ...creates the foreign key', /REFERENCES "users" \("id"\)/.test(pg.text), true);

const my = await exportSchema(source, 'mysql');
check('mysql export succeeds', my.ok, true);
check('  ...quotes with backticks', my.text.includes('CREATE TABLE `users`'), true);

for (const target of EXPORT_TARGETS) {
  // eslint-disable-next-line no-await-in-loop
  const result = await exportSchema(source, target.id);
  check(`${target.label} export produces output`, result.ok && result.text.length > 0, true);
}

// A parse error must arrive as readable text, not @dbml/core's undefined message.
const broken = await exportSchema('Table oops {\n  id integer\n', 'postgres');
check('broken DBML fails the export', broken.ok, false);
check('  ...with a real message', typeof broken.error === 'string' && broken.error.length > 0, true);
check('  ...that is never "undefined"', /undefined/.test(broken.error), false);
check('  ...and names the line', /^Line \d+:/.test(broken.error), true);

const nothing = await exportSchema('   ', 'postgres');
check('empty schema is refused politely', nothing.ok, false);

// --- SQL import ---
const imported = await importSql(
  `CREATE TABLE "customers" (
     "id" serial PRIMARY KEY,
     "email" varchar(255) NOT NULL UNIQUE
   );
   CREATE TABLE "invoices" (
     "id" serial PRIMARY KEY,
     "customer_id" int NOT NULL REFERENCES "customers" ("id")
   );`,
  'postgres'
);
check('postgres import succeeds', imported.ok, true);

// The real test of an import is that the DBML it produced parses back.
const reparsed = await parseDbml(imported.dbml);
check('  ...and the DBML it produced parses', reparsed.ok, true);
check('  ...with both tables', reparsed.schema.tables.map((t) => t.name).sort(), ['customers', 'invoices']);
check('  ...and the foreign key as a ref', reparsed.schema.refs.length, 1);
check('  ...pointing invoices -> customers', [reparsed.schema.refs[0].source.table, reparsed.schema.refs[0].target.table], ['invoices', 'customers']);

const junk = await importSql('this is not sql at all', 'postgres');
check('junk input fails the import', junk.ok, false);
check('  ...with a real message', typeof junk.error === 'string' && junk.error.length > 0, true);
check('every import dialect is named', IMPORT_SOURCES.every((s) => s.id && s.label), true);

// --- round trip ---
const roundTrip = await importSql(pg.text, 'postgres');
check('exported postgres re-imports', roundTrip.ok, true);
const roundParsed = await parseDbml(roundTrip.dbml);
check('  ...and the round trip still parses', roundParsed.ok, true);
check('  ...keeping every table', roundParsed.schema.tables.map((t) => t.name).sort(), ['orders', 'users']);

// --- SVG ---
const parsed = await parseDbml(source);
const { nodes, edges, groups } = buildGraph(parsed.schema, {}, {});
const svg = buildDiagramSvg(nodes, edges, groups);

check('svg is produced', svg.startsWith('<svg'), true);
check('  ...and closed', svg.endsWith('</svg>'), true);
check('  ...declares the namespace', svg.includes('xmlns="http://www.w3.org/2000/svg"'), true);
check('  ...has positive dimensions', /width="(\d+(\.\d+)?)" height="(\d+(\.\d+)?)"/.test(svg), true);
check('  ...names every table', svg.includes('>users<') && svg.includes('>orders<'), true);
check('  ...draws the enum', svg.includes('>order_status<'), true);
check('  ...draws the group', svg.includes('>billing<'), true);
check('  ...draws the index', svg.includes('(email) U'), true);
check('  ...labels the relationship', svg.includes('>1:N<'), true);
check('  ...defines the arrow marker it references', svg.includes('<marker id="arrow"'), true);
check('  ...draws one path per edge', (svg.match(/<path d="M/g) || []).length >= edges.length, true);

// The ground has to sit outside the content transform, or the margins come out
// transparent and the PNG looks clipped wherever it's pasted.
check('  ...paints the ground before translating', svg.indexOf('<rect width=') < svg.indexOf('<g transform='), true);

// Nothing may be drawn outside the viewBox: the group backdrop is the piece
// that reaches furthest, so its padding has to be inside the measured bounds.
const [, svgW, svgH] = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
const coords = [...svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)];
const offset = svg.match(/translate\(([\d.]+) ([\d.]+)\)/);
check('every drawn box lands inside the canvas',
  coords.every(([, x, y, w, h]) =>
    Number(x) + Number(offset[1]) >= 0 &&
    Number(y) + Number(offset[2]) >= 0 &&
    Number(x) + Number(w) + Number(offset[1]) <= Number(svgW) &&
    Number(y) + Number(h) + Number(offset[2]) <= Number(svgH)), true);

// --- sticky notes in the export ---
const noted = buildDiagramSvg(nodes, edges, groups, {
  notes: [
    {
      id: 'n1',
      x: -400,
      y: -300,
      text: 'Remember to add soft deletes before this ships to anyone',
    },
  ],
});
check('a note is drawn', noted.includes('>Remember to add soft'), true);
// 56 characters against a 30-character line: it has to break onto a second one.
check('  ...and wraps rather than overflowing', (noted.match(/font-size="11.5"/g) || []).length, 2);
check('  ...and widens the canvas to fit', Number(noted.match(/width="([\d.]+)"/)[1]) > Number(svgW), true);

const longWord = buildDiagramSvg(nodes, edges, groups, {
  notes: [{ id: 'n1', x: 0, y: 0, text: 'x'.repeat(75) }],
});
check('an unbreakable word is hard-wrapped', (longWord.match(/>x{30}</g) || []).length, 2);

const emptyNote = buildDiagramSvg(nodes, edges, groups, { notes: [{ id: 'n1', x: 0, y: 0, text: '' }] });
check('an empty note still draws its card', (emptyNote.match(/rx="8"/g) || []).length > (svg.match(/rx="8"/g) || []).length, true);

const nastyNote = buildDiagramSvg(nodes, edges, groups, {
  notes: [{ id: 'n1', x: 0, y: 0, text: '<script>alert(1)</script>' }],
});
check('note text is escaped', nastyNote.includes('&lt;script&gt;'), true);
check('  ...leaving no live element', nastyNote.includes('<script>'), false);

const light = buildDiagramSvg(nodes, edges, groups, { theme: 'light' });
check('light theme uses a white ground', light.includes('fill="#ffffff"'), true);
check('dark theme does not', svg.includes('fill="#ffffff"'), false);

check('an empty diagram exports nothing rather than a blank file', buildDiagramSvg([], [], []), null);

// Text from the schema must not be able to break out of the markup.
const nastyParse = await parseDbml('Table "a<b>&c" {\n  id integer [pk]\n}\n');
const nasty = buildDiagramSvg(buildGraph(nastyParse.schema, {}, {}).nodes, [], []);
check('table names are escaped', nasty.includes('a&lt;b&gt;&amp;c'), true);
check('  ...leaving no raw tag', nasty.includes('<b>'), false);

console.log(failures === 0 ? '\nAll export checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
