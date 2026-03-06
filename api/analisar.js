export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key não configurada' });

  try {
    const { system, messages } = req.body;
    if (!system || !messages) return res.status(400).json({ error: 'Dados incompletos' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        temperature: 0,
        system,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Erro na API do Claude'
      });
    }

    // Extract text from response
    const result = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!result) {
      console.error('Empty response from Claude:', data);
      return res.status(500).json({ error: 'Resposta vazia da IA' });
    }

    // Clean and extract JSON
    let cleaned = result.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '').trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }

    // Validate JSON
    try {
      JSON.parse(cleaned);
    } catch(e) {
      console.error('Invalid JSON:', cleaned.substring(0, 300));
      return res.status(500).json({ error: 'IA retornou formato inválido, tente novamente' });
    }

    return res.status(200).json({ result: cleaned });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
