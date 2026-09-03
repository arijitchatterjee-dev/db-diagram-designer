import { Info } from '@phosphor-icons/react';
import StackLayer from '../plan/StackLayer';
import { LAYERING, TOPOLOGY } from '../../engine/architecture';

/**
 * Layering and topology in the wizard, with the same reasoning and the same
 * override control as everywhere else.
 *
 * Concerns, folders and the decision log are deliberately not here. The wizard
 * is a first pass; those need room to read and belong on the tab that has it.
 */
export default function StepArchitecture({ architecture, moduleCount, onOverride, onClearOverride }) {
  return (
    <div className="wstep">
      <header className="wstep__head">
        <h2>Architecture</h2>
        <p>
          How the code is organised, and how it ships. Reasoned from your team size, your
          scale and the {moduleCount} {moduleCount === 1 ? 'module' : 'modules'} you picked,
          so going back and changing those changes this.
        </p>
      </header>

      <StackLayer
        row={architecture.layering}
        label="Layering"
        dimension="layering"
        options={LAYERING}
        onOverride={onOverride}
        onClearOverride={onClearOverride}
      />

      <StackLayer
        row={architecture.topology}
        label="Topology"
        dimension="topology"
        options={TOPOLOGY}
        onOverride={onOverride}
        onClearOverride={onClearOverride}
      />

      <p className="wnotice">
        <Info size={14} weight="fill" />
        <span>
          The nine cross-cutting concerns, the folder structure and the decision log all
          follow from these two. They are on the Architecture tab once the plan exists.
        </span>
      </p>
    </div>
  );
}
