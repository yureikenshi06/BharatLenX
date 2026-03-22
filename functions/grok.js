// BharatLenX — Grok AI proxy (Cloudflare Pages Function)
// Cloudflare Pages Functions use Web API Request/Response — NOT express/netlify format
// Env vars are accessed via context.env.GROK_API_KEY (set in CF Pages dashboard)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

export async function onRequestPost(context) {
  const apiKey = context.env.GROK_API_KEY || context.env.GROQ_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GROK_API_KEY not configured in Cloudflare Pages environment variables.' }), { status: 400, headers: CORS })
  }

  try {
    const { system, userMsg } = await context.request.json()
    if (!userMsg) return new Response(JSON.stringify({ error: 'No message provided' }), { status: 400, headers: CORS })

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'grok-3',
        max_tokens:  2500,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system || 'You are an expert Indian stock market F&O trading coach.' },
          { role: 'user',   content: userMsg },
        ],
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `xAI error ${res.status}`)

    const text = data.choices?.[0]?.message?.content || 'No response from Grok.'
    return new Response(JSON.stringify({ text }), { status: 200, headers: CORS })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS })
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS })
}
