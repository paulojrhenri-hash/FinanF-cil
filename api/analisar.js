export default async function handler(req, res) {
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
        'Content-Type': 'application/json; charset=utf-8',
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
      return res.status(response.status).json({
        error: data.error?.message || 'Erro na API do Claude'
      });
    }

    let result = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!result || result.trim().length === 0) {
      return res.status(500).json({ error: 'Resposta vazia da IA' });
    }

    // Clean markdown fences
    result = result.trim();
    result = result.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim();

    // Extract JSON object
    const firstBrace = result.indexOf('{');
    const lastBrace = result.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return res.status(500).json({ error: 'IA não retornou JSON válido. Tente novamente.' });
    }

    result = result.slice(firstBrace, lastBrace + 1);

    // Fix common JSON issues with special characters
    // Replace unescaped control characters
    result = result.replace(/[\u0000-\u001F\u007F]/g, ' ');

    // Try to parse
    try {
      const parsed = JSON.parse(result);
      // Re-stringify to ensure clean UTF-8 JSON
      const clean = JSON.stringify(parsed);
      return res.status(200).json({ result: clean });
    } catch(e) {
      // Try fixing common issues
      try {
        // Fix trailing commas
        let fixed = result.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        // Fix unescaped newlines inside strings
        fixed = fixed.replace(/(?<=":.*)\n(?=.*")/g, '\\n');
        const parsed = JSON.parse(fixed);
        const clean = JSON.stringify(parsed);
        return res.status(200).json({ result: clean });
      } catch(e2) {
        console.error('JSON parse failed:', e2.message, result.substring(0, 300));
        return res.status(500).json({ error: 'Erro ao processar resposta. Tente novamente.' });
      }
    }

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
