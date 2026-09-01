import ApiTable from '../plan/ApiTable';

export default function StepApis(props) {
  return (
    <div className="wstep">
      <header className="wstep__head">
        <h2>API surface</h2>
        <p>
          Derived from the modules you picked. Edit any row, or add the endpoints your
          product needs that no module implies.
        </p>
        <p className="wstep__count">{props.apis.length} endpoints</p>
      </header>

      <ApiTable {...props} />
    </div>
  );
}
