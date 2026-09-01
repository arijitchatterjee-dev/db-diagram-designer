import { modulesForPreset } from './modules.js';

/**
 * Starting points. A preset seeds the answers that are true of that kind of
 * product by definition (an ecommerce site does need strong consistency) and
 * ticks the modules that shape usually has.
 *
 * Everything a preset sets is a default, not a decision. Every answer and every
 * module stays yours to change afterwards, and overriding one is recorded.
 */
export const PRESET_DATA = {
  ecommerce: {
    // Money and stock are involved, and the entities are all references to
    // each other. Those two are not really up for debate here.
    defaultAnswers: {
      consistency: 'strong',
      dataShape: 'relational',
      readWrite: 'read-heavy',
      search: 'faceted',
    },
  },
  saas: {
    defaultAnswers: {
      consistency: 'strong',
      dataShape: 'relational',
      readWrite: 'balanced',
      search: 'basic',
    },
  },
  blog: {
    defaultAnswers: {
      consistency: 'eventual-ok',
      dataShape: 'mixed',
      readWrite: 'read-heavy',
      search: 'full-text',
    },
  },
  marketplace: {
    defaultAnswers: {
      consistency: 'strong',
      dataShape: 'relational',
      readWrite: 'read-heavy',
      search: 'faceted',
    },
  },
  custom: {
    defaultAnswers: {},
  },
};

export const PRESET_KEYS = Object.keys(PRESET_DATA);

export function defaultAnswersFor(presetKey) {
  return { ...(PRESET_DATA[presetKey]?.defaultAnswers ?? {}) };
}

export function suggestedModulesFor(presetKey) {
  return modulesForPreset(presetKey).map((module) => module.key);
}
