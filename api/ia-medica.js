// /api/ia-medica.js — QP Clinic ECE
// Vercel Serverless Function (CommonJS)
// Maneja dos modos: nota SOAP completa y sugerencia de diagnósticos CIE-10

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { tipo, transcripcion, nota, paciente, antecedentes } = req.body || {};
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en Vercel" });

  // ── MODO 1: Solo diagnósticos CIE-10 ────────────────────────────────────────
  if (tipo === "diagnosticos") {
    if (!nota) return res.status(400).json({ error: "Se requiere el contenido de la nota" });

    const prompt = `Eres un médico experto en codificación diagnóstica CIE-10.
Analiza el siguiente contenido clínico y proporciona los diagnósticos más probables.

DATOS DEL PACIENTE: ${paciente || "No especificado"}

CONTENIDO CLÍNICO:
${nota}

Responde ÚNICAMENTE con este JSON sin texto adicional:
{"diagnosticos":[{"codigo":"X00.0","nombre":"Nombre completo del diagnóstico","certeza":"Principal"}]}

Reglas:
- Entre 1 y 6 diagnósticos, del más probable al menos probable
- Código CIE-10 exacto y específico
- certeza: Principal (el más probable), Secundario, o Diferencial
- Incluye tanto diagnósticos etiológicos como sintomáticos si aplica`;

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,200)}` }); }
      const d = await r.json();
      const raw = (d?.content?.[0]?.text || "").trim();
      const parsed = parseJSON(raw);
      if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta", raw: raw.substring(0, 400) });
      return res.status(200).json(parsed);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── MODO 2: Nota SOAP completa ───────────────────────────────────────────────
  if (!transcripcion) return res.status(400).json({ error: "Se requiere la transcripción del interrogatorio" });

  const prompt = `Eres un médico clínico experto. Genera una nota médica SOAP completa en formato JSON.

DATOS DEL PACIENTE:
${paciente || "No especificado"}

ANTECEDENTES:
${antecedentes || "No especificados"}

INTERROGATORIO:
${transcripcion}

Responde ÚNICAMENTE con este JSON, sin texto adicional, sin bloques de código:
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
  "pronostico_funcion": "Rehabilitable|Bueno|Bueno a largo plazo|Favorable con tratamiento|Regular|Malo|Reservado|No rehabilitable",
  "pronostico_vida": "Sin riesgo vital inmediato|Bueno|Favorable|Regular|Malo|Reservado|Grave"
}

Incluye 1-5 diagnósticos de mayor a menor probabilidad. Si es medicina del deporte incluye pruebas funcionales específicas.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,300)}` }); }
    const d = await r.json();
    const raw = (d?.content?.[0]?.text || "").trim();
    const parsed = parseJSON(raw);
    if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta IA", raw: raw.substring(0, 500) });
    return res.status(200).json(parsed);
  } catch (e) { return res.status(500).json({ error: e.message }); }
};

// Parseo robusto: JSON limpio, con markdown, o con texto alrededor
function parseJSON(raw) {
  let p = null;
  const try_ = (s) => { try { p = JSON.parse(s); return true; } catch { return false; } };
  if (try_(raw)) return p;
  const noMd = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  if (try_(noMd)) return p;
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s !== -1 && e > s && try_(raw.substring(s, e + 1))) return p;
  return null;
}
