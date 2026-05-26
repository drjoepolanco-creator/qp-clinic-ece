module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nota } = req.body;
  if (!nota || !nota.trim()) return res.status(400).json({ error: 'Nota requerida' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Eres un médico experto en codificación CIE-10. Analiza la nota médica y propón los diagnósticos más probables.

Responde ÚNICAMENTE con JSON válido sin texto adicional ni backticks:
{"diagnosticos":[{"codigo":"M54.5","nombre":"Lumbago no especificado","certeza":"Principal"}]}

Incluye 1-5 diagnósticos. Certeza: Principal, Secundario, o Diferencial.

NOTA MÉDICA:
${nota}`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Error API' });

    const text = data.content[0].text.trim();
    const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ diagnosticos: [] });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json({ diagnosticos: parsed.diagnosticos || [] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
