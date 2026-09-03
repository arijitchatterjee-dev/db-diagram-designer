import { findModule } from './modules.js';

/**
 * The folder layout a stack and a layering choice imply.
 *
 * Tied to layering, not only to the stack: Express with `layered` puts orders
 * into four horizontal folders, and Express with `modular` puts it into one
 * vertical folder. That difference is the whole reason this is generated from
 * the architecture rather than from the framework alone.
 *
 * Depth stops at folders and the files that carry meaning. It is a map for
 * somebody about to write the code, not a manifest to keep in sync.
 */

const folder = (path, note = '') => ({ path, kind: 'folder', note });
const file = (path, note = '') => ({ path, kind: 'file', note });

// Where the backend lives depends on whether there is a frontend beside it.
function roots(stack) {
  const hasFrontend = Boolean(pick(stack, 'frontend'));
  return {
    server: hasFrontend ? 'server' : '.',
    client: 'client',
    hasFrontend,
  };
}

function pick(stack, layer) {
  const row = (stack ?? []).find((entry) => entry.layer === layer && !entry.undecided);
  return row?.choice ?? null;
}

function join(root, rest) {
  return root === '.' ? rest : `${root}/${rest}`;
}

// --- backend layouts, one per layering choice -----------------------------

function backendLayered(root) {
  return [
    folder(join(root, 'src/routes'), 'One file per resource, wiring only'),
    folder(join(root, 'src/controllers'), 'Reads the request, calls a service, shapes the response'),
    folder(join(root, 'src/services'), 'The actual behaviour, and where a transaction belongs'),
    folder(join(root, 'src/repositories'), 'Everything that touches the database'),
    folder(join(root, 'src/models')),
    folder(join(root, 'src/middleware')),
    folder(join(root, 'src/config')),
    folder(join(root, 'src/utils')),
    file(join(root, 'src/app.js'), 'Wiring only, so it can be imported by tests'),
    file(join(root, 'src/server.js'), 'Entry point'),
  ];
}

function backendMvc(root) {
  return [
    folder(join(root, 'src/routes')),
    folder(join(root, 'src/controllers')),
    folder(join(root, 'src/models')),
    folder(join(root, 'src/middleware')),
    folder(join(root, 'src/config')),
    file(join(root, 'src/app.js')),
    file(join(root, 'src/server.js')),
  ];
}

function backendModular(root, modules) {
  const out = [
    folder(join(root, 'src/modules'), 'One folder per feature, top to bottom'),
    folder(join(root, 'src/shared/middleware')),
    folder(join(root, 'src/shared/config')),
    folder(join(root, 'src/shared/utils'), 'Only what two modules genuinely share'),
    file(join(root, 'src/app.js')),
    file(join(root, 'src/server.js')),
  ];

  for (const key of modules) {
    const base = join(root, `src/modules/${key}`);
    out.push(
      folder(base),
      file(`${base}/${key}.routes.js`),
      file(`${base}/${key}.controller.js`),
      file(`${base}/${key}.service.js`),
      file(`${base}/${key}.model.js`)
    );
  }
  return out;
}

function backendHexagonal(root, modules) {
  const out = [
    folder(join(root, 'src/domain'), 'Entities and rules. Imports nothing below.'),
    folder(join(root, 'src/application'), 'Use cases, one per thing the product does'),
    folder(join(root, 'src/ports'), 'The interfaces the domain asks for'),
    folder(join(root, 'src/adapters/http'), 'Routes and controllers'),
    folder(join(root, 'src/adapters/persistence'), 'Repository implementations'),
    folder(join(root, 'src/config')),
    file(join(root, 'src/app.js')),
  ];
  for (const key of modules) {
    out.push(folder(join(root, `src/domain/${key}`)), folder(join(root, `src/application/${key}`)));
  }
  return out;
}

function backendClean(root, modules) {
  const out = [
    folder(join(root, 'src/entities'), 'Business objects, no dependencies at all'),
    folder(join(root, 'src/usecases')),
    folder(join(root, 'src/adapters/controllers')),
    folder(join(root, 'src/adapters/gateways')),
    folder(join(root, 'src/frameworks/web')),
    folder(join(root, 'src/frameworks/db')),
    folder(join(root, 'src/config')),
    file(join(root, 'src/main.js'), 'Composition root: the only place that knows every layer'),
  ];
  for (const key of modules) out.push(folder(join(root, `src/usecases/${key}`)));
  return out;
}

// NestJS brings its own conventions, and fighting them is not an architecture
// decision worth making.
function backendNest(root, modules) {
  const out = [
    folder(join(root, 'src/common'), 'Filters, guards, pipes and interceptors'),
    folder(join(root, 'src/config')),
    file(join(root, 'src/app.module.ts')),
    file(join(root, 'src/main.ts')),
  ];
  for (const key of modules) {
    const base = join(root, `src/${key}`);
    out.push(
      folder(base),
      file(`${base}/${key}.module.ts`),
      file(`${base}/${key}.controller.ts`),
      file(`${base}/${key}.service.ts`)
    );
  }
  return out;
}

function backendTree(backend, layering, root, modules) {
  if (backend === 'nestjs') return backendNest(root, modules);

  switch (layering) {
    case 'mvc':
      return backendMvc(root);
    case 'modular':
      return backendModular(root, modules);
    case 'hexagonal':
      return backendHexagonal(root, modules);
    case 'clean':
      return backendClean(root, modules);
    default:
      return backendLayered(root);
  }
}

// --- frontend layouts ------------------------------------------------------

function frontendTree(frontend, root) {
  if (frontend === 'nextjs') {
    return [
      folder(`${root}/app`, 'Routes, one folder per segment'),
      folder(`${root}/components`),
      folder(`${root}/lib`, 'Data access and shared helpers'),
      folder(`${root}/public`),
    ];
  }

  return [
    folder(`${root}/src/api`, 'One module per resource, all HTTP in here'),
    folder(`${root}/src/components`),
    folder(`${root}/src/pages`),
    folder(`${root}/src/store`),
    folder(`${root}/src/utils`),
    file(`${root}/src/main.jsx`),
    file(`${root}/src/App.jsx`),
  ];
}

// --- the signature ---------------------------------------------------------

// Small non-cryptographic hash: enough to notice that the inputs changed,
// which is all `generatedFrom` is ever asked.
function hash(text) {
  let value = 5381;
  for (let i = 0; i < text.length; i += 1) value = ((value << 5) + value + text.charCodeAt(i)) >>> 0;
  return value.toString(36);
}

export function folderSignature({ stack = [], layering = '', moduleKeys = [] } = {}) {
  const keys = [...moduleKeys].sort().join(',');
  return [
    pick(stack, 'backend') ?? 'none',
    pick(stack, 'frontend') ?? 'none',
    layering || 'none',
    moduleKeys.length,
    hash(keys),
  ].join('|');
}

// --- editing ---------------------------------------------------------------

// Mirrors the server's `cleanPath` so the UI refuses a bad path before the API
// has to. Relative, no traversal, no empty segments, eight levels at most.
const SEGMENT = /^[\w.@+-]+$/;

export function isValidPath(path) {
  const text = String(path ?? '').trim();
  if (!text || text.startsWith('/') || text.includes('\\')) return false;

  const segments = text.split('/');
  if (segments.length > 8) return false;
  return segments.every((segment) => segment && segment !== '.' && segment !== '..' && SEGMENT.test(segment));
}

export function isValidSegment(name) {
  const text = String(name ?? '').trim();
  return Boolean(text) && text !== '.' && text !== '..' && SEGMENT.test(text);
}

/** Everything at or under a path. Renaming and deleting both act on this set. */
export function subtreeOf(nodes, path) {
  return nodes.filter((node) => node.path === path || node.path.startsWith(`${path}/`));
}

/**
 * Moves a node and everything under it.
 *
 * Rename and move are the same operation on different parts of the path, so
 * there is one implementation. Returns null when the move is invalid or would
 * land on something that already exists, since silently merging two folders is
 * not what anyone means by a rename.
 */
export function repath(nodes, from, to) {
  if (from === to) return { nodes, moved: 0 };
  if (!isValidPath(to)) return null;
  // Moving a folder inside itself would detach it from the tree.
  if (to === from || to.startsWith(`${from}/`)) return null;

  const moving = subtreeOf(nodes, from);
  if (moving.length === 0) return null;

  const movingPaths = new Set(moving.map((node) => node.path));
  const landing = new Set(
    nodes.filter((node) => !movingPaths.has(node.path)).map((node) => node.path)
  );
  const rewritten = moving.map((node) => ({
    ...node,
    path: `${to}${node.path.slice(from.length)}`,
  }));
  if (rewritten.some((node) => landing.has(node.path))) return null;

  const next = nodes.map((node) => {
    if (!movingPaths.has(node.path)) return node;
    return { ...node, path: `${to}${node.path.slice(from.length)}` };
  });

  return { nodes: sortNodes(next), moved: moving.length };
}

/**
 * Renames a node, and the files inside it that were named after it.
 *
 * The feature-module layout names files for their folder: `orders/` holds
 * `orders.service.js`. Renaming the folder to `sales/` and leaving
 * `orders.service.js` inside it produces a layout that contradicts its own
 * convention. So a direct child whose name begins with exactly `<oldName>.`
 * follows the rename; anything else is left alone, since guessing beyond that
 * would be renaming files nobody asked about.
 */
export function renameNode(nodes, path, name) {
  const next = String(name ?? '').trim();
  if (!isValidSegment(next)) return null;

  const segments = path.split('/');
  const oldName = segments[segments.length - 1];
  segments[segments.length - 1] = next;

  const moved = repath(nodes, path, segments.join('/'));
  if (!moved) return null;

  const newPath = segments.join('/');
  const prefix = `${oldName}.`;
  let renamedChildren = 0;

  const withChildren = moved.nodes.map((node) => {
    if (!node.path.startsWith(`${newPath}/`)) return node;
    const rest = node.path.slice(newPath.length + 1);
    // Direct children only: a nested folder's files are its own business.
    if (rest.includes('/') || !rest.startsWith(prefix)) return node;

    renamedChildren += 1;
    return { ...node, path: `${newPath}/${next}.${rest.slice(prefix.length)}` };
  });

  return { nodes: sortNodes(withChildren), moved: moved.moved, renamedChildren };
}

/** Removing a folder takes its children with it, and says how many. */
export function removeSubtree(nodes, path) {
  const removed = subtreeOf(nodes, path);
  if (removed.length === 0) return null;
  const gone = new Set(removed.map((node) => node.path));
  return { nodes: nodes.filter((node) => !gone.has(node.path)), removed: removed.map((n) => n.path) };
}

export function addNode(nodes, path, kind = 'folder') {
  if (!isValidPath(path)) return null;
  if (nodes.some((node) => node.path === path)) return null;
  return { nodes: sortNodes([...nodes, { path, kind, note: '' }]) };
}

export function setNote(nodes, path, note) {
  return nodes.map((node) => (node.path === path ? { ...node, note } : node));
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Turns the flat path list into something renderable.
 *
 * Intermediate folders are synthesised: the generator emits
 * `server/src/routes` without separately emitting `server` or `server/src`,
 * and the tree still has to show them. Those carry `implicit: true` so the UI
 * can treat them as structure rather than as nodes you chose.
 */
export function buildTree(nodes = []) {
  const root = { children: new Map() };

  const ensure = (segments, depth) => {
    let current = root;
    for (let i = 0; i < depth; i += 1) {
      const name = segments[i];
      if (!current.children.has(name)) {
        current.children.set(name, {
          name,
          path: segments.slice(0, i + 1).join('/'),
          kind: 'folder',
          note: '',
          implicit: true,
          children: new Map(),
        });
      }
      current = current.children.get(name);
    }
    return current;
  };

  for (const node of nodes) {
    const segments = node.path.split('/');
    const parent = ensure(segments, segments.length - 1);
    const name = segments[segments.length - 1];
    const existing = parent.children.get(name);

    parent.children.set(name, {
      name,
      path: node.path,
      kind: node.kind,
      note: node.note ?? '',
      implicit: false,
      children: existing?.children ?? new Map(),
    });
  }

  // Folders before files, then alphabetical: the conventional reading order,
  // and stable regardless of what order the paths arrived in.
  const toArray = (map) =>
    [...map.values()]
      .map((entry) => ({ ...entry, children: toArray(entry.children) }))
      .sort((a, b) => {
        const aFolder = a.kind === 'folder' || a.children.length > 0;
        const bFolder = b.kind === 'folder' || b.children.length > 0;
        if (aFolder !== bFolder) return aFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

  return toArray(root.children);
}

/**
 * The tree as indented text, for the exports.
 *
 * A trailing slash marks a folder and a `#` comment carries the note, which is
 * how anyone reading a directory listing expects to read one.
 */
export function renderTreeText(nodes = [], { indent = '  ' } = {}) {
  const lines = [];

  const walk = (list, depth) => {
    for (const node of list) {
      const isFolder = node.kind === 'folder' || node.children.length > 0;
      const note = node.note ? `    # ${node.note}` : '';
      lines.push(`${indent.repeat(depth)}${node.name}${isFolder ? '/' : ''}${note}`);
      walk(node.children, depth + 1);
    }
  };

  walk(buildTree(nodes), 0);
  return lines.join('\n');
}

/**
 * `customModules` contribute their keys like any other module, so a module you
 * named yourself gets a folder with your name on it.
 */
export function generateFolders({ stack = [], layering = '', moduleKeys = [], customModules = [] } = {}) {
  const backend = pick(stack, 'backend');
  const frontend = pick(stack, 'frontend');
  if (!backend && !frontend) return [];

  const { server, client } = roots(stack);
  const customKeys = new Set(customModules.map((module) => module.key));
  // Only modules that exist, and slug-safe, since these become path segments.
  const modules = moduleKeys.filter((key) => customKeys.has(key) || findModule(key));

  const out = [];
  if (backend) out.push(...backendTree(backend, layering, server, modules));
  if (frontend) out.push(...frontendTree(frontend, client));

  out.push(folder(server === '.' ? 'tests' : `${server}/tests`, 'Mirrors the source layout'));

  // The same path twice is one node. Later notes win, since a more specific
  // layout added it deliberately.
  const seen = new Map();
  for (const node of out) seen.set(node.path, node);
  return [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
}
