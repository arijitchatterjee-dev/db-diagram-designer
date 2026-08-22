import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowsOutSimple,
  Graph,
  MagnifyingGlass,
  TreeStructure,
  X,
} from '@phosphor-icons/react';
import TableNode from './TableNode';
import { useProjectStore } from '../../store/useProjectStore';
import { EDGE_ACTIVE, EDGE_IDLE } from '../../utils/buildGraph';
import { usePrefersReducedMotion } from '../../utils/usePrefersReducedMotion';

export default function DiagramCanvas() {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onNodeDragStop = useProjectStore((s) => s.onNodeDragStop);
  const autoLayoutAll = useProjectStore((s) => s.autoLayoutAll);

  // Must be memoised — a fresh object here re-registers node types every render.
  const nodeTypes = useMemo(() => ({ table: TableNode }), []);

  const [instance, setInstance] = useState(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef(null);
  const hasFitted = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const ease = reducedMotion ? 0 : 320;

  // The flow mounts empty (the parser loads lazily), so React Flow's own
  // `fitView` runs before there is anything to fit. Do it once, when the first
  // nodes actually arrive — after that, leave the user's viewport alone.
  useEffect(() => {
    if (hasFitted.current || !instance || nodes.length === 0) return undefined;
    hasFitted.current = true;
    const raf = requestAnimationFrame(() => instance.fitView({ padding: 0.22 }));
    return () => cancelAnimationFrame(raf);
  }, [instance, nodes.length]);

  const fitAll = useCallback(() => {
    instance?.fitView({ padding: 0.22, duration: ease });
  }, [instance, ease]);

  const handleAutoLayout = useCallback(async () => {
    await autoLayoutAll();
    requestAnimationFrame(() => instance?.fitView({ padding: 0.22, duration: ease }));
  }, [autoLayoutAll, instance, ease]);

  const focusTable = useCallback(
    (node) => {
      if (!instance) return;
      instance.setCenter(
        node.position.x + (node.width ?? 260) / 2,
        node.position.y + (node.height ?? 120) / 2,
        { zoom: 1, duration: ease }
      );
      onNodesChange(
        nodes.map((n) => ({ id: n.id, type: 'select', selected: n.id === node.id }))
      );
      setSearchOpen(false);
      setQuery('');
    },
    [instance, nodes, onNodesChange, ease]
  );

  // Selecting a table lights up only its own relationships. Everything else
  // stays quiet, which is what makes a 30-table diagram readable.
  const selectedIds = useMemo(
    () => new Set(nodes.filter((n) => n.selected).map((n) => n.id)),
    [nodes]
  );

  const decoratedEdges = useMemo(() => {
    if (selectedIds.size === 0) return edges;
    return edges.map((edge) => {
      const active = selectedIds.has(edge.source) || selectedIds.has(edge.target);
      if (!active) return { ...edge, style: { ...edge.style, opacity: 0.35 } };
      return {
        ...edge,
        zIndex: 10,
        style: { ...edge.style, stroke: EDGE_ACTIVE, strokeWidth: 2.2, opacity: 1 },
        labelStyle: { ...edge.labelStyle, fill: EDGE_ACTIVE },
        markerEnd: edge.markerEnd ? { ...edge.markerEnd, color: EDGE_ACTIVE } : undefined,
        markerStart: edge.markerStart ? { ...edge.markerStart, color: EDGE_ACTIVE } : undefined,
      };
    });
  }, [edges, selectedIds]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes.slice(0, 8);
    return nodes.filter((n) => n.id.toLowerCase().includes(q)).slice(0, 8);
  }, [nodes, query]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onInit={setInstance}
        minZoom={0.08}
        maxZoom={2}
        nodesConnectable={false}
        edgesFocusable={false}
        elevateNodesOnSelect
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1d2330" />

        <Controls showInteractive={false} position="bottom-left" />

        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(n) => (n.selected ? EDGE_ACTIVE : '#2a3142')}
          nodeStrokeWidth={0}
          nodeBorderRadius={3}
          maskColor="rgba(10, 12, 16, 0.78)"
        />

        <Panel position="top-left" className="canvas-toolbar">
          <div className="toolbar">
            <button
              type="button"
              className="toolbar__btn"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              title="Find a table"
            >
              <MagnifyingGlass size={15} weight="bold" />
              <span>Find</span>
            </button>
            <span className="toolbar__sep" aria-hidden="true" />
            <button type="button" className="toolbar__btn" onClick={handleAutoLayout} title="Re-arrange every table">
              <TreeStructure size={15} weight="bold" />
              <span>Arrange</span>
            </button>
            <button type="button" className="toolbar__btn" onClick={fitAll} title="Fit the whole diagram">
              <ArrowsOutSimple size={15} weight="bold" />
              <span>Fit</span>
            </button>
          </div>

          {searchOpen && (
            <div className="finder">
              <div className="finder__field">
                <MagnifyingGlass size={14} weight="bold" />
                <input
                  ref={searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchOpen(false);
                    if (e.key === 'Enter' && matches[0]) focusTable(matches[0]);
                  }}
                  placeholder="Table name"
                  aria-label="Find a table"
                />
                <button type="button" className="finder__close" onClick={() => setSearchOpen(false)} aria-label="Close find">
                  <X size={13} weight="bold" />
                </button>
              </div>

              {matches.length === 0 ? (
                <p className="finder__empty">No table matches that.</p>
              ) : (
                <ul className="finder__list">
                  {matches.map((node) => (
                    <li key={node.id}>
                      <button type="button" onClick={() => focusTable(node)}>
                        <span className="finder__name">{node.id}</span>
                        <span className="finder__meta">{node.data.table.fields.length} col</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        {nodes.length === 0 && (
          <Panel position="top-center" className="canvas-empty">
            <Graph size={26} weight="duotone" />
            <p className="canvas-empty__title">Nothing to draw yet</p>
            <p className="canvas-empty__body">
              Define a table in the editor and it appears here as you type.
            </p>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
