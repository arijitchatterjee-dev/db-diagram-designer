import { labelFor, LAYERS, PRESETS, ANSWERS, ANSWER_KEYS } from './planOptions.js';
import { findModule } from './modules.js';
import { generateDbml } from './generateDbml.js';

/**
 * Turns a plan into the two things you take away from it.
 *
 * `prompt` mode is written at an agent about to build the thing: it states the
 * decisions as settled and says why, so the reasoning does not have to be
 * rediscovered or argued with. `document` mode is the same content written
 * neutrally, to commit next to the code.
 *
 * Both come from one builder because a spec and a brief that disagree are
 * worse than either alone.
 */

function heading(level, text) {
  return `${'#'.repeat(level)} ${text}`;
}

function answerLabel(key, value) {
  return ANSWERS[key].options.find((o) => o.value === value)?.label ?? value;
}

function stackSection(stack, level) {
  const decided = stack.filter((row) => !row.undecided);
  if (decided.length === 0) return [];

  const lines = [heading(level, 'Stack')];
  for (const row of decided) {
    const flags = [];
    if (row.overridden) flags.push('chosen over the recommendation');
    if (row.tossUp) flags.push('a close call, either would work');

    lines.push(
      '',
      `**${labelFor(LAYERS, row.layer)}: ${row.name}**${flags.length ? ` _(${flags.join('; ')})_` : ''}`
    );
    for (const reason of row.reasons) lines.push(`- ${reason}`);
    for (const concern of row.concerns) lines.push(`- Caveat: ${concern}`);
    if (row.breaksAt) lines.push(`- Breaks at: ${row.breaksAt}`);

    // Only the ones that were genuinely rejected, so the reader knows the
    // obvious alternative was considered rather than missed.
    const ruledOut = (row.alternatives ?? []).filter((alt) => alt.ruledOut && alt.tradeoff);
    for (const alt of ruledOut) lines.push(`- Not ${alt.name}: ${alt.tradeoff}`);
  }

  const undecided = stack.filter((row) => row.undecided);
  if (undecided.length) {
    lines.push(
      '',
      `Still undecided: ${undecided.map((row) => labelFor(LAYERS, row.layer)).join(', ')}.`
    );
  }
  return lines;
}

function modulesSection(moduleKeys, selectedModules, level) {
  if (moduleKeys.length === 0) return [];

  const checklistsByKey = new Map(
    (selectedModules ?? []).map((module) => [module.blueprintKey, module])
  );
  const lines = [heading(level, 'Modules')];

  for (const key of moduleKeys) {
    const module = findModule(key);
    if (!module) continue;

    lines.push('', heading(level + 1, module.name), module.summary);
    if (module.entities.length) {
      lines.push('', `Tables: ${module.entities.map((e) => `\`${e.name}\``).join(', ')}`);
    }

    // A module's checklist is attached per blueprint, so several modules can
    // share one. Printed under the first that references it.
    const attached = module.blueprintKey ? checklistsByKey.get(module.blueprintKey) : null;
    if (attached) {
      checklistsByKey.delete(module.blueprintKey);
      lines.push('', `Checklist (${module.blueprintKey}):`);
      for (const item of attached.checklist) {
        lines.push(`- [${item.done ? 'x' : ' '}] ${item.category}: ${item.item}`);
      }
    }
  }
  return lines;
}

function apiSection(apis, level) {
  if (apis.length === 0) return [];
  return [
    heading(level, 'API surface'),
    '',
    '| Method | Path | Purpose | Auth |',
    '| --- | --- | --- | --- |',
    ...apis.map(
      (api) =>
        `| ${api.method} | \`${api.path}\` | ${api.purpose || ''} | ${api.auth ? 'yes' : 'public'} |`
    ),
  ];
}

export function buildSpec({
  projectName,
  plan,
  stack,
  entities,
  selectedModules = [],
  mode = 'document',
}) {
  const isPrompt = mode === 'prompt';
  const moduleKeys = plan.moduleKeys ?? [];
  const answers = plan.answers ?? {};
  const answered = ANSWER_KEYS.filter((key) => answers[key]);

  const out = [];

  if (isPrompt) {
    out.push(
      heading(1, `Build: ${projectName}`),
      '',
      'This is a settled plan, not a brief to reinterpret. The decisions below',
      'were reasoned against the constraints listed with them. Follow them, and',
      'if one looks wrong, say so rather than quietly choosing differently.'
    );
  } else {
    out.push(heading(1, projectName));
  }

  out.push('', heading(2, 'What it is'), plan.context || '_Not written yet._');
  if (plan.goal) out.push('', `**Done looks like:** ${plan.goal}`);
  out.push('', `Project type: ${labelFor(PRESETS, plan.presetKey)}. Status: ${plan.status}.`);

  if (answered.length) {
    out.push(
      '',
      heading(2, 'Constraints'),
      '',
      ...answered.map((key) => `- **${ANSWERS[key].label}:** ${answerLabel(key, answers[key])}`)
    );
  }

  const stackLines = stackSection(stack, 2);
  if (stackLines.length) out.push('', ...stackLines);

  if ((plan.scaleNotes ?? []).length) {
    out.push('', heading(2, 'What breaks first'), '', ...plan.scaleNotes.map((n) => `- ${n}`));
  }

  const moduleLines = modulesSection(moduleKeys, selectedModules, 2);
  if (moduleLines.length) out.push('', ...moduleLines);

  const apiLines = apiSection(plan.apis ?? [], 2);
  if (apiLines.length) out.push('', ...apiLines);

  if (entities.length) {
    out.push(
      '',
      heading(2, 'Data model'),
      '',
      'DBML. A starting point: the tables and the obvious foreign keys.',
      '',
      '```dbml',
      generateDbml(entities, { title: projectName }).trimEnd(),
      '```'
    );
  }

  if (isPrompt) {
    out.push(
      '',
      heading(2, 'How to work'),
      '',
      '- Use the stack above. Every line under it is the reason it was picked.',
      '- Tick nothing off a checklist you have not actually done.',
      '- The data model is a starting point. Add the columns the features need.',
      '- Ask before adding a dependency that is not implied by the stack.',
      '- Where the plan is silent, say so rather than inventing a decision.'
    );
  }

  return `${out.join('\n')}\n`;
}

/** The structured form the printable view renders, from the same inputs. */
export function specSections({ plan, stack, selectedModules = [] }) {
  const answers = plan.answers ?? {};
  return {
    answers: ANSWER_KEYS.filter((key) => answers[key]).map((key) => ({
      label: ANSWERS[key].label,
      value: answerLabel(key, answers[key]),
    })),
    stack: stack
      .filter((row) => !row.undecided)
      .map((row) => ({
        layer: labelFor(LAYERS, row.layer),
        name: row.name,
        reasons: row.reasons,
        overridden: row.overridden,
        tossUp: row.tossUp,
      })),
    modules: (plan.moduleKeys ?? [])
      .map((key) => findModule(key))
      .filter(Boolean)
      .map((module) => ({
        name: module.name,
        summary: module.summary,
        tables: module.entities.map((e) => e.name),
      })),
    checklists: (selectedModules ?? []).map((module) => ({
      key: module.blueprintKey,
      items: module.checklist,
      done: module.checklist.filter((i) => i.done).length,
    })),
  };
}
