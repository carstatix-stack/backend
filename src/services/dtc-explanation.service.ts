import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { ExplainDtcCodesInput } from '../schemas/dtc-explanation.schema.js';

const DISCLAIMER =
  'Informational only — not a diagnosis. Have a qualified mechanic inspect the vehicle.';

/** Bump when prompts change so cached generic answers are regenerated. */
const PROMPT_VERSION = 'p2-priority';

type ExplanationPayload = {
  code: string;
  laymanExplanation: string;
  whatToDo: string | null;
  cached: boolean;
};

type GeneratedExplanation = {
  laymanExplanation: string;
  whatToDo: string | null;
};

function isOpenAiConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

function cacheModelTag(): string {
  return `${env.OPENAI_MODEL}:${PROMPT_VERSION}`;
}

function isCurrentPromptCache(model: string | null | undefined): boolean {
  return Boolean(model && model.includes(PROMPT_VERSION));
}

function vehicleContext(vehicle?: ExplainDtcCodesInput['vehicle']): string | null {
  if (!vehicle) return null;
  const parts = [vehicle.year, vehicle.make, vehicle.model]
    .filter((part) => part != null && String(part).trim().length > 0)
    .map(String);
  return parts.length > 0 ? parts.join(' ') : null;
}

function buildSystemPrompt(): string {
  return [
    'You are an automotive diagnostic educator for car owners who are not mechanics.',
    'For each OBD-II DTC, explain that specific code — not a vague category summary.',
    'Name the subsystem involved (e.g. oxygen sensor circuit, ignition coil, EVAP purge valve).',
    'Describe what the ECU detected, what typically fails, and symptoms the driver may notice.',
    'Rank recommended actions by priority: Urgent (stop/limit driving or get checked ASAP), Soon (schedule service), Optional (monitor / DIY checks).',
    'Use plain English; define any technical term in the same sentence.',
    'Do not invent vehicle-specific parts unless year/make/model is provided.',
    'Never claim the car is safe or unsafe to drive — state urgency levels instead.',
    'Return strict JSON only.',
  ].join(' ');
}

function buildUserPrompt(
  codes: ExplainDtcCodesInput['codes'],
  vehicle?: ExplainDtcCodesInput['vehicle'],
): string {
  const vehicleLine = vehicleContext(vehicle);
  const codeLines = codes.map((entry) => {
    const status = entry.status ? ` (${entry.status})` : '';
    const title = entry.title ? ` — official title: ${entry.title}` : '';
    return `- ${entry.code}${status}${title}`;
  });

  return [
    'Explain each DTC for a non-mechanic car owner.',
    vehicleLine
      ? `Vehicle context: ${vehicleLine}`
      : 'Vehicle context: unknown (stay accurate to the SAE/generic meaning of the code).',
    '',
    'Codes:',
    ...codeLines,
    '',
    'For EACH code, fill:',
    '- laymanExplanation: 3–5 sentences. Cover (1) exact meaning of this code, (2) which system/component is involved, (3) what the computer saw go wrong, (4) likely symptoms, (5) why it matters.',
    '- whatToDo: prioritized action list as plain text using these labels on separate lines:',
    '  Urgent: ...',
    '  Soon: ...',
    '  Optional: ...',
    '  Skip a priority line only if it truly does not apply.',
    '',
    'Respond with JSON shaped exactly like:',
    '{',
    '  "explanations": {',
    '    "P0300": {',
    '      "laymanExplanation": "...",',
    '      "whatToDo": "Urgent: ...\\nSoon: ...\\nOptional: ..."',
    '    }',
    '  }',
    '}',
    'Include every code listed. Keys must match the code exactly (e.g. P0300).',
  ].join('\n');
}

async function callOpenAi(
  codes: ExplainDtcCodesInput['codes'],
  vehicle?: ExplainDtcCodesInput['vehicle'],
): Promise<Record<string, GeneratedExplanation>> {
  if (!isOpenAiConfigured()) {
    throw new AppError(
      503,
      'AI explanations are not configured on the server',
      'AI_NOT_CONFIGURED',
    );
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.35,
      max_tokens: Math.min(900 * codes.length + 200, 4000),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(codes, vehicle) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(
      502,
      `OpenAI request failed (${response.status}): ${body.slice(0, 200)}`,
      'AI_PROVIDER_ERROR',
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(502, 'OpenAI returned an empty response', 'AI_PROVIDER_ERROR');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(502, 'OpenAI returned invalid JSON', 'AI_PROVIDER_ERROR');
  }

  if (!parsed || typeof parsed !== 'object' || !('explanations' in parsed)) {
    throw new AppError(502, 'OpenAI JSON missing explanations', 'AI_PROVIDER_ERROR');
  }

  const explanations = (parsed as { explanations: unknown }).explanations;
  if (!explanations || typeof explanations !== 'object') {
    throw new AppError(502, 'OpenAI JSON missing explanations', 'AI_PROVIDER_ERROR');
  }

  const result: Record<string, GeneratedExplanation> = {};
  for (const entry of codes) {
    const raw = (explanations as Record<string, unknown>)[entry.code];
    if (!raw || typeof raw !== 'object') continue;

    const layman = (raw as { laymanExplanation?: unknown }).laymanExplanation;
    const whatToDo = (raw as { whatToDo?: unknown }).whatToDo;
    if (typeof layman !== 'string' || layman.trim().length === 0) continue;

    result[entry.code] = {
      laymanExplanation: layman.trim(),
      whatToDo:
        typeof whatToDo === 'string' && whatToDo.trim().length > 0
          ? whatToDo.trim()
          : null,
    };
  }

  if (Object.keys(result).length === 0) {
    throw new AppError(502, 'OpenAI did not explain any codes', 'AI_PROVIDER_ERROR');
  }

  return result;
}

async function cacheExplanation(code: string, generated: GeneratedExplanation) {
  const model = cacheModelTag();
  await prisma.dtcExplanation.upsert({
    where: { code },
    create: {
      code,
      laymanExplanation: generated.laymanExplanation,
      whatToDo: generated.whatToDo,
      model,
    },
    update: {
      laymanExplanation: generated.laymanExplanation,
      whatToDo: generated.whatToDo,
      model,
    },
  });
}

export async function explainDtcCodes(input: ExplainDtcCodesInput) {
  const uniqueCodes = new Map<string, ExplainDtcCodesInput['codes'][number]>();
  for (const entry of input.codes) {
    uniqueCodes.set(entry.code, entry);
  }
  const requested = [...uniqueCodes.values()];

  const cachedRows = await prisma.dtcExplanation.findMany({
    where: { code: { in: requested.map((entry) => entry.code) } },
  });
  const cachedByCode = new Map(
    cachedRows
      .filter((row) => isCurrentPromptCache(row.model))
      .map((row) => [row.code, row]),
  );

  const missing = requested.filter((entry) => !cachedByCode.has(entry.code));
  if (missing.length > 0) {
    const generated = await callOpenAi(missing, input.vehicle);
    for (const entry of missing) {
      const explanation = generated[entry.code];
      if (!explanation) continue;
      await cacheExplanation(entry.code, explanation);
      cachedByCode.set(entry.code, {
        code: entry.code,
        laymanExplanation: explanation.laymanExplanation,
        whatToDo: explanation.whatToDo,
        model: cacheModelTag(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const explanations: Record<string, ExplanationPayload> = {};
  const initiallyCached = new Set(
    cachedRows
      .filter((row) => isCurrentPromptCache(row.model))
      .map((row) => row.code),
  );

  for (const entry of requested) {
    const row = cachedByCode.get(entry.code);
    if (!row) continue;
    explanations[entry.code] = {
      code: entry.code,
      laymanExplanation: row.laymanExplanation,
      whatToDo: row.whatToDo,
      cached: initiallyCached.has(entry.code),
    };
  }

  return {
    explanations,
    disclaimer: DISCLAIMER,
    aiEnabled: isOpenAiConfigured(),
  };
}
