/**
 * The nine questions an architecture has to answer whatever it is built on.
 *
 * Same rule shape as everything else, so the reason shown next to a choice is
 * the rule that produced it. Several of these read the stack rather than the
 * answers: what is right for Express is not what is right for NestJS, and what
 * is right beside Postgres is not what is right beside Mongo.
 *
 * `none yet` is a real option for the concerns where it is the honest answer.
 * A tool willing to say "no cache" should be willing to say "no queue".
 */
export const CONCERNS = [
  {
    key: 'auth',
    label: 'Authentication',
    help: 'How a request proves who it is.',
    options: [
      {
        key: 'session-cookie',
        name: 'httpOnly session cookie',
        rules: [
          {
            when: { hosting: ['managed', 'self-hosted'] },
            points: 3,
            because: 'Page JavaScript can never read the token, which closes off the usual theft route.',
          },
          { when: { team: 'solo' }, points: 1, because: 'Nothing extra to run or pay for.' },
        ],
      },
      {
        key: 'jwt-bearer',
        name: 'JWT bearer token',
        rules: [
          {
            when: { hosting: 'serverless' },
            points: 3,
            because: 'Stateless verification suits instances that come and go.',
          },
          {
            whenChoice: { topology: 'services' },
            points: 2,
            because: 'Several services can verify the same token without a shared session store.',
          },
        ],
      },
      {
        key: 'provider',
        name: 'Hosted identity provider',
        rules: [
          {
            when: { team: 'large', userScale: 'large' },
            points: 3,
            because: 'SSO, MFA and account recovery become someone else’s problem to keep correct.',
          },
        ],
      },
    ],
  },
  {
    key: 'validation',
    label: 'Input validation',
    help: 'Where a bad request gets stopped.',
    options: [
      {
        key: 'schema-at-edge',
        name: 'Schema validation at the edge',
        rules: [
          {
            points: 2,
            because: 'One schema per endpoint, checked before any handler runs.',
          },
          {
            whenChoice: { backend: 'fastify' },
            points: 2,
            because: 'Fastify does this natively, so it costs you a schema and nothing else.',
          },
          {
            when: { consistency: 'strong' },
            points: 1,
            because: 'Bad input never reaches the code that has to stay correct.',
          },
        ],
      },
      {
        key: 'framework-builtin',
        name: 'Framework validation pipeline',
        rules: [
          {
            whenChoice: { backend: 'nestjs' },
            points: 4,
            because: 'Nest ships a validation pipe; a second mechanism beside it is just drift.',
          },
        ],
      },
      {
        key: 'manual',
        name: 'Checks inside the handler',
        rules: [
          { when: { userScale: 'hobby' }, points: 2, because: 'Few enough endpoints to keep honest by hand.' },
          {
            when: { consistency: 'strong' },
            points: -3,
            because: 'The check you forget is the one that corrupts the data you cannot afford to lose.',
          },
        ],
      },
    ],
  },
  {
    key: 'errors',
    label: 'Error handling',
    help: 'What happens when something throws.',
    options: [
      {
        key: 'central-middleware',
        name: 'Central handler with typed errors',
        rules: [
          {
            points: 3,
            because: 'One place decides status codes and response shape, so they cannot drift per route.',
          },
          {
            when: { team: ['small', 'large'] },
            points: 1,
            because: 'Everyone throws the same error types instead of inventing their own responses.',
          },
        ],
      },
      {
        key: 'per-route',
        name: 'Handled per route',
        rules: [
          { when: { userScale: 'hobby' }, points: 1, because: 'Few enough routes that it stays consistent.' },
          {
            when: { team: 'large' },
            points: -3,
            because: 'Ten people writing their own catch blocks produces ten error formats.',
          },
        ],
      },
    ],
  },
  {
    key: 'logging',
    label: 'Logging and observability',
    help: 'How you find out what happened after it happened.',
    options: [
      {
        key: 'console',
        name: 'Plain console output',
        rules: [
          { when: { userScale: 'hobby' }, points: 3, because: 'You can read the whole log. Nothing else is needed yet.' },
          { when: { team: 'solo' }, points: 1, because: 'No aggregation to set up or pay for.' },
          {
            when: { userScale: ['growing', 'large'] },
            points: -3,
            because: 'Past a certain volume nobody reads unstructured logs, so they may as well not exist.',
          },
        ],
      },
      {
        key: 'structured-json',
        name: 'Structured JSON logger',
        rules: [
          {
            when: { userScale: ['growing', 'large'] },
            points: 3,
            because: 'Searchable fields are what make a log useful once there is too much of it to read.',
          },
          { when: { team: ['small', 'large'] }, points: 1, because: 'One format everyone can query.' },
        ],
      },
      {
        key: 'hosted-apm',
        name: 'Hosted observability',
        rules: [
          {
            when: { userScale: 'large', team: 'large' },
            points: 3,
            because: 'Traces across requests are worth paying for when several people are on call.',
          },
          {
            whenChoice: { topology: 'services' },
            points: 2,
            because: 'With several services, a request you cannot trace end to end is a request you cannot debug.',
          },
        ],
      },
    ],
  },
  {
    key: 'config',
    label: 'Config and secrets',
    help: 'Where the values that differ per environment live.',
    options: [
      {
        key: 'env-validated',
        name: 'Env vars validated at boot',
        rules: [
          {
            points: 3,
            because: 'A missing variable fails at startup instead of at midnight on the one route that reads it.',
          },
        ],
      },
      {
        key: 'env-plain',
        name: 'Env vars, unchecked',
        rules: [
          { when: { userScale: 'hobby' }, points: 1, because: 'Few enough values to keep straight.' },
        ],
      },
      {
        key: 'secret-manager',
        name: 'Managed secret store',
        rules: [
          {
            when: { team: 'large' },
            points: 3,
            because: 'Rotation and access control stop depending on who has the deployment dashboard open.',
          },
          { when: { userScale: 'large' }, points: 1, because: 'Enough environments that hand-copying secrets breaks down.' },
        ],
      },
    ],
  },
  {
    key: 'jobs',
    label: 'Background work',
    help: 'What happens to work that should not block a response.',
    options: [
      {
        key: 'none',
        name: 'None yet',
        rules: [
          {
            when: { userScale: ['hobby', 'small'] },
            points: 3,
            because: 'Nothing here is slow enough to defer. A queue you do not need is a second thing that can break.',
          },
          { when: { team: 'solo' }, points: 1, because: 'One less moving part to run and watch.' },
        ],
      },
      {
        key: 'in-process',
        name: 'In-process queue',
        rules: [
          {
            when: { userScale: 'growing' },
            points: 2,
            because: 'Gets slow work off the request path without adding a service to operate.',
          },
        ],
      },
      {
        key: 'external-queue',
        name: 'External queue and workers',
        rules: [
          {
            when: { userScale: 'large' },
            points: 3,
            because: 'Work survives a restart and scales separately from the web tier.',
          },
          { when: { readWrite: 'write-heavy' }, points: 2, because: 'Absorbs write bursts instead of passing them straight to the database.' },
          {
            whenChoice: { cache: 'redis' },
            points: 1,
            because: 'Redis is already running, so the queue does not add another service.',
          },
        ],
      },
    ],
  },
  {
    key: 'rateLimit',
    label: 'Rate limiting',
    help: 'What stops one caller from ruining it for everyone.',
    options: [
      {
        key: 'none',
        name: 'None yet',
        rules: [
          { when: { userScale: 'hobby' }, points: 2, because: 'Nobody is trying yet, and you would notice if they were.' },
        ],
      },
      {
        key: 'sensitive-routes',
        name: 'On login and register only',
        rules: [
          {
            points: 3,
            because: 'Credential stuffing goes at the auth routes, and that is where a global limit is least useful.',
          },
        ],
      },
      {
        key: 'global',
        name: 'Global limit plus stricter auth routes',
        rules: [
          { when: { userScale: 'large' }, points: 3, because: 'Enough traffic that a single bad client is a real outage risk.' },
          { when: { hosting: 'serverless' }, points: 1, because: 'Per-request billing turns an abusive caller into a bill.' },
        ],
      },
    ],
  },
  {
    key: 'migrations',
    label: 'Schema migrations',
    help: 'How the database gets from one shape to the next.',
    options: [
      {
        key: 'orm-migrations',
        name: 'Generated migrations',
        rules: [
          {
            whenChoice: { database: ['postgresql', 'mysql', 'sqlite'] },
            points: 3,
            because: 'A relational schema has to change in order, and generated migrations keep that order in the repository.',
          },
        ],
      },
      {
        key: 'hand-written-sql',
        name: 'Hand-written SQL migrations',
        rules: [
          {
            whenChoice: { database: ['postgresql', 'mysql'] },
            points: 1,
            because: 'Full control over locking and backfills, which generated migrations tend to get wrong at size.',
          },
          { when: { userScale: 'large' }, points: 2, because: 'At this size a migration that locks a table is an outage.' },
        ],
      },
      {
        key: 'none',
        name: 'No migrations',
        rules: [
          {
            whenChoice: { database: 'mongodb' },
            points: 3,
            because: 'Nothing enforces a shape, so the versioning problem moves into your code rather than disappearing.',
          },
        ],
      },
    ],
  },
  {
    key: 'testing',
    label: 'Testing strategy',
    help: 'What you write tests for.',
    options: [
      {
        key: 'integration-only',
        name: 'Integration tests over the API',
        rules: [
          {
            when: { team: 'solo' },
            points: 3,
            because: 'Catches the most per test written when there is nobody to break your assumptions but you.',
          },
          { when: { userScale: ['hobby', 'small'] }, points: 1, because: 'The surface is small enough to cover end to end.' },
        ],
      },
      {
        key: 'unit-integration',
        name: 'Unit tests plus integration',
        rules: [
          {
            when: { team: ['small', 'large'] },
            points: 3,
            because: 'Unit tests are how one person finds out they broke somebody else’s assumption.',
          },
          { when: { consistency: 'strong' }, points: 2, because: 'The logic that must stay correct is worth testing in isolation.' },
        ],
      },
      {
        key: 'manual',
        name: 'Manual testing',
        rules: [
          { when: { userScale: 'hobby' }, points: 1, because: 'Nothing is at stake yet.' },
          {
            when: { consistency: 'strong' },
            points: -3,
            because: 'Money and stock are exactly what nobody catches by clicking around.',
          },
        ],
      },
    ],
  },
];

export const CONCERN_KEYS = CONCERNS.map((concern) => concern.key);

export function findConcern(key) {
  return CONCERNS.find((concern) => concern.key === key) ?? null;
}

export function findConcernOption(concernKey, optionKey) {
  return findConcern(concernKey)?.options.find((option) => option.key === optionKey) ?? null;
}
