# QP Clinic ECE — Contexto completo para continuación

## ⚠️ LEER PRIMERO — reglas de operación (actualizado 21 agosto 2026)

1. **Fuente de verdad: `C:\Users\Alan\Documents\qp-clinic-ece`** (repo git conectado a GitHub → Vercel).
   La carpeta de Google Drive quedó OBSOLETA. No editar ahí: ya causó una divergencia de versiones.
   El Dr. Polanco publica con **doble clic en `publicar.bat`**, que corre el verificador, pide una
   descripción del cambio y hace `add`/`commit`/`push`. No tiene terminal abierta ni la necesita.

0. **La interfaz nunca debe afirmar algo que no ocurrió.** Es el error que más caro ha salido en
   este proyecto, tres veces distintas:
   · el login mostraba «usuario o contraseña incorrectos» ante *cualquier* fallo —incluido el
     bloqueo por exceso de intentos—, y el personal reintentaba hasta quedar fuera;
   · el campo «Nueva contraseña» de otro usuario no cambiaba nada y avisaba «Perfil guardado»;
   · un botón decía «Resumen Clínico PDF» y respondía «función disponible próximamente».
   Ante un error, mostrar la causa real y qué hacer. Ante una función que no existe, no poner
   el botón.

2. **Correr `python verificar.py index.html` antes de entregar.** Está enganchado como hook de
   pre-commit (`git config core.hooksPath .githooks`). Nueve comprobaciones nacidas de errores
   reales. La más importante es CHK-3: detecta variables usadas fuera de la función donde se
   declaran, que fue lo que tumbó los expedientes en producción.

3. **Supabase YA TIENE RLS configurado** en las 34 tablas. **NO activar/desactivar RLS ni
   inventar políticas sin ver antes las que existen.** Agregar una política `USING (true)` a una
   tabla que ya tiene otras las AFLOJA, porque en PostgreSQL las políticas se suman con OR.
   Antes de proponer cualquier cambio de seguridad, pedir primero:
   `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
   y `SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname='public';`
   **El editor SQL de Supabase solo muestra el resultado de la ÚLTIMA consulta pegada.**
   Entregar siempre una consulta a la vez, o los diagnósticos se pierden.

6. **Al cambiar la unidad de un usuario o paciente, revisar las restricciones CHECK.**
   `usuarios_sede_chk` y `pacientes_sede_origen_chk` enumeran los valores permitidos y se
   escribieron antes de que AMFA existiera. Ambas ya incluyen `'amfa'`; una unidad futura
   necesitará el mismo ajuste.

4. **Al aplicar parches en el índice de 20 mil líneas, verificar el punto de inserción.**
   Los patrones de texto se repiten. Un bloque destinado a `pgExp` cayó en `pgMedicos` porque
   se reemplazó la primera coincidencia sin comprobar en qué función estaba.

5. **Excepciones que NO deben cerrarse sin cambiar código:**
   `usuarios` (el login la consulta sin sesión para traducir usuario→correo) y
   `pre_registros` (los pacientes llenan su pre-registro desde un enlace con token).

## Acceso de usuarios y contraseñas (21 agosto 2026 — RESUELTO)

Durante semanas el personal quedaba fuera del sistema y se daban de alta personas duplicadas con
otro correo. Eran **tres causas encadenadas**, ninguna evidente:

1. **El login mentía.** Cualquier error se mostraba como «usuario o contraseña incorrectos», así
   que ante un correo sin confirmar la gente reintentaba hasta agotar el límite de Supabase — y el
   bloqueo también decía «contraseña incorrecta». Ahora nombra la causa: correo sin confirmar
   (con enlace para reenviar), demasiados intentos (**pidiendo que esperen**, no que reintenten) o
   cuenta desactivada.
2. **El campo «Nueva contraseña» de otro usuario no cambiaba nada**: enviaba un correo de
   restablecimiento que nunca llegaba. Sustituido por la función del servidor.
3. **Las cuentas creadas antes de apagar *Confirm email* seguían sin confirmar.** Se corrigieron
   en bloque con `UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL`.

**Estado actual del acceso:**

- *Confirm email* está **apagado** en Authentication → Sign In / Providers. Las cuentas nuevas
  entran de inmediato con la contraseña que fija el administrador.
- **Edge Function `fijar-contrasena`** (código y guía en `supabase/functions/fijar-contrasena/`):
  un administrador escribe la contraseña de otra persona de su unidad y queda activa al instante.
  Verifica rol admin, respeta el aislamiento de unidades, no toca cuentas ocultas, marca el correo
  como confirmado y asienta el cambio en `bitacora_accesos` como `CAMBIO DE CONTRASEÑA`.
- El alta de usuarios **propone el nombre de usuario** (`dr.garcia`, sin acentos), **precarga la
  contraseña por defecto** `QpClinic2026!`, **comprueba duplicados de correo y de usuario antes de
  tocar Auth** y termina con una ficha de entrega copiable.
- **Cuentas de dirección**: `usuarios.oculto = true` las saca de gestión de usuarios, de los
  filtros de agenda y del buscador de interconsultas. Siguen registradas en bitácora.

⚠️ **PENDIENTE Y BLOQUEANTE PARA EL PERSONAL:** el proyecto usa el correo compartido de Supabase,
que **solo entrega a direcciones miembros de la organización**. «Olvidé mi contraseña» está roto
para todos salvo el Dr. Polanco. Se arregla configurando SMTP propio (Resend con `qpclinic.org`) en
Authentication → Emails → SMTP Settings.

## Autoguardado general (24 agosto 2026)

El autoguardado anterior vigilaba siete campos fijos (`cs_subj` … `cs_plan`). En las notas
quirúrgicas esos siete están ocultos por `CAMPOS_OCULTOS_NOTA` y el texto vive en los `dc_*`, así
que la pregunta «¿hay algo escrito?» daba siempre falso y **el temporizador nunca guardaba, justo
en la nota más larga de todas**. El respaldo local miraba la misma lista, de modo que tampoco
había red de seguridad. Ahora hay un motor único, `AG_SECCIONES`, que **no conoce ninguna lista de
campos**: recorre los `input/textarea/select` visibles dentro de la sección activa.

**Dos modos, y el aviso en pantalla dice cuál ocurrió:**

- **`expediente`** — nota de consulta, antecedentes, interrogatorio. Escriben en Supabase con
  upsert o update idempotente, así que repetir el guardado no ensucia nada. Usan
  `guardarConsultaSilencioso()`, `persistirAntecedentes()` y `persistirInterrogatorio()`; estas dos
  últimas se extrajeron de los botones Guardar para que el motor y el botón compartan la escritura.
- **`borrador`** — signos vitales, fisioterapia y ficha de identificación. Su guardado real hace
  **INSERT de un registro nuevo** o exige validación. Autoguardar eso en la base llenaría el
  expediente de registros a medias, que es peor que no tener ninguno; ahí solo se conserva un
  borrador en el equipo (`qp_borrador_<seccion>_<pid>`) y al volver aparece una barra que ofrece
  recuperarlo. ⚠️ **No pasar estas secciones a modo `expediente` sin convertir antes su guardado
  en upsert.**

**Cuándo dispara:** cada 30 s · al salir de una sección (`setET()` es ahora `async` y guarda antes
de dibujar la siguiente) · al cerrar la nota (`cerrarConsulta()` espera el guardado antes de
vaciar `STATE.consultaActual`) · al ocultarse la pestaña · al cerrar el navegador.

**El error ya no se esconde.** `guardarConsultaSilencioso()` tenía un `catch{}` vacío que se
tragaba los fallos y dejaba la nota como si estuviera guardada. Ahora devuelve `{error}` y el
motor deja un aviso rojo que **no se desvanece solo** — regla 0. Lo que sigue igual: el
autoguardado no escribe en `bitacora_accesos`, así que una nota que aparece en `consultas` sin su
evento `GUARDADO DE NOTA` fue un autoguardado, no un guardado manual.

**`confirmarTipoDeNota()`** avisa al firmar cuando el texto habla de un procedimiento quirúrgico
pero el tipo seleccionado no es una nota quirúrgica. Es la corrección de la causa real del
incidente del 23 de agosto: una nota posquirúrgica de la paciente del expediente 357 se dio por
perdida y en realidad estaba guardada y firmada **como nota de evolución** — el médico escribió el
título «Nota postquirurgica y de seguimiento» dentro del campo Subjetivo y nunca movió el selector.
No fue un fallo de la base; fue de la interfaz, que dejó firmar sin decir nada.

## Alergias: una sola lista para todas las pantallas (24 agosto 2026)

Había **dos almacenes separados** y solo uno se mostraba. `STATE.alergs` es la lista del catálogo
(las que se marcan con clic) y `STATE.alOtrosText` es el texto libre de la sub-pestaña «✏️ Otros».
La barra roja del encabezado leía únicamente `STATE.alergs`, así que una alergia capturada en el
texto libre **se guardaba correctamente pero no aparecía en ninguna pantalla** — parecía que el
guardado había fallado, y la única forma de verla era volver a Alergias y marcarla en la lista.

- **`alergiasPaciente()`** junta las dos fuentes, quita duplicados sin distinguir mayúsculas,
  descarta «ALERGIAS NEGADAS» y parte el texto libre por saltos de línea, comas y punto y coma.
  Es la única fuente para el encabezado, la nota de consulta, el resumen médico y el contexto de
  la IA. **No volver a leer `STATE.alergs` directo para mostrar alergias.**
- **`badgeAlergiasHTML()`** dibuja la barra (misma pieza en expediente y en consulta) y
  **`refrescarBadgeAlergias()`** la actualiza en caliente: al marcar una alergia solo se redibuja
  `#ab`, y el encabezado se quedaba con la lista anterior hasta cambiar de sección.

## Pantalla de Consulta — encabezado (24 agosto 2026)

Muestra el **nombre completo** (antes solo nombre y apellido paterno) y la **barra roja de
alergias**, igual que el expediente. El campo «Alergias» de la nota se precarga con la lista
unificada.

## Quirófano — el nombre del paciente abre su expediente (24 agosto 2026)

En la tabla de episodios el nombre es un enlace a `abrirExpediente(id)`. Se regresa con el botón
Quirófano del menú. Si el episodio no tiene paciente ligado, el texto no es clicable.

## Quirófano — cancelar y reprogramar (21 agosto 2026)

Una cirugía **nunca se borra**. Estados `cancelado` y `reprogramado`, ambos con motivo obligatorio
de un catálogo cerrado (`QX_MOTIVOS_CANCELA` / `QX_MOTIVOS_REPROG`) para poder agrupar y medir por
qué se caen. Reprogramar **conserva el episodio original** y crea uno nuevo enlazado por
`episodio_origen`, de modo que la fecha primera no se pierde. Encabezado con contadores y tasa de
cancelación. Columnas agregadas: `motivo_cambio`, `fecha_cambio_estado`, `cambio_por`,
`episodio_origen`, y `episodios_quirurgicos_estado_chk` ampliada.

## PDF generados desde HTML — nitidez contra peso

Todos los PDF del sistema son **fotografías de la pantalla**, no texto: por eso pesan y no se
pueden buscar por dentro.

- **La nitidez la da la escala**, no el formato. Escala 3 sobre el ancho de render ≈ 315 dpi.
  El expediente se había quedado en escala 2 (≈210 dpi) y por eso salía lavado.
- **El peso lo decide el formato.** Guardar en PNG llevó un expediente de tres páginas a **55 MB**,
  porque conserva sin comprimir cada matiz del suavizado de las letras. Con JPEG a `PDF_CALIDAD`
  (constante única, hoy 0.9) se ve igual y pesa una fracción.
- Logos, firmas y gráficas pequeñas sí van en PNG.
- Si algún día el peso vuelve a estorbar, la salida real es generar el PDF como **texto**: pesaría
  unos 200 KB, sería nítido a cualquier zoom y buscable, que es lo que la NOM-024 agradece.

## Receta y papel membretado (21 agosto 2026)

Diseño de **media carta**: firma y pie suben cuando el tratamiento es corto
(`firmaLineY = min(148, max(112, contentY+24))`) y bajan solos si el texto es largo.
Membrete con nombre centrado en azul marino, especialidad e institución, licenciatura e
institución, cédulas en fila, subespecialidad y alta especialidad. Línea con degradado dibujada
por segmentos (jsPDF no sabe hacer degradados), cruces de la marca y iconos de teléfono y
ubicación dibujados como vectores.
**`abreviarInstitucion()`** convierte «Universidad Nacional Autónoma de México» en UNAM y demás:
antes se cortaban a la derecha. Si aparece una institución desconocida de más de 26 caracteres,
arma las siglas sola. Nadie tiene que cambiar su perfil.
El pie toma teléfono y domicilio **de la sede activa**; antes estaban escritos a mano y una receta
de AMFA salía con los datos de QP.

## AMFA Nutrición Especializada — tercera unidad (10 agosto 2026, EN PRODUCCIÓN)

Regla única del aislamiento: **AMFA ve solo lo suyo; todas las demás unidades ven QP
(clinic + surgery) como una sola casa.** Vive en `puede_ver_paciente(pid)`.

- **Tabla puente `paciente_sedes`** (paciente_id, sede, origen) dice qué unidades alcanzan a cada
  paciente. La mantienen tres disparadores: alta de paciente, consulta guardada e interconsulta
  (esta última es el puente deliberado entre unidades). Ver `AMFA_1_preparar.sql`.
- **`sede_del_usuario()`** lee `usuarios.sede` con `COALESCE(..., 'clinic')`. Ese respaldo silencioso
  costó horas de diagnóstico: cuando la función fallaba, los pacientes de AMFA se guardaban como de
  QP sin ningún error visible. Por eso **la aplicación escribe `payload.sede_origen = sedeActiva()`
  al dar de alta** (`pgNuevoPaciente`): el navegador sí sabe en qué unidad está. No quitar esa línea.
- **Políticas en `pacientes`:** `pacientes_sel/ins/upd/del`. No debe existir `auth_all_pacientes`
  junto a ellas.
- **Reparar huérfanos** (pacientes sin fila en la tabla puente; se ven por `sede_origen` pero no
  cuentan en los padrones):
  ```sql
  INSERT INTO public.paciente_sedes (paciente_id, sede, origen)
  SELECT p.id, COALESCE(p.sede_origen,'clinic'), 'reparacion' FROM public.pacientes p
   WHERE NOT EXISTS (SELECT 1 FROM public.paciente_sedes ps WHERE ps.paciente_id = p.id)
  ON CONFLICT DO NOTHING;
  ```
- **Padrón real por unidad** (contra el que se comparan los totales de la interfaz):
  ```sql
  SELECT ps.sede, count(DISTINCT ps.paciente_id) FROM public.paciente_sedes ps
    JOIN public.pacientes p ON p.id = ps.paciente_id
   WHERE p.activo IS DISTINCT FROM false GROUP BY ps.sede;
  ```
  Al 10-ago-2026: clinic 313 · surgery 313 · amfa 1.
- **Salida de emergencia:** `AMFA_3_revertir.sql` devuelve todo a `auth_all_*` en segundos.
- **En el front:** `esAmfa()`, `usuarioAmfa()`, `sedeDir()`, `sedeTels()`, `sedePie()`.
  `puedeCambiarSede()` es false para amfa; `toggleSede()` solo cicla clinic↔surgery; el nav se
  filtra a Agenda/Pacientes/Nuevo/Herramientas; `GRUPOS_VIS` filtra la barra del expediente
  (**dentro de `pgExp`**, no de `pgMedicos`); `tiposNotaDisponibles()` deja solo Nota nutricional
  y Nota de interconsulta; `pgBitacora`, `pgReportes`, `pgCorteCaja` y `pgTramites` tienen guarda.
- **El número de expediente es un contador único compartido** entre las tres unidades, así que las
  series salen intercaladas. Es cosmético y el Dr. Polanco lo aceptó. Si algún día quiere serie
  propia para AMFA (`AMFA-001`), es un contador aparte y no toca los expedientes existentes.

## Pendientes

**Por orden de urgencia:**

1. **SMTP propio** (Resend con `qpclinic.org`) en Authentication → Emails. Sin esto «Olvidé mi
   contraseña» seguirá roto para todo el personal. Es el único pendiente que afecta la operación
   diaria.
2. **Razón social de amfa** y sus propios aviso de privacidad y consentimientos. Hoy los pacientes
   de amfa firman documentos a nombre de QP Clinic, S.C., que no es quien les presta el servicio.
   Es la brecha B-07 del manual y hay exposición legal desde el primer paciente.
3. **Revisar el consumo de Supabase.** El panel mostró *EXCEEDING USAGE LIMITS*; el proyecto se
   subió a plan Pro el 21 de agosto pero conviene confirmar que quedó dentro de los límites.
4. **Verificar que la bitácora sea inmutable en la base** (brecha B-09). El sistema no ofrece
   forma de editarla, pero no está comprobado que la tabla esté restringida a INSERT, y el
   artículo 8 de la NOM-024 lo exige.
5. **Constancias de capacitación** del personal (brecha B-04) y **registro de verificación mensual
   de respaldos** (B-05). Ambas son papeleo, no desarrollo.
6. **El checklist de cirugía segura de la OMS aparece en 0/3 en los doce episodios**, incluidos los
   finalizados. Averiguar si no se usa o si no se guarda.
7. Certificación NOM-024: falta trazabilidad de *consultas* (quién vio qué expediente), no solo de
   escrituras (B-02), e interoperabilidad HL7 CDA (B-03). Consultar el texto vigente de la DGIS
   antes de planear.
8. Mover a funciones RPC las consultas anónimas a `usuarios` y `pre_registros`.

## Documentación del sistema (agosto 2026)

- **`QP-OP-PNO-013 Manual de procedimientos del SIEC.docx`** — 16 procedimientos operativos con
  tabla de actividades, sobre la plantilla oficial PNO. Anexo A con 9 brechas, responsable y fecha.
- **`Manual SIEC QP Clinic v2.0.docx`** — descripción del sistema, control de acceso, seguridad,
  bitácora y respaldo. Su apartado 14.1 lista cinco afirmaciones de la versión 1.0 que no
  correspondían al sistema real.
- Ambos se remiten entre sí y **no deben contradecirse**: si cambia una brecha, actualizar los dos.


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
- **Tipo:** SPA single-file (`index.html`, ~20,600 líneas) + `/api/ia-medica.js`
- **Supabase project:** `ebukjdxeekhzeurmhgkj`
- **Archivo de trabajo activo:** `C:\Users\Alan\Documents\qp-clinic-ece\index.html` ← SIEMPRE este
- **REGLA CRÍTICA:** Nunca revertir a versiones anteriores ni a archivos subidos al chat.
- **Deploy:** GitHub → Vercel automático
- **Unidades:** `clinic` (QP Clinic) · `surgery` (QP Surgery) · `amfa` (AMFA Nutrición Especializada)

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
- **Archivo base siempre:** `C:\Users\Alan\Documents\qp-clinic-ece\index.html`
- Correr `python verificar.py index.html` después de cada cambio (hook de pre-commit)
- Llamar `present_files` al terminar para entrega
- El Dr. Polanco publica con **doble clic en `publicar.bat`**. No usa terminal: el .bat le pide la
  descripción del cambio y hace todo lo demás. Sugerirle el texto del commit **sin acentos ni ñ**,
  que la consola de Windows rompe.
- **Cuando haya que tocar Supabase**, entregar una consulta a la vez y decirle la ruta exacta del
  panel. Yo no manejo credenciales ni doy de alta cuentas: la llave de servicio, las contraseñas y
  el alta de proveedores los hace él.

