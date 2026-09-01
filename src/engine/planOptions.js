/**
 * The client-side vocabulary of a plan: the same legal values the server
 * validates against, plus the labels and one-line explanations the UI shows.
 *
 * The server's `planOptions.js` stays the authority on what is legal. If these
 * two drift, the symptom is a 400 on save, which is why every value here is
 * copied verbatim rather than paraphrased.
 */

export const ANSWERS = {
  userScale: {
    label: 'Expected users',
    help: 'Roughly how many people will use this.',
    options: [
      { value: 'hobby', label: 'Hobby', detail: 'A handful. Personal or a demo.' },
      { value: 'small', label: 'Small', detail: 'Up to a few thousand.' },
      { value: 'growing', label: 'Growing', detail: 'Tens of thousands, and climbing.' },
      { value: 'large', label: 'Large', detail: 'Hundreds of thousands or more.' },
    ],
  },
  readWrite: {
    label: 'Read / write balance',
    help: 'Which way the traffic leans decides whether caching earns its keep.',
    options: [
      { value: 'read-heavy', label: 'Mostly reads', detail: 'Browsing, catalogues, feeds.' },
      { value: 'write-heavy', label: 'Mostly writes', detail: 'Logging, tracking, ingestion.' },
      { value: 'balanced', label: 'Balanced', detail: 'Roughly even.' },
    ],
  },
  consistency: {
    label: 'Consistency needs',
    help: 'The single biggest input into the database choice.',
    options: [
      {
        value: 'strong',
        label: 'Strong',
        detail: 'Money, stock or bookings. Two people must never get the last one.',
      },
      {
        value: 'eventual-ok',
        label: 'Eventual is fine',
        detail: 'A few seconds of staleness harms nobody.',
      },
    ],
  },
  dataShape: {
    label: 'Shape of the data',
    help: 'Whether your records are joins or self-contained documents.',
    options: [
      { value: 'relational', label: 'Relational', detail: 'Lots of references between entities.' },
      { value: 'document', label: 'Document', detail: 'Mostly self-contained, varying fields.' },
      { value: 'mixed', label: 'Mixed', detail: 'Some of each.' },
    ],
  },
  realtime: {
    label: 'Realtime needs',
    help: 'Only live collaboration justifies a websocket layer.',
    options: [
      { value: 'none', label: 'None', detail: 'Plain request and response.' },
      { value: 'notifications', label: 'Notifications', detail: 'Push updates one way.' },
      { value: 'live', label: 'Live', detail: 'Shared cursors, collaborative editing.' },
    ],
  },
  search: {
    label: 'Search needs',
    help: 'Faceted filtering is where a dedicated search service starts to pay.',
    options: [
      { value: 'none', label: 'None', detail: 'No search surface.' },
      { value: 'basic', label: 'Basic', detail: 'Match on a name or title.' },
      { value: 'full-text', label: 'Full text', detail: 'Search inside long content.' },
      { value: 'faceted', label: 'Faceted', detail: 'Filter by many attributes at once.' },
    ],
  },
  team: {
    label: 'Team size',
    help: 'Who maintains this, which decides how much infrastructure is too much.',
    options: [
      { value: 'solo', label: 'Solo', detail: 'Just you.' },
      { value: 'small', label: 'Small team', detail: 'Two to five people.' },
      { value: 'large', label: 'Large team', detail: 'More than five.' },
    ],
  },
  hosting: {
    label: 'Hosting preference',
    help: 'How much operations work you are willing to own.',
    options: [
      { value: 'managed', label: 'Managed', detail: 'Someone else runs the database.' },
      { value: 'self-hosted', label: 'Self-hosted', detail: 'Your own server, your own upgrades.' },
      { value: 'serverless', label: 'Serverless', detail: 'Scale to zero, pay per request.' },
    ],
  },
};

export const ANSWER_KEYS = Object.keys(ANSWERS);

export const LAYERS = [
  { value: 'database', label: 'Database' },
  { value: 'backend', label: 'Backend' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'cache', label: 'Cache' },
  { value: 'search', label: 'Search' },
  { value: 'hosting', label: 'Hosting' },
];

export const PRESETS = [
  { value: 'ecommerce', label: 'Ecommerce', detail: 'Catalogue, cart, checkout, orders.' },
  { value: 'saas', label: 'SaaS', detail: 'Accounts, teams, billing, permissions.' },
  { value: 'blog', label: 'Blog / CMS', detail: 'Posts, authors, categories, comments.' },
  { value: 'marketplace', label: 'Marketplace', detail: 'Two sides, listings, payouts.' },
  { value: 'custom', label: 'Custom', detail: 'Start from nothing.' },
];

export const STATUSES = [
  { value: 'draft', label: 'Draft', detail: 'Still deciding.' },
  { value: 'planned', label: 'Planned', detail: 'Decisions made, ready to build.' },
  { value: 'building', label: 'Building', detail: 'Work is under way.' },
];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function labelFor(list, value) {
  return list.find((entry) => entry.value === value)?.label ?? value ?? '';
}
