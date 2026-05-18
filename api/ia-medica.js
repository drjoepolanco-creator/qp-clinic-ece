export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcripcion, paciente, antecedentes } = req.body;
  if (!transcripcion) return res.status(400).json({ error: 'Transcripcion requerida' });

  const prompt = `Eres un asistente medico experto. Analiza este interrogatorio y genera una nota SOAP. Responde SOLO con JSON valido sin backticks: {"subjetivo":"...","exploracion_sugerida":"...","diagnosticos":[{"cie10":"CODIGO","nombre":"Nombre CIE-10","descripcion":"justificacion","probabilidad":"alta"}],"tratamiento":"...","laboratorios":"...","gabinete":"...","plan":"..."} Incluye 3-5 diagnosticos. PACIENTE: ${paciente || 'No especificado'} ANTECEDENTES: ${antecedentes || 'No especificados'} INTERROGATORIO: "${transcripcion}"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: JSON.stringify(data) });

    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
