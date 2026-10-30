/**
 * Runs both lanes concurrently against one warrant.
 *
 *   SCRIPTED=1 npm run race              # fixed sequence, no LLM key
 *   npm run race -- --revoke-after=8     # revoke ~8s into the run
 *
 * Mid-run revoke: warrant lane's next purchase comes back rejected with a real
 * Appwrite error; credential lane keeps committing.
 */
import { asAgent, describeError } from '../src/appwrite.mjs';
import { grant, revoke, mintAgentJwt } from '../src/control.mjs';
import { warrantLane, credentialLane } from '../src/lanes.mjs';
import { scriptedMode } from '../src/agent/llm.mjs';

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function stamp(lane, entry) {
  const outcome = entry.result?.outcome ?? '?';
  const err = entry.result?.error
    ? ` ${entry.result.error.code ?? ''} ${entry.result.error.type ?? entry.result.error.message ?? ''}`.trim()
    : '';
  const amount =
    entry.name === 'purchase' ? ` $${(Number(entry.args.amountCents) / 100).toFixed(2)}` : '';
  console.log(
    `[${lane}] ${entry.name}${amount} → ${outcome}${err ? ` (${err})` : ''}${entry.note ? `  # ${entry.note}` : ''}`,
  );
}

async function main() {
  const revokeAfterSec = Number(arg('revoke-after', '0'));
  const budgetCents = Number(arg('budget', '50000'));
  const mode = scriptedMode() ? 'scripted' : 'live';

  console.log(`\nWarrant race  mode=${mode}  budget=$${(budgetCents / 100).toFixed(2)}`);
  if (revokeAfterSec > 0) console.log(`Will revoke after ${revokeAfterSec}s\n`);
  else console.log('(pass --revoke-after=N to revoke mid-run)\n');

  const { warrantId } = await grant({
    budgetCents,
    actionsLeft: 40,
    label: `race ${new Date().toISOString()}`,
  });
  console.log(`warrant ${warrantId}`);

  const { jwt } = await mintAgentJwt();
  // Two clients, same JWT — each lane writes as agent_02.
  const warrantAgent = asAgent(jwt);
  const credentialAgent = asAgent(jwt);

  let revoked = false;
  let revokeTimer;
  if (revokeAfterSec > 0) {
    revokeTimer = setTimeout(async () => {
      try {
        const { removed, revokedAt } = await revoke(warrantId);
        revoked = true;
        console.log(`\n*** REVOKE ${revokedAt} removed ${removed.join(', ')} ***\n`);
      } catch (err) {
        console.error('revoke failed', describeError(err));
      }
    }, revokeAfterSec * 1000);
  }

  const [warrantResult, credentialResult] = await Promise.all([
    warrantLane({
      agent: warrantAgent,
      warrantId,
      onEvent: (e) => stamp('warrant   ', e),
    }),
    credentialLane({
      agent: credentialAgent,
      warrantId,
      onEvent: (e) => stamp('credential', e),
    }),
  ]);

  if (revokeTimer) clearTimeout(revokeTimer);

  const count = (result, lane, outcome) =>
    result.log.filter((e) => e.name === 'purchase' && e.result?.outcome === outcome).length;

  console.log('\n--- totals (purchases) ---');
  console.log(
    `warrant     committed=${count(warrantResult, 'warrant', 'committed')}  rejected=${count(warrantResult, 'warrant', 'rejected')}`,
  );
  console.log(
    `credential  committed=${count(credentialResult, 'credential', 'committed')}  rejected=${count(credentialResult, 'credential', 'rejected')}`,
  );
  console.log(`revoked mid-run: ${revoked}`);
  console.log(`warrantId: ${warrantId}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('\nRace crashed:', describeError(err));
  process.exit(1);
});
