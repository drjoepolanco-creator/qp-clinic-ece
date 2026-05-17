export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcripcion, paciente, antecedentes } = req.body;
  if (!transcripcion) return res.status(400).json({ error: 'Transcripción requerida' });

  const prompt = `Eres un asistente médico clínico experto. Analiza el siguiente interrogatorio y genera una nota SOAP.

PACIENTE: ${paciente || 'No especificado'}
ANTECEDENTES: ${antecedentes || 'No especificados'}
INTERROGATORIO: "${transcripcion}"

Responde SOLO con JSON válido sin backticks:
{"subjetivo":"...","exploracion_sugerida":"...","diagnosticos":[{"cie10":"CÓDIGO","nombre":"Nombre CIE-10","descripcion":"justificación","probabilidad":"alta"}],"tratamiento":"...","laboratorios":"...","gabinete":"...","plan":"..."}

Incluye 3-5 diagnósticos diferenciales con código CIE-10 correcto.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Error API' });
    const text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
