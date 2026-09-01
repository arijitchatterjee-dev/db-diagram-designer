import StackLayer from '../plan/StackLayer';

export default function StepStack({ stack, onOverride, onClearOverride }) {
  const decided = stack.filter((row) => !row.undecided);

  return (
    <div className="wstep">
      <header className="wstep__head">
        <h2>Recommended stack</h2>
        <p>
          Each reason below is a rule that matched your answers, not a summary written
          after the fact. Disagree with any of them and pick something else.
        </p>
        <p className="wstep__count">
          {decided.length} of {stack.length} layers decided
        </p>
      </header>

      {stack.map((row) => (
        <StackLayer
          key={row.layer}
          row={row}
          onOverride={onOverride}
          onClearOverride={onClearOverride}
        />
      ))}
    </div>
  );
}
