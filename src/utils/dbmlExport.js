// SQL in and out of DBML. Both directions live in @dbml/core, which is already
// loaded lazily for parsing — these share that same chunk, so offering export
// and import costs nothing until someone actually opens the menu.
let corePromise = null;

function loadCore() {
  if (!corePromise) corePromise = import('@dbml/core');
  return corePromise;
}

/** Dialects @dbml/core can generate DDL for, in the order the menu shows them. */
export const EXPORT_TARGETS = [
  { id: 'postgres', label: 'PostgreSQL', extension: 'sql' },
  { id: 'mysql', label: 'MySQL', extension: 'sql' },
  { id: 'mssql', label: 'SQL Server', extension: 'sql' },
  { id: 'oracle', label: 'Oracle', extension: 'sql' },
  { id: 'json', label: 'JSON', extension: 'json' },
];

/** Dialects it can read DDL from. */
export const IMPORT_SOURCES = [
  { id: 'postgres', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'mssql', label: 'SQL Server' },
  { id: 'snowflake', label: 'Snowflake' },
];

/**
 * DBML -> DDL. Resolves to `{ ok: true, text }` or `{ ok: false, error }`;
 * like the parser wrapper, it never throws at the caller.
 */
export async function exportSchema(dbml, target) {
  if (!(dbml || '').trim()) {
    return { ok: false, error: 'There is nothing to export yet.' };
  }

  try {
    const { exporter } = await loadCore();
    return { ok: true, text: exporter.export(dbml, target) };
  } catch (err) {
    return { ok: false, error: readableError(err, 'Could not export this schema') };
  }
}

/**
 * DDL -> DBML. The result is text for the editor, not a schema: the caller
 * decides whether to replace what's already there.
 */
export async function importSql(sql, source) {
  if (!(sql || '').trim()) {
    return { ok: false, error: 'Paste some SQL first.' };
  }

  try {
    const { importer } = await loadCore();
    const dbml = importer.import(sql, source);
    if (!dbml.trim()) {
      return { ok: false, error: 'That SQL parsed, but produced no tables.' };
    }
    return { ok: true, dbml };
  } catch (err) {
    return { ok: false, error: readableError(err, 'Could not read that SQL') };
  }
}

// @dbml/core throws a CompilerError whose own `message` is undefined — the
// real text is on the first entry of `diags`.
function readableError(err, fallback) {
  const diag = Array.isArray(err?.diags) && err.diags.length ? err.diags[0] : null;
  const message = diag?.message || err?.message;
  if (!message) return fallback;

  const line = diag?.location?.start?.line ?? err?.location?.start?.line;
  return line ? `Line ${line}: ${message}` : message;
}
