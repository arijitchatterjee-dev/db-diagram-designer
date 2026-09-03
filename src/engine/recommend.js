import { CANDIDATES, LAYER_ORDER, candidatesForLayer } from './catalog.js';
import { MODULES, findModule } from './modules.js';
import { ARCHITECTURE_ORDER, candidatesFor } from './architecture.js';
import { CONCERNS, findConcernOption } from './concerns.js';

// Two candidates this close is not a recommendation, it is a coin flip, and
// saying so is more useful than picking one and sounding certain.
const TOSSUP_MARGIN = 1;

// Enough to answer "why not the obvious other one", short of listing the whole
// catalogue back at the reader.
const MAX_ALTERNATIVES = 3;

function matchesValue(expected, actual) {
  if (actual === undefined || actual === null || actual === '') return false;
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
}

/**
 * Facts derived from the plan rather than answered in the wizard: how many
 * modules are selected, whether one of them handles money. Numbers are matched
 * with `{ min, max }` because "eight or more features" is the shape those rules
 * actually want; everything else matches by value.
 */
function matchesFact(expected, actual) {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    if (typeof actual !== 'number') return false;
    if (expected.min !== undefined && actual < expected.min) return false;
    if (expected.max !== undefined && actual > expected.max) return false;
    return true;
  }
  if (typeof expected === 'boolean') return actual === expected;
  return matchesValue(expected, actual);
}

function ruleMatches(rule, answers, chosen, facts = {}) {
  for (const [key, expected] of Object.entries(rule.when ?? {})) {
    if (!matchesValue(expected, answers[key])) return false;
  }
  for (const [layer, expected] of Object.entries(rule.whenChoice ?? {})) {
    if (!matchesValue(expected, chosen[layer])) return false;
  }
  for (const [key, expected] of Object.entries(rule.whenFact ?? {})) {
    if (!matchesFact(expected, facts[key])) return false;
  }
  return true;
}

function scoreCandidate(candidate, answers, chosen, facts) {
  let score = 0;
  const forReasons = [];
  const againstReasons = [];

  for (const rule of candidate.rules) {
    if (!ruleMatches(rule, answers, chosen, facts)) continue;
    score += rule.points;
    if (rule.points > 0) forReasons.push({ points: rule.points, text: rule.because });
    else if (rule.points < 0) againstReasons.push({ points: rule.points, text: rule.because });
  }

  // Strongest argument first, so the UI can show one reason and be showing the
  // best one.
  forReasons.sort((a, b) => b.points - a.points);
  againstReasons.sort((a, b) => a.points - b.points);

  return {
    candidate,
    score,
    reasons: forReasons.map((r) => r.text),
    concerns: againstReasons.map((r) => r.text),
  };
}

/**
 * Scores every candidate in every layer.
 *
 * Layers resolve in LAYER_ORDER so a later one can react to an earlier choice:
 * "you already run Postgres" is only a reason for Postgres full-text search
 * once the database is settled.
 *
 * A layer whose best candidate scores nothing comes back `undecided` rather
 * than guessing. Answer more questions and it fills in.
 */
export function recommendStack(answers = {}) {
  const chosen = {};
  const results = [];

  for (const layer of LAYER_ORDER) {
    const scored = candidatesForLayer(layer)
      .map((candidate) => scoreCandidate(candidate, answers, chosen))
      .sort((a, b) => b.score - a.score);

    const [best, runnerUp] = scored;

    if (!best || best.score <= 0) {
      results.push({
        layer,
        choice: null,
        name: null,
        score: best?.score ?? 0,
        reasons: [],
        concerns: [],
        alternatives: [],
        tossUp: false,
        undecided: true,
        breaksAt: null,
      });
      continue;
    }

    chosen[layer] = best.candidate.key;

    results.push({
      layer,
      choice: best.candidate.key,
      name: best.candidate.name,
      score: best.score,
      reasons: best.reasons,
      concerns: best.concerns,
      alternatives: scored
        .slice(1)
        // Anything the answers actually said something about, for or against.
        // A candidate that scored only objections still earns its place: "why
        // not MongoDB here" is the first question a reader has, and the
        // objections are the answer.
        .filter((entry) => entry.reasons.length > 0 || entry.concerns.length > 0)
        .slice(0, MAX_ALTERNATIVES)
        .map((entry) => ({
          choice: entry.candidate.key,
          name: entry.candidate.name,
          score: entry.score,
          why: entry.reasons[0] ?? '',
          // The honest cost of picking this instead: its own strongest
          // objection, or failing that what the winner does better.
          tradeoff: entry.concerns[0] ?? best.reasons[0] ?? '',
          // On balance the answers argue against it, whatever it also has
          // going for it. Presenting SQLite as a live option for a growing
          // store because it happens to be ACID would be misleading, so these
          // are shown as considered and rejected, with the objection.
          ruledOut: entry.score <= 0,
        })),
      tossUp: Boolean(runnerUp) && best.score - runnerUp.score <= TOSSUP_MARGIN && runnerUp.score > 0,
      undecided: false,
      breaksAt: best.candidate.breaksAt ?? null,
    });
  }

  return results;
}

/** What gives out first, so the plan records the ceiling it was designed to. */
export function scaleNotes(answers = {}, stack = []) {
  const notes = [];
  const pick = (layer) => stack.find((row) => row.layer === layer);

  const database = pick('database');
  if (database?.breaksAt) notes.push(`${database.name}: ${database.breaksAt}`);

  // Anything extra you are running is another thing with a ceiling, so say what
  // each one's is rather than only the database's.
  for (const layer of ['cache', 'search']) {
    const row = pick(layer);
    if (row && row.choice && row.choice !== 'none' && row.breaksAt) {
      notes.push(`${row.name}: ${row.breaksAt}`);
    }
  }

  const search = pick('search');
  if (search?.choice === 'postgres-fts' && answers.search === 'faceted') {
    notes.push(
      'Faceted filtering on Postgres is the first thing to strain. That is the moment a dedicated search service earns its keep.'
    );
  }

  const cache = pick('cache');
  if (cache?.choice === 'none' && answers.readWrite === 'read-heavy') {
    notes.push(
      'No cache yet, deliberately. Add one when the same expensive read starts repeating, not before.'
    );
  }

  if (answers.userScale === 'hobby') {
    notes.push('Sized for a personal project. Almost every choice here changes if real traffic arrives.');
  }
  if (answers.userScale === 'large' && answers.consistency === 'strong') {
    notes.push(
      'Strong consistency at this size means the write path is the bottleneck, not the read path. Plan the read replicas before you need them.'
    );
  }
  if (answers.realtime === 'live') {
    notes.push(
      'Live collaboration needs sticky connections, which is the part that makes horizontal scaling awkward. Decide early where that state lives.'
    );
  }

  return notes;
}

// ----------------------------------------------------------- architecture

/**
 * Facts the architecture rules read that the wizard never asked about. Derived
 * from the plan, so changing the module selection changes the architecture.
 */
export function architectureFacts(plan = {}, stack = []) {
  const moduleKeys = plan.moduleKeys ?? [];
  const MONEY = new Set(['checkout', 'billing', 'payouts', 'orders', 'sales']);

  return {
    moduleCount: moduleKeys.length,
    hasPayments: moduleKeys.some((key) => MONEY.has(key)),
    hasRealtime: plan.answers?.realtime === 'live',
    stack,
  };
}

function chosenFromStack(stack = []) {
  const chosen = {};
  for (const row of stack) {
    if (row && !row.undecided && row.choice) chosen[row.layer] = row.choice;
  }
  return chosen;
}

/**
 * Layering and topology, scored the same way the stack is.
 *
 * Resolved in order so topology can react to the layering choice: "the code is
 * already organised by feature, so the deployment shape matches it" is only a
 * reason once layering is settled.
 */
export function recommendArchitecture(answers = {}, facts = {}) {
  const chosen = chosenFromStack(facts.stack);
  const out = {};

  for (const dimension of ARCHITECTURE_ORDER) {
    const scored = candidatesFor(dimension)
      .map((candidate) => scoreCandidate(candidate, answers, chosen, facts))
      .sort((a, b) => b.score - a.score);

    const [best, runnerUp] = scored;

    if (!best || best.score <= 0) {
      out[dimension] = {
        dimension,
        choice: null,
        name: null,
        score: best?.score ?? 0,
        reasons: [],
        concerns: [],
        alternatives: [],
        tossUp: false,
        undecided: true,
        breaksAt: null,
      };
      continue;
    }

    chosen[dimension] = best.candidate.key;

    out[dimension] = {
      dimension,
      choice: best.candidate.key,
      name: best.candidate.name,
      summary: best.candidate.summary,
      score: best.score,
      reasons: best.reasons,
      concerns: best.concerns,
      alternatives: scored
        .slice(1)
        .filter((entry) => entry.reasons.length > 0 || entry.concerns.length > 0)
        .slice(0, MAX_ALTERNATIVES)
        .map((entry) => ({
          choice: entry.candidate.key,
          name: entry.candidate.name,
          score: entry.score,
          why: entry.reasons[0] ?? '',
          tradeoff: entry.concerns[0] ?? best.reasons[0] ?? '',
          ruledOut: entry.score <= 0,
        })),
      tossUp: Boolean(runnerUp) && best.score - runnerUp.score <= TOSSUP_MARGIN && runnerUp.score > 0,
      undecided: false,
      breaksAt: best.candidate.breaksAt ?? null,
    };
  }

  return out;
}

/** One decision per cross-cutting concern, with the rule that produced it. */
export function recommendConcerns(answers = {}, facts = {}, architecture = {}) {
  const chosen = {
    ...chosenFromStack(facts.stack),
    layering: architecture.layering?.choice ?? null,
    topology: architecture.topology?.choice ?? null,
  };

  return CONCERNS.map((concern) => {
    const scored = concern.options
      .map((option) => scoreCandidate(option, answers, chosen, facts))
      .sort((a, b) => b.score - a.score);

    const [best] = scored;
    if (!best || best.score <= 0) {
      return { key: concern.key, label: concern.label, choice: null, reason: '', alternatives: [], undecided: true };
    }

    return {
      key: concern.key,
      label: concern.label,
      choice: best.candidate.key,
      name: best.candidate.name,
      reason: best.reasons[0] ?? '',
      reasons: best.reasons,
      concerns: best.concerns,
      alternatives: scored
        .slice(1)
        .filter((entry) => entry.reasons.length > 0 || entry.concerns.length > 0)
        .slice(0, MAX_ALTERNATIVES)
        .map((entry) => ({
          choice: entry.candidate.key,
          name: entry.candidate.name,
          why: entry.reasons[0] ?? '',
          tradeoff: entry.concerns[0] ?? '',
          ruledOut: entry.score <= 0,
        })),
      undecided: false,
    };
  });
}

/**
 * Replaces the engine's architecture picks with yours.
 *
 * Applied on top of a fresh run, exactly like the stack: changing an answer
 * re-reasons everything while your decisions stay yours, and an overridden
 * choice still carries its real reasons and objections under the current
 * answers so you can see what you are trading away.
 */
export function applyArchitectureOverrides(architecture, overrides = {}, answers = {}, facts = {}) {
  const chosen = {
    ...chosenFromStack(facts.stack),
    layering: overrides.layering ?? architecture.layering?.choice ?? null,
    topology: overrides.topology ?? architecture.topology?.choice ?? null,
  };

  const out = {};
  for (const dimension of ARCHITECTURE_ORDER) {
    const row = architecture[dimension];
    const choice = overrides[dimension];

    if (!choice || choice === row?.choice) {
      out[dimension] = row;
      continue;
    }

    const candidate = candidatesFor(dimension).find((c) => c.key === choice);
    if (!candidate) {
      out[dimension] = row;
      continue;
    }

    const scored = scoreCandidate(candidate, answers, chosen, facts);
    out[dimension] = {
      ...row,
      choice: candidate.key,
      name: candidate.name,
      summary: candidate.summary,
      reasons: scored.reasons,
      concerns: scored.concerns,
      breaksAt: candidate.breaksAt ?? null,
      overridden: true,
      // Kept so the UI can offer to go back to it.
      enginePick: row?.undecided ? null : { choice: row?.choice, name: row?.name },
      undecided: false,
      tossUp: false,
    };
  }
  return out;
}

/** The same, for the one decision per cross-cutting concern. */
export function applyConcernOverrides(concerns, overrides = {}) {
  return concerns.map((concern) => {
    const choice = overrides[concern.key];
    if (!choice || choice === concern.choice) return concern;

    const option = findConcernOption(concern.key, choice);
    if (!option) return concern;

    return {
      ...concern,
      choice: option.key,
      name: option.name,
      // The engine did not argue for this one, so there is no rule to quote.
      reason: '',
      overridden: true,
      enginePick: concern.undecided ? null : { choice: concern.choice, name: concern.name },
      undecided: false,
    };
  });
}

/** Turns architecture output into the rows the API stores. */
export function toArchitectureRows(architecture, notes = {}) {
  const row = (entry, key) => ({
    choice: entry?.undecided ? '' : entry?.choice ?? '',
    reasons: entry?.reasons ?? [],
    alternatives: (entry?.alternatives ?? []).map((alt) => ({
      choice: alt.choice,
      why: alt.why,
      tradeoff: alt.tradeoff,
    })),
    overridden: entry?.overridden === true,
    // Your own note on the decision, which no re-run may discard.
    note: notes[key] ?? '',
  });

  return {
    layering: row(architecture.layering, 'layering'),
    topology: row(architecture.topology, 'topology'),
  };
}

export function toConcernRows(concerns, notes = {}) {
  return concerns
    .filter((concern) => !concern.undecided)
    .map((concern) => ({
      key: concern.key,
      choice: concern.choice,
      reason: concern.reason,
      note: notes[concern.key] ?? '',
      overridden: concern.overridden === true,
    }));
}

/**
 * Replaces the engine's pick for a layer with the one you chose.
 *
 * Overrides are applied on top of a fresh run rather than baked in, so changing
 * an answer re-reasons everything while your decisions stay yours. The
 * overridden row still carries that candidate's real reasons and concerns
 * under the current answers, which is how you can see what you are trading
 * away rather than only that you disagreed.
 */
export function applyOverrides(recommendations, overrides = {}, answers = {}) {
  // The effective choice per layer, so a cross-layer rule sees what you
  // actually picked rather than what the engine would have picked.
  const chosen = {};
  for (const row of recommendations) {
    const choice = overrides[row.layer] ?? row.choice;
    if (choice) chosen[row.layer] = choice;
  }

  return recommendations.map((row) => {
    const choice = overrides[row.layer];
    if (!choice || choice === row.choice) return row;

    const candidate = CANDIDATES.find((c) => c.layer === row.layer && c.key === choice);
    if (!candidate) return row;

    const scored = scoreCandidate(candidate, answers, chosen);

    return {
      ...row,
      choice: candidate.key,
      name: candidate.name,
      reasons: scored.reasons,
      concerns: scored.concerns,
      breaksAt: candidate.breaksAt ?? null,
      overridden: true,
      // The engine's own pick, kept so the UI can offer to go back to it.
      enginePick: row.undecided ? null : { choice: row.choice, name: row.name },
      undecided: false,
      tossUp: false,
    };
  });
}

/** Turns engine output into the `stack` rows the API stores. */
export function toStackRows(recommendations) {
  return recommendations
    .filter((row) => !row.undecided && row.choice)
    .map((row) => ({
      layer: row.layer,
      choice: row.choice,
      reasons: row.reasons,
      alternatives: row.alternatives.map((alt) => ({
        choice: alt.choice,
        why: alt.why,
        tradeoff: alt.tradeoff,
      })),
      overridden: row.overridden === true,
      note: '',
    }));
}

// ---------------------------------------------------------------- modules

/**
 * Built-in modules plus the ones you defined, with yours winning a collision.
 *
 * Naming a custom module `auth` replaces the built-in for that project rather
 * than erroring: your product's idea of authentication is more authoritative
 * than the catalogue's. The UI is where that has to be said out loud.
 *
 * Custom modules carry `entities` only after `hydrateCustomModules` has parsed
 * their DBML; before that they contribute endpoints but no tables.
 */
export function moduleIndex(customModules = []) {
  const byKey = new Map(MODULES.map((module) => [module.key, module]));
  for (const module of customModules) {
    if (module?.key) byKey.set(module.key, { entities: [], apis: [], dependsOn: [], ...module });
  }
  return byKey;
}

function lookupIn(index, key) {
  return index.get(key) ?? null;
}

/**
 * Pulls in what a selection depends on. Ticking `checkout` without `cart` is
 * not a plan, it is a gap, so the missing pieces are added and reported rather
 * than silently assumed.
 */
export function resolveDependencies(keys = [], customModules = []) {
  const index = moduleIndex(customModules);
  const selected = [];
  const added = [];
  const seen = new Set();

  const visit = (key, requiredBy) => {
    if (seen.has(key)) return;
    const module = lookupIn(index, key);
    if (!module) return;

    seen.add(key);
    for (const dependency of module.dependsOn ?? []) visit(dependency, key);

    selected.push(key);
    if (requiredBy) added.push({ key, name: module.name, requiredBy });
  };

  for (const key of keys) visit(key, null);

  // Catalogue order first, then custom modules in the order they were defined,
  // so the result does not depend on click order.
  const order = [...MODULES.map((module) => module.key), ...customModules.map((m) => m.key)];
  selected.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return { keys: selected, added };
}

/**
 * Removing a module also removes anything that depended on it, since leaving
 * `checkout` behind after dropping `cart` would leave a broken plan.
 */
export function removeModule(keys = [], target, customModules = []) {
  const index = moduleIndex(customModules);
  const remaining = keys.filter((key) => key !== target);
  const dropped = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...remaining]) {
      const module = lookupIn(index, key);
      if (!module) continue;
      const missing = (module.dependsOn ?? []).find((dep) => !remaining.includes(dep));
      if (missing) {
        remaining.splice(remaining.indexOf(key), 1);
        dropped.push({ key, name: module.name, because: missing });
        changed = true;
      }
    }
  }

  return { keys: remaining, dropped };
}

export function apisFor(keys = [], customModules = []) {
  const index = moduleIndex(customModules);
  return keys.flatMap((key) => {
    const module = lookupIn(index, key);
    if (!module) return [];
    return (module.apis ?? []).map((api) => ({
      moduleKey: key,
      method: api.method,
      path: api.path,
      purpose: api.purpose ?? '',
      auth: api.auth !== false,
    }));
  });
}

/**
 * Every table the selection implies. A `ref` pointing at a table that is not
 * in the selection is dropped: a relationship to a table nobody created would
 * fail to parse as DBML.
 */
export function entitiesFor(keys = [], customModules = []) {
  const index = moduleIndex(customModules);
  const entities = [];
  const seen = new Set();

  for (const key of keys) {
    const module = lookupIn(index, key);
    if (!module) continue;
    for (const entity of module.entities ?? []) {
      if (seen.has(entity.name)) continue;
      seen.add(entity.name);
      entities.push({ ...entity, moduleKey: key });
    }
  }

  const tables = new Set(entities.map((entity) => entity.name));
  return entities.map((entity) => ({
    ...entity,
    fields: entity.fields.map((field) => {
      if (!field.ref) return { ...field };
      const [table] = field.ref.split('.');
      return tables.has(table) ? { ...field } : { ...field, ref: undefined };
    }),
  }));
}

export function blueprintKeysFor(keys = [], customModules = []) {
  const index = moduleIndex(customModules);
  const blueprints = new Set();
  for (const key of keys) {
    const module = lookupIn(index, key);
    if (module?.blueprintKey) blueprints.add(module.blueprintKey);
  }
  return [...blueprints];
}

/**
 * Which module owns each table name in a selection.
 *
 * Two modules declaring the same table is not an error the parser can catch:
 * `entitiesFor` silently keeps the first. This is what lets the editor say so
 * while you are still typing, which is the only useful moment.
 */
export function tableOwners(keys = [], customModules = []) {
  const index = moduleIndex(customModules);
  const owners = new Map();

  for (const key of keys) {
    const module = lookupIn(index, key);
    for (const entity of module?.entities ?? []) {
      if (!owners.has(entity.name)) owners.set(entity.name, []);
      owners.get(entity.name).push(key);
    }
  }
  return owners;
}

export { CANDIDATES, LAYER_ORDER };
