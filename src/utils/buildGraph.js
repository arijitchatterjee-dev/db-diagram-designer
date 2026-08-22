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

export const EDGE_IDLE = '#46536b';
export const EDGE_ACTIVE = '#f5a524';

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
    pathOptions: { borderRadius: 14 },
    label: style.label,
    labelShowBg: false,
    labelStyle: {
      fill: '#7c8699',
      fontSize: 10,
      fontWeight: 600,
      fontFamily: "'Geist Mono Variable', ui-monospace, monospace",
    },
    animated: false,
    style: { stroke: EDGE_IDLE, strokeWidth: 1.6, strokeDasharray: style.dash },
    markerEnd: style.markerEnd
      ? { type: MarkerType.ArrowClosed, width: 14, height: 14, color: EDGE_IDLE }
      : undefined,
    markerStart: style.markerStart
      ? { type: MarkerType.ArrowClosed, width: 14, height: 14, color: EDGE_IDLE }
      : undefined,
    data: { relationType: ref.type, dash: style.dash },
  };
}

/**
 * Cardinality is carried by line treatment and a small label, not by colour.
 * Colour is reserved for state: every relationship is the same quiet slate
 * until you select a table, and then its own relationships light up.
 */
const STYLES = {
  'one-to-many': { label: '1:N', dash: undefined, markerEnd: true, markerStart: false },
  'one-to-one': { label: '1:1', dash: undefined, markerEnd: false, markerStart: false },
  'many-to-many': { label: 'N:N', dash: '5 4', markerEnd: true, markerStart: true },
};
