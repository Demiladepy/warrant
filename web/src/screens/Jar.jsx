import { useState } from 'react';
import { control } from '../appwrite';

/**
 * Baseline numbers from handoff/MEASURED.md (2026-10-30).
 * Live jar button re-runs the race against Appwrite when control is available.
 */
const MEASURED = {
  date: '2026-10-30',
  jar: { committed: 5, rejected: 15, spent: '$50.00' },
  naive: { charged: 20, spent: '$200.00', overspend: '$150.00' },
  floorError: '400 column_limit_exceeded',
};

export default function Jar({ onGoto }) {
  const [live, setLive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function runLive() {
    setBusy(true);
    setError(null);
    try {
      const res = await control('jar');
      setLive(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const committed = live?.committed ?? MEASURED.jar.committed;
  const rejected = live?.rejected ?? MEASURED.jar.rejected;
  const spent =
    live != null
      ? `$${((live.committed * 10) ).toFixed(2)}`
      : MEASURED.jar.spent;

  return (
    <section className="jar">
      <header className="race-head">
        <div>
          <p className="brand">Warrant</p>
          <h1>The jar</h1>
          <p className="lede">
            Twenty parallel $10 spends on a $50 warrant. The floor is the database, not the agent.
          </p>
        </div>
        <div className="race-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={runLive}>
            {busy ? 'Firing 20…' : 'Run live jar'}
          </button>
          <button type="button" className="btn ghost" onClick={() => onGoto('race')}>
            Race
          </button>
        </div>
      </header>

      {error && <p className="banner error">{error}</p>}
      {live && (
        <p className="meta">
          Live just now · warrant <code>{live.warrantId}</code> · budgetCents {live.budgetCents}
        </p>
      )}
      {!live && <p className="meta">Showing measured baseline until you run live ({MEASURED.date}).</p>}

      <div className="jar-grid">
        <div className="jar-card">
          <h2>decrementRowColumn · min: 0</h2>
          <p className="jar-stat">
            <strong>{committed}</strong> committed · <strong>{rejected}</strong> rejected
          </p>
          <p className="jar-stat">
            exactly <strong>{spent}</strong> spent · budget floor 0
          </p>
          <p className="meta">
            error: <code>{MEASURED.floorError}</code>
          </p>
        </div>
        <div className="jar-card naive">
          <h2>Naive read-then-write (measured)</h2>
          <p className="jar-stat">
            {MEASURED.naive.charged} of 20 charged → <strong>{MEASURED.naive.spent}</strong>
          </p>
          <p className="jar-stat">
            overspend <strong>{MEASURED.naive.overspend}</strong>
          </p>
          <p className="meta">Measured {MEASURED.date} via npm run prove · claim D — never invented</p>
        </div>
      </div>
    </section>
  );
}
