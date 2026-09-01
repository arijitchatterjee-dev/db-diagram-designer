import { indexDbml } from '../utils/dbmlIndex.js';
import { findModule } from './modules.js';

/**
 * Turns the entities a module selection implies into DBML the diagram tool can
 * open directly.
 *
 * What comes out is a starting point and the UI says so: it gets you the
 * tables and the obvious foreign keys, and the interesting columns are still
 * yours to write.
 */

// Quoted so a column or table sharing a name with DBML syntax cannot break the
// parse. Only applied where needed, since quoting everything is unreadable.
const SAFE_NAME = /^[A-Za-z_]\w*$/;
const RESERVED = new Set([
  'table',
  'ref',
  'enum',
  'note',
  'indexes',
  'project',
  'tablegroup',
  'as',
  'default',
  'type',
  'key',
  'primary',
  'unique',
  'increment',
  'null',
  'not',
]);

function name(value) {
  const text = String(value ?? '');
  if (!SAFE_NAME.test(text) || RESERVED.has(text.toLowerCase())) {
    return `"${text.replace(/"/g, '')}"`;
  }
  return text;
}

function settingsFor(field) {
  const settings = [];
  if (field.pk) settings.push('pk');
  if (field.increment) settings.push('increment');
  if (field.notNull && !field.pk) settings.push('not null');
  if (field.unique && !field.pk) settings.push('unique');
  return settings.length ? ` [${settings.join(', ')}]` : '';
}

function tableBlock(entity) {
  const lines = [`Table ${name(entity.name)} {`];
  for (const field of entity.fields) {
    lines.push(`  ${name(field.name)} ${field.type}${settingsFor(field)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

/**
 * `entities` is the output of `entitiesFor`, which has already dropped any ref
 * pointing outside the selection. `knownTables` lets an append keep refs that
 * point at tables already in the document.
 */
function refLines(entities, knownTables) {
  const available = new Set([...knownTables, ...entities.map((e) => e.name)]);
  const refs = [];

  for (const entity of entities) {
    for (const field of entity.fields) {
      if (!field.ref) continue;
      const [table, column] = field.ref.split('.');
      if (!available.has(table)) continue;
      refs.push(
        `Ref: ${name(entity.name)}.${name(field.name)} > ${name(table)}.${name(column)}`
      );
    }
  }
  return refs;
}

export function generateDbml(entities, { title, knownTables = [] } = {}) {
  if (entities.length === 0) return '';

  const header = [
    '// Generated from this project plan.',
    '// A starting point: the tables and the obvious foreign keys. The',
    '// interesting columns are still yours to write.',
  ];
  if (title) header.unshift(`// ${title}`);

  const blocks = [header.join('\n')];

  // Grouped by the module that brought them, so the schema reads in the same
  // order as the plan it came from.
  let currentModule = null;
  for (const entity of entities) {
    if (entity.moduleKey !== currentModule) {
      currentModule = entity.moduleKey;
      const module = findModule(currentModule);
      blocks.push(`// ${module?.name ?? currentModule}`);
    }
    blocks.push(tableBlock(entity));
  }

  const refs = refLines(entities, knownTables);
  if (refs.length) blocks.push(['// Relationships', ...refs].join('\n'));

  return `${blocks.join('\n\n')}\n`;
}

/**
 * What generating would do to the schema that is already there.
 *
 * The counts here are what the confirmation dialog shows, so someone can see
 * the consequence before choosing rather than after.
 */
export function generationPlan(currentDbml, entities) {
  const existing = indexDbml(currentDbml).tables.map((table) => table.name);
  const existingSet = new Set(existing);
  const generated = entities.map((entity) => entity.name);

  return {
    existing,
    generated,
    // Tables the plan would add that are not in the document yet.
    adding: generated.filter((table) => !existingSet.has(table)),
    // Already present, so appending leaves them exactly as they are.
    overlapping: generated.filter((table) => existingSet.has(table)),
    // Yours, and nothing in the plan accounts for them. These are what a
    // replace would destroy.
    unaccounted: existing.filter((table) => !generated.includes(table)),
  };
}

/**
 * Adds only the tables the document does not already have, leaving everything
 * present untouched. Refs from the new tables to existing ones are kept, since
 * those tables really are there.
 */
export function appendMissingTables(currentDbml, entities) {
  const { adding, existing } = generationPlan(currentDbml, entities);
  if (adding.length === 0) return currentDbml;

  const addingSet = new Set(adding);
  const fresh = entities.filter((entity) => addingSet.has(entity.name));
  const block = generateDbml(fresh, { knownTables: existing });

  const base = currentDbml.replace(/\s+$/, '');
  return base ? `${base}\n\n${block}` : block;
}

/**
 * The template a new project is seeded with, copied so the client can tell an
 * untouched schema from one someone has worked on.
 *
 * A copy, not a shared import: the server owns the real one. If they drift the
 * only consequence is that the confirmation dialog appears when it could have
 * been skipped, which is the safe direction to fail in.
 */
export const STARTER_DBML = `// Welcome! Edit this DBML and the diagram updates as you type.

Table users {
  id integer [pk, increment]
  username varchar [unique, not null]
  email varchar [unique, not null]
  created_at timestamp
}

Table posts {
  id integer [pk, increment]
  user_id integer [not null]
  title varchar [not null]
  body text
  published boolean [default: false]
  created_at timestamp
}

Table comments {
  id integer [pk, increment]
  post_id integer [not null]
  user_id integer [not null]
  body text
  created_at timestamp
}

Ref: posts.user_id > users.id
Ref: comments.post_id > posts.id
Ref: comments.user_id > users.id
`;

/** Nothing worth protecting: empty, or the template exactly as it was seeded. */
export function isUntouchedSchema(dbml) {
  const text = (dbml ?? '').trim();
  return text === '' || text === STARTER_DBML.trim();
}
