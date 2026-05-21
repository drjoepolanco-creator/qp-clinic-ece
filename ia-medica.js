export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, nota, instruccion, transcripcion, paciente, antecedentes } = req.body;

  try {
    let prompt = '';

    // ── MODO 1: Diagnósticos CIE-10 desde nota existente ──
    if (tipo === 'diagnosticos_cie10') {
      if (!nota) return res.status(400).json({ error: 'Nota requerida' });
      prompt = `${instruccion || 'Eres un médico experto en codificación CIE-10. Analiza la nota médica y propón los diagnósticos más probables con su código CIE-10 exacto. Responde ÚNICAMENTE en formato JSON sin texto adicional: {"diagnosticos":[{"codigo":"M54.5","nombre":"Lumbago no especificado","certeza":"Principal"}]}'}\n\nNOTA MÉDICA:\n${nota}`;

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
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Error API' });

      const text = data.content[0].text.trim();
      const clean = text.replace(/```json|```/g, '').trim();
      // Extraer solo el JSON
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) return res.status(200).json({ resultado: clean });
      const parsed = JSON.parse(match[0]);
      return res.status(200).json({ resultado: JSON.stringify(parsed), diagnosticos: parsed.diagnosticos });
    }

    // ── MODO 2: Nota sugerida por IA para campo específico ──
    if (tipo && tipo !== 'soap' && !transcripcion) {
      if (!nota) return res.status(400).json({ error: 'Nota requerida' });
      prompt = `${instruccion || 'Responde como médico clínico experto.'}\n\n${nota}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Error API' });
      const text = data.content[0].text.trim();
      return res.status(200).json({ resultado: text });
    }

    // ── MODO 3: Nota SOAP completa desde transcripción (original) ──
    if (!transcripcion) return res.status(400).json({ error: 'Transcripcion requerida' });

    prompt = `Eres un asistente medico clinico experto. Analiza el siguiente interrogatorio medico transcrito y genera una nota SOAP estructurada completa.

DATOS DEL PACIENTE:
${paciente || 'No especificado'}

ANTECEDENTES RELEVANTES:
${antecedentes || 'No especificados'}

TRANSCRIPCION DEL INTERROGATORIO:
"${transcripcion}"

Responde UNICAMENTE con un objeto JSON valido, sin texto adicional ni backticks:
{"subjetivo":"Redaccion del motivo de consulta e interrogatorio en terminos medicos profesionales en tercera persona.","exploracion_sugerida":"Lista numerada de sistemas a explorar y maniobras especificas.","diagnosticos":[{"cie10":"CODIGO","nombre":"Nombre oficial CIE-10","descripcion":"Justificacion","probabilidad":"alta"},{"cie10":"CODIGO","nombre":"Nombre oficial CIE-10","descripcion":"Justificacion","probabilidad":"media"},{"cie10":"CODIGO","nombre":"Nombre oficial CIE-10","descripcion":"Justificacion","probabilidad":"baja"}],"tratamiento":"Recomendaciones terapeuticas especificas con nombre generico dosis via frecuencia y duracion.","laboratorios":"Estudios de laboratorio recomendados con justificacion.","gabinete":"Estudios de imagen recomendados con justificacion.","plan":"Plan de seguimiento cuando regresar signos de alarma restricciones referencias si aplica."}

Incluye 3-5 diagnosticos diferenciales de mayor a menor probabilidad con codigo CIE-10 correcto.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Error API' });

    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('ia-medica error:', err);
    return res.status(500).json({ error: err.message });
  }
}
