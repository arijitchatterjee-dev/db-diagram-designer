import { memo } from 'react';
import { Handle, Position } from 'reactflow';

// A handle on each side of every column, so an edge can dock at the exact
// column it references (and from whichever side is closer to its partner).
function ColumnHandles({ column }) {
  return (
    <>
      <Handle
        type="source"
        id={`${column}__source__left`}
        position={Position.Left}
        className="col-handle"
      />
      <Handle
        type="source"
        id={`${column}__source__right`}
        position={Position.Right}
        className="col-handle"
      />
      <Handle
        type="target"
        id={`${column}__target__left`}
        position={Position.Left}
        className="col-handle"
      />
      <Handle
        type="target"
        id={`${column}__target__right`}
        position={Position.Right}
        className="col-handle"
      />
    </>
  );
}

function TableNode({ data, selected }) {
  const { table, relatedColumns } = data;

  return (
    <div className={`table-node${selected ? ' is-selected' : ''}`}>
      <div
        className="table-node__header"
        style={table.headerColor ? { background: table.headerColor } : undefined}
        title={table.note || undefined}
      >
        <span className="table-node__name">{table.name}</span>
        {table.schemaName && table.schemaName !== 'public' && (
          <span className="table-node__schema">{table.schemaName}</span>
        )}
      </div>

      <div className="table-node__body">
        {table.fields.length === 0 && <div className="table-node__empty">no columns</div>}

        {table.fields.map((field) => (
          <div
            key={field.name}
            className={`table-node__row${relatedColumns?.has(field.name) ? ' is-linked' : ''}`}
            title={field.note || undefined}
          >
            <ColumnHandles column={field.name} />

            <span className="table-node__col">
              {field.pk && <span className="badge badge--pk" title="Primary key">PK</span>}
              {!field.pk && field.unique && (
                <span className="badge badge--uq" title="Unique">UQ</span>
              )}
              <span className={field.pk ? 'col-name col-name--pk' : 'col-name'}>
                {field.name}
              </span>
            </span>

            <span className="table-node__type">
              {field.type}
              {field.notNull && <span className="nn" title="Not null">*</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
