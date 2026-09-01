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
