import { useCallback, useState } from 'react';
import {
  CaretDown,
  CircleNotch,
  Code,
  DownloadSimple,
  FileArrowUp,
  Image,
  WarningCircle,
} from '@phosphor-icons/react';
import { EXPORT_TARGETS, exportSchema } from '../../utils/dbmlExport';
import { buildDiagramSvg, svgToPng } from '../../utils/diagramImage';
import { downloadBlob, downloadText, slugify } from '../../utils/download';
import { useDismissable } from '../../utils/useDismissable';
import { useProjectStore } from '../../store/useProjectStore';

/**
 * Everything that turns the schema into a file. Kept behind one menu so the
 * editor header doesn't grow a row of buttons nobody uses on most sessions.
 */
export default function SchemaMenu({ onImport }) {
  const dbml = useProjectStore((s) => s.dbml);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const groups = useProjectStore((s) => s.groups);
  const notes = useProjectStore((s) => s.notes);
  const project = useProjectStore((s) => s.project);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);
  const menu = useDismissable(open, close);

  const base = slugify(project?.name);
  const hasDiagram = nodes.some((n) => n.type === 'table');

  async function handleSql(target) {
    setBusy(target.id);
    setError(null);
    const result = await exportSchema(dbml, target.id);
    setBusy(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    downloadText(
      result.text,
      `${base}.${target.extension}`,
      target.extension === 'json' ? 'application/json' : 'application/sql'
    );
    close();
  }

  function handleDbml() {
    downloadText(dbml, `${base}.dbml`);
    close();
  }

  function handleSvg(theme) {
    const svg = buildDiagramSvg(nodes, edges, groups, { theme, notes });
    if (!svg) {
      setError('There is nothing on the canvas to export.');
      return;
    }
    downloadText(svg, `${base}.svg`, 'image/svg+xml');
    close();
  }

  async function handlePng() {
    const svg = buildDiagramSvg(nodes, edges, groups, { theme: 'dark', notes });
    if (!svg) {
      setError('There is nothing on the canvas to export.');
      return;
    }

    setBusy('png');
    setError(null);
    try {
      downloadBlob(await svgToPng(svg), `${base}.png`);
      close();
    } catch (err) {
      setError(err.message || 'Could not render the image');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="menu" ref={menu}>
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <DownloadSimple size={14} weight="bold" />
        Export
        <CaretDown size={10} weight="bold" />
      </button>

      {open && (
        <div className="menu__panel" role="menu">
          <p className="menu__caption">Diagram</p>
          <MenuItem
            icon={<Image size={14} weight="bold" />}
            label="PNG image"
            hint="2x"
            disabled={!hasDiagram}
            busy={busy === 'png'}
            onClick={handlePng}
          />
          <MenuItem
            icon={<Image size={14} weight="bold" />}
            label="SVG, dark"
            disabled={!hasDiagram}
            onClick={() => handleSvg('dark')}
          />
          <MenuItem
            icon={<Image size={14} weight="bold" />}
            label="SVG, light"
            disabled={!hasDiagram}
            onClick={() => handleSvg('light')}
          />

          <p className="menu__caption">SQL</p>
          {EXPORT_TARGETS.map((target) => (
            <MenuItem
              key={target.id}
              icon={<Code size={14} weight="bold" />}
              label={target.label}
              hint={`.${target.extension}`}
              busy={busy === target.id}
              onClick={() => handleSql(target)}
            />
          ))}

          <p className="menu__caption">Source</p>
          <MenuItem
            icon={<DownloadSimple size={14} weight="bold" />}
            label="DBML file"
            hint=".dbml"
            onClick={handleDbml}
          />
          <MenuItem
            icon={<FileArrowUp size={14} weight="bold" />}
            label="Import SQL…"
            onClick={() => {
              close();
              onImport();
            }}
          />

          {error && (
            <p className="menu__error" role="alert">
              <WarningCircle size={13} weight="fill" />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, hint, onClick, disabled, busy }) {
  return (
    <button
      type="button"
      className="menu__item"
      role="menuitem"
      onClick={onClick}
      disabled={disabled || busy}
    >
      <span className="menu__icon">
        {busy ? <CircleNotch size={14} weight="bold" className="spin" /> : icon}
      </span>
      {label}
      {hint && <span className="menu__hint">{hint}</span>}
    </button>
  );
}
