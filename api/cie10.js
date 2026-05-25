// /api/cie10.js — QP Clinic ECE
// Serverless function para codificación diagnóstica CIE-10 con IA
// Despliega en: Vercel → carpeta /api/

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nota, instruccion } = req.body || {};

  if (!nota) {
    return res.status(400).json({ error: "Falta el campo 'nota'" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key no configurada" });
  }

  // Prompt del sistema — codificador CIE-10 experto
  const systemPrompt = instruccion || `Eres un médico experto en codificación diagnóstica CIE-10 (versión en español).
Analiza la nota clínica proporcionada e identifica todos los diagnósticos presentes.
Para cada diagnóstico devuelve exactamente este formato JSON, sin texto adicional, sin markdown:

{
  "diagnosticos": [
    {
      "codigo": "G43.9",
      "descripcion": "Migraña, no especificada",
      "tipo": "principal",
      "certeza": "presuntivo"
    }
  ]
}

Reglas:
- "tipo" puede ser: "principal", "secundario", "comorbilidad"
- "certeza" puede ser: "definitivo", "presuntivo", "descartado"
- Usa los códigos CIE-10 más específicos posibles
- Máximo 6 diagnósticos por nota
- Responde ÚNICAMENTE con el JSON, sin explicaciones ni texto extra`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Nota clínica:\n\n${nota}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", errBody);
      return res.status(502).json({ error: "Error al contactar la IA", detalle: errBody });
    }

    const data = await response.json();
    const rawText = data?.content?.[0]?.text || "";

    // Intentar parsear JSON de la respuesta
    let parsed;
    try {
      // Limpiar posibles fences de markdown
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // Si no es JSON válido, devolver texto crudo para debugging
      return res.status(200).json({
        diagnosticos: [],
        raw: rawText,
        advertencia: "La IA no devolvió JSON válido",
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Error interno:", err);
    return res.status(500).json({ error: "Error interno del servidor", detalle: err.message });
  }
}
