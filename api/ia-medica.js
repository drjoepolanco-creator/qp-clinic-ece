// /api/ia-medica.js — QP Clinic ECE
// Vercel Serverless Function (CommonJS)

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en Vercel" });

  const { tipo, transcripcion, nota, paciente, antecedentes, imageBase64, mediaType } = req.body || {};

  // ── MODO 3: Extracción automática InBody desde PDF/imagen ───────────────────
  if (tipo === "inbody") {
    if (!imageBase64) return res.status(400).json({ error: "Se requiere imageBase64" });
    const contentBlock = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } };
    const prompt = `Eres un experto en análisis de reportes InBody de composición corporal.
Extrae TODOS los valores numéricos de este reporte InBody y devuelve ÚNICAMENTE un objeto JSON con estos campos exactos (null si no está presente):

{
  "fecha": "YYYY-MM-DD o null",
  "hora": "HH:MM o null",
  "modelo": "nombre del modelo InBody",
  "puntuacion": número entero /100,
  "peso": kg,
  "altura": cm,
  "masa_grasa": kg,
  "masa_musculo": kg (MME - Masa Músculo Esquelético),
  "agua_corporal": litros (Agua Corporal Total),
  "proteina": kg,
  "minerales": kg,
  "imc": kg/m2,
  "pgc": porcentaje grasa corporal (%),
  "aec_act": ratio decimal (AEC/ACT),
  "grasa_visceral": nivel entero,
  "peso_ideal": kg,
  "control_peso": kg (negativo si debe bajar),
  "control_grasa": kg (negativo si debe bajar),
  "control_musculo": kg,
  "seg_brazo_der": kg masa magra brazo derecho,
  "seg_brazo_izq": kg masa magra brazo izquierdo,
  "seg_tronco": kg masa magra tronco,
  "seg_pierna_der": kg masa magra pierna derecha,
  "seg_pierna_izq": kg masa magra pierna izquierda,
  "grasa_brazo_der": kg grasa brazo derecho,
  "grasa_brazo_izq": kg grasa brazo izquierdo,
  "grasa_tronco": kg grasa tronco,
  "grasa_pierna_der": kg grasa pierna derecha,
  "grasa_pierna_izq": kg grasa pierna izquierda,
  "tmb": kcal tasa metabólica basal,
  "rcl": ratio cintura-cadera decimal,
  "masa_celular": kg masa celular corporal
}

IMPORTANTE: Devuelve SOLO el JSON puro, sin texto adicional, sin backticks, sin comentarios.`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
        }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,300)}` }); }
      const d = await r.json();
      const raw = (d?.content?.[0]?.text || "").trim();
      const parsed = parseJSON(raw);
      if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta", raw: raw.substring(0,300) });
      return res.status(200).json({ inbody: parsed });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── MODO 4: Análisis de laboratorio desde PDF/imagen ───────────────────────
  if (tipo === "laboratorio") {
    if (!imageBase64) return res.status(400).json({ error: "Se requiere imageBase64" });
    const contentBlock = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } };
    const prompt = `Eres un médico clínico experto en interpretación de resultados de laboratorio.
Analiza este reporte de laboratorio y extrae TODOS los resultados. Devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:

{
  "fecha": "YYYY-MM-DD o null",
  "laboratorio": "nombre del laboratorio o institución, o null",
  "paciente": "nombre del paciente si aparece, o null",
  "resumen_clinico": "párrafo breve (2-4 líneas) con interpretación clínica: qué está alterado, qué es relevante, qué sugiere. En español médico profesional.",
  "texto_nota": "bloque de texto listo para copiar en la nota médica SOAP, sección LABORATORIOS. Formato: LABORATORIOS (fecha):\n  cada analito en su línea: Nombre: valor unidades [Normal/↑ Alto/↓ Bajo] (referencia: rango)\n\nHallazgos relevantes: lista de los valores fuera de rango o clínicamente significativos.",
  "analitos": [
    {
      "nombre": "nombre del analito",
      "valor": "valor numérico o texto como string",
      "unidad": "unidad de medida",
      "referencia": "rango de referencia como string ej: 70-100",
      "interpretacion": "Normal | Alto | Bajo | Critico | No interpretable"
    }
  ]
}

REGLAS:
- Extrae TODOS los analitos visibles en el documento
- Para interpretacion usa exactamente: Normal, Alto, Bajo, Critico, o No interpretable
- El texto_nota debe ser autocontenido y copiable directamente a la nota médica
- Si hay múltiples paneles (BH, QS, PFH, etc.) agrúpalos en texto_nota con subtítulos
- SOLO devuelve el JSON puro, sin backticks, sin texto adicional`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 4096,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
        }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,300)}` }); }
      const d = await r.json();
      const raw = (d?.content?.[0]?.text || "").trim();
      const parsed = parseJSON(raw);
      if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta", raw: raw.substring(0,400) });
      return res.status(200).json({ laboratorio: parsed });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

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
        body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,200)}` }); }
      const d = await r.json();
      const raw = (d?.content?.[0]?.text || "").trim();
      const parsed = parseJSON(raw);
      if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta", raw: raw.substring(0,400) });
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
      body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,300)}` }); }
    const d = await r.json();
    const raw = (d?.content?.[0]?.text || "").trim();
    const parsed = parseJSON(raw);
    if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta IA", raw: raw.substring(0,500) });
    return res.status(200).json(parsed);
  } catch (e) { return res.status(500).json({ error: e.message }); }
};

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
