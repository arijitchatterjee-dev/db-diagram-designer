import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ListDashes } from '@phosphor-icons/react';

/**
 * An enum declared in the DBML. Rendered flatter and quieter than a table —
 * it's a type definition, not an entity, and shouldn't compete with the
 * tables for attention.
 */
function EnumNode({ data, selected }) {
  const { enumDef, used } = data;

  return (
    <div
      className={`enum-node${selected ? ' is-selected' : ''}${used ? '' : ' is-unused'}`}
      style={{ width: data.width }}
    >
      <Handle type="target" id="enum__target__left" position={Position.Left} className="col-handle" />
      <Handle type="target" id="enum__target__right" position={Position.Right} className="col-handle" />

      <header className="enum-node__header">
        <ListDashes size={12} weight="bold" className="enum-node__glyph" />
        <span className="enum-node__name">{enumDef.name}</span>
        <span className="enum-node__tag">enum</span>
      </header>

      <div className="enum-node__body">
        {enumDef.values.length === 0 ? (
          <p className="enum-node__empty">No values</p>
        ) : (
          enumDef.values.map((value) => (
            <div key={value} className="enum-node__value">
              {value}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(EnumNode);
