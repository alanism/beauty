// /.netlify/functions/oai
// Use: set OPENAI_API_KEY in Netlify env vars. Frontend POSTs { model, prompt, images:[{name,mime,b64}] }.
// We call OpenAI Responses API and return { text }.
import fetch from 'node-fetch';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'Server missing OPENAI_API_KEY env var' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const model = body.model || 'gpt-5-thinking';
    const prompt = String(body.prompt || '');
    const images = Array.isArray(body.images) ? body.images : [];

    const content = [{ type: 'input_text', text: prompt }];
    for (const img of images) {
      if (!img || !img.b64) continue;
      const mime = img.mime || 'image/jpeg';
      content.push({ type: 'input_image', image_url: { url: `data:${mime};base64,${img.b64}` } });
    }

    const req = {
      model,
      input: [{ role: 'user', content }],
      temperature: 0.2
    };

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(req)
    });

    const text = await res.text();
    if (!res.ok) {
      return { statusCode: res.status, body: text };
    }

    let outText = '';
    try {
      const json = JSON.parse(text);
      const outs = Array.isArray(json.output) ? json.output : [];
      outText = outs.flatMap(o => Array.isArray(o.content) ? o.content : [])
                    .filter(c => c && c.type === 'output_text' && typeof c.text === 'string')
                    .map(c => c.text).join('\n').trim();
      if (!outText && typeof json.output_text === 'string') outText = json.output_text;
    } catch (e) {
      // If parsing fails, just return raw text
      outText = text;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: outText })
    };
  } catch (e) {
    return { statusCode: 400, body: String(e.message || e) };
  }
};
