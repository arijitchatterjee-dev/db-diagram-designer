import { useState } from 'react';
import { CircleNotch, FileArrowUp, WarningCircle } from '@phosphor-icons/react';
import { IMPORT_SOURCES, importSql } from '../../utils/dbmlExport';

/**
 * Turns pasted DDL into DBML. Deliberately explicit about replacing what's in
 * the editor — the conversion is one-way, and the current schema would be gone.
 */
export default function ImportDialog({ hasExistingSchema, onCancel, onImported }) {
  const [sql, setSql] = useState('');
  const [source, setSource] = useState(IMPORT_SOURCES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleImport() {
    setBusy(true);
    setError(null);
    const result = await importSql(sql, source);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onImported(result.dbml);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Import SQL">
      <div className="dialog dialog--wide">
        <span className="dialog__icon dialog__icon--neutral">
          <FileArrowUp size={17} weight="bold" />
        </span>

        <h2 className="dialog__title">Import SQL</h2>
        <p className="dialog__body">
          Paste a <code>CREATE TABLE</code> script and it becomes DBML.
          {hasExistingSchema && ' This replaces everything currently in the editor.'}
        </p>

        <div className="field">
          <label htmlFor="import-source">Dialect</label>
          <select
            id="import-source"
            className="select"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {IMPORT_SOURCES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="import-sql">SQL</label>
          <textarea
            id="import-sql"
            className="textarea"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder={'CREATE TABLE "users" (\n  "id" serial PRIMARY KEY\n);'}
            spellCheck={false}
            rows={10}
          />
        </div>

        {error && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {error}
          </p>
        )}

        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleImport}
            disabled={busy || !sql.trim()}
          >
            {busy && <CircleNotch size={14} weight="bold" className="spin" />}
            {hasExistingSchema ? 'Replace schema' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
