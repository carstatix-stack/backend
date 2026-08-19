import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { ExplainDtcCodesInput } from '../schemas/dtc-explanation.schema.js';

const DISCLAIMER =
  'Informational only — not a diagnosis. Have a qualified mechanic inspect the vehicle.';

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

function vehicleContext(vehicle?: ExplainDtcCodesInput['vehicle']): string | null {
  if (!vehicle) return null;
  const parts = [vehicle.year, vehicle.make, vehicle.model]
    .filter((part) => part != null && String(part).trim().length > 0)
    .map(String);
  return parts.length > 0 ? parts.join(' ') : null;
}

function buildSystemPrompt(): string {
  return [
    'You explain OBD-II diagnostic trouble codes (DTCs) to non-mechanics.',
    'Use plain English. Avoid jargon unless you immediately define it.',
    'Do not invent vehicle-specific details unless provided.',
    'Never claim the car is safe or unsafe to drive — suggest professional inspection when appropriate.',
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
    const title = entry.title ? ` — ${entry.title}` : '';
    return `- ${entry.code}${status}${title}`;
  });

  return [
    'Explain each DTC below for a car owner who is not a mechanic.',
    vehicleLine ? `Vehicle context: ${vehicleLine}` : 'Vehicle context: unknown (keep explanations generic).',
    '',
    'Codes:',
    ...codeLines,
    '',
    'Respond with JSON shaped exactly like:',
    '{',
    '  "explanations": {',
    '    "P0300": {',
    '      "laymanExplanation": "2-4 short sentences: what it means, common symptoms, general severity.",',
    '      "whatToDo": "1-2 sentences: practical next step for the owner."',
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
      temperature: 0.3,
      max_tokens: 120 * codes.length + 120,
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
  await prisma.dtcExplanation.upsert({
    where: { code },
    create: {
      code,
      laymanExplanation: generated.laymanExplanation,
      whatToDo: generated.whatToDo,
      model: env.OPENAI_MODEL,
    },
    update: {
      laymanExplanation: generated.laymanExplanation,
      whatToDo: generated.whatToDo,
      model: env.OPENAI_MODEL,
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
  const cachedByCode = new Map(cachedRows.map((row) => [row.code, row]));

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
        model: env.OPENAI_MODEL,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const explanations: Record<string, ExplanationPayload> = {};
  const initiallyCached = new Set(cachedRows.map((row) => row.code));

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
