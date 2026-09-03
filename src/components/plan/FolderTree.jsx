import { useMemo, useState } from 'react';
import {
  ArrowClockwise,
  CaretDown,
  CaretRight,
  File,
  Folder,
  FolderOpen,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  buildTree,
  renameNode,
  removeSubtree,
  addNode,
  setNote,
  subtreeOf,
  isValidSegment,
} from '../../engine/folders';

/**
 * The planned layout, as a tree you can edit.
 *
 * Stored as flat paths and rendered as a tree: a path string is trivial to
 * validate and diff, and the nesting only matters for reading. Intermediate
 * folders nothing declared are drawn faintly, because they are structure
 * rather than decisions.
 */
export default function FolderTree({ nodes, stale, onChange, onRegenerate }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [renaming, setRenaming] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [adding, setAdding] = useState(null);
  const [draftChild, setDraftChild] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState(null);

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  // Collapsed is opt-in: a plan you cannot read at a glance is not a plan.
  const isOpen = (path) => !expanded.has(path);
  const toggle = (path) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  function apply(result, failure) {
    if (!result) {
      setError(failure);
      return false;
    }
    setError(null);
    onChange(result.nodes);
    return true;
  }

  function commitRename(path) {
    const name = draftName.trim();
    setRenaming(null);
    if (!name || name === path.split('/').pop()) return;
    apply(
      renameNode(nodes, path, name),
      isValidSegment(name)
        ? `Something is already called "${name}" there.`
        : 'A folder name cannot contain a slash or a space.'
    );
  }

  function commitChild(parentPath) {
    const name = draftChild.trim();
    setAdding(null);
    setDraftChild('');
    if (!name) return;

    const path = parentPath ? `${parentPath}/${name}` : name;
    // A dot in the last segment is how you say "this is a file".
    const kind = name.includes('.') ? 'file' : 'folder';
    apply(addNode(nodes, path, kind), `"${path}" is already in the tree, or is not a valid path.`);
  }

  function confirmDelete(node) {
    const count = subtreeOf(nodes, node.path).length;
    if (count > 1) {
      setPendingDelete({ path: node.path, count });
      return;
    }
    apply(removeSubtree(nodes, node.path), 'Nothing there to remove.');
  }

  const renderNode = (node, depth) => {
    const open = isOpen(node.path);
    const hasChildren = node.children.length > 0;
    const isFile = node.kind === 'file' && !hasChildren;

    return (
      <li key={node.path}>
        <div
          className={`ftree__row${node.implicit ? ' is-implicit' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button
            type="button"
            className="ftree__twist"
            onClick={() => hasChildren && toggle(node.path)}
            aria-label={hasChildren ? (open ? 'Collapse' : 'Expand') : undefined}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              open ? (
                <CaretDown size={10} weight="bold" />
              ) : (
                <CaretRight size={10} weight="bold" />
              )
            ) : null}
          </button>

          <span className="ftree__icon">
            {isFile ? (
              <File size={13} weight="regular" />
            ) : open && hasChildren ? (
              <FolderOpen size={13} weight="fill" />
            ) : (
              <Folder size={13} weight="fill" />
            )}
          </span>

          {renaming === node.path ? (
            <input
              className="ftree__input"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => commitRename(node.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(node.path);
                if (e.key === 'Escape') setRenaming(null);
              }}
              aria-label={`Rename ${node.name}`}
            />
          ) : (
            <button
              type="button"
              className="ftree__name"
              onClick={() => {
                setRenaming(node.path);
                setDraftName(node.name);
              }}
              title={node.implicit ? 'Not declared on its own, but you can rename it' : 'Rename'}
            >
              {node.name}
            </button>
          )}

          {node.note && <span className="ftree__note">{node.note}</span>}

          <span className="ftree__actions">
            {!isFile && (
              <button
                type="button"
                onClick={() => {
                  setAdding(node.path);
                  setDraftChild('');
                  setExpanded((set) => {
                    const next = new Set(set);
                    next.delete(node.path);
                    return next;
                  });
                }}
                aria-label={`Add inside ${node.name}`}
                title="Add inside"
              >
                <Plus size={11} weight="bold" />
              </button>
            )}
            <button
              type="button"
              onClick={() => confirmDelete(node)}
              aria-label={`Delete ${node.name}`}
              title="Delete"
            >
              <Trash size={11} weight="bold" />
            </button>
          </span>
        </div>

        {adding === node.path && (
          <div className="ftree__row" style={{ paddingLeft: `${(depth + 1) * 16 + 26}px` }}>
            <input
              className="ftree__input"
              value={draftChild}
              autoFocus
              placeholder="name, or name.js for a file"
              onChange={(e) => setDraftChild(e.target.value)}
              onBlur={() => commitChild(node.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitChild(node.path);
                if (e.key === 'Escape') setAdding(null);
              }}
              aria-label={`New entry inside ${node.name}`}
            />
          </div>
        )}

        {hasChildren && open && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <>
      {stale && (
        <p className="wnotice wnotice--warn">
          <ArrowClockwise size={14} weight="fill" />
          <span>
            The stack, the layering or the module selection has changed since this tree was
            generated. Regenerating replaces it, including anything you edited here.
          </span>
          <button type="button" className="linkish" onClick={onRegenerate}>
            Regenerate
          </button>
        </p>
      )}

      {error && (
        <p className="wnotice wnotice--warn">
          <WarningCircle size={14} weight="fill" />
          <span>{error}</span>
        </p>
      )}

      {pendingDelete && (
        <p className="wnotice wnotice--warn">
          <Trash size={14} weight="fill" />
          <span>
            Deleting <strong>{pendingDelete.path}</strong> also removes {pendingDelete.count - 1}{' '}
            {pendingDelete.count - 1 === 1 ? 'entry' : 'entries'} inside it.
          </span>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              apply(removeSubtree(nodes, pendingDelete.path), 'Nothing there to remove.');
              setPendingDelete(null);
            }}
          >
            Delete them
          </button>
          <button type="button" className="linkish" onClick={() => setPendingDelete(null)}>
            Keep them
          </button>
        </p>
      )}

      {nodes.length === 0 ? (
        <div className="ftree__empty">
          <p className="doc__hint">
            No layout yet. It is generated from the stack, the layering choice and the
            modules the plan covers.
          </p>
          <button type="button" className="btn btn--sm btn--primary" onClick={onRegenerate}>
            <ArrowClockwise size={14} weight="bold" />
            Generate it
          </button>
        </div>
      ) : (
        <>
          <ul className="ftree">{tree.map((node) => renderNode(node, 0))}</ul>

          <div className="ftree__foot">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setAdding('');
                setDraftChild('');
              }}
            >
              <Plus size={14} weight="bold" />
              Add at the top
            </button>
            <button type="button" className="linkish" onClick={onRegenerate}>
              <ArrowClockwise size={12} weight="bold" />
              Regenerate from the plan
            </button>
            <span className="doc__hint">{nodes.length} entries. Click a name to rename it.</span>
          </div>

          {adding === '' && (
            <div className="ftree__row">
              <input
                className="ftree__input"
                value={draftChild}
                autoFocus
                placeholder="name, or name.js for a file"
                onChange={(e) => setDraftChild(e.target.value)}
                onBlur={() => commitChild('')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitChild('');
                  if (e.key === 'Escape') setAdding(null);
                }}
                aria-label="New top-level entry"
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
