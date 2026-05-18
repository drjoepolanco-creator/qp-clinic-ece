export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcripcion, paciente, antecedentes } = req.body;
  if (!transcripcion) return res.status(400).json({ error: 'Transcripcion requerida' });

  const prompt = `Eres un asistente medico clinico experto. Analiza el siguiente interrogatorio medico transcrito y genera una nota SOAP estructurada completa.

DATOS DEL PACIENTE:
${paciente || 'No especificado'}

ANTECEDENTES RELEVANTES:
${antecedentes || 'No especificados'}

TRANSCRIPCION DEL INTERROGATORIO:
"${transcripcion}"

Responde UNICAMENTE con un objeto JSON valido, sin texto adicional ni backticks:
{"subjetivo":"Redaccion del motivo de consulta e interrogatorio en terminos medicos profesionales en tercera persona. Incluye inicio evolucion caracteristicas del sintoma principal sintomas asociados y negados relevantes.","exploracion_sugerida":"Lista numerada de sistemas a explorar y maniobras especificas a realizar segun los sintomas referidos. Se especifico menciona signos a buscar maniobras con nombre rangos normales esperados.","diagnosticos":[{"cie10":"CODIGO","nombre":"Nombre oficial CIE-10","descripcion":"Justificacion basada en el interrogatorio","probabilidad":"alta"},{"cie10":"CODIGO","nombre":"Nombre oficial CIE-10","descripcion":"Justificacion","probabilidad":"media"},{"cie10":"CODIGO","nombre":"Nombre oficial CIE-10","descripcion":"Justificacion","probabilidad":"baja"}],"tratamiento":"Recomendaciones terapeuticas especificas medicamentos con nombre generico dosis via frecuencia y duracion. Medidas generales e indicaciones de actividad fisica si aplica.","laboratorios":"Estudios de laboratorio recomendados con su justificacion clinica especifica.","gabinete":"Estudios de imagen o gabinete recomendados con justificacion.","plan":"Plan de seguimiento cuando regresar signos de alarma restricciones actividad deportiva referencias a especialistas si aplica."}

Incluye 3-5 diagnosticos diferenciales de mayor a menor probabilidad con codigo CIE-10 correcto.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
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
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
