import { useEffect, useMemo, useRef, useState } from 'react';
import { control, getWarrant, listActions, subscribeRace } from '../appwrite';

function afterRevokeCount(actions, lane, revokedAt) {
  if (!revokedAt) return 0;
  return actions.filter(
    (a) =>
      a.lane === lane &&
      a.tool === 'purchase' &&
      a.outcome === 'committed' &&
      a.$createdAt > revokedAt,
  ).length;
}

function purchasesOnly(actions) {
  return actions.filter((a) => a.tool === 'purchase');
}

export default function Race({ warrantId, onWarrantId, onGoto }) {
  const [actions, setActions] = useState([]);
  const [warrant, setWarrant] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [removed, setRemoved] = useState(null);
  const [running, setRunning] = useState(false);
  const debounceRef = useRef(null);
  const listRefs = useRef({ credential: null, warrant: null });

  async function refresh(id) {
    if (!id) return;
    const [w, a] = await Promise.all([getWarrant(id), listActions(id)]);
    setWarrant(w);
    setActions(a.rows ?? []);
    if (w?.status === 'revoked') setRunning(false);
  }

  function scheduleRefresh(id) {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refresh(id).catch(() => {});
    }, 180);
  }

  useEffect(() => {
    if (!warrantId) return;
    refresh(warrantId).catch((e) => setError(e.message));
    let sub;
    subscribeRace((event) => {
      const row = event.payload;
      if (!row) return;
      if (row.warrantId === warrantId || row.$id === warrantId) {
        scheduleRefresh(warrantId);
      }
    })
      .then((s) => {
        sub = s;
      })
      .catch((e) => setError(`Realtime: ${e.message}`));
    return () => {
      clearTimeout(debounceRef.current);
      sub?.unsubscribe?.();
    };
  }, [warrantId]);

  const lanes = useMemo(() => {
    const split = { warrant: [], credential: [] };
    for (const a of purchasesOnly(actions)) {
      if (split[a.lane]) split[a.lane].push(a);
    }
    return split;
  }, [actions]);

  useEffect(() => {
    for (const lane of ['credential', 'warrant']) {
      const el = listRefs.current[lane];
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [lanes]);

  async function start() {
    setBusy(true);
    setError(null);
    setRemoved(null);
    setSelected(null);
    setRunning(true);
    try {
      // Auto-revoke mid-stream so the 4-vs-0 beat happens without waiting.
      const { warrantId: id } = await control('startRace', {
        budgetCents: 50_000,
        label: 'dashboard race',
        revokeAfterSec: 2.2,
      });
      onWarrantId(id);
      await refresh(id);
    } catch (e) {
      setError(e.message);
      setRunning(false);
    } finally {
      setBusy(false);
    }
  }

  async function doRevoke() {
    if (!warrantId) return;
    setBusy(true);
    try {
      const res = await control('revoke', { warrantId });
      setRemoved(res.removed);
      await refresh(warrantId);
      onWarrantId(warrantId);
      setRunning(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const revokedAt = warrant?.revokedAt || null;
  const warrantAfter = afterRevokeCount(actions, 'warrant', revokedAt);
  const credentialAfter = afterRevokeCount(actions, 'credential', revokedAt);
  const budgetPct = warrant?.budgetStartCents
    ? Math.max(0, Math.min(100, Math.round((warrant.budgetCents / warrant.budgetStartCents) * 100)))
    : 0;

  return (
    <section className="race">
      <header className="race-top">
        <div className="race-identity">
          <p className="brand">Warrant</p>
          <p className="tagline">Your agent&apos;s leash should be a row.</p>
        </div>
        <div className="race-controls">
          <button type="button" className="btn primary" disabled={busy} onClick={start}>
            {busy && !warrantId ? 'Starting…' : running ? 'Racing…' : 'Run demo'}
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={busy || !warrantId || warrant?.status === 'revoked'}
            onClick={doRevoke}
          >
            Revoke now
          </button>
        </div>
      </header>

      <p className="lede">
        Same task. Credential lane caches authority once. Warrant lane asks the row every time.
        <span className="mode-tag">scripted</span>
      </p>

      {error && <p className="banner error">{error}</p>}

      <div className={`scoreboard ${revokedAt ? 'live' : ''}`}>
        <div className="score credential">
          <span className="score-label">Credential after revoke</span>
          <span className="score-num climb">{credentialAfter}</span>
          <span className="score-hint">keeps buying</span>
        </div>
        <div className="score-vs">vs</div>
        <div className="score warrant">
          <span className="score-label">Warrant after revoke</span>
          <span className="score-num zero">{warrantAfter}</span>
          <span className="score-hint">database rejects</span>
        </div>
      </div>

      {warrant && (
        <div className="warrant-strip">
          <div className="strip-meta">
            <span className={`status-pill ${warrant.status}`}>{warrant.status}</span>
            <code className="wid">{warrantId}</code>
            {revokedAt && (
              <span className="struck-inline">
                removed <span className="struck">{(removed || ['update("user:agent_02")']).join(', ')}</span>
              </span>
            )}
          </div>
          <div className="budget-row">
            <span>
              ${(warrant.budgetCents / 100).toFixed(2)}
              <small> / ${(warrant.budgetStartCents / 100).toFixed(2)}</small>
            </span>
            <div className="meter">
              <div style={{ width: `${budgetPct}%` }} />
            </div>
          </div>
        </div>
      )}

      {!warrantId && (
        <div className="empty-race">
          <p>Press <strong>Run demo</strong>. Revoke fires automatically ~2s in — or hit Revoke now.</p>
        </div>
      )}

      <div className="lanes">
        {['credential', 'warrant'].map((lane) => (
          <div key={lane} className={`lane lane-${lane}`}>
            <div className="lane-head">
              <h2>{lane === 'credential' ? 'Credential' : 'Warrant'}</h2>
              <span className="lane-count">{lanes[lane].length} buys</span>
            </div>
            <ol
              className="action-list"
              ref={(el) => {
                listRefs.current[lane] = el;
              }}
            >
              {lanes[lane].map((a, idx) => {
                const firstAfter =
                  revokedAt &&
                  a.$createdAt > revokedAt &&
                  !lanes[lane].slice(0, idx).some((x) => x.$createdAt > revokedAt);
                return (
                  <li key={a.$id}>
                    {firstAfter && <div className="revoke-line">revoke</div>}
                    <button
                      type="button"
                      className={`action-row outcome-${a.outcome} ${selected?.$id === a.$id ? 'selected' : ''}`}
                      onClick={() => setSelected(a)}
                    >
                      <span className="dot" aria-hidden />
                      <span className="tool">{a.vendor || a.tool}</span>
                      <span className="amt">${(a.amountCents / 100).toFixed(2)}</span>
                      <span className="out">{a.outcome}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      <div className="race-footer">
        <button type="button" className="btn ghost" onClick={() => onGoto('receipt')} disabled={!warrantId}>
          Receipt
        </button>
        <button type="button" className="btn ghost" onClick={() => onGoto('jar')}>
          Jar
        </button>
        <button type="button" className="btn ghost" onClick={() => onGoto('grant')} disabled={!warrantId}>
          Slip
        </button>
      </div>

      {selected && (
        <aside className="xray">
          <div className="xray-head">
            <h3>X-ray</h3>
            <button type="button" className="btn ghost tiny" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <dl>
            <div>
              <dt>call</dt>
              <dd>
                {selected.tool}
                {selected.vendor ? ` · ${selected.vendor}` : ''}
                {selected.item ? ` · ${selected.item}` : ''}
              </dd>
            </div>
            <div>
              <dt>amount</dt>
              <dd>${(selected.amountCents / 100).toFixed(2)}</dd>
            </div>
            <div>
              <dt>outcome</dt>
              <dd className={`outcome-${selected.outcome}`}>{selected.outcome}</dd>
            </div>
            <div>
              <dt>Appwrite</dt>
              <dd>
                <code>{selected.error || '—'}</code>
              </dd>
            </div>
            <div>
              <dt>permission</dt>
              <dd>
                {selected.outcome === 'rejected' && selected.error?.includes('user_unauthorized') ? (
                  <span className="struck">update(&quot;user:agent_02&quot;)</span>
                ) : (
                  <code>update(&quot;user:agent_02&quot;)</code>
                )}
              </dd>
            </div>
          </dl>
        </aside>
      )}
    </section>
  );
}
