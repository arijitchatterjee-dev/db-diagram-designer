/**
 * How the code is organised, and how it is deployed.
 *
 * Same rule shape as `catalog.js`, with one addition: architecture depends on
 * the plan and not only on the answers, so a rule can also read derived
 * facts (`whenFact`) and decisions already taken (`whenChoice`).
 *
 *   when:       answer key -> value, or an array of accepted values
 *   whenFact:   fact -> value, or { min, max } for a number
 *   whenChoice: an already-decided layer or `layering`
 */

export const ARCHITECTURE_ORDER = ['layering', 'topology'];

export const LAYERING = [
  {
    key: 'mvc',
    name: 'MVC',
    summary: 'Controllers, models, and that is mostly it.',
    rules: [
      {
        when: { team: 'solo' },
        points: 2,
        because: 'One person, one convention. Controllers and models is as much structure as this needs.',
      },
      {
        when: { userScale: 'hobby' },
        points: 2,
        because: 'The smallest arrangement that still separates handling a request from storing the data.',
      },
      {
        // `min: 1` matters: with nothing selected, "few modules" is not true,
        // it is unknown, and an unknown must not score.
        whenFact: { moduleCount: { min: 1, max: 4 } },
        points: 2,
        because: 'Few enough features that two flat folders stay readable.',
      },
      {
        whenFact: { moduleCount: { min: 10 } },
        points: -3,
        because: 'Ten features flattened into one controllers folder stops being navigable.',
      },
      {
        when: { team: 'large' },
        points: -2,
        because: 'Gives a large team almost nothing to agree on, so everyone invents their own arrangement.',
      },
    ],
    breaksAt:
      'The controllers folder. Past a handful of features everything lives in two directories and nothing says which file belongs with which.',
  },
  {
    key: 'layered',
    name: 'Layered',
    summary: 'Routes, controllers, services, repositories.',
    rules: [
      {
        when: { team: ['solo', 'small'] },
        points: 3,
        because: 'Everyone already knows this shape, which is most of what a convention has to do.',
      },
      {
        whenFact: { moduleCount: { min: 4, max: 12 } },
        points: 2,
        because: 'Enough features to want a service layer, few enough that horizontal folders still work.',
      },
      {
        when: { consistency: 'strong' },
        points: 1,
        because: 'A service layer is where a transaction spanning two tables belongs.',
      },
      {
        whenFact: { moduleCount: { min: 16 } },
        points: -2,
        because: 'At this many features every folder holds sixteen files and none of them are related.',
      },
    ],
    breaksAt:
      'Feature count. Every new feature touches four folders, and all four keep growing.',
  },
  {
    key: 'modular',
    name: 'Feature modules',
    summary: 'Each feature owns its own folder, top to bottom.',
    rules: [
      {
        whenFact: { moduleCount: { min: 8 } },
        points: 3,
        because: 'A feature becomes one folder rather than four scattered files.',
      },
      {
        when: { team: 'large' },
        points: 3,
        because: 'Two people on two features stop editing the same directories.',
      },
      {
        when: { team: 'small' },
        points: 1,
        because: 'Keeps a feature reviewable as one unit without much ceremony.',
      },
      {
        whenFact: { moduleCount: { max: 3 } },
        points: -2,
        because: 'Not enough features for the extra nesting to buy anything.',
      },
      {
        when: { userScale: 'hobby' },
        points: -1,
        because: 'More structure than a personal project usually repays.',
      },
    ],
    breaksAt:
      'Shared code. The first time two modules need the same helper you need a rule for where it lives, and every project answers that differently.',
  },
  {
    key: 'hexagonal',
    name: 'Ports and adapters',
    summary: 'The domain sits in the middle and knows nothing about the outside.',
    rules: [
      {
        when: { consistency: 'strong' },
        points: 2,
        because: 'A domain that has to stay correct is worth isolating from the things around it.',
      },
      {
        whenFact: { hasPayments: true },
        points: 2,
        because: 'Payment providers get swapped, and an adapter is what keeps that a contained change.',
      },
      {
        when: { team: 'large' },
        points: 1,
        because: 'The boundaries are explicit enough to hold with many hands in the code.',
      },
      {
        when: { team: 'solo' },
        points: -3,
        because: 'A lot of indirection to maintain when there is nobody to be consistent with.',
      },
      {
        when: { userScale: 'hobby' },
        points: -3,
        because: 'The architecture would be larger than the thing it holds.',
      },
    ],
    breaksAt:
      'Ceremony. Every trivial read passes through a port, an adapter and a use case before it reaches a row.',
  },
  {
    key: 'clean',
    name: 'Clean architecture',
    summary: 'Entities, use cases, adapters, frameworks, in rings.',
    rules: [
      {
        when: { team: 'large' },
        points: 2,
        because: 'Prescribes where everything goes, which is worth most when many people are deciding.',
      },
      {
        when: { userScale: 'large' },
        points: 2,
        because: 'The surface area is big enough that the dependency rule earns its keep.',
      },
      {
        whenFact: { moduleCount: { min: 12 } },
        points: 1,
        because: 'Enough use cases that grouping them as their own layer is meaningful.',
      },
      {
        when: { team: 'solo' },
        points: -4,
        because: 'Four rings of indirection to maintain alone, for a codebase only you read.',
      },
      {
        when: { userScale: 'hobby' },
        points: -4,
        because: 'Far more architecture than this amount of behaviour justifies.',
      },
    ],
    breaksAt:
      'Its own rules. It is a discipline, and it degrades badly when only half the team follows it.',
  },
];

export const TOPOLOGY = [
  {
    key: 'monolith',
    name: 'One deployable',
    summary: 'Everything ships together.',
    rules: [
      {
        when: { team: 'solo' },
        points: 4,
        because: 'One thing to deploy, one thing to debug, one log to read.',
      },
      {
        when: { userScale: ['hobby', 'small'] },
        points: 3,
        because: 'At this traffic a single process has enormous headroom left.',
      },
      {
        when: { team: 'small' },
        points: 2,
        because: 'Few enough people that coordinating one release is easier than operating several.',
      },
      {
        when: { userScale: 'growing' },
        points: 1,
        because: 'Still comfortably within what one deployable handles, given a machine to scale.',
      },
      {
        when: { userScale: 'large' },
        points: -1,
        because: 'At this size shipping everything at once starts to be the thing that slows releases.',
      },
    ],
    breaksAt:
      'Deploy coupling. Every change ships everything, which matters once several people release on different schedules.',
  },
  {
    key: 'modular-monolith',
    name: 'Modular monolith',
    summary: 'One deployable, but the modules cannot reach into each other.',
    rules: [
      {
        whenFact: { moduleCount: { min: 8 } },
        points: 3,
        because: 'Enough features that boundaries between them are worth enforcing in code.',
      },
      {
        when: { team: 'large' },
        points: 2,
        because: 'Gives a large team ownership boundaries without putting a network between them.',
      },
      {
        when: { userScale: 'growing' },
        points: 2,
        because: 'Keeps the option of splitting something out later without paying for it now.',
      },
      {
        whenChoice: { layering: 'modular' },
        points: 2,
        because: 'The code is already organised by feature, so the deployment shape matches it.',
      },
      {
        when: { userScale: 'hobby' },
        points: -2,
        because: 'Boundaries to maintain around features a single person can hold in their head.',
      },
    ],
    breaksAt:
      'Discipline. The boundaries are conventions, and nothing at runtime stops a determined import from crossing one.',
  },
  {
    key: 'services',
    name: 'Separate services',
    summary: 'Independent deployables that talk over the network.',
    rules: [
      {
        // Both, not either. This is the whole gate, and it is weighted to be
        // reachable at the extreme without ever outscoring the negatives that
        // apply to a smaller team.
        when: { team: 'large', userScale: 'large' },
        points: 6,
        because: 'Enough people and enough traffic that independent deploys are worth the operational cost.',
      },
      {
        whenFact: { moduleCount: { min: 15 } },
        points: 1,
        because: 'A surface this wide is hard to reason about as one deployable.',
      },
      {
        when: { team: 'solo' },
        points: -8,
        because: 'One person operating several services spends their time on operations instead of on the product.',
      },
      {
        when: { team: 'small' },
        points: -4,
        because: 'A small team gets all of the operational cost and almost none of the independence.',
      },
      {
        when: { userScale: ['hobby', 'small'] },
        points: -5,
        because: 'Splitting a service that is not under load buys nothing and costs a distributed system.',
      },
    ],
    breaksAt:
      'Everything at once: deploys, tracing, data consistency across services, and running the whole thing on a laptop.',
  },
  {
    key: 'serverless',
    name: 'Functions',
    summary: 'Per-request compute that scales to zero.',
    rules: [
      {
        when: { hosting: 'serverless' },
        points: 5,
        because: 'You said you want to pay per request, and this is the shape that does.',
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
      {
        whenFact: { hasRealtime: true },
        points: -3,
        because: 'Live connections and functions that scale to zero want opposite things.',
      },
    ],
    breaksAt:
      'Long-running work and anything that holds a connection open. Both fight the execution model rather than fitting it.',
  },
];

export function candidatesFor(dimension) {
  return dimension === 'layering' ? LAYERING : TOPOLOGY;
}

export function findArchitecture(dimension, key) {
  return candidatesFor(dimension).find((candidate) => candidate.key === key) ?? null;
}
