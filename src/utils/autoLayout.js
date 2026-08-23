import dagre from 'dagre';

const MIN_NODE_WIDTH = 260;
const MAX_NODE_WIDTH = 460;
// The SVG exporter redraws nodes from scratch, so these are shared rather than
// duplicated — a node's exported box then matches the box dagre laid out.
export const ROW_HEIGHT = 26;
export const HEADER_HEIGHT = 40;
export const ENUM_ROW_HEIGHT = 22;
export const INDEX_ROW_HEIGHT = 20;
export const INDEX_CAPTION_HEIGHT = 20;

// Geist Mono advance widths at the two sizes the node uses. Only ever used to
// pick a node width, so a close estimate beats measuring in the DOM (which
// would mean laying out before we know where anything goes).
const NAME_CHAR = 7.05; // 12px column names
const TYPE_CHAR = 6.2; // 10.5px type names
const ROW_CHROME = 62; // padding + key column + gaps + not-null/unique marks

function clampWidth(value) {
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.ceil(value)));
}

export function estimateNodeHeight(table) {
  const indexes = table.indexes?.length || 0;
  const indexBlock = indexes ? INDEX_CAPTION_HEIGHT + indexes * INDEX_ROW_HEIGHT : 0;
  return HEADER_HEIGHT + (table.fields?.length || 0) * ROW_HEIGHT + indexBlock + 8;
}

// How an index reads on the node: `(tenant_id, created_at)`.
export function indexLabel(index) {
  return `(${index.columns.join(', ')})`;
}

/**
 * Widest row decides the node width, so long column or type names get room
 * instead of being cut off with an ellipsis. Bounded at both ends: narrow
 * tables still line up on a common width, wide ones stop before they dominate.
 */
export function estimateNodeWidth(table) {
  let widest = 0;
  (table.fields || []).forEach((field) => {
    const width =
      field.name.length * NAME_CHAR + (field.type?.length || 0) * TYPE_CHAR;
    if (width > widest) widest = width;
  });

  // Header carries the glyph, the table name and the column count.
  const header = table.name.length * NAME_CHAR + 74;

  // Index rows sit in the same box and can easily be the longest line on it.
  let indexes = 0;
  (table.indexes || []).forEach((index) => {
    const width = indexLabel(index).length * TYPE_CHAR + 54;
    if (width > indexes) indexes = width;
  });

  return clampWidth(Math.max(widest + ROW_CHROME, header, indexes));
}

export function estimateEnumHeight(enumDef) {
  return HEADER_HEIGHT + (enumDef.values?.length || 0) * ENUM_ROW_HEIGHT + 8;
}

export function estimateEnumWidth(enumDef) {
  let widest = enumDef.name.length * NAME_CHAR + 40;
  (enumDef.values || []).forEach((value) => {
    const width = value.length * NAME_CHAR + 44;
    if (width > widest) widest = width;
  });
  return Math.min(MAX_NODE_WIDTH, Math.max(180, Math.ceil(widest)));
}

/**
 * Runs dagre over a generic set of boxes and returns { id: {x, y} } for each.
 * Boxes are `{ id, width, height }` and links are `{ source, target }`, so
 * enum nodes take part in the same pass as tables. Callers layer saved manual
 * positions on top, which is why tables the user has dragged keep their spot.
 */
export function computeAutoLayout(boxes, links) {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 140, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  boxes.forEach((box) => {
    graph.setNode(box.id, { width: box.width, height: box.height });
  });

  links.forEach((link) => {
    // Skip links pointing at boxes that aren't in the graph (shouldn't happen
    // with a valid parse, but dagre throws hard if it does).
    if (graph.hasNode(link.source) && graph.hasNode(link.target)) {
      graph.setEdge(link.source, link.target);
    }
  });

  dagre.layout(graph);

  const positions = {};
  boxes.forEach((box) => {
    const node = graph.node(box.id);
    if (!node) return;
    // dagre gives centre points; React Flow wants the top-left corner.
    positions[box.id] = {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
    };
  });

  return positions;
}
