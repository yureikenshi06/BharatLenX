// BharatLenX — Grok AI proxy
// Env var: GROK_API_KEY (set in Netlify → Site Settings → Environment Variables)

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' }
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) }

  // Support both GROK_API_KEY and GROQ_API_KEY (common typo in Netlify env)
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: 'GROK_API_KEY not set in Netlify environment variables. Get your key at console.x.ai' }),
    }
  }

  try {
    const { system, userMsg } = JSON.parse(event.body || '{}')
    if (!userMsg) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'No message provided' }) }

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
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
    if (!res.ok) throw new Error(data.error?.message || `xAI error ${res.status}: ${JSON.stringify(data)}`)

    const text = data.choices?.[0]?.message?.content || 'No response from Grok.'
    return { statusCode: 200, headers: cors, body: JSON.stringify({ text }) }

  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) }
  }
}
