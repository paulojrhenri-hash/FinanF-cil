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

    // Log what we're sending (first 500 chars of user message)
    const userMsg = typeof messages[0]?.content === 'string' 
      ? messages[0].content.substring(0, 500)
      : 'PDF/binary content';
    console.log('Processing request, content preview:', userMsg);

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
      console.error('Anthropic error:', JSON.stringify(data));
      return res.status(response.status).json({
        error: data.error?.message || 'Erro na API do Claude'
      });
    }

    const result = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    console.log('Claude response (first 500 chars):', result.substring(0, 500));

    if (!result || result.trim().length === 0) {
      return res.status(500).json({ error: 'Resposta vazia da IA' });
    }

    // Aggressive JSON extraction
    let cleaned = result.trim();

    // Remove markdown fences
    cleaned = cleaned.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim();

    // Find outermost JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error('No JSON braces found in:', cleaned.substring(0, 300));
      return res.status(500).json({ 
        error: 'IA não retornou JSON. Resposta: ' + cleaned.substring(0, 200)
      });
    }

    cleaned = cleaned.slice(firstBrace, lastBrace + 1);

    // Try to parse
    try {
      JSON.parse(cleaned);
      console.log('JSON valid, returning result');
      return res.status(200).json({ result: cleaned });
    } catch(e) {
      console.error('JSON parse error:', e.message);
      console.error('Attempted to parse:', cleaned.substring(0, 500));
      return res.status(500).json({
        error: 'Formato inválido. Tente novamente com o mesmo arquivo.'
      });
    }

  } catch (err) {
    console.error('Server error:', err.message, err.stack);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
