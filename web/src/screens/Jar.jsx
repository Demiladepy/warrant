/**
 * Jar numbers come from handoff/MEASURED.md — never invent.
 * Measured 2026-10-30 against fra.cloud.appwrite.io.
 */
const MEASURED = {
  date: '2026-10-30',
  jar: { committed: 5, rejected: 15, spent: '$50.00' },
  naive: { charged: 20, spent: '$200.00', overspend: '$150.00' },
  floorError: '400 column_limit_exceeded',
};

export default function Jar({ onGoto }) {
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
          <button type="button" className="btn ghost" onClick={() => onGoto('race')}>
            Race
          </button>
        </div>
      </header>

      <div className="jar-grid">
        <div className="jar-card">
          <h2>decrementRowColumn · min: 0</h2>
          <p className="jar-stat">
            <strong>{MEASURED.jar.committed}</strong> committed · <strong>{MEASURED.jar.rejected}</strong>{' '}
            rejected
          </p>
          <p className="jar-stat">
            exactly <strong>{MEASURED.jar.spent}</strong> spent · budget floor 0
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
          <p className="meta">Measured {MEASURED.date} via npm run prove · claim D</p>
        </div>
      </div>
    </section>
  );
}
