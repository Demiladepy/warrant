import { useEffect, useState } from 'react';
import { getWarrant } from '../appwrite';

export default function Grant({ warrantId, onGoto }) {
  const [warrant, setWarrant] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!warrantId) {
      setWarrant(null);
      return;
    }
    getWarrant(warrantId)
      .then(setWarrant)
      .catch((e) => setError(e.message));
  }, [warrantId]);

  if (!warrantId) {
    return (
      <section className="grant">
        <p className="brand">Warrant</p>
        <p className="lede">Start a race to mint a warrant row.</p>
        <button type="button" className="btn primary" onClick={() => onGoto('race')}>
          Go to race
        </button>
      </section>
    );
  }

  if (error) return <p className="banner error">{error}</p>;
  if (!warrant) return <p className="meta">Loading slip…</p>;

  const pct = warrant.budgetStartCents
    ? Math.round((warrant.budgetCents / warrant.budgetStartCents) * 100)
    : 0;

  return (
    <section className="grant">
      <header className="race-head">
        <div>
          <p className="brand">Warrant</p>
          <p className="lede">It doesn&apos;t get a key. It gets a row.</p>
        </div>
        <button type="button" className="btn ghost" onClick={() => onGoto('race')}>
          Race
        </button>
      </header>
      <div className="slip">
        <h1>{warrant.label}</h1>
        <p className="slip-budget">
          ${(warrant.budgetCents / 100).toFixed(2)}
          <span> / ${(warrant.budgetStartCents / 100).toFixed(2)}</span>
        </p>
        <div className="meter">
          <div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
        <ul>
          <li>actions left {warrant.actionsLeft}</li>
          <li>vendors {(warrant.vendors || []).join(', ')}</li>
          <li>status {warrant.status}</li>
          <li>expires {warrant.expiresAt}</li>
        </ul>
      </div>
      <aside className="raw">
        <h2>$permissions</h2>
        <ul>
          {(warrant.$permissions || []).map((p) => (
            <li key={p}>
              <code className={warrant.status === 'revoked' && p.includes('agent_02') ? 'struck' : ''}>
                {p}
              </code>
            </li>
          ))}
          {warrant.status === 'revoked' &&
            !(warrant.$permissions || []).some((p) => p.includes('agent_02')) && (
              <li>
                <code className="struck">update(&quot;user:agent_02&quot;)</code> removed
              </li>
            )}
        </ul>
      </aside>
    </section>
  );
}
