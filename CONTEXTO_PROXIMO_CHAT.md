# QP Clinic ECE — Contexto completo para continuación

## ⚠️ LEER PRIMERO — reglas de operación (7 agosto 2026)

1. **Fuente de verdad: `C:\Users\Alan\Documents\qp-clinic-ece`** (repo git conectado a GitHub → Vercel).
   La carpeta de Google Drive quedó OBSOLETA. No editar ahí: ya causó una divergencia de versiones.
   Publicar con: `git add -A` → `git commit -m "..."` → `git push`. Vercel despliega solo.

2. **Correr `python verificar.py index.html` antes de entregar.** Está enganchado como hook de
   pre-commit (`git config core.hooksPath .githooks`). Nueve comprobaciones nacidas de errores
   reales. La más importante es CHK-3: detecta variables usadas fuera de la función donde se
   declaran, que fue lo que tumbó los expedientes en producción.

3. **Supabase YA TIENE RLS configurado** en las 34 tablas, con políticas `auth_all_<tabla>`
   (FOR ALL TO authenticated). **NO crear políticas nuevas ni activar/desactivar RLS.**
   Agregar una política `USING (true)` a una tabla que ya tiene otras las AFLOJA, porque en
   PostgreSQL las políticas se suman con OR.
   Antes de proponer cualquier cambio de seguridad, pedir primero:
   `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
   y `SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname='public';`

4. **Al aplicar parches en el índice de 20 mil líneas, verificar el punto de inserción.**
   Los patrones de texto se repiten. Un bloque destinado a `pgExp` cayó en `pgMedicos` porque
   se reemplazó la primera coincidencia sin comprobar en qué función estaba.

5. **Excepciones que NO deben cerrarse sin cambiar código:**
   `usuarios` (el login la consulta sin sesión para traducir usuario→correo) y
   `pre_registros` (los pacientes llenan su pre-registro desde un enlace con token).

## Pendientes
- Certificación NOM-024-SSA3-2012: consultar el texto vigente y los lineamientos de la DGIS
  antes de planear. Falta trazabilidad de *consultas* (quién vio qué expediente), no solo de
  escrituras; política de retención y respaldos verificables; documentación de evidencia.
- Mover a funciones RPC las consultas anónimas a `usuarios` y `pre_registros`.
- amfa necesita su propio aviso de privacidad y consentimientos con su razón social
  (los 11 textos legales del sistema siguen nombrando a QP Clinic, S.C. — es correcto por ahora).


## Identidad del usuario
**Dr. José Alan Polanco Fierro** — Director General de QP Clinic  
- Médico Cirujano (UNAM) + Especialista en Medicina del Deporte (IPN)  
- RFC personal: POFA810319L30 | Cédula Prof: 6382840 | Cédula Esp: 10861477  
- Datos clínica: Insurgentes Sur 933, Piso 12, Col. Nápoles, Benito Juárez, CDMX  
- Tel: 55 5682 4345 / 56 4423 7028 | WhatsApp clínica: +52 5644237028  
- RFC clínica: QCL230518J66 | Socio: Iván Quevedo  
- GitHub: `drjoepolanco-creator/qp-clinic-ece`  
- Sitio: `qpclinic.org` (Vercel + Supabase)

## Arquitectura del sistema
- **Tipo:** SPA single-file (`index.html`, 14,468 líneas) + `/api/ia-medica.js`
- **Supabase project:** `ebukjdxeekhzeurmhgkj`
- **Archivo de trabajo activo:** `/mnt/user-data/outputs/index.html` ← SIEMPRE usar este
- **REGLA CRÍTICA:** Nunca revertir a archivos subidos por el usuario. Siempre usar el outputs como base.
- **Deploy:** GitHub → Vercel automático

## Patrones técnicos establecidos (NUNCA romper)
1. **PDF:** Motor HTML→canvas (html2canvas scale:3, ~288dpi), jsPDF addImage. NUNCA jsPDF posicional para texto clínico.
2. **INSERT Supabase:** Solo columnas base. UPDATEs separados para campos JSONB (responsable, seguro_medico, domicilio, etc.)
3. **`go(pg, {key:val})`:** Segundo parámetro para asignación atómica de STATE antes de draw(). NUNCA `go(pg); STATE.x=val` (race condition).
4. **JWT corruption:** `_esJWTCorrupto()` + `_limpiarYRecargar()` globales al inicio del script. `sbRefresh()` + `sbSafe()` para queries.
5. **Datos internos en `anexos`:** Prefijos especiales: `__OBJCAL__:` (objetivos calóricos), `__IA__:` (análisis laboratorio). Excluidos de la lista de Documentos.
6. **WhatsApp:** Siempre `https://web.whatsapp.com/send?phone=...` (nunca wa.me ni api.whatsapp.com — abre directamente WA Web sin pantalla intermedia).
7. **`calcEdad(fnac)`:** Devuelve string "45a 3m". Para fórmulas numéricas usar `edadAnios(fnac)` (devuelve número puro).

## Módulos implementados (navegación)

### Menú principal (nav)
`Agenda | Pacientes | Nuevo paciente | Herramientas | Ultrasonido | Nutrición ▾ | Configuración ▾`

### Nutrición (dropdown)
- **🧮 Cálculo nutricional** → `pgNutricionCalculo()` con 4 sub-pestañas:
  - 📏 Mediciones (desde InBody)
  - 🧮 Cálculos (4 fórmulas GEB + selector AF)
  - 📊 Calorías (déficit/normocalórico/superávit)
  - 📋 Cálculos calóricos guardados (desde `anexos __OBJCAL__:`)
  - **Mediciones son EDITABLES** (`STATE.calcM`): se precargan del InBody pero el nutriólogo puede cambiarlas y todo recalcula en vivo. NUNCA leer peso/talla directo de `STATE.calcIB` — usar `medicionesActuales()`.
  - Fórmulas: las 4 originales + **Katch-McArdle** (si hay %grasa) + **TMB del equipo InBody**
  - Déficit: kcal/kg, −300/−500/−750 kcal sobre GET, −15/20/25% del GET, manual (kcal/kg o kcal totales)
  - **Panel de macronutrientes** (`macroPanelHTML()` / `renderMacroResultado()`) en los 3 balances: prot y lip en g/kg, HC por diferencia
- **Plantillas Famel** (4 fases) → `pgNutricionPlantillas()`:
  - Fase 1: Cetosis Franca | Fase 2: Cetosis Mixta | Fase 3: Transición | Fase 4: Mantenimiento
  - Requiere paciente activo. Logo Famel embebido en base64. Botón ← Expediente.
  - PDF HTML→canvas con logo Famel + tablas editables + listas de referencia fija

### Configuración (dropdown, solo admin)
- Gestión de médicos y usuarios (`pgMedicos`)
- Bitácora, Reportes de Dirección, Corte de Caja, Trámites, Herramientas

### Expediente del paciente (`pgExp`)
Sub-pestañas: Ficha | Signos Vitales (enfermería) | Antecedentes | Consultas | InBody | Ultrasonido | Interconsultas | Fisioterapia | Nutrición | Vacunas | Documentos Anexos

### Consulta médica (`pgConsulta`)
- Tipos de nota: Nota de evolución, **Nota nutricional** (nueva), Nota de primera vez, Urgencias, Pre/Pos-operatoria, Egreso, Referencia, Interconsulta, Valoración preanestésica, Anestesia transoperatoria, Postanestésica
- **Nota nutricional**: formulario ABCD completo (`renderSeccionEspecial`), campos `dc_nu_*`. Oculta EVA, Exploración física y Pronóstico vía `CAMPOS_OCULTOS_NOTA`. Botones "📥 Traer del InBody" y "🧮 Traer objetivo calórico". IMC, ICC y macros se autocalculan con `nutriRecalcular()`. Sección propia en el PDF (`SEC_QX["Nota nutricional"]`).
  - ⚠️ `esNotaSinSOAP(tipo)` distingue notas quirúrgicas (ocultan todo el SOAP) de la nutricional. No usar `CAMPOS_OCULTOS_NOTA[tipo]` como booleano.
- Campo Tratamiento: botón **💊 Suplementación** — **17 productos** en `FAMEL_SUPLEMENTOS`, el catálogo Famel Nutrition COMPLETO según la ficha técnica oficial ("Productos Famel", 18 págs, sep-2025): Vanilla / Strawberry / Chocolate / Whey Moka Protein Mix, Hot Cakes Protein, Creatine, Myo + D Chiro Inositol, Iso Flav Fem, Glutamine, Gli Mg Complex, Full CitraMag, Antiox C+D3, Calcium Plus, Tripto + B6 + CitMg, Omega +, Vitam Fusion, Akker + B. Lactis Probiotic. Cada `texto` incluye composición en mg por porción/unidad + posología con intervalo horario (cada 12 / cada 24 h) y duración. La duración usa el marcador **`{DIAS}`**, que `agregarSuplementoATratamiento()` sustituye con el valor del selector `#sup-dias` (15/30/45/60/90 días, default `SUP_DIAS=30`). Menú con **buscador**, selector de duración y contador; permanece abierto para agregar varios. **NUNCA recortar ni agregar productos de otras marcas.** + **Receta electrónica**
- PDF nota médica: HTML→canvas, logo QP Clinic, tabla CIE-10 automática, tratamiento numerado, lab/gab con viñetas, pronóstico en badges, firma digital
- Autoguardado cada 90 segundos
- IA médica integrada (claude-opus-4-6): diagnósticos sugeridos, SOAP, análisis InBody, análisis laboratorio

### Prescripción de Ejercicio (v2 — motor volumétrico VME/VMR)
Reprogramado desde las 6 plantillas de Excel del Dr. Polanco. Ocupa ~1,300 líneas.
- **`EJ_PASOS`**: 11 variables secuenciales con los deltas exactos de las fórmulas IFS del Excel (nivel → edad → talla → peso → sueño → recuperación → estrés → novedad → dieta → esteroides → sexo). `ejCalcularVolumen()` devuelve la traza paso a paso para auditoría.
- **⚠️ Única desviación del Excel**: el bucket «Mujer >175 cm» se corrigió de +1/+2 a **−1/−2** por simetría con «Hombre >195 cm» (decisión del Dr. Polanco). Va marcado con `corregido:true` y se avisa en pantalla.
- **`EJ_BIBLIO`**: 11 grupos · 31 patrones · **457 ejercicios**, extraídos de las listas desplegables. NO recortar.
- **`EJ_SECUENCIAS`**: 5 secuencias (3d, 4d, 5d_inf, 5d_sup, 6d) con superseries `3A/3B` respetadas.
- **Topes de seguridad**: `EJ_MAX_SESION=10` series por grupo/sesión, `EJ_MAX_FILA=5`. Si la secuencia no alcanza el objetivo para un grupo, se avisa en `plan.aviso`.
- **Progresión por Ajuste**: compuestos mueven CARGA (±5%/±2.5%), aislados mueven REPETICIONES (±2/±1). `ejAplicarAjuste()`.
- **Cuestionario de bienestar**: 6×5 = 30 pts, 6 rangos de recomendación.
- Guarda en `anexos` con prefijo `__EJERCICIO__:` y `version:2`. `verPlanEjercicio()` detecta los planes del motor anterior y los abre en modo lectura.

## Módulos especiales

### Interconsultas
- Buscador de médico por nombre/especialidad (no select simple)
- `telefono` (no `celular`) es el campo correcto en tabla `usuarios`
- `medico_interconsultante_id` se guarda al crear
- Respuesta → redirige a "Nota de interconsulta" en Consultas (no formulario inline)
- Al guardar nota de interconsulta → marca IC como "Respondida" automáticamente
- Botón 📲 Reenviar por WhatsApp en lista y en modal de cada IC
- WA: solo texto informativo, sin PDF, sin enlace al sistema

### Signos Vitales (Enfermería)
- Formulario SIEMPRE inicia en blanco (peso/talla sugeridos desde InBody, resto vacío)
- Si ya hay registro del día → aviso informativo azul (no prellenar)
- Bug corregido: `setET("sv")` (no "triage")

### PDF de Interconsulta
- Motor HTML→canvas, diseño según JSON proporcionado
- Logo QP Clinic desde Supabase Storage
- Badge estatus (pendiente/respondida), tabla CIE-10, firmas en dos columnas

### Módulo Ultrasonido
- 22 plantillas de texto, BI-RADS SVG editor
- PDF HTML→canvas (div 720px, scale:3)

### InBody / Composición Corporal
- Extracción IA desde PDF (claude-opus-4-6)
- 12 campos: peso, altura, IMC, %grasa, masa grasa/muscular, agua, proteína, minerales, grasa visceral, TMB, masa celular

### Cálculo Nutricional — Fórmulas GEB
```
FAO/OMS/ONU (Schofield): por rangos de edad/sexo
Harris-Benedict: H=66.5+13.75p+5.08t-6.78e | M=655.1+9.56p+1.85t-4.68e
Valencia (mexicanos): H<30: 13.37p+747 | H30-60: 13.08p+693 | H>60: 14.21p+429
                      M<30: 11.02p+679 | M30-60: 10.92p+677 | M>60: 10.98p+520
Mifflin-St.Jeor: H=(9.99p)+(6.25t)-(4.92e)+5 | M=mismo-161
```
Niveles AF: Sedentario 0%/1.00/<1.6METs | Ligera 30%/1.375/1.6-2.9 | Moderada 45%/1.55/3.0-5.9 | Intensa 65%/1.725/6.0-8.9 | Muy intensa 85%/1.90/≥9.0

### Gestión de Usuarios
- Campo "Correo electrónico real *" obligatorio al crear (correo del profesionista)
- Login con: campo `username` (ej. dr.garcia) → busca email en tabla usuarios → auth con email+password
- Desactivar/activar usuario (no eliminar — preserva historial NOM-004)
- `telefono` (no `celular`) en tabla `usuarios`
- Al crear: `email` solo se incluye en `profilePayload` si es usuario nuevo (`if(!uid)`)

## Tablas Supabase principales
`pacientes | usuarios | consultas | signos_vitales | interconsultas | inbody_resultados | ultrasonido_reportes | anexos | agenda | fisioterapia_notas | notas_enfermeria | bitacora`

Columnas JSONB en `pacientes`: `responsable`, `seguro_medico`, `domicilio`, `datos_laborales`, `facturacion`  
Columnas que NO existen: `objetivo_calorico_actual`, `objetivo_calorico_historial`, `celular` en usuarios

## Consentimientos informados (17 tipos)
Sistema de firma digital (`firmar.html`), guardado en Storage `expedientes/{pid}/consentimientos/`

## Instrucción de trabajo
- **Archivo base siempre:** `/mnt/user-data/outputs/index.html`
- Verificar sintaxis con `node -e "..."` después de cada cambio
- `cp /home/claude/index.html /mnt/user-data/outputs/index.html` al finalizar
- Llamar `present_files` al terminar para entrega
- El Dr. Polanco sube manualmente el archivo a GitHub para deploy en Vercel

