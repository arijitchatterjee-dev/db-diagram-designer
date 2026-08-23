import { MarkerType } from 'reactflow';
import {
  computeAutoLayout,
  estimateEnumHeight,
  estimateEnumWidth,
  estimateNodeHeight,
  estimateNodeWidth,
} from './autoLayout.js';

// Enum nodes share the layout map with tables, so their keys are namespaced to
// keep a `status` enum from colliding with a `status` table.
export const ENUM_PREFIX = 'enum:';
export const enumNodeId = (name) => `${ENUM_PREFIX}${name}`;

/**
 * Turns a parsed schema into React Flow nodes/edges.
 *
 * Position priority, highest first:
 *   1. `layout` — positions the user has explicitly dragged (persisted).
 *   2. `previousPositions` — where the node already sits this session, so
 *      adding one table doesn't reshuffle the whole canvas.
 *   3. dagre — computed only for nodes that have neither of the above.
 */
export function buildGraph(schema, layout = {}, previousPositions = {}) {
  const { tables, refs, enums = [], groups = [] } = schema;

  const boxes = [
    ...tables.map((table) => ({
      id: table.name,
      width: estimateNodeWidth(table),
      height: estimateNodeHeight(table),
    })),
    ...enums.map((enumDef) => ({
      id: enumNodeId(enumDef.name),
      width: estimateEnumWidth(enumDef),
      height: estimateEnumHeight(enumDef),
    })),
  ];
  const sizeOf = new Map(boxes.map((box) => [box.id, box]));

  const tableNames = new Set(tables.map((t) => t.name));
  const liveRefs = refs.filter(
    (ref) => tableNames.has(ref.source.table) && tableNames.has(ref.target.table)
  );
  const enumUses = findEnumUses(tables, enums);

  const links = [
    ...liveRefs.map((ref) => ({ source: ref.source.table, target: ref.target.table })),
    ...enumUses.map((use) => ({ source: use.table, target: enumNodeId(use.enumName) })),
  ];

  const needsAuto = boxes.some((box) => !layout[box.id] && !previousPositions[box.id]);
  const autoPositions = needsAuto ? computeAutoLayout(boxes, links) : {};

  const positions = {};
  boxes.forEach((box) => {
    positions[box.id] =
      layout[box.id] || previousPositions[box.id] || autoPositions[box.id] || { x: 0, y: 0 };
  });

  const usedEnums = new Set(enumUses.map((use) => use.enumName));

  const tableNodes = tables.map((table) => ({
    id: table.name,
    type: 'table',
    position: positions[table.name],
    data: {
      table,
      // Which columns take part in a relationship — used to mark them in the UI.
      relatedColumns: relatedColumnsFor(table.name, liveRefs),
      // Columns whose declared type is one of the schema's enums.
      enumColumns: new Set(
        enumUses.filter((use) => use.table === table.name).map((use) => use.column)
      ),
      // React Flow measures the rendered DOM rather than applying node.width,
      // so the node component has to set it — hence carrying it in data too.
      width: sizeOf.get(table.name).width,
    },
    width: sizeOf.get(table.name).width,
    height: sizeOf.get(table.name).height,
  }));

  const enumNodes = enums.map((enumDef) => {
    const id = enumNodeId(enumDef.name);
    return {
      id,
      type: 'enum',
      position: positions[id],
      data: { enumDef, used: usedEnums.has(enumDef.name), width: sizeOf.get(id).width },
      width: sizeOf.get(id).width,
      height: sizeOf.get(id).height,
    };
  });

  const edges = [
    ...liveRefs.map((ref) => buildRefEdge(ref, positions, sizeOf)),
    ...enumUses.map((use) => buildEnumEdge(use, positions, sizeOf)),
  ];

  // Groups are described, not positioned: their backdrop is derived from wherever
  // their member tables currently sit, so it follows them as they're dragged.
  const liveGroups = groups
    .map((group) => ({
      name: group.name,
      note: group.note,
      tables: group.tables.filter((name) => tableNames.has(name)),
    }))
    .filter((group) => group.tables.length > 0);

  return { nodes: [...tableNodes, ...enumNodes], edges, positions, groups: liveGroups };
}

// A column "uses" an enum when its declared type is that enum's name. DBML
// doesn't model this as a ref, so it has to be matched by name.
function findEnumUses(tables, enums) {
  if (!enums.length) return [];
  const byName = new Map(enums.map((e) => [e.name.toLowerCase(), e.name]));

  const uses = [];
  tables.forEach((table) => {
    (table.fields || []).forEach((field) => {
      // `schema.enum_name` and bare `enum_name` both refer to the same enum.
      const bare = String(field.type || '').split('.').pop().toLowerCase();
      const match = byName.get(bare);
      if (match) uses.push({ table: table.name, column: field.name, enumName: match });
    });
  });
  return uses;
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

/**
 * Picks the side of each node an edge should leave from, comparing node
 * centres so a wide node doesn't get routed as if it were narrow. Exported
 * because the canvas re-runs it live while a node is being dragged — the
 * positions baked in here are only the starting point.
 */
export function handleSides(sourceBox, targetBox) {
  const sourceCentre = (sourceBox?.x ?? 0) + (sourceBox?.width ?? 0) / 2;
  const targetCentre = (targetBox?.x ?? 0) + (targetBox?.width ?? 0) / 2;
  return sourceCentre <= targetCentre
    ? { source: 'right', target: 'left' }
    : { source: 'left', target: 'right' };
}

export const columnHandle = (column, role, side) => `${column}__${role}__${side}`;
export const enumHandle = (role, side) => `enum__${role}__${side}`;

function boxAt(positions, sizeOf, id) {
  return { ...(positions[id] || { x: 0, y: 0 }), width: sizeOf.get(id)?.width ?? 260 };
}

export const EDGE_IDLE = '#46536b';
export const EDGE_ACTIVE = '#f5a524';
export const EDGE_ENUM = '#333c4c';

function buildRefEdge(ref, positions, sizeOf) {
  const sides = handleSides(
    boxAt(positions, sizeOf, ref.source.table),
    boxAt(positions, sizeOf, ref.target.table)
  );
  const sourceColumn = ref.source.columns[0];
  const targetColumn = ref.target.columns[0];

  const style = STYLES[ref.type] || STYLES['one-to-many'];

  return {
    id: ref.id,
    source: ref.source.table,
    target: ref.target.table,
    sourceHandle: columnHandle(sourceColumn, 'source', sides.source),
    targetHandle: columnHandle(targetColumn, 'target', sides.target),
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
    // The canvas re-derives handles from these while a node is dragged.
    data: { kind: 'ref', relationType: ref.type, sourceColumn, targetColumn },
  };
}

// Enum links are reference material, not structure: hairline, dotted, no
// arrowhead and no label, so they read as a footnote next to the real refs.
function buildEnumEdge(use, positions, sizeOf) {
  const targetId = enumNodeId(use.enumName);
  const sides = handleSides(
    boxAt(positions, sizeOf, use.table),
    boxAt(positions, sizeOf, targetId)
  );

  return {
    id: `enum-${use.table}.${use.column}--${use.enumName}`,
    source: use.table,
    target: targetId,
    sourceHandle: columnHandle(use.column, 'source', sides.source),
    targetHandle: enumHandle('target', sides.target),
    type: 'smoothstep',
    pathOptions: { borderRadius: 14 },
    animated: false,
    style: { stroke: EDGE_ENUM, strokeWidth: 1.2, strokeDasharray: '2 4' },
    data: { kind: 'enum', sourceColumn: use.column, targetColumn: null },
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
