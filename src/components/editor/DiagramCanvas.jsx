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
  ListDashes,
  MagnifyingGlass,
  NoteBlank,
  TreeStructure,
  X,
} from '@phosphor-icons/react';
import TableNode from './TableNode';
import EnumNode from './EnumNode';
import GroupNode from './GroupNode';
import NoteNode from './NoteNode';
import { useProjectStore } from '../../store/useProjectStore';
import {
  EDGE_ACTIVE,
  columnHandle,
  enumHandle,
  handleSides,
} from '../../utils/buildGraph';
import { usePrefersReducedMotion } from '../../utils/usePrefersReducedMotion';

const MAX_MATCHES = 8;
// Breathing room between a group's outermost table and its backdrop, plus the
// extra at the top that the group's own label sits in.
const GROUP_PAD = 26;
const GROUP_LABEL_SPACE = 22;
const NOTE_WIDTH = 220;

export default function DiagramCanvas() {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const groups = useProjectStore((s) => s.groups);
  const notes = useProjectStore((s) => s.notes);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onNodeDragStop = useProjectStore((s) => s.onNodeDragStop);
  const autoLayoutAll = useProjectStore((s) => s.autoLayoutAll);
  const addNote = useProjectStore((s) => s.addNote);
  const dragNote = useProjectStore((s) => s.dragNote);
  const setNoteText = useProjectStore((s) => s.setNoteText);
  const removeNote = useProjectStore((s) => s.removeNote);

  // Must be memoised — a fresh object here re-registers node types every render.
  const nodeTypes = useMemo(
    () => ({ table: TableNode, enum: EnumNode, group: GroupNode, note: NoteNode }),
    []
  );

  const [instance, setInstance] = useState(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showEnums, setShowEnums] = useState(true);
  const searchInput = useRef(null);
  const shell = useRef(null);
  const hasFitted = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const ease = reducedMotion ? 0 : 320;

  const hasEnums = useMemo(() => nodes.some((n) => n.type === 'enum'), [nodes]);

  const visibleNodes = useMemo(
    () => (showEnums ? nodes : nodes.filter((n) => n.type !== 'enum')),
    [nodes, showEnums]
  );

  // A group's backdrop is sized from where its tables are right now, so it
  // stretches to follow them while they're being dragged rather than snapping
  // into place on the next re-parse.
  const groupNodes = useMemo(() => {
    if (groups.length === 0) return [];
    const byId = new Map(visibleNodes.map((n) => [n.id, n]));

    return groups
      .map((group) => {
        const members = group.tables.map((name) => byId.get(name)).filter(Boolean);
        if (members.length === 0) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        members.forEach((node) => {
          minX = Math.min(minX, node.position.x);
          minY = Math.min(minY, node.position.y);
          maxX = Math.max(maxX, node.position.x + (node.width ?? 260));
          maxY = Math.max(maxY, node.position.y + (node.height ?? 120));
        });

        return {
          id: `group:${group.name}`,
          type: 'group',
          position: { x: minX - GROUP_PAD, y: minY - GROUP_PAD - GROUP_LABEL_SPACE },
          data: {
            name: group.name,
            note: group.note,
            count: members.length,
            width: maxX - minX + GROUP_PAD * 2,
            height: maxY - minY + GROUP_PAD * 2 + GROUP_LABEL_SPACE,
          },
          draggable: false,
          selectable: false,
          focusable: false,
          deletable: false,
          zIndex: -1,
        };
      })
      .filter(Boolean);
  }, [groups, visibleNodes]);

  const [freshNote, setFreshNote] = useState(null);

  const noteNodes = useMemo(
    () =>
      notes.map((note) => ({
        id: note.id,
        type: 'note',
        position: { x: note.x, y: note.y },
        // Only the top strip drags, so clicking into the text doesn't move it.
        dragHandle: '.note-node__grip',
        data: {
          text: note.text,
          autoFocus: note.id === freshNote,
          onChange: (text) => setNoteText(note.id, text),
          onDelete: removeNote,
        },
      })),
    [notes, freshNote, setNoteText, removeNote]
  );

  // Backdrops first so they paint behind the tables they enclose; notes last so
  // they float above everything.
  const flowNodes = useMemo(
    () => [...groupNodes, ...visibleNodes, ...noteNodes],
    [groupNodes, visibleNodes, noteNodes]
  );

  // React Flow hands every node's changes to one callback; notes keep their own
  // position, so their changes are routed to the notes list instead of `nodes`.
  const noteIds = useMemo(() => new Set(notes.map((n) => n.id)), [notes]);

  const handleNodesChange = useCallback(
    (changes) => {
      const forSchema = [];
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && noteIds.has(change.id)) {
          dragNote(change.id, change.position);
        } else if (!noteIds.has(change.id)) {
          forSchema.push(change);
        }
      });
      if (forSchema.length) onNodesChange(forSchema);
    },
    [noteIds, dragNote, onNodesChange]
  );

  // New notes land in the middle of what you're currently looking at, not at
  // the origin — measured from the canvas pane, not the window, since the
  // editor takes up the other half of the screen.
  const handleAddNote = useCallback(() => {
    if (!instance) return;

    const rect = shell.current?.getBoundingClientRect();
    const point = rect
      ? instance.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      : { x: 0, y: 0 };

    setFreshNote(addNote({ x: point.x - NOTE_WIDTH / 2, y: point.y - 40 }));
  }, [instance, addNote]);

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

  const focusNode = useCallback(
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

  // Live geometry, updated on every drag frame. Edges are re-routed from this
  // rather than from the positions baked in at parse time, so dragging a table
  // past its partner flips the connection to the near side straight away
  // instead of looping the line back over the node until the next re-parse.
  const boxes = useMemo(() => {
    const map = new Map();
    visibleNodes.forEach((n) => {
      map.set(n.id, { x: n.position.x, y: n.position.y, width: n.width ?? 260 });
    });
    return map;
  }, [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return edges
      .filter((edge) => boxes.has(edge.source) && boxes.has(edge.target))
      .map((edge) => {
        const sides = handleSides(boxes.get(edge.source), boxes.get(edge.target));
        const isEnum = edge.data?.kind === 'enum';

        const routed = {
          ...edge,
          sourceHandle: columnHandle(edge.data.sourceColumn, 'source', sides.source),
          targetHandle: isEnum
            ? enumHandle('target', sides.target)
            : columnHandle(edge.data.targetColumn, 'target', sides.target),
        };

        if (selectedIds.size === 0) return routed;

        const active = selectedIds.has(edge.source) || selectedIds.has(edge.target);
        if (!active) return { ...routed, style: { ...routed.style, opacity: 0.35 } };

        return {
          ...routed,
          zIndex: 10,
          style: { ...routed.style, stroke: EDGE_ACTIVE, strokeWidth: isEnum ? 1.4 : 2.2, opacity: 1 },
          labelStyle: { ...routed.labelStyle, fill: EDGE_ACTIVE },
          markerEnd: routed.markerEnd ? { ...routed.markerEnd, color: EDGE_ACTIVE } : undefined,
          markerStart: routed.markerStart ? { ...routed.markerStart, color: EDGE_ACTIVE } : undefined,
        };
      });
  }, [edges, boxes, selectedIds]);

  // Search covers column names too, not just table names — on a wide schema
  // you usually remember the column you're looking for, not which table it
  // ended up in. Table matches rank above column matches.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return visibleNodes.slice(0, MAX_MATCHES).map((node) => ({
        key: node.id,
        node,
        label: labelOf(node),
        meta: metaOf(node),
      }));
    }

    const byName = [];
    const byColumn = [];

    visibleNodes.forEach((node) => {
      if (labelOf(node).toLowerCase().includes(q)) {
        byName.push({ key: node.id, node, label: labelOf(node), meta: metaOf(node) });
        return;
      }
      if (node.type !== 'table') return;
      const field = node.data.table.fields.find((f) => f.name.toLowerCase().includes(q));
      if (field) {
        byColumn.push({
          key: `${node.id}.${field.name}`,
          node,
          label: `${node.id}.${field.name}`,
          meta: field.type,
        });
      }
    });

    return [...byName, ...byColumn].slice(0, MAX_MATCHES);
  }, [visibleNodes, query]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  return (
    <div className="canvas" ref={shell}>
      <ReactFlow
        nodes={flowNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
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
          nodeColor={(n) => minimapColor(n)}
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
              title="Find a table or column"
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
            <button type="button" className="toolbar__btn" onClick={handleAddNote} title="Add a sticky note">
              <NoteBlank size={15} weight="bold" />
              <span>Note</span>
            </button>
            {hasEnums && (
              <>
                <span className="toolbar__sep" aria-hidden="true" />
                <button
                  type="button"
                  className="toolbar__btn"
                  onClick={() => setShowEnums((v) => !v)}
                  aria-pressed={showEnums}
                  title={showEnums ? 'Hide enum definitions' : 'Show enum definitions'}
                >
                  <ListDashes size={15} weight="bold" />
                  <span>Enums</span>
                </button>
              </>
            )}
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
                    if (e.key === 'Enter' && matches[0]) focusNode(matches[0].node);
                  }}
                  placeholder="Table or column"
                  aria-label="Find a table or column"
                />
                <button type="button" className="finder__close" onClick={() => setSearchOpen(false)} aria-label="Close find">
                  <X size={13} weight="bold" />
                </button>
              </div>

              {matches.length === 0 ? (
                <p className="finder__empty">Nothing matches that.</p>
              ) : (
                <ul className="finder__list">
                  {matches.map((match) => (
                    <li key={match.key}>
                      <button type="button" onClick={() => focusNode(match.node)}>
                        <span className="finder__name">{match.label}</span>
                        <span className="finder__meta">{match.meta}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        {visibleNodes.length === 0 && (
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

function minimapColor(node) {
  if (node.type === 'group') return 'transparent';
  if (node.selected) return EDGE_ACTIVE;
  if (node.type === 'note') return '#3a3320';
  return node.type === 'enum' ? '#1f2532' : '#2a3142';
}

function labelOf(node) {
  return node.type === 'enum' ? node.data.enumDef.name : node.id;
}

function metaOf(node) {
  return node.type === 'enum'
    ? `${node.data.enumDef.values.length} val`
    : `${node.data.table.fields.length} col`;
}
