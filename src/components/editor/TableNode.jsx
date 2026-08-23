import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Info, Key, LinkSimple, Table } from '@phosphor-icons/react';
import { indexLabel } from '../../utils/autoLayout';

// A handle on each side of every column, so an edge can dock at the exact
// column it references (and from whichever side is closer to its partner).
function ColumnHandles({ column }) {
  return (
    <>
      <Handle type="source" id={`${column}__source__left`} position={Position.Left} className="col-handle" />
      <Handle type="source" id={`${column}__source__right`} position={Position.Right} className="col-handle" />
      <Handle type="target" id={`${column}__target__left`} position={Position.Left} className="col-handle" />
      <Handle type="target" id={`${column}__target__right`} position={Position.Right} className="col-handle" />
    </>
  );
}

// DBML lets a table declare `[headerColor: #a33]`. Honour it on the header
// strip only — the body stays on the app's own surface so a bright colour
// can't make the columns unreadable.
function headerStyle(color) {
  if (!color) return undefined;
  return { background: color, borderBottomColor: color, color: readableOn(color) };
}

function readableOn(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (full.length !== 6) return undefined;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  if ([r, g, b].some(Number.isNaN)) return undefined;
  // Rec. 601 luma — enough to choose between the two text colours.
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? '#12151b' : '#f2f4f8';
}

function TableNode({ data, selected }) {
  const { table, relatedColumns, enumColumns, width } = data;
  const columnCount = table.fields.length;
  const custom = headerStyle(table.headerColor);

  return (
    <div className={`table-node${selected ? ' is-selected' : ''}`} style={{ width }}>
      <header className={`table-node__header${custom ? ' has-color' : ''}`} style={custom}>
        <Table size={13} weight="fill" className="table-node__glyph" />
        <span className="table-node__name">{table.name}</span>
        {table.note && (
          <span className="table-node__note" title={table.note} aria-label={`Note: ${table.note}`}>
            <Info size={12} weight="fill" />
          </span>
        )}
        <span className="table-node__count">{columnCount}</span>
      </header>

      <div className="table-node__body">
        {columnCount === 0 && <p className="table-node__empty">No columns yet</p>}

        {table.fields.map((field) => {
          const linked = relatedColumns?.has(field.name);
          const isEnum = enumColumns?.has(field.name);
          return (
            <div
              key={field.name}
              className={`table-node__row${linked ? ' is-linked' : ''}`}
              title={field.note || undefined}
            >
              <ColumnHandles column={field.name} />

              <span className="table-node__mark">
                {field.pk ? (
                  <Key size={12} weight="fill" className="mark mark--pk" aria-label="Primary key" />
                ) : linked ? (
                  <LinkSimple size={12} weight="bold" className="mark mark--fk" aria-label="Referenced" />
                ) : null}
              </span>

              <span className={`table-node__col${field.pk ? ' is-pk' : ''}`}>
                {field.name}
                {field.note && <i className="table-node__noted" aria-hidden="true" />}
              </span>

              <span className={`table-node__type${isEnum ? ' is-enum' : ''}`}>
                {field.type}
                {field.notNull && <i className="table-node__req" title="Not null" />}
                {field.unique && !field.pk && <em className="table-node__uq" title="Unique">U</em>}
              </span>
            </div>
          );
        })}
      </div>

      {table.indexes?.length > 0 && (
        <div className="table-node__indexes">
          <p className="table-node__caption">Indexes</p>
          {table.indexes.map((index) => (
            <div
              key={index.name || indexLabel(index)}
              className="table-node__index"
              title={indexTitle(index)}
            >
              <span className="table-node__index-cols">{indexLabel(index)}</span>
              {index.pk && <em className="table-node__uq">PK</em>}
              {index.unique && !index.pk && <em className="table-node__uq">U</em>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function indexTitle(index) {
  const parts = [index.name || 'unnamed index'];
  if (index.type) parts.push(index.type);
  if (index.pk) parts.push('primary key');
  else if (index.unique) parts.push('unique');
  return parts.join(' · ');
}

export default memo(TableNode);
