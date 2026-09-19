type GatewayContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_file'; filename: string; file_data: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' };

function gatewayToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
}

function extractText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content)
      : [];
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
    }
  }
  return '';
}

export function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/i, '').trim();
  try { return JSON.parse(cleaned) as Record<string, unknown>; } catch {}
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
  throw new Error('AI response was not valid JSON');
}

export async function gatewayJson({
  prompt,
  file,
  filename,
  mediaType,
  feature,
  userId,
}: {
  prompt: string;
  file?: Uint8Array;
  filename?: string;
  mediaType?: string;
  feature: string;
  userId: string;
}) {
  const token = gatewayToken();
  if (!token) throw new Error('AI Gateway is not configured');

  const content: GatewayContent[] = [{ type: 'input_text', text: prompt }];
  if (file && filename && mediaType) {
    const base64 = Buffer.from(file).toString('base64');
    if (mediaType === 'application/pdf') {
      content.push({
        type: 'input_file',
        filename,
        file_data: `data:application/pdf;base64,${base64}`,
      });
    } else if (mediaType.startsWith('image/')) {
      content.push({
        type: 'input_image',
        image_url: `data:${mediaType};base64,${base64}`,
        detail: 'auto',
      });
    } else {
      throw new Error('Only PDF and image extraction are supported');
    }
  }

  const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.STUDYOS_AI_MODEL || 'openai/gpt-5.6-sol',
      input: [{ type: 'message', role: 'user', content }],
      metadata: { feature, user: userId },
    }),
  });

  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === 'object' && payload.error
      ? JSON.stringify(payload.error)
      : JSON.stringify(payload);
    throw new Error(`AI Gateway request failed: ${message}`);
  }

  return parseJsonObject(extractText(payload));
}
