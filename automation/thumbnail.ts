// Makes a reel thumbnail with OpenAI's Image API: Claude's prompt plus a
// reference photo of the presenter, cropped to a 1080x1920 cover.

import { spawnSync } from 'node:child_process';
import { openAsBlob, writeFileSync } from 'node:fs';
import { THUMB_REQUEST_SIZE } from '../src/data/aiEdit';

const API = 'https://api.openai.com/v1/images';
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-sunburst';

export class ImageApiError extends Error {}

interface ImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string; code?: string };
}

function friendly(status: number, body: ImageResponse): string {
  const msg = body.error?.message ?? '';
  if (status === 401) return 'OpenAI rejected the API key. Check the OPENAI_API_KEY secret.';
  if (status === 429) return 'OpenAI rate limit or spending limit reached. Check your OpenAI billing, then try again.';
  if (body.error?.code === 'moderation_blocked' || /safety|moderation/i.test(msg)) {
    return 'OpenAI’s safety filter blocked this thumbnail. Try again with notes that change the idea.';
  }
  return `OpenAI couldn’t make the image (${status}).`;
}

/** Ask the image model for one image. With a reference photo it uses the edits endpoint. */
export async function generateImage(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  referencePath?: string;
}): Promise<Buffer> {
  let res: Response;
  if (opts.referencePath) {
    const form = new FormData();
    form.set('model', opts.model);
    form.set('prompt', opts.prompt);
    form.set('size', THUMB_REQUEST_SIZE);
    form.set('quality', 'high');
    form.set('n', '1');
    form.append('image[]', await openAsBlob(opts.referencePath, { type: 'image/png' }), 'reference.png');
    res = await fetch(`${API}/edits`, { method: 'POST', headers: { Authorization: `Bearer ${opts.apiKey}` }, body: form });
  } else {
    res = await fetch(`${API}/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: opts.model, prompt: opts.prompt, size: THUMB_REQUEST_SIZE, quality: 'high', n: 1 }),
    });
  }
  const body = (await res.json().catch(() => ({}))) as ImageResponse;
  const b64 = body.data?.[0]?.b64_json;
  if (!res.ok || !b64) throw new ImageApiError(friendly(res.status, body));
  return Buffer.from(b64, 'base64');
}

/** Scale and centre-crop any image to a 1080x1920 PNG cover. */
export function cropToCover(image: Buffer, workPath: string, outPath: string): void {
  writeFileSync(workPath, image);
  const r = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', workPath,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-frames:v', '1', outPath,
  ]);
  if (r.status !== 0) throw new ImageApiError('Couldn’t crop the thumbnail to 1080x1920.');
}
