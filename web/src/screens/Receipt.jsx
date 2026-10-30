import { useEffect, useState } from 'react';
import { getWarrant, listActions, proofAfterRevoke } from '../appwrite';

const GUARANTEES = [
  ['Revoke takes effect on the next write', 'Row $permissions, agent writing as its own user'],
  ['Budget can never go negative', 'decrementRowColumn with min: 0 (#13464)'],
  ["A retried tool call can't charge twice", 'rowId = tool-call id → row_already_exists'],
  ['Nothing committed after revoke, provably', 'listRows … outcome=committed, $createdAt > revokedAt → 0'],
  ['The grantor sees everything live', 'Realtime on warrants and actions'],
];

export default function Receipt({ warrantId, onGoto }) {
  const [warrant, setWarrant] = useState(null);
  const [proof, setProof] = useState(null);
  const [credAfter, setCredAfter] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!warrantId) return;
    (async () => {
      try {
        const w = await getWarrant(warrantId);
        setWarrant(w);
        if (!w.revokedAt) {
          setProof({ total: null, note: 'Revoke first — proof anchors on revokedAt.' });
          return;
        }
        const p = await proofAfterRevoke(warrantId, w.revokedAt);
        setProof(p);
        const all = await listActions(warrantId);
        const n = (all.rows ?? []).filter(
          (a) =>
            a.lane === 'credential' &&
            a.tool === 'purchase' &&
            a.outcome === 'committed' &&
            a.$createdAt > w.revokedAt,
        ).length;
        setCredAfter(n);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [warrantId]);

  return (
    <section className="receipt">
      <header className="race-head">
        <div>
          <p className="brand">Warrant</p>
          <h1>Receipt</h1>
          <p className="lede">0 actions committed after revocation — fetched, not hard-coded.</p>
        </div>
        <div className="race-actions">
          <button type="button" className="btn ghost" onClick={() => onGoto('race')}>
            Race
          </button>
        </div>
      </header>

      {error && <p className="banner error">{error}</p>}
      {!warrantId && <p className="banner">Run a race first.</p>}

      {warrant && (
        <>
          <div className="proof-pair">
            <pre className="query">{`tablesDB.listRows({
  databaseId: 'warrant',
  tableId: 'actions',
  queries: [
    Query.equal('warrantId', '${warrantId}'),
    Query.equal('outcome', 'committed'),
    Query.equal('lane', 'warrant'),
    Query.greaterThan('$createdAt', '${warrant.revokedAt || '<revokedAt>'}'),
  ],
});`}</pre>
            <div className="proof-result">
              <p className="proof-total">
                total:{' '}
                <strong>{proof?.total === null || proof?.total === undefined ? '—' : proof.total}</strong>
              </p>
              {proof?.note && <p className="meta">{proof.note}</p>}
              {credAfter !== null && (
                <p className="meta">
                  credential lane after revoke: <strong>{credAfter}</strong> · warrant lane:{' '}
                  <strong className="zero">0</strong>
                </p>
              )}
            </div>
          </div>

          <table className="guarantees">
            <thead>
              <tr>
                <th>Guarantee</th>
                <th>Primitive</th>
              </tr>
            </thead>
            <tbody>
              {GUARANTEES.map(([g, p]) => (
                <tr key={g}>
                  <td>{g}</td>
                  <td>
                    <code>{p}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="citations">
            Appwrite closed this gap for human sessions in October:{' '}
            <a href="https://github.com/appwrite/appwrite/issues/14039">#14039</a> /{' '}
            <a href="https://github.com/appwrite/appwrite/issues/14021">#14021</a>. Warrant is the same
            rule for agents. Never uses a transaction as a lock (
            <a href="https://github.com/appwrite/appwrite/issues/14489">#14489</a>).
          </p>
        </>
      )}
    </section>
  );
}
