/**
 * A tolerant scanner over DBML text.
 *
 * Autocomplete can't use `@dbml/core` for this: while you're typing, the
 * document is usually mid-edit and fails to parse, which is exactly when you
 * most want suggestions. This walks the text line by line and picks up
 * whatever tables, columns and enums it can see, brace-matching be damned.
 */

const TABLE_OPEN = /^\s*table\s+(?:"([^"]+)"|([\w.]+))(?:\s+as\s+(?:"([^"]+)"|(\w+)))?/i;
const ENUM_OPEN = /^\s*enum\s+(?:"([^"]+)"|([\w.]+))/i;
const BLOCK_OPEN = /^\s*(tablegroup|project|note|indexes)\b/i;
const COLUMN = /^\s*(?:"([^"]+)"|([A-Za-z_]\w*))\s+(?:"([^"]+)"|([A-Za-z_][\w.]*(?:\([^)]*\))?))/;
const NOT_A_COLUMN = /^\s*(note|indexes|ref)\b/i;

function stripComments(line) {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

export function indexDbml(source) {
  const tables = [];
  const enums = [];

  let current = null; // the table whose body we're inside
  let currentEnum = null;
  let depth = 0;
  let skipBlockDepth = null; // inside indexes {} / Note {} etc.

  const lines = (source || '').split('\n');

  for (const raw of lines) {
    const line = stripComments(raw);
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    // A `Table`/`Enum` opener always starts a new block, even at depth > 0.
    // Reaching one while still "inside" a block means the previous block was
    // never closed, which is the normal state of a document being typed. The
    // alternative (treating it as a column) poisons the whole index.
    const table = opens > 0 ? TABLE_OPEN.exec(line) : null;
    const enumDef = opens > 0 && !table ? ENUM_OPEN.exec(line) : null;

    if (table || enumDef) {
      skipBlockDepth = null;
      if (table) {
        current = {
          name: table[1] || table[2],
          alias: table[3] || table[4] || null,
          columns: [],
        };
        currentEnum = null;
        tables.push(current);
      } else {
        currentEnum = { name: enumDef[1] || enumDef[2], values: [] };
        current = null;
        enums.push(currentEnum);
      }

      depth = opens - closes;
      if (depth <= 0) {
        depth = 0;
        current = null;
        currentEnum = null;
      }
      continue;
    }

    if (depth > 0 && skipBlockDepth === null) {
      if (current) {
        // Nested `indexes { }` / `Note { }` blocks aren't column lists.
        if (BLOCK_OPEN.test(line) && opens > 0) {
          skipBlockDepth = depth;
        } else if (!NOT_A_COLUMN.test(line)) {
          const col = COLUMN.exec(line);
          if (col) {
            current.columns.push({
              name: col[1] || col[2],
              type: col[3] || col[4] || '',
            });
          }
        }
      } else if (currentEnum) {
        const value = /^\s*(?:"([^"]+)"|([A-Za-z_]\w*))/.exec(line);
        if (value) currentEnum.values.push(value[1] || value[2]);
      }
    }

    depth += opens - closes;

    if (skipBlockDepth !== null && depth <= skipBlockDepth) skipBlockDepth = null;
    if (depth <= 0) {
      depth = 0;
      current = null;
      currentEnum = null;
      skipBlockDepth = null;
    }
  }

  return { tables, enums };
}

// Tables are addressable by their real name or their `as` alias.
export function findTable(index, nameOrAlias) {
  const needle = nameOrAlias.toLowerCase();
  return (
    index.tables.find((t) => t.name.toLowerCase() === needle) ||
    index.tables.find((t) => t.alias && t.alias.toLowerCase() === needle) ||
    // `schema.table` references
    index.tables.find((t) => t.name.toLowerCase().endsWith(`.${needle}`)) ||
    null
  );
}

/** Which table body does this document offset sit inside, if any? */
export function tableAtOffset(source, offset) {
  const before = source.slice(0, offset);
  const index = indexDbml(before);
  if (index.tables.length === 0) return null;

  let depth = 0;
  for (const ch of before) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
  }
  if (depth <= 0) return null;

  return index.tables[index.tables.length - 1];
}
