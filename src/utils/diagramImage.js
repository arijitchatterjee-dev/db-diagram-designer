import { Position, getSmoothStepPath } from 'reactflow';
import {
  ENUM_ROW_HEIGHT,
  HEADER_HEIGHT,
  INDEX_CAPTION_HEIGHT,
  INDEX_ROW_HEIGHT,
  ROW_HEIGHT,
  indexLabel,
} from './autoLayout.js';
import { handleSides } from './buildGraph.js';

/**
 * Draws the diagram as an SVG from the graph data rather than screenshotting
 * the DOM. That keeps the export independent of scroll position and zoom, the
 * text real text (searchable, selectable, sharp at any size), and — since
 * nothing has to be inlined from the page — free of any extra dependency.
 */

const MARGIN = 48;
const PAD = 10;
const GROUP_PAD = 26;
const GROUP_LABEL_SPACE = 22;
// The group's name chip, centred on the backdrop's top edge.
const LABEL_HEIGHT = 18;
const LABEL_INSET = 12;
const labelWidth = (name) => name.length * 6.2 + 18;

// Sticky notes. Width matches the on-screen note so a note that fits there
// fits here; the character budget is what 200px of 11.5px mono holds.
const NOTE_WIDTH = 220;
const NOTE_GRIP = 20;
const NOTE_LINE = 17;
const NOTE_CHARS = 30;
const NOTE_MAX_LINES = 24;

const THEMES = {
  dark: {
    bg: '#0a0c10',
    surface: '#12151b',
    surfaceAlt: '#171b23',
    indexBg: '#0d1015',
    line: '#2a3140',
    lineSoft: '#1e242e',
    text: '#e7eaf0',
    textDim: '#9099a9',
    textFaint: '#697184',
    accent: '#f5a524',
    edge: '#46536b',
    edgeEnum: '#333c4c',
    noteBg: '#241d0c',
    noteLine: '#4a3c14',
    noteText: '#f0e3c2',
  },
  light: {
    bg: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#f2f4f7',
    indexBg: '#f8f9fb',
    line: '#c9cfda',
    lineSoft: '#e3e7ee',
    text: '#151922',
    textDim: '#5a6272',
    textFaint: '#858d9c',
    accent: '#b46a00',
    edge: '#8b95a6',
    edgeEnum: '#c2c9d4',
    noteBg: '#fdf6e0',
    noteLine: '#e0cd93',
    noteText: '#4a3c14',
  },
};

// Generic families only: the SVG has to stand on its own in a doc or a README,
// and rasterising to PNG can't pull a webfont in either.
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function buildDiagramSvg(nodes, edges, groups = [], { theme = 'dark', notes = [] } = {}) {
  const palette = THEMES[theme] || THEMES.dark;
  const drawable = nodes.filter((n) => n.type === 'table' || n.type === 'enum');
  if (drawable.length === 0) return null;

  const byId = new Map(drawable.map((n) => [n.id, n]));
  const bounds = boundsOf(drawable, groups, byId, notes);
  const width = bounds.maxX - bounds.minX + MARGIN * 2;
  const height = bounds.maxY - bounds.minY + MARGIN * 2;
  // Shift everything so the top-left of the content sits at the margin.
  const dx = MARGIN - bounds.minX;
  const dy = MARGIN - bounds.minY;

  const parts = [
    ...groups.map((group) => drawGroup(group, byId, palette)),
    ...edges.map((edge) => drawEdge(edge, byId, palette)).filter(Boolean),
    ...drawable.map((node) =>
      node.type === 'enum' ? drawEnum(node, palette) : drawTable(node, palette)
    ),
    ...notes.map((note) => drawNote(note, palette)),
  ];

  const defs =
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5"` +
    ` markerHeight="5" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="${palette.edge}"/></marker></defs>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}"`,
    ` viewBox="0 0 ${round(width)} ${round(height)}" font-family="${MONO}">`,
    defs,
    // Outside the translate, so the ground covers the margins too — a PNG with
    // transparent edges looks broken wherever it's pasted.
    `<rect width="${round(width)}" height="${round(height)}" fill="${palette.bg}"/>`,
    `<g transform="translate(${round(dx)} ${round(dy)})">`,
    parts.join(''),
    '</g></svg>',
  ].join('');
}

/** Rasterises an SVG string through a canvas. Resolves to a PNG blob. */
export function svgToPng(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const match = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
    if (!match) {
      reject(new Error('Could not measure the diagram'));
      return;
    }
    const width = Number(match[1]);
    const height = Number(match[2]);

    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not render the image'));
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the image'));
    };
    image.src = url;
  });
}

// ---------------------------------------------------------------- geometry

function boundsOf(nodes, groups, byId, notes = []) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const stretch = (x, y, width, height) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  };

  nodes.forEach((node) => stretch(node.position.x, node.position.y, widthOf(node), heightOf(node)));

  // A group backdrop sticks out past its own members, but only around them —
  // padding the whole drawing instead would leave dead space on every side.
  // Its name chip straddles the top edge, so that overhang counts too.
  groups.forEach((group) => {
    const rect = groupRect(group, byId);
    if (!rect) return;
    stretch(rect.x, rect.y, rect.width, rect.height);
    stretch(rect.x + LABEL_INSET, rect.y - LABEL_HEIGHT / 2, labelWidth(group.name), LABEL_HEIGHT);
  });

  notes.forEach((note) => stretch(note.x, note.y, NOTE_WIDTH, noteHeight(note)));

  return { minX, minY, maxX, maxY };
}

/** The backdrop a group occupies, or null when none of its tables are drawn. */
function groupRect(group, byId) {
  const members = group.tables.map((name) => byId.get(name)).filter(Boolean);
  if (members.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  members.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + widthOf(node));
    maxY = Math.max(maxY, node.position.y + heightOf(node));
  });

  return {
    x: minX - GROUP_PAD,
    y: minY - GROUP_PAD - GROUP_LABEL_SPACE,
    width: maxX - minX + GROUP_PAD * 2,
    height: maxY - minY + GROUP_PAD * 2 + GROUP_LABEL_SPACE,
  };
}

const widthOf = (node) => node.width ?? node.data?.width ?? 260;

function heightOf(node) {
  if (node.height) return node.height;
  return node.type === 'enum'
    ? HEADER_HEIGHT + node.data.enumDef.values.length * ENUM_ROW_HEIGHT + 8
    : HEADER_HEIGHT + node.data.table.fields.length * ROW_HEIGHT + 8;
}

/** Vertical centre of a column's row, which is where its edges dock. */
function columnY(node, column) {
  const index = node.data.table.fields.findIndex((f) => f.name === column);
  if (index < 0) return node.position.y + HEADER_HEIGHT / 2;
  return node.position.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
}

// ---------------------------------------------------------------- drawing

function drawEdge(edge, byId, palette) {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return null;

  const sides = handleSides(
    { ...source.position, width: widthOf(source) },
    { ...target.position, width: widthOf(target) }
  );

  const sourceX = sides.source === 'right' ? source.position.x + widthOf(source) : source.position.x;
  const targetX = sides.target === 'right' ? target.position.x + widthOf(target) : target.position.x;

  const isEnum = edge.data?.kind === 'enum';
  const sourceY = columnY(source, edge.data.sourceColumn);
  const targetY = isEnum
    ? target.position.y + heightOf(target) / 2
    : columnY(target, edge.data.targetColumn);

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sides.source === 'right' ? Position.Right : Position.Left,
    targetPosition: sides.target === 'right' ? Position.Right : Position.Left,
    borderRadius: 14,
  });

  const stroke = isEnum ? palette.edgeEnum : palette.edge;
  const dash = edge.style?.strokeDasharray;

  const line =
    `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${isEnum ? 1.2 : 1.6}"` +
    `${dash ? ` stroke-dasharray="${dash}"` : ''}` +
    `${edge.markerEnd ? ' marker-end="url(#arrow)"' : ''}` +
    `${edge.markerStart ? ' marker-start="url(#arrow)"' : ''}/>`;

  const label = edge.label
    ? `<text x="${round(labelX)}" y="${round(labelY)}" fill="${palette.textFaint}" font-size="10"` +
      ` font-weight="600" text-anchor="middle" dominant-baseline="middle">${escape(edge.label)}</text>`
    : '';

  return line + label;
}

function drawGroup(group, byId, palette) {
  const rect = groupRect(group, byId);
  if (!rect) return '';

  const { x, y, width, height } = rect;
  const chip = labelWidth(group.name);

  return (
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}"` +
    ` rx="12" fill="none" stroke="${palette.lineSoft}"/>` +
    `<rect x="${round(x + LABEL_INSET)}" y="${round(y - LABEL_HEIGHT / 2)}" width="${round(chip)}"` +
    ` height="${LABEL_HEIGHT}" rx="4" fill="${palette.bg}" stroke="${palette.line}"/>` +
    `<text x="${round(x + LABEL_INSET + chip / 2)}" y="${round(y)}" fill="${palette.textDim}"` +
    ` font-size="10.5" font-weight="600" text-anchor="middle" dominant-baseline="middle">` +
    `${escape(group.name)}</text>`
  );
}

function drawTable(node, palette) {
  const { table } = node.data;
  const width = widthOf(node);
  const { x, y } = node.position;
  const height = heightOf(node);

  const rows = table.fields.map((field, index) => {
    const rowY = y + HEADER_HEIGHT + index * ROW_HEIGHT;
    const centre = rowY + ROW_HEIGHT / 2;
    const marks =
      (field.pk ? 'PK' : '') + (field.unique && !field.pk ? 'U' : '') + (field.notNull ? '*' : '');

    return (
      (index > 0
        ? `<line x1="${round(x)}" y1="${round(rowY)}" x2="${round(x + width)}" y2="${round(rowY)}"` +
          ` stroke="${palette.lineSoft}"/>`
        : '') +
      `<text x="${round(x + PAD)}" y="${round(centre)}" fill="${palette.text}" font-size="12"` +
      `${field.pk ? ' font-weight="600"' : ''} dominant-baseline="middle">${escape(field.name)}</text>` +
      `<text x="${round(x + width - PAD)}" y="${round(centre)}" fill="${palette.textFaint}"` +
      ` font-size="10.5" text-anchor="end" dominant-baseline="middle">` +
      `${escape(field.type)}${marks ? ` ${marks}` : ''}</text>`
    );
  });

  const indexBlock = table.indexes?.length ? drawIndexes(node, palette) : '';
  const headerFill = table.headerColor || palette.surfaceAlt;

  return (
    `<g>` +
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}"` +
    ` rx="8" fill="${palette.surface}" stroke="${palette.line}"/>` +
    `<path d="M${round(x)},${round(y + 8)} a8,8 0 0 1 8,-8 h${round(width - 16)} a8,8 0 0 1 8,8` +
    ` v${round(HEADER_HEIGHT - 8)} h${round(-width)} z" fill="${headerFill}"/>` +
    `<line x1="${round(x)}" y1="${round(y + HEADER_HEIGHT)}" x2="${round(x + width)}"` +
    ` y2="${round(y + HEADER_HEIGHT)}" stroke="${palette.line}"/>` +
    `<text x="${round(x + PAD)}" y="${round(y + HEADER_HEIGHT / 2)}" fill="${palette.text}"` +
    ` font-size="12.5" font-weight="600" dominant-baseline="middle">${escape(table.name)}</text>` +
    `<text x="${round(x + width - PAD)}" y="${round(y + HEADER_HEIGHT / 2)}" fill="${palette.textFaint}"` +
    ` font-size="10.5" text-anchor="end" dominant-baseline="middle">${table.fields.length}</text>` +
    rows.join('') +
    indexBlock +
    `</g>`
  );
}

function drawIndexes(node, palette) {
  const { table } = node.data;
  const width = widthOf(node);
  const { x } = node.position;
  const top = node.position.y + HEADER_HEIGHT + table.fields.length * ROW_HEIGHT;
  const blockHeight = INDEX_CAPTION_HEIGHT + table.indexes.length * INDEX_ROW_HEIGHT;

  const rows = table.indexes.map((index, i) => {
    const centre = top + INDEX_CAPTION_HEIGHT + i * INDEX_ROW_HEIGHT + INDEX_ROW_HEIGHT / 2;
    const badge = index.pk ? ' PK' : index.unique ? ' U' : '';
    return (
      `<text x="${round(x + PAD)}" y="${round(centre)}" fill="${palette.textDim}" font-size="10.5"` +
      ` dominant-baseline="middle">${escape(indexLabel(index) + badge)}</text>`
    );
  });

  return (
    `<rect x="${round(x)}" y="${round(top)}" width="${round(width)}" height="${round(blockHeight)}"` +
    ` fill="${palette.indexBg}"/>` +
    `<line x1="${round(x)}" y1="${round(top)}" x2="${round(x + width)}" y2="${round(top)}"` +
    ` stroke="${palette.line}"/>` +
    `<text x="${round(x + PAD)}" y="${round(top + INDEX_CAPTION_HEIGHT / 2)}"` +
    ` fill="${palette.textFaint}" font-size="9" font-weight="700" letter-spacing="0.8"` +
    ` dominant-baseline="middle">INDEXES</text>` +
    rows.join('')
  );
}

function drawEnum(node, palette) {
  const { enumDef } = node.data;
  const width = widthOf(node);
  const { x, y } = node.position;
  const height = heightOf(node);

  const values = enumDef.values.map((value, index) => {
    const centre = y + HEADER_HEIGHT + index * ENUM_ROW_HEIGHT + ENUM_ROW_HEIGHT / 2;
    return (
      `<text x="${round(x + PAD + 10)}" y="${round(centre)}" fill="${palette.textDim}"` +
      ` font-size="11" dominant-baseline="middle">${escape(value)}</text>`
    );
  });

  return (
    `<g>` +
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}"` +
    ` rx="8" fill="${palette.bg}" stroke="${palette.line}" stroke-dasharray="4 3"/>` +
    `<line x1="${round(x)}" y1="${round(y + HEADER_HEIGHT)}" x2="${round(x + width)}"` +
    ` y2="${round(y + HEADER_HEIGHT)}" stroke="${palette.line}" stroke-dasharray="4 3"/>` +
    `<text x="${round(x + PAD)}" y="${round(y + HEADER_HEIGHT / 2)}" fill="${palette.text}"` +
    ` font-size="12.5" font-weight="600" dominant-baseline="middle">${escape(enumDef.name)}</text>` +
    `<text x="${round(x + width - PAD)}" y="${round(y + HEADER_HEIGHT / 2)}" fill="${palette.textFaint}"` +
    ` font-size="9" font-weight="700" text-anchor="end" dominant-baseline="middle">ENUM</text>` +
    values.join('') +
    `</g>`
  );
}

/**
 * SVG has no text wrapping, so the note's text is broken into lines here at the
 * same character budget the on-screen note wraps at.
 */
function noteLines(note) {
  const text = String(note.text || '');
  if (!text.trim()) return [];

  const lines = [];
  text.split('\n').forEach((paragraph) => {
    let current = '';
    paragraph.split(/\s+/).forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= NOTE_CHARS) {
        current = candidate;
        return;
      }
      if (current) lines.push(current);
      // A single word longer than the line gets hard-broken rather than
      // running off the edge of the note.
      current = word;
      while (current.length > NOTE_CHARS) {
        lines.push(current.slice(0, NOTE_CHARS));
        current = current.slice(NOTE_CHARS);
      }
    });
    lines.push(current);
  });

  return lines.slice(0, NOTE_MAX_LINES);
}

function noteHeight(note) {
  const lines = Math.max(noteLines(note).length, 1);
  return NOTE_GRIP + lines * NOTE_LINE + 16;
}

function drawNote(note, palette) {
  const lines = noteLines(note);
  const height = noteHeight(note);

  const body = lines.map(
    (line, index) =>
      `<text x="${round(note.x + 10)}" y="${round(note.y + NOTE_GRIP + 8 + index * NOTE_LINE + NOTE_LINE / 2)}"` +
      ` fill="${palette.noteText}" font-size="11.5" dominant-baseline="middle">${escape(line)}</text>`
  );

  return (
    `<g>` +
    `<rect x="${round(note.x)}" y="${round(note.y)}" width="${NOTE_WIDTH}" height="${round(height)}"` +
    ` rx="8" fill="${palette.noteBg}" stroke="${palette.noteLine}"/>` +
    `<line x1="${round(note.x)}" y1="${round(note.y + NOTE_GRIP)}" x2="${round(note.x + NOTE_WIDTH)}"` +
    ` y2="${round(note.y + NOTE_GRIP)}" stroke="${palette.noteLine}"/>` +
    body.join('') +
    `</g>`
  );
}

// ---------------------------------------------------------------- helpers

const round = (n) => Math.round(n * 100) / 100;

function escape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
