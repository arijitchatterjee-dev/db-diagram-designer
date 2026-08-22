import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import TableNode from './TableNode';
import { useProjectStore } from '../../store/useProjectStore';

export default function DiagramCanvas() {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onNodeDragStop = useProjectStore((s) => s.onNodeDragStop);
  const autoLayoutAll = useProjectStore((s) => s.autoLayoutAll);

  // Must be memoised — a fresh object here re-registers node types every render.
  const nodeTypes = useMemo(() => ({ table: TableNode }), []);

  // The flow mounts empty (the parser loads lazily), so React Flow's own
  // `fitView` runs before there is anything to fit. Do it once, when the first
  // nodes actually arrive — after that, leave the user's viewport alone.
  const [instance, setInstance] = useState(null);
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current || !instance || nodes.length === 0) return;
    hasFitted.current = true;
    // Wait a frame so the nodes have been measured before fitting to them.
    const raf = requestAnimationFrame(() => instance.fitView({ padding: 0.2 }));
    return () => cancelAnimationFrame(raf);
  }, [instance, nodes.length]);

  const handleAutoLayout = useCallback(async () => {
    await autoLayoutAll();
    requestAnimationFrame(() => instance?.fitView({ padding: 0.2 }));
  }, [autoLayoutAll, instance]);

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onInit={setInstance}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        nodesConnectable={false}
        edgesFocusable={false}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#243044" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="#1e293b"
          nodeStrokeColor="#3b82f6"
          maskColor="rgba(9, 13, 20, 0.7)"
        />

        <Panel position="top-right" className="canvas-panel">
          <button type="button" className="btn btn--ghost" onClick={handleAutoLayout}>
            Auto-arrange
          </button>
        </Panel>

        {nodes.length === 0 && (
          <Panel position="top-center" className="canvas-empty">
            No tables yet — define one in the editor to see it here.
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
