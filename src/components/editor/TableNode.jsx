import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Key, LinkSimple, Table } from '@phosphor-icons/react';

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

function TableNode({ data, selected }) {
  const { table, relatedColumns } = data;
  const columnCount = table.fields.length;

  return (
    <div className={`table-node${selected ? ' is-selected' : ''}`}>
      <header className="table-node__header" title={table.note || undefined}>
        <Table size={13} weight="fill" className="table-node__glyph" />
        <span className="table-node__name">{table.name}</span>
        <span className="table-node__count">{columnCount}</span>
      </header>

      <div className="table-node__body">
        {columnCount === 0 && <p className="table-node__empty">No columns yet</p>}

        {table.fields.map((field) => {
          const linked = relatedColumns?.has(field.name);
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

              <span className={`table-node__col${field.pk ? ' is-pk' : ''}`}>{field.name}</span>

              <span className="table-node__type">
                {field.type}
                {field.notNull && <i className="table-node__req" title="Not null" />}
                {field.unique && !field.pk && <em className="table-node__uq" title="Unique">U</em>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TableNode);
