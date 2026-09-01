/**
 * The knowledge base behind every recommendation.
 *
 * A candidate scores by summing the rules that match your answers. Each rule
 * carries the sentence that explains it, so a recommendation is never a bare
 * verdict: the reasons shown in the UI are literally the rules that fired.
 *
 * Rule shape:
 *   when:       answer key -> value, or an array of accepted values. All keys
 *               must match. A missing answer never matches.
 *   whenChoice: layer -> choice already decided earlier in LAYER_ORDER, so
 *               "you already have Postgres" can be a reason.
 *   points:     positive argues for, negative argues against. Negative rules
 *               become the honest caveats attached to the choice.
 */

// Resolved in this order, so a later layer can react to an earlier decision.
export const LAYER_ORDER = ['database', 'backend', 'frontend', 'cache', 'search', 'hosting'];

export const CANDIDATES = [
  // ---------------------------------------------------------------- database
  {
    key: 'postgresql',
    layer: 'database',
    name: 'PostgreSQL',
    rules: [
      {
        when: { consistency: 'strong' },
        points: 3,
        because: 'Anything touching money, stock or bookings needs real transactions, and here they are the default rather than an add-on.',
      },
      {
        when: { dataShape: 'relational' },
        points: 3,
        because: 'Your records are mostly references to each other, which is exactly what joins are for.',
      },
      {
        when: { dataShape: 'mixed' },
        points: 2,
        because: 'JSONB gives you document-shaped columns without giving up joins on everything else.',
      },
      {
        when: { userScale: ['growing', 'large'] },
        points: 1,
        because: 'Scales a long way on one machine before you have to think about it.',
      },
      {
        when: { hosting: 'managed' },
        points: 1,
        because: 'Every managed provider offers it, so switching hosts later is not a migration.',
      },
      {
        when: { userScale: 'hobby' },
        points: -1,
        because: 'A whole database server is more setup than a personal project usually needs.',
      },
    ],
    breaksAt:
      'Writes go through one primary. Past that you are into read replicas, then partitioning, in that order.',
  },
  {
    key: 'mongodb',
    layer: 'database',
    name: 'MongoDB',
    rules: [
      {
        when: { dataShape: 'document' },
        points: 4,
        because: 'Your records are self-contained and their fields vary, which is the case a document store is built for.',
      },
      {
        when: { readWrite: 'write-heavy' },
        points: 2,
        because: 'Write throughput spreads across shards rather than queueing behind one primary.',
      },
      {
        when: { consistency: 'eventual-ok' },
        points: 1,
        because: 'You said a few seconds of staleness is harmless, so the replication model costs you nothing.',
      },
      {
        when: { consistency: 'strong' },
        points: -3,
        because: 'Multi-document transactions exist but are the exception here, and stock or payment logic wants them to be the rule.',
      },
      {
        when: { dataShape: 'relational' },
        points: -3,
        because: 'Joins are possible but awkward, and referential integrity becomes your code’s job rather than the database’s.',
      },
    ],
    breaksAt:
      'Schema drift. Nothing stops two documents in one collection disagreeing about their shape, so validation has to live in your code.',
  },
  {
    key: 'sqlite',
    layer: 'database',
    name: 'SQLite',
    rules: [
      {
        when: { userScale: 'hobby' },
        points: 4,
        because: 'One file, no server, no operations. For a personal tool that is the entire database problem solved.',
      },
      {
        when: { team: 'solo' },
        points: 2,
        because: 'Nothing to provision, back up or upgrade while you are the only person maintaining it.',
      },
      {
        when: { consistency: 'strong' },
        points: 1,
        because: 'Fully ACID despite the size, so correctness is not what you give up.',
      },
      {
        when: { readWrite: 'read-heavy' },
        points: 1,
        because: 'Reads are extremely fast; it is concurrent writes that hurt.',
      },
      {
        when: { userScale: 'growing' },
        points: -4,
        because: 'Concurrent writers serialise behind a single lock, which starts showing up as timeouts.',
      },
      {
        when: { userScale: 'large' },
        points: -6,
        because: 'Well past what a single-writer file database should be asked to do.',
      },
      {
        when: { hosting: 'serverless' },
        points: -3,
        because: 'Serverless instances come and go, and a database that is a local file goes with them.',
      },
    ],
    breaksAt:
      'Concurrent writers. One writer at a time is fine for a personal tool and fatal for a busy one.',
  },
  {
    key: 'mysql',
    layer: 'database',
    name: 'MySQL',
    rules: [
      {
        when: { dataShape: 'relational' },
        points: 2,
        because: 'Relational and well understood, with transactions you can rely on.',
      },
      {
        when: { consistency: 'strong' },
        points: 2,
        because: 'InnoDB gives you the transactional guarantees the workload needs.',
      },
      {
        when: { team: 'large' },
        points: 1,
        because: 'The odds that someone on a large team has already run this in production are high.',
      },
      {
        when: { dataShape: 'mixed' },
        points: -1,
        because: 'JSON support is thinner than Postgres, so document-shaped columns are more awkward.',
      },
      {
        when: { search: ['full-text', 'faceted'] },
        points: -1,
        because: 'Full-text support is weaker, so you reach for a separate search service sooner.',
      },
    ],
    breaksAt:
      'Same single-primary write ceiling as Postgres, reached with fewer built-in escape hatches.',
  },

  // ----------------------------------------------------------------- backend
  {
    key: 'express',
    layer: 'backend',
    name: 'Express',
    rules: [
      {
        when: { team: 'solo' },
        points: 3,
        because: 'Nothing to learn before you are productive, and you decide the structure.',
      },
      {
        when: { userScale: ['hobby', 'small'] },
        points: 2,
        because: 'More than fast enough at this size, and the smallest thing that works.',
      },
      {
        when: { team: 'large' },
        points: -2,
        because: 'Imposes no structure of its own, so a large team has to agree on conventions and then enforce them by hand.',
      },
    ],
    breaksAt:
      'Its own lack of opinions. Past a few thousand lines every project invents a different folder layout.',
  },
  {
    key: 'fastify',
    layer: 'backend',
    name: 'Fastify',
    rules: [
      {
        when: { readWrite: 'write-heavy' },
        points: 2,
        because: 'Meaningfully faster per request, which shows up first under sustained writes.',
      },
      {
        when: { userScale: ['growing', 'large'] },
        points: 2,
        because: 'Schema-based validation and serialisation are built in rather than bolted on.',
      },
      {
        when: { team: 'small' },
        points: 1,
        because: 'Enough convention to keep a small team consistent without a framework to learn first.',
      },
    ],
    breaksAt: 'A smaller plugin ecosystem, so occasionally you write the integration yourself.',
  },
  {
    key: 'nestjs',
    layer: 'backend',
    name: 'NestJS',
    rules: [
      {
        when: { team: 'large' },
        points: 4,
        because: 'Prescribes the structure, so ten people write the same shape of code without a meeting about it.',
      },
      {
        when: { userScale: 'large' },
        points: 1,
        because: 'Modules and dependency injection hold up as the surface area grows.',
      },
      {
        when: { team: 'solo' },
        points: -3,
        because: 'A lot of ceremony to maintain when there is nobody to be consistent with.',
      },
      {
        when: { userScale: 'hobby' },
        points: -2,
        because: 'The framework would be bigger than the thing you are building.',
      },
    ],
    breaksAt: 'Its own weight. The structure that helps a large team slows a solo one down.',
  },

  // ---------------------------------------------------------------- frontend
  {
    key: 'react-vite',
    layer: 'frontend',
    name: 'React + Vite',
    rules: [
      {
        when: { team: 'solo' },
        points: 2,
        because: 'One build tool, instant dev server, nothing between you and the app.',
      },
      {
        when: { hosting: 'self-hosted' },
        points: 2,
        because: 'Builds to static files that any web server can hand out.',
      },
      {
        when: { userScale: 'hobby' },
        points: 1,
        because: 'No server-side rendering to run means no server to run.',
      },
      {
        when: { hosting: 'managed' },
        points: 1,
        because: 'A static bundle is the simplest thing a platform can be asked to serve.',
      },
      {
        when: { team: 'small' },
        points: 1,
        because: 'One build tool and one way to render, which is little for a small team to agree on.',
      },
      {
        when: { hosting: 'serverless' },
        points: -1,
        because: 'You would be deploying a static bundle to a platform whose main advantage is running code.',
      },
    ],
    breaksAt:
      'Anything needing indexable server-rendered pages. A client-only bundle is a poor fit for public content.',
  },
  {
    key: 'nextjs',
    layer: 'frontend',
    name: 'Next.js',
    rules: [
      {
        when: { hosting: 'serverless' },
        points: 3,
        because: 'Serverless is its native deployment target rather than a configuration you assemble.',
      },
      {
        when: { team: 'large' },
        points: 1,
        because: 'Routing and data-loading conventions come with the framework, so they are not per-team decisions.',
      },
      {
        when: { userScale: 'large' },
        points: 1,
        because: 'Server rendering and caching are there when the page count and traffic justify them.',
      },
      {
        when: { readWrite: 'read-heavy' },
        points: 2,
        because: 'Read-mostly traffic is where server rendering and page caching pay off most.',
      },
      {
        when: { team: 'solo' },
        points: -1,
        because: 'The rendering model is a real thing to learn before you ship anything.',
      },
    ],
    breaksAt:
      'Framework coupling. Its rendering assumptions reach further into your code than a plain SPA build would.',
  },

  // ------------------------------------------------------------------- cache
  // `none` is a real candidate. A cache nobody needs is a bug, not a feature.
  {
    key: 'none',
    layer: 'cache',
    name: 'No cache',
    rules: [
      {
        when: { userScale: ['hobby', 'small'] },
        points: 3,
        because: 'At this size the database answers fast enough, and a cache would only add a second thing that can be wrong.',
      },
      {
        when: { readWrite: 'write-heavy' },
        points: 2,
        because: 'Caching a workload that mostly writes buys little and costs you invalidation bugs.',
      },
      {
        when: { team: 'solo' },
        points: 1,
        because: 'One less moving part to run and reason about on your own.',
      },
    ],
    breaksAt: 'Read volume. When the same expensive query runs constantly, add the cache then.',
  },
  {
    key: 'redis',
    layer: 'cache',
    name: 'Redis',
    rules: [
      {
        when: { readWrite: 'read-heavy' },
        points: 3,
        because: 'The same expensive reads repeat constantly, which is precisely what a cache is for.',
      },
      {
        when: { userScale: 'growing' },
        points: 2,
        because: 'At this traffic, keeping hot reads off the database is what buys you headroom.',
      },
      {
        when: { userScale: 'large' },
        points: 3,
        because: 'At this size the database should not be answering the same question repeatedly.',
      },
      {
        when: { realtime: 'live' },
        points: 2,
        because: 'Its pub/sub also gives you the fan-out that live updates need across instances.',
      },
      {
        when: { userScale: 'hobby' },
        points: -3,
        because: 'A second service to run for a workload that has no performance problem yet.',
      },
    ],
    breaksAt:
      'Invalidation. Every cached value is a copy that can go stale, and deciding when to drop it is on you.',
  },

  // ------------------------------------------------------------------ search
  {
    key: 'none',
    layer: 'search',
    name: 'No search service',
    rules: [
      {
        when: { search: 'none' },
        points: 4,
        because: 'You said there is no search surface, so there is nothing to run.',
      },
      {
        when: { search: 'basic' },
        points: 3,
        because: 'Matching a name or title is an indexed query, not a search engine.',
      },
    ],
    breaksAt: 'The first time someone wants to search inside long content rather than match a title.',
  },
  {
    key: 'postgres-fts',
    layer: 'search',
    name: 'PostgreSQL full-text search',
    rules: [
      {
        when: { search: 'full-text' },
        whenChoice: { database: 'postgresql' },
        points: 4,
        because: 'You already run Postgres, and its full-text search covers this without a second system to operate.',
      },
      {
        when: { search: 'faceted' },
        whenChoice: { database: 'postgresql' },
        points: 1,
        because: 'Can be pushed into faceting, though this is the edge of what it does comfortably.',
      },
      {
        when: { userScale: 'large' },
        points: -1,
        because: 'Search load and transactional load end up competing for the same database.',
      },
    ],
    breaksAt:
      'Roughly a million rows, or the first serious faceted filter. Both are the moment to move search out.',
  },
  {
    key: 'sqlite-fts',
    layer: 'search',
    name: 'SQLite full-text search',
    rules: [
      {
        when: { search: 'full-text' },
        whenChoice: { database: 'sqlite' },
        points: 4,
        because: 'SQLite ships full-text search (FTS5) in the file you already have, so this costs you nothing to run.',
      },
      {
        when: { search: 'faceted' },
        whenChoice: { database: 'sqlite' },
        points: -1,
        because: 'Faceted filtering is past what FTS5 does comfortably.',
      },
    ],
    breaksAt: 'The same ceiling as SQLite itself. When the database moves, search moves with it.',
  },
  {
    key: 'meilisearch',
    layer: 'search',
    name: 'Meilisearch',
    rules: [
      {
        when: { search: 'faceted' },
        points: 4,
        because: 'Faceted filtering across many attributes is the thing it is built to do.',
      },
      {
        when: { search: 'full-text' },
        points: 2,
        because: 'Typo tolerance and relevance ranking that you would otherwise be hand-rolling.',
      },
      {
        // Gated on there actually being search to do. Traffic alone is not a
        // reason to run a search service.
        when: { userScale: ['growing', 'large'], search: ['full-text', 'faceted'] },
        points: 1,
        because: 'Keeps search traffic off the database entirely.',
      },
      {
        when: { team: 'solo' },
        points: -1,
        because: 'Still a second service to run, and its index has to be kept in step with your data.',
      },
    ],
    breaksAt: 'Index freshness. Every write now has a second place it needs to land.',
  },
  {
    key: 'elasticsearch',
    layer: 'search',
    name: 'Elasticsearch',
    rules: [
      {
        // Also gated: being large is not by itself a reason to run a cluster
        // when there is no search surface to point it at.
        when: { userScale: 'large', search: ['full-text', 'faceted'] },
        points: 3,
        because: 'At this volume the tuning and analysis controls start to be worth their weight.',
      },
      {
        when: { search: 'faceted' },
        points: 1,
        because: 'Aggregations handle faceting comfortably.',
      },
      {
        when: { team: 'solo' },
        points: -3,
        because: 'A cluster to operate, and operating it becomes a real part of your week.',
      },
      {
        when: { userScale: ['hobby', 'small'] },
        points: -3,
        because: 'Far more machinery than this amount of data justifies.',
      },
    ],
    breaksAt: 'Operational cost. It is the most capable option here and by far the most work to run.',
  },

  // ----------------------------------------------------------------- hosting
  {
    key: 'managed-platform',
    layer: 'hosting',
    name: 'Managed platform',
    rules: [
      {
        when: { hosting: 'managed' },
        // A stated preference outranks anything merely inferred. Weighted
        // above the highest total the other rules here can reach, so an
        // explicit answer is never reported back as a coin flip.
        points: 6,
        because: 'You said you would rather someone else ran the servers, and this is that.',
      },
      {
        when: { team: 'solo' },
        points: 2,
        because: 'No operations work competing with the time you have to build the thing.',
      },
      {
        when: { userScale: ['small', 'growing'] },
        points: 1,
        because: 'Scaling is a setting rather than a project at this size.',
      },
    ],
    breaksAt: 'Cost per unit of compute, which climbs faster than a server you rent yourself.',
  },
  {
    key: 'vps',
    layer: 'hosting',
    name: 'Your own server',
    rules: [
      {
        when: { hosting: 'self-hosted' },
        // A stated preference outranks anything merely inferred. Weighted
        // above the highest total the other rules here can reach, so an
        // explicit answer is never reported back as a coin flip.
        points: 6,
        because: 'You said you want to own the box, and this is the cheapest compute per unit.',
      },
      {
        when: { team: 'large' },
        points: 1,
        because: 'A large enough team can absorb the operations work that comes with it.',
      },
      {
        when: { team: 'solo' },
        points: -1,
        because: 'Patching, backups and uptime all become your job, permanently.',
      },
    ],
    breaksAt: 'You. Everything the platform would have done is now something you remember to do.',
  },
  {
    key: 'serverless',
    layer: 'hosting',
    name: 'Serverless',
    rules: [
      {
        when: { hosting: 'serverless' },
        // A stated preference outranks anything merely inferred. Weighted
        // above the highest total the other rules here can reach, so an
        // explicit answer is never reported back as a coin flip.
        points: 6,
        because: 'You said you want to pay per request and scale to zero between them.',
      },
      {
        when: { userScale: 'hobby' },
        points: 2,
        because: 'Traffic this low costs approximately nothing when idle time is free.',
      },
      {
        when: { readWrite: 'read-heavy' },
        points: 1,
        because: 'Read-mostly traffic parallelises across instances without coordination.',
      },
      {
        when: { consistency: 'strong' },
        points: -1,
        because: 'Connection pooling against a transactional database is the classic sharp edge here.',
      },
    ],
    breaksAt:
      'Long-running work and database connections. Both fight the execution model rather than fitting it.',
  },
];

export function candidatesForLayer(layer) {
  return CANDIDATES.filter((candidate) => candidate.layer === layer);
}

export function findCandidate(layer, key) {
  return CANDIDATES.find((candidate) => candidate.layer === layer && candidate.key === key) ?? null;
}
