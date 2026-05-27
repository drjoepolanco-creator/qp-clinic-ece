// /api/ia-medica.js — QP Clinic ECE
// Vercel Serverless Function (CommonJS)
// Variable de entorno requerida: ANTHROPIC_API_KEY

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { transcripcion, paciente, antecedentes } = req.body || {};
  if (!transcripcion) return res.status(400).json({ error: "Se requiere la transcripción del interrogatorio" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en Vercel" });

  const systemPrompt = `Eres un médico clínico experto que genera notas médicas estructuradas en formato SOAP.
Recibes la transcripción del interrogatorio de una consulta y generas la nota completa.
REGLA CRÍTICA: Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional. Sin bloques de código. Sin markdown. Solo el JSON puro.

Estructura exacta requerida:
{
  "subjetivo": "Narrativa del motivo de consulta, síntomas, cronología, características del dolor/malestar según el interrogatorio",
  "exploracion_sugerida": "Lista detallada de la exploración física que DEBE realizarse: signos vitales, inspección, palpación, percusión, auscultación, maniobras específicas y pruebas especiales relevantes. El médico completará con los hallazgos encontrados.",
  "diagnosticos": [
    {
      "cie10": "Código CIE-10 exacto",
      "nombre": "Nombre completo del diagnóstico",
      "descripcion": "Justificación clínica breve basada en síntomas referidos",
      "probabilidad": "alta"
    }
  ],
  "tratamiento": "Medicamentos: nombre genérico, presentación, dosis, vía, frecuencia y duración. Medidas generales. Numerados.",
  "laboratorios": "Estudios de laboratorio relevantes, uno por línea",
  "gabinete": "Estudios de imagen o gabinete relevantes, uno por línea",
  "plan": "Seguimiento: próxima cita, indicaciones de alarma, restricciones, referencias si aplica",
  "pronostico_funcion": "Uno solo de: Rehabilitable | Bueno | Bueno a largo plazo | Favorable con tratamiento | Regular | Malo | Reservado | No rehabilitable",
  "pronostico_vida": "Uno solo de: Sin riesgo vital inmediato | Bueno | Favorable | Regular | Malo | Reservado | Grave"
}

Reglas:
- Entre 1 y 5 diagnósticos ordenados de más probable (alta) a menos probable (baja)
- Código CIE-10 correcto y específico siempre
- Tratamiento farmacológicamente correcto y seguro
- Exploración sugerida: detallada y específica al caso clínico
- Si es medicina del deporte: incluye pruebas funcionales específicas (Ober, McMurray, Lachman, etc. según corresponda)
- Respuesta en español`;

  const userMessage = `DATOS DEL PACIENTE:
${paciente || "No especificado"}

ANTECEDENTES:
${antecedentes || "No especificados"}

INTERROGATORIO / TRANSCRIPCIÓN:
${transcripcion}

Genera la nota médica SOAP completa en JSON puro.`;

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
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `Anthropic API ${response.status}: ${errText.substring(0, 300)}` });
    }

    const data = await response.json();
    const rawText = (data?.content?.[0]?.text || "").trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); }
        catch { return res.status(500).json({ error: "JSON inválido en respuesta IA", raw: rawText.substring(0, 400) }); }
      } else {
        return res.status(500).json({ error: "La IA no retornó JSON", raw: rawText.substring(0, 400) });
      }
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};
