/**
 * Local warrant-control HTTP server.
 * Actions: grant | revoke | agentJwt | startRace
 *
 *   npm run control
 */
import http from 'node:http';
import { asAgent, describeError } from '../src/appwrite.mjs';
import { grant, revoke, mintAgentJwt } from '../src/control.mjs';
import { warrantLane, credentialLane } from '../src/lanes.mjs';

const PORT = Number(process.env.CONTROL_PORT || 8787);

/** In-flight races keyed by warrantId — dashboard can revoke while they run. */
const races = new Map();

async function handle(body) {
  const action = body?.action;

  if (action === 'grant') {
    return grant({
      budgetCents: body.budgetCents ?? 50_000,
      actionsLeft: body.actionsLeft ?? 40,
      label: body.label ?? 'demo',
    });
  }

  if (action === 'revoke') {
    if (!body.warrantId) throw Object.assign(new Error('warrantId required'), { code: 400 });
    return revoke(body.warrantId);
  }

  if (action === 'agentJwt') {
    return mintAgentJwt({ duration: body.duration ?? 900 });
  }

  if (action === 'startRace') {
    process.env.SCRIPTED = '1';
    const { warrantId } = await grant({
      budgetCents: body.budgetCents ?? 50_000,
      actionsLeft: body.actionsLeft ?? 40,
      label: body.label ?? `race ${new Date().toISOString()}`,
    });
    const { jwt } = await mintAgentJwt();
    // Default auto-revoke so the demo climax is not a long wait.
    const revokeAfterSec = Number(body.revokeAfterSec ?? 2.2);

    const running = (async () => {
      const warrantAgent = asAgent(jwt);
      const credentialAgent = asAgent(jwt);
      let revokeTimer;
      if (revokeAfterSec > 0) {
        revokeTimer = setTimeout(() => {
          revoke(warrantId).catch((err) => console.error('auto-revoke', describeError(err)));
        }, revokeAfterSec * 1000);
      }
      try {
        await Promise.all([
          warrantLane({ agent: warrantAgent, warrantId }),
          credentialLane({ agent: credentialAgent, warrantId }),
        ]);
      } finally {
        if (revokeTimer) clearTimeout(revokeTimer);
        races.delete(warrantId);
      }
    })();

    races.set(warrantId, { startedAt: Date.now() });
    // Don't await — return immediately so the UI can subscribe.
    running.catch((err) => console.error('race failed', describeError(err)));
    return { warrantId, mode: 'scripted' };
  }

  if (action === 'status') {
    return { races: [...races.keys()] };
  }

  throw Object.assign(new Error(`unknown action: ${action}`), { code: 400 });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'POST only' }));
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON' }));
    return;
  }

  try {
    const result = await handle(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const e = describeError(err);
    const code = typeof e.code === 'number' && e.code >= 400 && e.code < 600 ? e.code : 500;
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`warrant-control on http://127.0.0.1:${PORT}`);
  console.log('actions: grant | revoke | agentJwt | startRace | status');
});
