// /api/ia-medica.js — QP Clinic ECE
// Vercel Serverless Function (CommonJS)
// Variable de entorno requerida: ANTHROPIC_API_KEY

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { transcripcion, paciente, antecedentes } = req.body || {};
  if (!transcripcion) return res.status(400).json({ error: "Se requiere la transcripción del interrogatorio" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en Vercel" });

  const systemPrompt = `Eres un médico clínico experto. Generas notas médicas SOAP completas en JSON.
Responde SOLO con el contenido JSON, sin texto previo ni posterior.`;

  const userMessage = `Genera una nota médica SOAP completa en formato JSON para el siguiente caso.

DATOS DEL PACIENTE:
${paciente || "No especificado"}

ANTECEDENTES:
${antecedentes || "No especificados"}

INTERROGATORIO:
${transcripcion}

Responde con este JSON exacto (completa todos los campos):
{
  "subjetivo": "Narrativa del motivo de consulta, síntomas, cronología y características según el interrogatorio",
  "exploracion_sugerida": "Lista detallada de exploración física a realizar: signos vitales, inspección, palpación, percusión, auscultación, maniobras y pruebas especiales relevantes al caso",
  "diagnosticos": [
    {"cie10": "código", "nombre": "nombre diagnóstico", "descripcion": "justificación clínica breve", "probabilidad": "alta|media|baja"}
  ],
  "tratamiento": "Medicamentos numerados: nombre genérico, presentación, dosis, vía, frecuencia, duración. Medidas generales.",
  "laboratorios": "Estudios de laboratorio relevantes, uno por línea",
  "gabinete": "Estudios de imagen o gabinete relevantes, uno por línea",
  "plan": "Seguimiento: próxima cita, indicaciones de alarma, restricciones, referencias",
  "pronostico_funcion": "Rehabilitable|Bueno|Bueno a largo plazo|Favorable con tratamiento|Regular|Malo|Reservado|No rehabilitable",
  "pronostico_vida": "Sin riesgo vital inmediato|Bueno|Favorable|Regular|Malo|Reservado|Grave"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content: "{" }  // Prefill: fuerza respuesta JSON sin markdown
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `Anthropic API ${response.status}: ${errText.substring(0, 300)}` });
    }

    const data = await response.json();
    // El prefill "{" ya fue enviado, Claude continúa desde ahí
    const rawText = ("{" + (data?.content?.[0]?.text || "")).trim();

    // Estrategias de parseo en cascada
    let parsed = null;

    // 1. Parseo directo
    try { parsed = JSON.parse(rawText); } catch {}

    // 2. Quitar markdown si lo hay
    if (!parsed) {
      const stripped = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
      try { parsed = JSON.parse(stripped); } catch {}
    }

    // 3. Extraer desde primer { hasta último }
    if (!parsed) {
      const start = rawText.indexOf("{");
      const end = rawText.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try { parsed = JSON.parse(rawText.substring(start, end + 1)); } catch {}
      }
    }

    if (!parsed) {
      return res.status(500).json({
        error: "No se pudo parsear la respuesta de la IA",
        raw: rawText.substring(0, 600)
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
};
