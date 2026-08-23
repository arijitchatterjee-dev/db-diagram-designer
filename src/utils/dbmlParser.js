// @dbml/core ships every dialect importer/exporter in one package and is by far
// the heaviest dependency here, so it loads on demand — only the editor page
// ever needs it, and the login/dashboard bundles stay small.
let ParserClass = null;
let loadPromise = null;

export function loadParser() {
  if (ParserClass) return Promise.resolve(ParserClass);
  if (!loadPromise) {
    loadPromise = import('@dbml/core').then((mod) => {
      ParserClass = mod.Parser;
      return ParserClass;
    });
  }
  return loadPromise;
}

const EMPTY_SCHEMA = { tables: [], refs: [], enums: [], groups: [], project: null };

/**
 * Wraps @dbml/core so the rest of the app never touches the raw AST and never
 * sees a thrown parse error. Always resolves to a result object:
 *   { ok: true,  schema: { tables, refs, enums, groups, project } }
 *   { ok: false, error: { message, line, column } }
 */
export async function parseDbml(source) {
  if (!(source || '').trim()) {
    return { ok: true, schema: EMPTY_SCHEMA };
  }

  let Parser;
  try {
    Parser = await loadParser();
  } catch {
    return { ok: false, error: { message: 'Could not load the DBML parser', line: null, column: null } };
  }

  try {
    const database = new Parser().parse(source, 'dbml');
    return { ok: true, schema: normalize(database) };
  } catch (err) {
    return { ok: false, error: toParseError(err) };
  }
}

function normalize(database) {
  const tables = [];
  const refs = [];
  const enums = [];
  const groups = [];

  (database.schemas || []).forEach((schema) => {
    (schema.enums || []).forEach((e) => {
      enums.push({
        name: e.name,
        values: (e.values || []).map((v) => v.name),
      });
    });

    (schema.tableGroups || []).forEach((group) => {
      groups.push({
        name: group.name,
        note: noteText(group.note),
        tables: (group.tables || []).map((t) => t.name),
      });
    });

    (schema.tables || []).forEach((table) => {
      tables.push({
        name: table.name,
        schemaName: schema.name,
        note: noteText(table.note),
        headerColor: table.headerColor || null,
        groupName: table.group?.name || null,
        indexes: (table.indexes || []).map(indexOf),
        fields: (table.fields || []).map((field) => ({
          name: field.name,
          type: field.type?.type_name || 'unknown',
          pk: Boolean(field.pk),
          unique: Boolean(field.unique),
          notNull: Boolean(field.not_null),
          increment: Boolean(field.increment),
          default: field.dbdefault?.value ?? null,
          note: noteText(field.note),
        })),
      });
    });

    (schema.refs || []).forEach((ref, index) => {
      const [left, right] = ref.endpoints || [];
      if (!left || !right) return;

      // Endpoint order isn't normalized by the parser: an inline
      // `[ref: > users.id]` comes back reversed relative to an equivalent
      // `Ref: posts.user_id > users.id` line. Always put the "many" side
      // first so the arrow points from the FK to the PK either way.
      const flip = left.relation === '1' && right.relation === '*';
      const source = endpointOf(flip ? right : left);
      const target = endpointOf(flip ? left : right);

      refs.push({
        id: `ref-${source.table}.${source.columns.join('-')}--${target.table}.${target.columns.join('-')}-${index}`,
        source,
        target,
        type: relationType(source.relation, target.relation),
      });
    });
  });

  return {
    tables,
    refs,
    enums,
    groups,
    // The optional `Project { }` block. Null when the document doesn't have one.
    project: database.name
      ? {
          name: database.name,
          note: noteText(database.note),
          databaseType: database.databaseType || null,
        }
      : null,
  };
}

/**
 * An `indexes { }` entry. A column can be a plain name or a backtick
 * expression like `` `lower(email)` `` — both arrive as a `value`, with `type`
 * telling them apart, so expressions get shown as the expression they are.
 */
function indexOf(index) {
  const columns = (index.columns || []).map((column) =>
    column.type === 'expression' ? `(${column.value})` : column.value
  );

  return {
    name: index.name || null,
    columns,
    unique: Boolean(index.unique),
    pk: Boolean(index.pk),
    type: index.type || null, // btree / hash / gin ...
  };
}

function endpointOf(endpoint) {
  return {
    table: endpoint.tableName,
    columns: endpoint.fieldNames || (endpoint.fields || []).map((f) => f.name),
    relation: endpoint.relation, // '1' or '*'
  };
}

// DBML gives us the cardinality on each side; collapse the pair into the
// operator the user actually typed.
function relationType(sourceRelation, targetRelation) {
  if (sourceRelation === '*' && targetRelation === '*') return 'many-to-many';
  if (sourceRelation === '1' && targetRelation === '1') return 'one-to-one';
  return 'one-to-many';
}

function noteText(note) {
  if (!note) return null;
  if (typeof note === 'string') return note;
  return note.value || null;
}

// @dbml/core has shipped a few different error shapes over the years; pull a
// message and a line number out of whichever one we got.
function toParseError(err) {
  const diag = Array.isArray(err?.diags) && err.diags.length ? err.diags[0] : null;
  const location = diag?.location || err?.location || null;
  const line = location?.start?.line ?? null;
  const column = location?.start?.column ?? null;
  const message = (diag?.message || err?.message || 'Invalid DBML').trim();

  return { message, line, column };
}
