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
  "puntuacion": numero entero /100,
  "peso": kg,
  "altura": cm,
  "masa_grasa": kg,
  "masa_musculo": kg,
  "agua_corporal": litros,
  "proteina": kg,
  "minerales": kg,
  "imc": kg/m2,
  "pgc": porcentaje grasa corporal,
  "aec_act": ratio decimal,
  "grasa_visceral": nivel entero,
  "peso_ideal": kg,
  "control_peso": kg,
  "control_grasa": kg,
  "control_musculo": kg,
  "seg_brazo_der": kg,
  "seg_brazo_izq": kg,
  "seg_tronco": kg,
  "seg_pierna_der": kg,
  "seg_pierna_izq": kg,
  "grasa_brazo_der": kg,
  "grasa_brazo_izq": kg,
  "grasa_tronco": kg,
  "grasa_pierna_der": kg,
  "grasa_pierna_izq": kg,
  "tmb": kcal,
  "rcl": ratio decimal,
  "masa_celular": kg
}

Devuelve SOLO el JSON, sin backticks ni texto adicional.`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1500,
          messages: [
            { role: "user", content: [contentBlock, { type: "text", text: prompt }] },
            { role: "assistant", content: "{" }
          ],
        }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,300)}` }); }
      const d = await r.json();
      const raw = "{" + (d?.content?.[0]?.text || "").trim();
      const parsed = parseJSON(raw);
      if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta", raw: raw.substring(0,300) });
      return res.status(200).json({ inbody: parsed });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── MODO 4: Análisis de laboratorio desde PDF/imagen ────────────────────────
  if (tipo === "laboratorio") {
    if (!imageBase64) return res.status(400).json({ error: "Se requiere imageBase64" });
    const contentBlock = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } };

    // PASO 1 — extraer datos estructurados (JSON puro, sin texto_nota para evitar newlines problemáticos)
    const promptDatos = `Eres un médico clínico experto en interpretación de resultados de laboratorio.
Analiza este reporte y extrae los datos. Devuelve SOLO este JSON, sin backticks ni texto adicional:

{
  "fecha": "YYYY-MM-DD o null",
  "laboratorio": "nombre del laboratorio o null",
  "paciente": "nombre del paciente o null",
  "resumen_clinico": "Interpretacion clinica en 2-3 oraciones. Menciona valores alterados y su significado clinico.",
  "analitos": [
    {"nombre": "Nombre analito", "valor": "valor como string", "unidad": "unidades", "referencia": "rango referencia", "interpretacion": "Normal"}
  ]
}

Para interpretacion usa EXACTAMENTE una de estas palabras: Normal, Alto, Bajo, Critico, NoInterpretable
Incluye TODOS los analitos del documento.`;

    try {
      const r1 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 4096,
          messages: [
            { role: "user", content: [contentBlock, { type: "text", text: promptDatos }] },
            { role: "assistant", content: "{" }
          ],
        }),
      });
      if (!r1.ok) { const t = await r1.text(); return res.status(500).json({ error: `API ${r1.status}: ${t.substring(0,300)}` }); }
      const d1 = await r1.json();
      const raw1 = "{" + (d1?.content?.[0]?.text || "").trim();
      const parsed1 = parseJSON(raw1);
      if (!parsed1) return res.status(500).json({ error: "No se pudo parsear respuesta IA", raw: raw1.substring(0,400) });

      // PASO 2 — generar texto_nota a partir de los datos ya estructurados (sin documento, sin riesgo de newlines en JSON)
      const analitosTexto = (parsed1.analitos || []).map(a => {
        const interp = a.interpretacion === "Normal" ? "[Normal]"
          : a.interpretacion === "Alto"   ? "[↑ Alto]"
          : a.interpretacion === "Bajo"   ? "[↓ Bajo]"
          : a.interpretacion === "Critico" ? "[⚠️ CRÍTICO]"
          : "";
        return `  ${a.nombre}: ${a.valor} ${a.unidad} ${interp}${a.referencia ? " (ref: " + a.referencia + ")" : ""}`;
      }).join("\n");

      const alterados = (parsed1.analitos || [])
        .filter(a => a.interpretacion !== "Normal" && a.interpretacion !== "NoInterpretable")
        .map(a => `  - ${a.nombre}: ${a.valor} ${a.unidad} (${a.interpretacion === "Alto" ? "↑ Alto" : a.interpretacion === "Bajo" ? "↓ Bajo" : "⚠️ Crítico"})`)
        .join("\n");

      const fechaStr = parsed1.fecha || new Date().toISOString().split("T")[0];
      const labStr   = parsed1.laboratorio ? ` — ${parsed1.laboratorio}` : "";

      const texto_nota = [
        `LABORATORIOS (${fechaStr}${labStr}):`,
        analitosTexto || "  Sin analitos extraídos",
        alterados ? `\nHALLAZGOS RELEVANTES:\n${alterados}` : "",
        parsed1.resumen_clinico ? `\nINTERPRETACIÓN CLÍNICA:\n  ${parsed1.resumen_clinico}` : "",
      ].filter(Boolean).join("\n");

      return res.status(200).json({
        laboratorio: {
          ...parsed1,
          texto_nota,
        }
      });

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
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          messages: [
            { role: "user", content: prompt },
            { role: "assistant", content: "{" }
          ]
        }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,200)}` }); }
      const d = await r.json();
      const raw = "{" + (d?.content?.[0]?.text || "").trim();
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
  "exploracion_sugerida": "exploración física detallada a realizar",
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
        messages: [
          { role: "user", content: prompt },
          { role: "assistant", content: "{" }
        ]
      }),
    });
    if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,300)}` }); }
    const d = await r.json();
    const raw = "{" + (d?.content?.[0]?.text || "").trim();
    const parsed = parseJSON(raw);
    if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta IA", raw: raw.substring(0,500) });
    return res.status(200).json(parsed);
  } catch (e) { return res.status(500).json({ error: e.message }); }
};

function parseJSON(raw) {
  if (!raw) return null;
  let p = null;
  const try_ = (s) => { try { p = JSON.parse(s); return true; } catch { return false; } };
  // 1. Intento directo
  if (try_(raw)) return p;
  // 2. Quitar backticks markdown
  const noMd = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  if (try_(noMd)) return p;
  // 3. Extraer primer objeto JSON completo
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s !== -1 && e > s && try_(raw.substring(s, e + 1))) return p;
  // 4. Intentar reparar JSON truncado añadiendo cierre
  const incomplete = raw.substring(s !== -1 ? s : 0);
  const repaired = incomplete + (incomplete.endsWith("}") ? "" : "}");
  if (try_(repaired)) return p;
  return null;
}
