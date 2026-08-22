import { MarkerType } from 'reactflow';
import { computeAutoLayout, estimateNodeHeight } from './autoLayout.js';

const NODE_WIDTH = 260;

/**
 * Turns a parsed schema into React Flow nodes/edges.
 *
 * Position priority, highest first:
 *   1. `layout` — positions the user has explicitly dragged (persisted).
 *   2. `previousPositions` — where the table already sits this session, so
 *      adding one table doesn't reshuffle the whole canvas.
 *   3. dagre — computed only for tables that have neither of the above.
 */
export function buildGraph(schema, layout = {}, previousPositions = {}) {
  const { tables, refs } = schema;

  const needsAuto = tables.filter(
    (t) => !layout[t.name] && !previousPositions[t.name]
  );
  const autoPositions = needsAuto.length ? computeAutoLayout(tables, refs) : {};

  const positions = {};
  tables.forEach((table) => {
    positions[table.name] =
      layout[table.name] ||
      previousPositions[table.name] ||
      autoPositions[table.name] || { x: 0, y: 0 };
  });

  const nodes = tables.map((table) => ({
    id: table.name,
    type: 'table',
    position: positions[table.name],
    data: {
      table,
      // Which columns take part in a relationship — used to mark them in the UI.
      relatedColumns: relatedColumnsFor(table.name, refs),
    },
    width: NODE_WIDTH,
    height: estimateNodeHeight(table),
  }));

  const tableNames = new Set(tables.map((t) => t.name));
  const edges = refs
    .filter((ref) => tableNames.has(ref.source.table) && tableNames.has(ref.target.table))
    .map((ref) => buildEdge(ref, positions));

  return { nodes, edges, positions };
}

function relatedColumnsFor(tableName, refs) {
  const columns = new Set();
  refs.forEach((ref) => {
    [ref.source, ref.target].forEach((end) => {
      if (end.table === tableName) end.columns.forEach((c) => columns.add(c));
    });
  });
  return columns;
}

// Pick the side of each node the edge leaves from, so lines don't loop back
// across the table body when the target sits to the left of the source.
function handleSides(sourcePos, targetPos) {
  const sourceIsLeft = (sourcePos?.x ?? 0) <= (targetPos?.x ?? 0);
  return sourceIsLeft
    ? { source: 'right', target: 'left' }
    : { source: 'left', target: 'right' };
}

function buildEdge(ref, positions) {
  const sides = handleSides(positions[ref.source.table], positions[ref.target.table]);
  const sourceColumn = ref.source.columns[0];
  const targetColumn = ref.target.columns[0];

  const style = STYLES[ref.type] || STYLES['one-to-many'];

  return {
    id: ref.id,
    source: ref.source.table,
    target: ref.target.table,
    sourceHandle: `${sourceColumn}__source__${sides.source}`,
    targetHandle: `${targetColumn}__target__${sides.target}`,
    type: 'smoothstep',
    label: style.label,
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: '#1b2333', stroke: '#334155' },
    labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 600 },
    animated: false,
    style: { stroke: style.stroke, strokeWidth: 1.8, strokeDasharray: style.dash },
    markerEnd: style.markerEnd
      ? { type: MarkerType.ArrowClosed, width: 16, height: 16, color: style.stroke }
      : undefined,
    markerStart: style.markerStart
      ? { type: MarkerType.ArrowClosed, width: 16, height: 16, color: style.stroke }
      : undefined,
    data: { relationType: ref.type },
  };
}

// One visual language per DBML relationship operator.
const STYLES = {
  'one-to-many': {
    label: '1:N',
    stroke: '#60a5fa',
    dash: undefined,
    markerEnd: true,
    markerStart: false,
  },
  'one-to-one': {
    label: '1:1',
    stroke: '#34d399',
    dash: undefined,
    markerEnd: false,
    markerStart: false,
  },
  'many-to-many': {
    label: 'N:N',
    stroke: '#f472b6',
    dash: '6 4',
    markerEnd: true,
    markerStart: true,
  },
};
