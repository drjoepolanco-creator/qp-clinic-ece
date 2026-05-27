// /api/ia-medica.js — QP Clinic ECE
// Vercel Serverless Function
// Requiere: ANTHROPIC_API_KEY en variables de entorno de Vercel

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { transcripcion, paciente, antecedentes } = req.body || {};

  if (!transcripcion) {
    return res.status(400).json({ error: "Se requiere la transcripción del interrogatorio" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en Vercel" });
  }

  const systemPrompt = `Eres un médico clínico experto que ayuda a generar notas médicas estructuradas en formato SOAP. 
Recibes la transcripción del interrogatorio de una consulta y datos del paciente, y generas la nota médica completa.
IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código, sin markdown.
El JSON debe tener exactamente esta estructura:
{
  "subjetivo": "Texto narrativo del motivo de consulta, síntomas, cronología y características del dolor o malestar según el interrogatorio",
  "exploracion_sugerida": "Lista detallada de la exploración física que DEBE realizarse: signos vitales, inspección, palpación, percusión, auscultación, maniobras específicas y pruebas especiales relevantes al caso. El médico completará con los hallazgos encontrados.",
  "diagnosticos": [
    {
      "cie10": "Código CIE-10 exacto",
      "nombre": "Nombre completo del diagnóstico",
      "descripcion": "Justificación clínica breve basada en los síntomas referidos",
      "probabilidad": "alta | media | baja"
    }
  ],
  "tratamiento": "Medicamentos con nombre genérico, presentación, dosis, vía, frecuencia y duración. Medidas generales. Máximo 5-7 líneas numeradas.",
  "laboratorios": "Estudios de laboratorio relevantes al caso, uno por línea",
  "gabinete": "Estudios de imagen o gabinete relevantes, uno por línea",
  "plan": "Plan de seguimiento: próxima cita, indicaciones de alarma, restricciones de actividad, referencias si aplica",
  "pronostico_funcion": "Uno de: Rehabilitable | Bueno | Bueno a largo plazo | Favorable con tratamiento | Regular | Malo | Reservado | No rehabilitable",
  "pronostico_vida": "Uno de: Sin riesgo vital inmediato | Bueno | Favorable | Regular | Malo | Reservado | Grave"
}
Instrucciones:
- Incluye entre 1 y 5 diagnósticos ordenados de más probable a menos probable
- El primer diagnóstico debe ser el más probable (probabilidad alta)
- Usa siempre el código CIE-10 correcto y específico
- El tratamiento debe ser farmacológicamente correcto y seguro
- La exploración sugerida debe ser relevante y detallada para orientar al médico
- Si el caso es de medicina del deporte, incluye pruebas funcionales específicas
- El pronóstico para la función es clínico/rehabilitatorio; para la vida considera el riesgo vital
- Responde en español`;

  const userPrompt = `DATOS DEL PACIENTE:
${paciente || "No especificado"}

ANTECEDENTES:
${antecedentes || "No especificados"}

INTERROGATORIO / TRANSCRIPCIÓN:
${transcripcion}

Genera la nota médica SOAP completa en formato JSON.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `Error Anthropic API: ${response.status} — ${errText}` });
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text || "";

    // Extraer JSON de la respuesta
    let parsed;
    try {
      // Intentar parsear directo
      parsed = JSON.parse(rawText);
    } catch {
      // Intentar extraer bloque JSON si hay texto alrededor
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return res.status(500).json({
          error: "La IA no retornó JSON válido",
          raw: rawText.substring(0, 500),
        });
      }
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
}
