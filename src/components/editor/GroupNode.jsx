import { memo } from 'react';

/**
 * The backdrop behind a `TableGroup`. It holds no position of its own — the
 * canvas sizes it from wherever its member tables currently are — so it can't
 * be selected or dragged, only looked at.
 */
function GroupNode({ data }) {
  return (
    <div className="group-node" style={{ width: data.width, height: data.height }}>
      <span className="group-node__label" title={data.note || undefined}>
        {data.name}
        <em className="group-node__count">{data.count}</em>
      </span>
    </div>
  );
}

export default memo(GroupNode);
