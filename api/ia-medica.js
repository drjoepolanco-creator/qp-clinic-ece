// /api/ia-medica.js — QP Clinic ECE
// Vercel Serverless Function (CommonJS)

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { transcripcion, paciente, antecedentes } = req.body || {};
  if (!transcripcion) return res.status(400).json({ error: "Se requiere la transcripción" });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en Vercel" });

  const prompt = `Eres un médico clínico experto. Genera una nota médica SOAP completa en formato JSON.

DATOS DEL PACIENTE:
${paciente || "No especificado"}

ANTECEDENTES:
${antecedentes || "No especificados"}

INTERROGATORIO / TRANSCRIPCIÓN:
${transcripcion}

Responde ÚNICAMENTE con este JSON, sin texto adicional, sin bloques de código, sin explicaciones:
{
  "subjetivo": "narrativa del motivo de consulta, síntomas, cronología y características",
  "exploracion_sugerida": "exploración física detallada a realizar: inspección, palpación, percusión, auscultación, maniobras y pruebas especiales relevantes al caso",
  "diagnosticos": [
    {"cie10": "código exacto", "nombre": "nombre del diagnóstico", "descripcion": "justificación clínica breve", "probabilidad": "alta"}
  ],
  "tratamiento": "medicamentos numerados: nombre genérico, presentación, dosis, vía, frecuencia, duración. Medidas generales.",
  "laboratorios": "estudios de laboratorio relevantes, uno por línea",
  "gabinete": "estudios de imagen o gabinete, uno por línea",
  "plan": "seguimiento: próxima cita, indicaciones de alarma, restricciones, referencias si aplica",
  "pronostico_funcion": "una opción: Rehabilitable|Bueno|Bueno a largo plazo|Favorable con tratamiento|Regular|Malo|Reservado|No rehabilitable",
  "pronostico_vida": "una opción: Sin riesgo vital inmediato|Bueno|Favorable|Regular|Malo|Reservado|Grave"
}

Incluye 1-5 diagnósticos de mayor a menor probabilidad. El JSON debe ser válido y completo.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      return res.status(500).json({ error: `Anthropic API ${response.status}: ${t.substring(0, 400)}` });
    }

    const data = await response.json();
    const raw = (data?.content?.[0]?.text || "").trim();

    // Parseo en cascada — maneja JSON limpio, con markdown, o con texto alrededor
    let parsed = null;

    const intentar = (str) => {
      try { parsed = JSON.parse(str); return true; } catch { return false; }
    };

    // 1. Directo
    if (!intentar(raw)) {
      // 2. Sin bloques markdown ```json ... ```
      const sinMd = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
      if (!intentar(sinMd)) {
        // 3. Extraer desde primer { hasta último }
        const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
        if (s !== -1 && e > s) intentar(raw.substring(s, e + 1));
      }
    }

    if (!parsed) {
      return res.status(500).json({ error: "No se pudo parsear respuesta IA", raw: raw.substring(0, 500) });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};
