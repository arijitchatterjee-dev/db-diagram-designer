import { useCallback, useMemo } from 'react';
import {
  recommendArchitecture,
  recommendConcerns,
  applyArchitectureOverrides,
  applyConcernOverrides,
  architectureFacts,
  toArchitectureRows,
  toConcernRows,
} from '../engine/recommend';
import { seedDecisions } from '../engine/decisions';
import { generateFolders, folderSignature } from '../engine/folders';

/**
 * Everything downstream of the answers on the architecture side.
 *
 * Both the plan document and the architecture page need this, and they need to
 * agree: the plan's architecture step and the architecture page are two views
 * of one derivation, so it lives in one place rather than being written twice
 * and drifting.
 */
export function usePlanArchitecture(plan, stack, hydrated) {
  const answers = plan?.answers ?? {};
  const stored = plan?.architecture ?? {};

  const facts = useMemo(
    () => architectureFacts({ moduleKeys: plan?.moduleKeys ?? [], answers }, stack),
    [plan?.moduleKeys, answers, stack]
  );

  const archOverrides = useMemo(() => {
    const out = {};
    for (const dimension of ['layering', 'topology']) {
      if (stored[dimension]?.overridden && stored[dimension]?.choice) {
        out[dimension] = stored[dimension].choice;
      }
    }
    return out;
  }, [stored]);

  const concernOverrides = useMemo(
    () =>
      Object.fromEntries(
        (stored.concerns ?? []).filter((c) => c.overridden && c.choice).map((c) => [c.key, c.choice])
      ),
    [stored.concerns]
  );

  // Notes are yours and no re-run may discard them, so they are carried
  // separately from anything the engine produces.
  const archNotes = useMemo(
    () => ({ layering: stored.layering?.note ?? '', topology: stored.topology?.note ?? '' }),
    [stored]
  );
  const concernNotes = useMemo(
    () => Object.fromEntries((stored.concerns ?? []).map((c) => [c.key, c.note ?? ''])),
    [stored.concerns]
  );

  const architecture = useMemo(
    () =>
      applyArchitectureOverrides(recommendArchitecture(answers, facts), archOverrides, answers, facts),
    [answers, facts, archOverrides]
  );
  const concerns = useMemo(
    () => applyConcernOverrides(recommendConcerns(answers, facts, architecture), concernOverrides),
    [answers, facts, architecture, concernOverrides]
  );

  /**
   * The whole derived architecture as one object, so a saved plan never holds
   * an architecture that disagrees with the answers behind it.
   */
  const build = useCallback(
    ({
      arch = archOverrides,
      con = concernOverrides,
      notes = archNotes,
      cNotes = concernNotes,
      decisions = stored.decisions ?? [],
    } = {}) => {
      const nextArch = applyArchitectureOverrides(
        recommendArchitecture(answers, facts),
        arch,
        answers,
        facts
      );
      const nextConcerns = applyConcernOverrides(
        recommendConcerns(answers, facts, nextArch),
        con
      );

      return {
        ...toArchitectureRows(nextArch, notes),
        concerns: toConcernRows(nextConcerns, cNotes),
        // Engine entries follow the decision they describe, so changing one
        // here updates its entry. Entries you wrote are passed through
        // untouched by `seedDecisions`.
        decisions: seedDecisions({ stack, architecture: nextArch, existing: decisions }),
      };
    },
    [answers, facts, stack, archOverrides, concernOverrides, archNotes, concernNotes, stored.decisions]
  );

  // What the tree would be generated from right now. When this stops matching
  // what it was generated from, the tree is stale and says so.
  const folderInputs = useMemo(
    () => ({
      stack,
      layering: architecture.layering?.undecided ? '' : architecture.layering?.choice ?? '',
      moduleKeys: plan?.moduleKeys ?? [],
      customModules: hydrated,
    }),
    [stack, architecture.layering, plan?.moduleKeys, hydrated]
  );
  const signature = useMemo(() => folderSignature(folderInputs), [folderInputs]);

  const buildFolders = useCallback(
    () => ({ generatedFrom: signature, tree: generateFolders(folderInputs) }),
    [signature, folderInputs]
  );

  return {
    facts,
    architecture,
    concerns,
    archOverrides,
    concernOverrides,
    archNotes,
    concernNotes,
    build,
    signature,
    buildFolders,
  };
}
