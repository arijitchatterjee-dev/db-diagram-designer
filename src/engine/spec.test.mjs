// Checks for the exported spec and the AI handoff prompt: `npm test` in client/.
import { parseDbml } from '../utils/dbmlParser.js';
import { recommendStack, resolveDependencies, entitiesFor, apisFor, toStackRows, scaleNotes, applyOverrides } from './recommend.js';
import { suggestedModulesFor, defaultAnswersFor } from './presets.js';
import { buildSpec, specSections } from './buildSpec.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`
  );
}

const answers = {
  ...defaultAnswersFor('ecommerce'),
  userScale: 'growing',
  team: 'small',
  hosting: 'managed',
  realtime: 'notifications',
};
const stack = recommendStack(answers);
const moduleKeys = resolveDependencies(suggestedModulesFor('ecommerce')).keys;
const entities = entitiesFor(moduleKeys);

const plan = {
  presetKey: 'ecommerce',
  context: 'A storefront for a small clothing brand.',
  goal: 'Customers can browse, pay and track an order.',
  answers,
  moduleKeys,
  stack: toStackRows(stack),
  apis: apisFor(moduleKeys),
  scaleNotes: scaleNotes(answers, stack),
  status: 'planned',
};

const selectedModules = [
  {
    blueprintKey: 'auth',
    blueprintVersion: 1,
    checklist: [
      { category: 'Security', item: 'bcrypt password hashing', done: true },
      { category: 'Data', item: 'Unique index on email', done: false },
    ],
  },
];

const base = { projectName: 'Storefront', plan, stack, entities, selectedModules };
const doc = buildSpec({ ...base, mode: 'document' });
const prompt = buildSpec({ ...base, mode: 'prompt' });

// -------------------------------------------------------------- both modes
for (const [name, text] of [['document', doc], ['prompt', prompt]]) {
  check(`${name}: names the project`, text.includes('Storefront'), true);
  check(`${name}: carries the context`, text.includes('A storefront for a small clothing brand.'), true);
  check(`${name}: carries the goal`, text.includes('Customers can browse, pay and track an order.'), true);
  check(`${name}: lists the constraints`, text.includes('**Expected users:** Growing'), true);
  check(`${name}: states the database`, text.includes('**Database: PostgreSQL**'), true);
  // The whole value of the tool is that the reasons travel with the decision.
  check(`${name}: carries the reasoning`, text.includes('joins are for'), true);
  check(`${name}: says what breaks first`, text.includes('What breaks first'), true);
  check(`${name}: lists modules`, text.includes('### Authentication'), true);
  check(`${name}: has an API table`, text.includes('| Method | Path | Purpose | Auth |'), true);
  check(`${name}: marks a public endpoint`, text.includes('| public |'), true);
  check(`${name}: embeds the data model`, text.includes('```dbml'), true);
  check(`${name}: includes the checklist state`, text.includes('- [x] Security: bcrypt password hashing'), true);
  check(`${name}: and what is still open`, text.includes('- [ ] Data: Unique index on email'), true);
}

// ------------------------------------------------------ what differs by mode
check('the prompt is addressed at a builder', prompt.includes('# Build: Storefront'), true);
check('  ...and says the decisions are settled', prompt.includes('settled plan'), true);
check('  ...and gives working rules', prompt.includes('## How to work'), true);
check('  ...including not to fake progress', prompt.includes('Tick nothing off a checklist you have not actually done.'), true);
check('the document is neutral', doc.startsWith('# Storefront\n'), true);
check('  ...with no instructions to an agent', doc.includes('## How to work'), false);

// ------------------------------------------------ the embedded DBML must parse
const fence = prompt.split('```dbml\n')[1].split('\n```')[0];
const parsed = await parseDbml(fence);
check('the embedded DBML parses', parsed.ok, true);
check('  ...with every table', parsed.schema.tables.length, entities.length);

// ------------------------------------------ architecture, folders, the log
const withArchitecture = {
  ...plan,
  architecture: {
    layering: { choice: 'modular', reasons: ['A feature becomes one folder.'], alternatives: [{ choice: 'mvc', why: '', tradeoff: 'Ten features flattened stops being navigable.' }], overridden: true, note: 'Team prefers this.' },
    topology: { choice: 'monolith', reasons: ['One thing to deploy.'], alternatives: [], overridden: false, note: '' },
    concerns: [
      { key: 'auth', choice: 'session-cookie', reason: 'Page JavaScript can never read the token.', note: '', overridden: false },
      { key: 'jobs', choice: 'none', reason: '', note: 'Revisit at launch.', overridden: true },
    ],
    decisions: [
      { id: 'stack:database', title: 'Database: PostgreSQL', date: '2026-09-03', context: 'Money and joins.', choice: 'PostgreSQL', rejected: ['MongoDB: transactions are the exception'], consequence: 'One primary for writes.', source: 'engine' },
      { id: 'manual:x', title: 'Use UUIDs for public ids', date: '2026-09-01', context: 'Sequential ids leak volume.', choice: 'UUID v7', rejected: [], consequence: 'Larger indexes.', source: 'manual' },
    ],
  },
  folders: {
    generatedFrom: 'express|react-vite|modular|10|abc',
    tree: [
      { path: 'server/src/modules/orders', kind: 'folder', note: '' },
      { path: 'server/src/modules/orders/orders.service.js', kind: 'file', note: 'Business logic' },
      { path: 'server/src/app.js', kind: 'file', note: '' },
    ],
  },
};

for (const [name, text] of [
  ['document', buildSpec({ ...base, plan: withArchitecture, mode: 'document' })],
  ['prompt', buildSpec({ ...base, plan: withArchitecture, mode: 'prompt' })],
]) {
  // Names, not keys: an export saying "modular" helps nobody.
  check(`${name}: names the layering`, text.includes('**Layering: Feature modules**'), true);
  check(`${name}: names the topology`, text.includes('**Deployment: One deployable**'), true);
  check(`${name}: carries the architecture reasoning`, text.includes('A feature becomes one folder.'), true);
  check(`${name}: marks an override`, text.includes('chosen over the recommendation'), true);
  check(`${name}: carries your note on it`, text.includes('Team prefers this.'), true);
  check(`${name}: records what was ruled out`, text.includes('Not mvc:'), true);
  check(`${name}: has a concerns table`, text.includes('| Concern | Decision | Why |'), true);
  check(`${name}: names the concern option`, text.includes('httpOnly session cookie'), true);
  // A concern you chose has no rule to quote, and the export says so honestly.
  check(`${name}: falls back to your note when there is no rule`, text.includes('Revisit at launch.'), true);
  check(`${name}: has the folder tree`, text.includes('Folder structure'), true);
  check(`${name}: renders it as a tree`, text.includes('orders.service.js'), true);
  check(`${name}: carries folder notes`, text.includes('# Business logic'), true);
  check(`${name}: has the decision log`, text.includes('Decision log'), true);
  check(`${name}: with an engine entry`, text.includes('Database: PostgreSQL (2026-09-03)'), true);
  check(`${name}: and one of yours`, text.includes('Use UUIDs for public ids'), true);
  check(`${name}: recording what was set aside`, text.includes('MongoDB: transactions are the exception'), true);
  check(`${name}: and what it costs later`, text.includes('One primary for writes.'), true);
}

// The instruction that makes the folder structure worth exporting at all.
check(
  'the prompt tells an agent to follow the folder structure',
  buildSpec({ ...base, plan: withArchitecture, mode: 'prompt' }).includes('Follow the folder structure'),
  true
);
check(
  '  ...and to ask rather than invent a home',
  buildSpec({ ...base, plan: withArchitecture, mode: 'prompt' }).includes('ask rather than inventing one'),
  true
);

// ------------------------------------------------------------- edge cases
const empty = buildSpec({
  projectName: 'Blank',
  plan: { presetKey: 'custom', context: '', goal: '', answers: {}, moduleKeys: [], apis: [], scaleNotes: [], status: 'draft' },
  stack: recommendStack({}),
  entities: [],
  mode: 'document',
});
check('an empty plan still produces a document', empty.includes('# Blank'), true);
check('  ...saying the context is missing', empty.includes('_Not written yet._'), true);
check('  ...with no empty API table', empty.includes('| Method |'), false);
check('  ...and no empty code fence', empty.includes('```dbml'), false);
check('  ...and no stack section', empty.includes('## Stack'), false);
// Sections with nothing in them are absent rather than present and empty.
check('  ...no architecture section', empty.includes('## Architecture'), false);
check('  ...no folder section', empty.includes('## Folder structure'), false);
check('  ...and no decision log', empty.includes('## Decision log'), false);

// A plan with an architecture but no folders yet prints the one it has.
const archOnly = buildSpec({
  ...base,
  plan: { ...withArchitecture, folders: { generatedFrom: '', tree: [] } },
  mode: 'document',
});
check('an architecture without folders still prints', archOnly.includes('**Layering: Feature modules**'), true);
check('  ...and omits the folder section', archOnly.includes('## Folder structure'), false);

// An override and a toss-up have to be visible, not smoothed over.
const withOverride = applyOverrides(stack, { database: 'mysql' }, answers);
const overrideText = buildSpec({ ...base, stack: withOverride, mode: 'document' });
check('an override is labelled', overrideText.includes('chosen over the recommendation'), true);
const tossStack = recommendStack({ dataShape: 'relational', consistency: 'strong', team: 'large' });
const tossText = buildSpec({ ...base, stack: tossStack, mode: 'document' });
check('a toss-up is labelled', tossText.includes('either would work'), true);

const undecidedText = buildSpec({ ...base, stack: recommendStack({ team: 'solo' }), mode: 'document' });
check('undecided layers are named, not hidden', undecidedText.includes('Still undecided:'), true);

// ------------------------------------------------------------- print view
const sections = specSections({ plan, stack, selectedModules });
check('print sections carry the answers', sections.answers.length, 8);
check('  ...the decided stack', sections.stack.length, stack.filter((r) => !r.undecided).length);
check('  ...the modules with their tables', sections.modules[0].tables.includes('users'), true);
check('  ...and the checklist progress', sections.checklists[0].done, 1);

console.log(failures === 0 ? '\nAll spec checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
