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

  // ── MODO 3: Extracción InBody ────────────────────────────────────────────────
  if (tipo === "inbody") {
    if (!imageBase64) return res.status(400).json({ error: "Se requiere imageBase64" });
    const contentBlock = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } };
    const prompt = `Eres un experto en análisis de reportes InBody. Extrae los valores y devuelve SOLO un objeto JSON válido (sin backticks, sin texto adicional):
{"fecha":null,"hora":null,"modelo":null,"puntuacion":null,"peso":null,"altura":null,"masa_grasa":null,"masa_musculo":null,"agua_corporal":null,"proteina":null,"minerales":null,"imc":null,"pgc":null,"aec_act":null,"grasa_visceral":null,"peso_ideal":null,"control_peso":null,"control_grasa":null,"control_musculo":null,"seg_brazo_der":null,"seg_brazo_izq":null,"seg_tronco":null,"seg_pierna_der":null,"seg_pierna_izq":null,"grasa_brazo_der":null,"grasa_brazo_izq":null,"grasa_tronco":null,"grasa_pierna_der":null,"grasa_pierna_izq":null,"tmb":null,"rcl":null,"masa_celular":null}
Reemplaza null con los valores encontrados. Devuelve SOLO el JSON.`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 1500, messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }] }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(500).json({ error: `API ${r.status}: ${t.substring(0,300)}` }); }
      const d = await r.json();
      const raw = (d?.content?.[0]?.text || "").trim();
      const parsed = parseJSON(raw);
      if (!parsed) return res.status(500).json({ error: "No se pudo parsear respuesta", raw: raw.substring(0,300) });
      return res.status(200).json({ inbody: parsed });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── MODO 4: Análisis de laboratorio ─────────────────────────────────────────
  if (tipo === "laboratorio") {
    if (!imageBase64) return res.status(400).json({ error: "Se requiere imageBase64" });
    const contentBlock = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } };

    const prompt = `Eres un médico clínico experto en interpretación de laboratorios. Analiza el reporte y devuelve SOLO un objeto JSON válido, sin backticks, sin texto antes ni después del JSON.

Estructura exacta requerida:
{"fecha":null,"laboratorio":null,"paciente":null,"resumen_clinico":"texto de interpretacion aqui","analitos":[{"nombre":"Glucosa","valor":"95","unidad":"mg/dL","referencia":"70-100","interpretacion":"Normal"}]}

Reglas:
- fecha: formato YYYY-MM-DD o null
- resumen_clinico: 2-3 oraciones de interpretacion clinica en español, sin saltos de linea
- analitos: incluye TODOS los analitos del documento
- interpretacion: usa EXACTAMENTE una de estas: Normal, Alto, Bajo, Critico, NoInterpretable
- SOLO devuelve el JSON, nada mas`;

    try {
      const r1 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 4096, messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }] }),
      });
      if (!r1.ok) { const t = await r1.text(); return res.status(500).json({ error: `API ${r1.status}: ${t.substring(0,300)}` }); }
      const d1 = await r1.json();
      const raw1 = (d1?.content?.[0]?.text || "").trim();
      const parsed1 = parseJSON(raw1);
      if (!parsed1) return res.status(500).json({ error: "No se pudo parsear respuesta IA", raw: raw1.substring(0,500) });

      // Construir texto_nota en Node.js (no en el JSON de Claude)
      const fechaStr = parsed1.fecha || new Date().toISOString().split("T")[0];
      const labStr   = parsed1.laboratorio ? ` — ${parsed1.laboratorio}` : "";
      const lineasAnalitos = (parsed1.analitos || []).map(a => {
        const tag = a.interpretacion === "Normal"  ? "[Normal]"
                  : a.interpretacion === "Alto"    ? "[↑ Alto]"
                  : a.interpretacion === "Bajo"    ? "[↓ Bajo]"
                  : a.interpretacion === "Critico" ? "[⚠️ CRÍTICO]"
                  : "";
        const ref = a.referencia ? ` (ref: ${a.referencia})` : "";
        return `  ${a.nombre}: ${a.valor} ${a.unidad} ${tag}${ref}`.trimEnd();
      });
      const alterados = (parsed1.analitos || []).filter(a =>
        a.interpretacion === "Alto" || a.interpretacion === "Bajo" || a.interpretacion === "Critico"
      ).map(a => `  - ${a.nombre}: ${a.valor} ${a.unidad} (${
        a.interpretacion === "Alto" ? "↑ Alto" : a.interpretacion === "Bajo" ? "↓ Bajo" : "⚠️ CRÍTICO"
      })`);

      const partes = [`LABORATORIOS (${fechaStr}${labStr}):`, ...lineasAnalitos];
      if (alterados.length) partes.push("", "HALLAZGOS RELEVANTES:", ...alterados);
      if (parsed1.resumen_clinico) partes.push("", "INTERPRETACIÓN CLÍNICA:", `  ${parsed1.resumen_clinico}`);
      const texto_nota = partes.join("\n");

      return res.status(200).json({ laboratorio: { ...parsed1, texto_nota } });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── MODO 1: Diagnósticos CIE-10 ─────────────────────────────────────────────
  if (tipo === "diagnosticos") {
    if (!nota) return res.status(400).json({ error: "Se requiere el contenido de la nota" });
    const prompt = `Eres un médico experto en codificación diagnóstica CIE-10. Analiza el contenido clínico y devuelve SOLO un JSON válido, sin backticks ni texto adicional.

DATOS DEL PACIENTE: ${paciente || "No especificado"}
CONTENIDO CLÍNICO: ${nota}

Formato exacto: {"diagnosticos":[{"codigo":"X00.0","nombre":"Nombre completo","certeza":"Principal"}]}
- Entre 1 y 6 diagnósticos, del más probable al menos probable
- certeza: Principal, Secundario, o Diferencial`;
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
  const prompt = `Eres un médico clínico experto. Genera una nota SOAP en JSON. Devuelve SOLO el JSON, sin backticks ni texto adicional.

DATOS DEL PACIENTE: ${paciente || "No especificado"}
ANTECEDENTES: ${antecedentes || "No especificados"}
INTERROGATORIO: ${transcripcion}

Formato exacto:
{"subjetivo":"...","exploracion_sugerida":"...","diagnosticos":[{"cie10":"X00.0","nombre":"...","descripcion":"...","probabilidad":"alta"}],"tratamiento":"...","laboratorios":"...","gabinete":"...","plan":"...","pronostico_funcion":"Bueno","pronostico_vida":"Sin riesgo vital inmediato"}

- 1 a 5 diagnósticos de mayor a menor probabilidad
- Si es medicina del deporte incluye pruebas funcionales
- Sin saltos de línea dentro de los valores del JSON`;
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
  if (!raw) return null;
  let p = null;
  const try_ = (s) => { try { p = JSON.parse(s); return true; } catch { return false; } };
  // 1. Directo
  if (try_(raw)) return p;
  // 2. Quitar backticks markdown ```json ... ```
  const noMd = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/im, "").trim();
  if (try_(noMd)) return p;
  // 3. Extraer desde primer { hasta último }
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s !== -1 && e > s && try_(raw.substring(s, e + 1))) return p;
  // 4. Mismo sobre noMd
  const s2 = noMd.indexOf("{"), e2 = noMd.lastIndexOf("}");
  if (s2 !== -1 && e2 > s2 && try_(noMd.substring(s2, e2 + 1))) return p;
  return null;
}
