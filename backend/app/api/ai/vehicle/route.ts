import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { FileDoc } from '@/lib/models';
import { bad, body, handler, HttpError, isId, notFound } from '@/lib/http';
import { storageDir } from '@/lib/registry';
import { BODY_TYPES } from '@/lib/engine/vehicles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/** Tells the UI which AI features are configured. */
export const GET = handler(async () => ({
  vision: !!process.env.ANTHROPIC_API_KEY,
  model3d: !!process.env.MESHY_API_KEY,
}));

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isVehicle', 'make', 'model', 'yearRange', 'bodyType', 'paintColorHex', 'paintColorName', 'finish', 'wheelColor', 'existingTint', 'view', 'windows', 'confidence', 'notes'],
  properties: {
    isVehicle: { type: 'boolean' },
    make: { type: 'string' },
    model: { type: 'string' },
    yearRange: { type: 'string' },
    bodyType: { type: 'string', enum: BODY_TYPES.map((b) => b.key) },
    paintColorHex: { type: 'string' },
    paintColorName: { type: 'string' },
    finish: { type: 'string', enum: ['gloss', 'metallic', 'pearl', 'matte'] },
    wheelColor: { type: 'string', enum: ['silver', 'black', 'gunmetal', 'bronze', 'chrome'] },
    existingTint: {
      type: 'object',
      additionalProperties: false,
      required: ['present', 'estimatedVlt', 'factoryPrivacyRear'],
      properties: { present: { type: 'boolean' }, estimatedVlt: { type: 'number' }, factoryPrivacyRear: { type: 'boolean' } },
    },
    view: { type: 'string', enum: ['front', 'rear', 'side', 'front_three_quarter', 'rear_three_quarter', 'unknown'] },
    windows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'zone', 'polygon'],
        properties: {
          label: { type: 'string' },
          zone: { type: 'string', enum: ['windscreen', 'frontSides', 'rearSides', 'rearWindscreen', 'sunroof'] },
          polygon: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
        },
      },
    },
    confidence: { type: 'number' },
    notes: { type: 'string' },
  },
} as const;

const PROMPT = `You are the vehicle-intake assistant for a window-tinting shop. Look at the photo and describe the vehicle so a 3D configurator can rebuild it.

Return:
- isVehicle: false if the photo does not show a car, ute, SUV or van (then fill the other fields with your best neutral defaults and an empty windows list).
- make, model, yearRange (e.g. "2019–2023"); use "Unknown" when you cannot tell.
- bodyType: the closest of ${BODY_TYPES.map((b) => `${b.key} (${b.label})`).join(', ')}.
- paintColorHex: the main body paint colour as #rrggbb, sampled from a mid-tone area of the body (not reflections or shadows); paintColorName in plain words.
- finish and wheelColor.
- existingTint: whether the side/rear glass already has film, an estimated VLT % (0–100, use 80 for clear glass), and whether the rear glass looks like factory privacy glass.
- view: the camera angle.
- windows: every visible window as a polygon of 4–8 [x, y] points in normalised image coordinates (0–1, origin top-left), tracing the glass edge. Label each (e.g. "Front left door") and give its zone.
- confidence 0–1 and short notes (e.g. aftermarket parts, damage, glare that hides the glass).`;

export const POST = handler(async (req: NextRequest) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(501, 'AI photo analysis is not configured. Add ANTHROPIC_API_KEY to backend/.env.local to enable it.');
  const { fileId } = await body<{ fileId?: string }>(req);
  if (!isId(fileId)) throw bad('Upload a photo first');
  const doc = await FileDoc.findById(fileId).lean<any>();
  if (!doc?.diskName) throw notFound('Photo not found');
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(doc.mime)) throw bad('Use a JPG, PNG or WebP photo');
  const data = await fs.readFile(path.join(storageDir(), 'uploads', path.basename(doc.diskName)));
  if (data.length > 5 * 1024 * 1024) throw bad('Photo is larger than 5 MB — resize it and try again');

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: doc.mime, data: data.toString('base64') } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(502, 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.');
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'AI is busy right now — try again in a moment.');
    if (err instanceof Anthropic.BadRequestError) throw new HttpError(502, `AI request rejected: ${err.message}`);
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `AI service error (${err.status ?? 'network'})`);
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new HttpError(422, 'The AI declined to analyse this photo. Try a different picture.');
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    throw new HttpError(502, 'The AI returned an unreadable answer. Try again.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(result.paintColorHex || '')) result.paintColorHex = '#9aa3ad';
  result.windows = (result.windows || []).filter((w: any) => Array.isArray(w.polygon) && w.polygon.length >= 3);
  return { ...result, model_used: response.model };
});
