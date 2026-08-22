import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';

export default function PasswordField({ label, hint, value, onChange, autoComplete, minLength, id }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        <button
          type="button"
          className="field__reveal"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeSlash size={15} weight="bold" /> : <Eye size={15} weight="bold" />}
        </button>
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}
