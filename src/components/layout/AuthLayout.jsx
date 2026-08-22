import { Database } from '@phosphor-icons/react';

const POINTS = [
  ['Write DBML', 'Tables, columns and relationships as plain text.'],
  ['See it instantly', 'The diagram redraws as you type, and remembers where you put things.'],
  ['Kept to yourself', 'Every project is scoped to your account. Nobody else can open it.'],
];

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="brand brand--lg">
          <span className="brand__mark">
            <Database size={17} weight="fill" />
          </span>
          <span className="brand__text">Schema Designer</span>
        </div>

        <p className="auth__pitch">Design a database schema in text. Read it as a diagram.</p>

        <dl className="auth__points">
          {POINTS.map(([term, detail]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <main className="auth__main">
        <div className="auth__card">
          <h1 className="auth__title">{title}</h1>
          <p className="auth__sub">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
