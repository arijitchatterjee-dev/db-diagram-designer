/**
 * Arranging modules into phases.
 *
 * All pure, and all returning a new template rather than mutating one: the
 * editor keeps the draft in React state, and an in-place move would not
 * re-render. Kept out of the component so the fiddly part — what an index means
 * once you have removed the thing you are moving — can be tested directly.
 *
 * Two rules hold everywhere in here:
 *   - Order is the content. Array order is the build order, in both directions.
 *   - A module lives in exactly one phase. Adding it somewhere takes it out of
 *     wherever it was, rather than leaving a copy behind.
 */

export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let phaseCounter = 0;

/** Stable across a reorder, unlike an array index. */
export function newPhaseId() {
  phaseCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `p${Date.now().toString(36)}${phaseCounter}${random}`;
}

export function blankPhase(name = 'Phase 1') {
  return { id: newPhaseId(), name, moduleKeys: [] };
}

/** A new template is never an empty page: it opens with one phase to fill. */
export function blankTemplate() {
  return {
    key: '',
    name: '',
    summary: '',
    phases: [blankPhase()],
  };
}

/** `SaaS Starter!` -> `saas-starter`, matching what the API accepts. */
export function slugifyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Every module key the template has placed, in build order. */
export function assignedKeys(template) {
  return (template.phases || []).flatMap((phase) => phase.moduleKeys);
}

// ---------------------------------------------------------------- phases

export function addPhase(template) {
  const name = `Phase ${(template.phases?.length ?? 0) + 1}`;
  return { ...template, phases: [...(template.phases || []), blankPhase(name)] };
}

export function renamePhase(template, phaseId, name) {
  return {
    ...template,
    phases: template.phases.map((phase) => (phase.id === phaseId ? { ...phase, name } : phase)),
  };
}

/**
 * Removing a phase does not delete the modules in it — they simply stop being
 * assigned, and reappear in the unplaced list to be put somewhere else.
 */
export function removePhase(template, phaseId) {
  return { ...template, phases: template.phases.filter((phase) => phase.id !== phaseId) };
}

export function movePhase(template, phaseId, delta) {
  const from = template.phases.findIndex((phase) => phase.id === phaseId);
  if (from === -1) return template;

  const to = from + delta;
  if (to < 0 || to >= template.phases.length) return template;

  const phases = [...template.phases];
  const [moved] = phases.splice(from, 1);
  phases.splice(to, 0, moved);
  return { ...template, phases };
}

// ---------------------------------------------------------------- modules

/** Where a key currently sits, or null if it is unplaced. */
export function locate(template, key) {
  for (const phase of template.phases || []) {
    const index = phase.moduleKeys.indexOf(key);
    if (index !== -1) return { phaseId: phase.id, index };
  }
  return null;
}

function withoutKey(phases, key) {
  return phases.map((phase) => ({
    ...phase,
    moduleKeys: phase.moduleKeys.filter((k) => k !== key),
  }));
}

/** Appends to the end of a phase, taking the module out of any other phase. */
export function addModule(template, phaseId, key) {
  if (!template.phases.some((phase) => phase.id === phaseId)) return template;

  const phases = withoutKey(template.phases, key).map((phase) =>
    phase.id === phaseId ? { ...phase, moduleKeys: [...phase.moduleKeys, key] } : phase
  );
  return { ...template, phases };
}

/** Takes a module out of the arrangement entirely, back to the unplaced list. */
export function removeModule(template, key) {
  return { ...template, phases: withoutKey(template.phases, key) };
}

/**
 * Moves a module to a position in a phase.
 *
 * `toIndex` is read against the destination list **as it looks now**, before
 * the move — which is what a drop target means: "put it where this row is,
 * pushing this row down". That is also where the one real trap lives: within a
 * single phase, removing the module first shifts every later index down by one,
 * so a downward move has to compensate or it lands one short.
 *
 * `toIndex` beyond the end appends, which is what dropping past the last row
 * should do rather than nothing.
 */
export function moveModule(template, key, toPhaseId, toIndex) {
  const origin = locate(template, key);
  if (!origin) return template;
  if (!template.phases.some((phase) => phase.id === toPhaseId)) return template;

  const sameList = origin.phaseId === toPhaseId;
  const target = sameList && origin.index < toIndex ? toIndex - 1 : toIndex;

  const phases = withoutKey(template.phases, key).map((phase) => {
    if (phase.id !== toPhaseId) return phase;
    const moduleKeys = [...phase.moduleKeys];
    // Clamped rather than rejected: a drop past the last row means "last".
    moduleKeys.splice(Math.max(0, Math.min(target, moduleKeys.length)), 0, key);
    return { ...phase, moduleKeys };
  });

  return { ...template, phases };
}

/** One step up or down within its own phase. The keyboard path for dragging. */
export function nudgeModule(template, key, delta) {
  const origin = locate(template, key);
  if (!origin) return template;

  const phase = template.phases.find((p) => p.id === origin.phaseId);
  const to = origin.index + delta;
  if (to < 0 || to >= phase.moduleKeys.length) return template;

  const moduleKeys = [...phase.moduleKeys];
  const [moved] = moduleKeys.splice(origin.index, 1);
  moduleKeys.splice(to, 0, moved);

  return {
    ...template,
    phases: template.phases.map((p) => (p.id === origin.phaseId ? { ...p, moduleKeys } : p)),
  };
}

// ---------------------------------------------------------------- validation

/** Everything wrong with a template, as messages. Empty means it will save. */
export function validateTemplate(template, { existingKeys = [] } = {}) {
  const problems = [];

  if (!template.name?.trim()) problems.push('Give the template a name.');

  if (!template.key?.trim()) problems.push('Give the template a key.');
  else if (!KEY_PATTERN.test(template.key)) {
    problems.push('The key must be lowercase words joined by hyphens, like "saas-starter".');
  } else if (existingKeys.includes(template.key)) {
    problems.push(`Another template already uses the key "${template.key}".`);
  }

  const unnamed = (template.phases || []).filter((phase) => !phase.name?.trim());
  if (unnamed.length) problems.push('Every phase needs a name.');

  if (!(template.phases || []).length) problems.push('Add at least one phase.');
  else if (assignedKeys(template).length === 0) {
    problems.push('Put at least one module into a phase.');
  }

  return problems;
}
