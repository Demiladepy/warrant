/**
 * Model adapter. SCRIPTED=1 replays a fixed tool-call sequence — no API key,
 * deterministic timing for recording. Live mode uses OPENAI_API_KEY when set.
 */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_catalog',
      description: 'Read a vendor catalog by vendor id.',
      parameters: {
        type: 'object',
        properties: { vendor: { type: 'string' } },
        required: ['vendor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'purchase',
      description: 'Buy one item from a vendor for amountCents.',
      parameters: {
        type: 'object',
        properties: {
          vendor: { type: 'string' },
          item: { type: 'string' },
          amountCents: { type: 'integer' },
        },
        required: ['vendor', 'item', 'amountCents'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'End the purchasing loop with a short summary.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
    },
  },
];

/** Fixed demo script — tight timing so the revoke beat lands in ~3–4s. */
const SCRIPTED_STEPS = [
  { name: 'read_catalog', args: { vendor: 'northwind' }, delayMs: 80 },
  {
    name: 'purchase',
    args: { vendor: 'northwind', item: 'USB-C dock, 8-port', amountCents: 4200 },
    delayMs: 120,
  },
  { name: 'read_catalog', args: { vendor: 'brightline' }, delayMs: 80 },
  {
    name: 'purchase',
    args: { vendor: 'brightline', item: '40 × BL-DOCK-8', amountCents: 152_000 },
    delayMs: 160,
    note: 'injected overspend',
  },
  // Post-injection stream — short gaps so after-revoke counters move live.
  ...Array.from({ length: 6 }, (_, i) => ({
    name: 'purchase',
    args: {
      vendor: 'cobalt',
      item: 'Headset, wired',
      amountCents: 3100,
    },
    delayMs: 380,
    note: `stream ${i + 1}`,
  })),
  {
    name: 'finish',
    args: { summary: 'Purchases complete.' },
    delayMs: 60,
  },
];

function scriptedMode() {
  return process.env.SCRIPTED === '1' || process.env.SCRIPTED === 'true' || !process.env.OPENAI_API_KEY;
}

/**
 * One model step. Returns { toolCallId, name, args, note? } or { done: true }.
 * `stepIndex` is owned by the caller so scripted mode advances deterministically.
 */
export async function nextStep({ messages, stepIndex = 0 }) {
  if (scriptedMode()) {
    const step = SCRIPTED_STEPS[stepIndex];
    if (!step) return { done: true };
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
    return {
      toolCallId: `call_script_${stepIndex}_${step.name}`,
      name: step.name,
      args: step.args,
      note: step.note,
      nextIndex: stepIndex + 1,
      scripted: true,
    };
  }

  const key = process.env.OPENAI_API_KEY;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const call = msg?.tool_calls?.[0];
  if (!call) {
    return { done: true, content: msg?.content ?? '' };
  }
  let args = {};
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    args = {};
  }
  return {
    toolCallId: call.id,
    name: call.function.name,
    args,
    nextIndex: stepIndex + 1,
    scripted: false,
    assistantMessage: msg,
  };
}

export { TOOLS, SCRIPTED_STEPS, scriptedMode };
