import dagre from 'dagre';

const DEFAULT_NODE_WIDTH = 260;
const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 40;

export function estimateNodeHeight(table) {
  return HEADER_HEIGHT + (table.fields?.length || 0) * ROW_HEIGHT + 8;
}

/**
 * Runs dagre over the whole graph and returns { tableName: {x, y} } for every
 * table. Callers layer saved manual positions on top of this, so tables the
 * user has already dragged keep their spot.
 */
export function computeAutoLayout(tables, refs) {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 140, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  tables.forEach((table) => {
    graph.setNode(table.name, {
      width: DEFAULT_NODE_WIDTH,
      height: estimateNodeHeight(table),
    });
  });

  refs.forEach((ref) => {
    // Skip edges pointing at tables that aren't in the graph (shouldn't
    // happen with a valid parse, but dagre throws hard if it does).
    if (graph.hasNode(ref.source.table) && graph.hasNode(ref.target.table)) {
      graph.setEdge(ref.source.table, ref.target.table);
    }
  });

  dagre.layout(graph);

  const positions = {};
  tables.forEach((table) => {
    const node = graph.node(table.name);
    if (!node) return;
    // dagre gives centre points; React Flow wants the top-left corner.
    positions[table.name] = {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
    };
  });

  return positions;
}
