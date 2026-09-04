import { parseDbml } from '../utils/dbmlParser.js';

/**
 * Turns a custom module's DBML into the entity shape the rest of the engine
 * already speaks.
 *
 * The parse is async because `@dbml/core` loads on demand, and the engine's
 * table functions are synchronous and used inside render. So parsing happens
 * once, up front, and the result is cached onto the module. Everything
 * downstream then treats a custom module exactly like a built-in one.
 */

/**
 * The parser returns tables and refs separately; built-in modules carry the
 * relationship on the field itself. Folding refs back onto their field is what
 * makes a custom module's relationships survive into the generated schema.
 */
export function schemaToEntities(schema) {
  const refByField = new Map();
  for (const ref of schema.refs ?? []) {
    const column = ref.source.columns?.[0];
    const target = ref.target.columns?.[0];
    if (!column || !target) continue;
    refByField.set(`${ref.source.table}.${column}`, `${ref.target.table}.${target}`);
  }

  return (schema.tables ?? []).map((table) => ({
    name: table.name,
    fields: (table.fields ?? []).map((field) => ({
      name: field.name,
      type: field.type,
      pk: field.pk,
      unique: field.unique,
      notNull: field.notNull,
      increment: field.increment,
      ref: refByField.get(`${table.name}.${field.name}`),
    })),
  }));
}

/**
 * Parses one module's DBML. Never throws: a module being edited is invalid most
 * of the time, and losing the rest of the plan over a half-typed table would be
 * absurd. An unparseable module simply contributes no tables, and says why.
 */
export async function hydrateCustomModule(module) {
  if (!module?.dbml?.trim()) {
    return { ...module, entities: [], parseError: null };
  }

  const result = await parseDbml(module.dbml);
  if (!result.ok) {
    return { ...module, entities: [], parseError: result.error };
  }
  return { ...module, entities: schemaToEntities(result.schema), parseError: null };
}

export async function hydrateCustomModules(customModules = []) {
  return Promise.all(customModules.map(hydrateCustomModule));
}

/** What gets stored: the hydrated fields are derived and never persisted. */
export function stripHydration(module) {
  const { entities, parseError, ...stored } = module;
  return stored;
}

export function stripAll(customModules = []) {
  return customModules.map(stripHydration);
}

/** A starting point for a new module, so the editor is never a blank page. */
export function blankModule(key = '') {
  return {
    key,
    name: '',
    summary: '',
    dbml: '',
    apis: [],
    dependsOn: [],
    // Empty rather than a level: unset means "use the default" rather than
    // claiming a size nobody chose.
    complexity: '',
    blueprintKey: '',
    libraryKey: '',
  };
}

export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `Razorpay Payments!` -> `razorpay-payments`, matching what the API accepts. */
export function slugifyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Everything wrong with a module, as messages. Empty means it will save.
 * `existingKeys` are the other modules in play, built-in included, so the
 * editor can warn about shadowing before it happens rather than after.
 */
export function validateModule(module, { existingKeys = [], builtInKeys = [] } = {}) {
  const problems = [];

  if (!module.name?.trim()) problems.push('Give the module a name.');
  if (!module.key?.trim()) problems.push('Give the module a key.');
  else if (!KEY_PATTERN.test(module.key)) {
    problems.push('The key must be lowercase words joined by hyphens, like "razorpay-payments".');
  } else if (existingKeys.includes(module.key)) {
    problems.push(`Another module in this plan already uses the key "${module.key}".`);
  }

  for (const api of module.apis ?? []) {
    if (!api.path?.startsWith('/')) {
      problems.push(`Endpoint paths must start with a slash: "${api.path}".`);
      break;
    }
  }

  return problems;
}

/** Not an error: shadowing a built-in is allowed, but it should be said. */
export function shadowWarning(module, builtInKeys = []) {
  if (!module.key || !builtInKeys.includes(module.key)) return null;
  return `This replaces the built-in "${module.key}" module for this project.`;
}
