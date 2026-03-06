export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada no servidor' });
  }

  const { system, messages, isPDF } = req.body;

  if (!messages || !system) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
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

    const result = (data.content || []).map(b => b.text || '').join('');
    return res.status(200).json({ result });

  } catch (err) {
    console.error('Erro no servidor:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
