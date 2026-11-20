/* PDFify AI helper - Cloudflare Worker (FREE plan: Workers AI gives 10,000 free "neurons" per day).
   No API key is needed: the "AI" binding is added in the Cloudflare dashboard (see CLOUDFLARE-SETUP.txt). */
const ALLOWED = ['https://pdfify.online', 'https://www.pdfify.online'];
const MAX_CHARS = 4000;            // per request, protects your free daily quota
const LANGS = ['en','ur','ar','hi','fr','de','es','tr','zh','ru','pt','it','fa','bn','id'];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const okOrigin = ALLOWED.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : ALLOWED[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return out({ error: 'POST only' }, 405);
    if (!okOrigin) return out({ error: 'Not allowed' }, 403);

    let b; try { b = await req.json(); } catch { return out({ error: 'Bad request' }, 400); }
    const text = String(b.text || '').trim();
    if (!text) return out({ error: 'No text' }, 400);
    if (text.length > MAX_CHARS) return out({ error: 'Text too long' }, 413);
    const path = new URL(req.url).pathname;

    try {
      if (path === '/translate') {
        const target = String(b.target || '');
        const source = String(b.source || 'en');
        if (!LANGS.includes(target) || !LANGS.includes(source)) return out({ error: 'Language not supported' }, 400);
        const r = await env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang: source, target_lang: target });
        return out({ text: r.translated_text || '' });
      }
      if (path === '/summarize') {
        const r = await env.AI.run('@cf/facebook/bart-large-cnn', { input_text: text, max_length: 200 });
        return out({ text: r.summary || '' });
      }
      return out({ error: 'Not found' }, 404);
    } catch (e) {
      return out({ error: 'AI service busy or free limit reached. Try again later.' }, 503);
    }
  },
};
