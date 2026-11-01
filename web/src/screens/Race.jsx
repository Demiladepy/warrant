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

function errorCode(err) {
  if (!err) return null;
  const m = String(err).match(/\b(401|400|409)\b/);
  if (m) return m[1];
  if (String(err).includes('user_unauthorized')) return '401';
  if (String(err).includes('column_limit_exceeded')) return '400';
  if (String(err).includes('row_already_exists')) return '409';
  return null;
}

export default function Race({ warrantId, onWarrantId, onGoto }) {
  const [actions, setActions] = useState([]);
  const [warrant, setWarrant] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [removed, setRemoved] = useState(null);
  const [running, setRunning] = useState(false);
  const [revokeClickAt, setRevokeClickAt] = useState(null);
  const [permissionRemovedAt, setPermissionRemovedAt] = useState(null);
  const debounceRef = useRef(null);
  const listRefs = useRef({ credential: null, warrant: null });

  async function refresh(id) {
    if (!id) return;
    const [w, a] = await Promise.all([getWarrant(id), listActions(id)]);
    setWarrant(w);
    setActions(a.rows ?? []);
    if (w?.status === 'revoked') {
      setRunning(false);
      if (w.revokedAt) setPermissionRemovedAt((prev) => prev || w.revokedAt);
    }
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
    setRevokeClickAt(null);
    setPermissionRemovedAt(null);
    try {
      const started = await control('startRace', {
        budgetCents: 50_000,
        label: 'dashboard race',
        revokeAfterSec: 2.2,
      });
      const id = started.warrantId;
      onWarrantId(id);
      await refresh(id);
      control(
        'runRace',
        {
          warrantId: id,
          revokeAfterSec: started.next?.revokeAfterSec ?? 2.2,
        },
        { background: true },
      ).catch((e) => setError(e.message));
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
    const clickAt = new Date().toISOString();
    setRevokeClickAt(clickAt);
    try {
      const res = await control('revoke', { warrantId });
      setRemoved(res.removed);
      setPermissionRemovedAt(res.revokedAt || new Date().toISOString());
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

  const firstRejectedAfter = useMemo(() => {
    if (!revokedAt) return null;
    return (
      lanes.warrant.find(
        (a) => a.outcome === 'rejected' && a.$createdAt > revokedAt && a.error?.includes('user_unauthorized'),
      ) || lanes.warrant.find((a) => a.outcome === 'rejected' && a.$createdAt > revokedAt) || null
    );
  }, [lanes, revokedAt]);

  const msPermission =
    revokeClickAt && permissionRemovedAt
      ? Math.max(0, new Date(permissionRemovedAt) - new Date(revokeClickAt))
      : null;
  const msReject =
    permissionRemovedAt && firstRejectedAfter
      ? Math.max(0, new Date(firstRejectedAfter.$createdAt) - new Date(permissionRemovedAt))
      : null;

  // Guided steps: 1 grant/start → 2 watch (running or has actions) → 3 revoke done
  const step = !warrantId ? 1 : warrant?.status === 'revoked' ? 3 : running || lanes.credential.length + lanes.warrant.length > 0 ? 2 : 1;

  return (
    <section className="race">
      <header className="race-top">
        <div className="race-identity">
          <p className="brand">Warrant</p>
          <p className="tagline">
            Your agent&apos;s leash should be a row.
            <span className="mode-tag">scripted</span>
          </p>
        </div>
      </header>

      {error && <p className="banner error">{error}</p>}

      <div className="guide" aria-label="Demo steps">
        <div className={`guide-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
          <span className="guide-n">1 · Grant</span>
          <p className="guide-copy">Give the agent a $200 warrant.</p>
          <button
            type="button"
            className={`btn ${step === 1 ? 'primary' : 'quiet'}`}
            disabled={busy || running}
            onClick={start}
          >
            {busy && !warrantId ? 'Starting…' : running ? 'Racing…' : 'Run demo'}
          </button>
        </div>
        <div className={`guide-step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>
          <span className="guide-n">2 · Watch</span>
          <p className="guide-copy">Both agents shop the same way.</p>
          <button type="button" className={`btn ${step === 2 ? 'primary' : 'quiet'}`} disabled>
            {running ? 'Live…' : warrantId ? 'Feeds below' : 'Waiting'}
          </button>
        </div>
        <div className={`guide-step ${step === 3 ? 'active' : ''}`}>
          <span className="guide-n">3 · Revoke</span>
          <p className="guide-copy">Now take it back.</p>
          <button
            type="button"
            className={`btn ${step >= 2 && warrant?.status !== 'revoked' ? 'danger' : 'quiet'}`}
            disabled={busy || !warrantId || warrant?.status === 'revoked'}
            onClick={doRevoke}
          >
            {warrant?.status === 'revoked' ? 'Revoked' : 'Revoke now'}
          </button>
        </div>
      </div>

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

      {(msPermission !== null || msReject !== null) && (
        <div className="timings" aria-live="polite">
          {msPermission !== null && (
            <span>
              click → permission removed: <strong>{msPermission} ms</strong>
            </span>
          )}
          {msReject !== null && (
            <span>
              permission removed → first rejected write: <strong>{msReject} ms</strong>
            </span>
          )}
        </div>
      )}

      {warrant && (
        <div className={`slip inline ${warrant.status === 'revoked' ? 'revoked' : ''}`}>
          <div>
            <p className="slip-title">{warrant.label || 'Permission slip'}</p>
            <p className="slip-serial">serial · {warrantId}</p>
            <p className="slip-budget">
              ${(warrant.budgetCents / 100).toFixed(2)}
              <span> / ${(warrant.budgetStartCents / 100).toFixed(2)}</span>
            </p>
            <div className="meter" aria-hidden>
              <div style={{ width: `${budgetPct}%` }} />
            </div>
            <ul className="slip-meta">
              <li>actions left {warrant.actionsLeft}</li>
              <li>vendors {(warrant.vendors || []).join(', ')}</li>
              <li>expires {warrant.expiresAt}</li>
              {revokedAt && (
                <li className="struck-inline">
                  removed{' '}
                  <span className="struck">
                    {(removed || ['update("user:agent_02")']).join(', ')}
                  </span>
                </li>
              )}
            </ul>
          </div>
          <div className="slip-stamp" aria-label={warrant.status}>
            {warrant.status === 'revoked' ? 'REVOKED' : 'ACTIVE'}
          </div>
        </div>
      )}

      {!warrantId && (
        <div className="empty-race">
          <p>
            Press <strong>Run demo</strong> in step 1. Revoke fires automatically ~2s in — or hit{' '}
            <strong>Revoke now</strong>.
          </p>
          <div className="empty-lanes">
            <div className="empty-lane">Credential feed</div>
            <div className="empty-lane">Warrant feed</div>
          </div>
        </div>
      )}

      {warrantId && (
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
                {lanes[lane].length === 0 && (
                  <li className="empty-lane" style={{ minHeight: 120, margin: 8 }}>
                    Waiting for purchases…
                  </li>
                )}
                {lanes[lane].map((a, idx) => {
                  const after = revokedAt && a.$createdAt > revokedAt;
                  const firstAfter =
                    after && !lanes[lane].slice(0, idx).some((x) => x.$createdAt > revokedAt);
                  const isLeak = lane === 'credential' && after && a.outcome === 'committed';
                  const isBounce =
                    lane === 'warrant' &&
                    after &&
                    a.outcome === 'rejected' &&
                    (firstAfter || a.error?.includes('user_unauthorized'));
                  const code = errorCode(a.error);
                  return (
                    <li key={a.$id}>
                      {firstAfter && <div className="revoke-line">REVOKED</div>}
                      <button
                        type="button"
                        className={`action-row outcome-${a.outcome} ${selected?.$id === a.$id ? 'selected' : ''} ${isLeak ? 'leak' : ''} ${isBounce ? 'bounce' : ''}`}
                        onClick={() => setSelected(a)}
                      >
                        <span className="dot" aria-hidden />
                        <span className="tool">{a.vendor || a.tool}</span>
                        <span className="amt">${(a.amountCents / 100).toFixed(2)}</span>
                        <span className="out">{a.outcome}</span>
                        {isBounce && (
                          <span className="reject-stamp">
                            Rejected by Appwrite
                            {a.error ? ` · ${a.error}` : code ? ` · ${code}` : ''}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div className="race-footer">
        <button
          type="button"
          className="btn primary"
          onClick={() => onGoto('receipt')}
          disabled={!warrantId || warrant?.status !== 'revoked'}
        >
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
            <h3>X-ray · TablesDB</h3>
            <button type="button" className="btn ghost tiny" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <dl>
            <div>
              <dt>call</dt>
              <dd>
                <code>
                  {selected.tool === 'purchase'
                    ? 'decrementRowColumn({ column: "budgetCents", value: amount, min: 0 })'
                    : selected.tool}
                </code>
                {selected.vendor ? ` · ${selected.vendor}` : ''}
                {selected.item ? ` · ${selected.item}` : ''}
              </dd>
            </div>
            <div>
              <dt>rowId</dt>
              <dd>
                <code>{selected.$id}</code>
              </dd>
            </div>
            <div>
              <dt>amount</dt>
              <dd>${(selected.amountCents / 100).toFixed(2)}</dd>
            </div>
            <div>
              <dt>response</dt>
              <dd className={`outcome-${selected.outcome}`}>
                {selected.outcome}
                {selected.error ? (
                  <>
                    {' '}
                    · <code>{selected.error}</code>
                    {errorCode(selected.error) ? ` (${errorCode(selected.error)})` : ''}
                  </>
                ) : (
                  ' · ok'
                )}
              </dd>
            </div>
            <div>
              <dt>$permissions</dt>
              <dd>
                {selected.outcome === 'rejected' && selected.error?.includes('user_unauthorized') ? (
                  <>
                    <code>read("any")</code>
                    <br />
                    <code>update("user:grantor_01")</code>
                    <br />
                    <code className="struck">update(&quot;user:agent_02&quot;)</code>
                  </>
                ) : (
                  <>
                    <code>read("any")</code>
                    <br />
                    <code>update("user:grantor_01")</code>
                    <br />
                    <code>update(&quot;user:agent_02&quot;)</code>
                  </>
                )}
              </dd>
            </div>
          </dl>
          <p className="xray-note">
            The agent never checks a kill switch. Appwrite accepts or rejects the write from the row&apos;s
            permissions alone.
          </p>
        </aside>
      )}
    </section>
  );
}
