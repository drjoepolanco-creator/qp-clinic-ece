// Vercel Serverless Function — Generador de Nota Médica con IA
// Endpoint: POST /api/ia-medica

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcripcion, paciente, antecedentes } = req.body;
  if (!transcripcion) return res.status(400).json({ error: 'Transcripción requerida' });

  const prompt = `Eres un asistente médico clínico experto. Analiza el siguiente interrogatorio médico transcrito y genera una nota SOAP estructurada completa.

DATOS DEL PACIENTE:
${paciente || 'No especificado'}

ANTECEDENTES RELEVANTES:
${antecedentes || 'No especificados'}

TRANSCRIPCIÓN DEL INTERROGATORIO:
"${transcripcion}"

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni backticks:
{
  "subjetivo": "Redacción del motivo de consulta e interrogatorio en términos médicos profesionales, en tercera persona. Incluye inicio, evolución, características del síntoma principal, síntomas asociados y negados relevantes.",
  "exploracion_sugerida": "Lista numerada de sistemas a explorar y maniobras específicas a realizar según los síntomas referidos. Sé específico: menciona signos a buscar, maniobras con nombre, rangos normales esperados.",
  "diagnosticos": [
    {"cie10": "CÓDIGO", "nombre": "Nombre oficial CIE-10", "descripcion": "Justificación basada en el interrogatorio", "probabilidad": "alta|media|baja"},
    {"cie10": "CÓDIGO", "nombre": "Nombre oficial CIE-10", "descripcion": "Justificación", "probabilidad": "media"},
    {"cie10": "CÓDIGO", "nombre": "Nombre oficial CIE-10", "descripcion": "Justificación", "probabilidad": "baja"}
  ],
  "tratamiento": "Recomendaciones terapéuticas específicas: medicamentos con nombre genérico, dosis, vía, frecuencia y duración. Medidas generales e indicaciones de actividad física si aplica.",
  "laboratorios": "Estudios de laboratorio recomendados con su justificación clínica específica.",
  "gabinete": "Estudios de imagen o gabinete recomendados con justificación.",
  "plan": "Plan de seguimiento: cuándo regresar, signos de alarma, restricciones, actividad deportiva, referencias a especialistas si aplica."
}

Incluye 3-5 diagnósticos diferenciales de mayor a menor probabilidad con código CIE-10 correcto.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5,
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
