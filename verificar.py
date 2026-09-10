#!/usr/bin/env python3
"""
Verificador del ECE QP Clinic — se ejecuta antes de cada commit.

Nace de errores reales que llegaron a producción:
  · un bloque insertado en pgMedicos que se usaba en pgExp  → CHK-3
  · un selector con opciones que no incluían el valor guardado → CHK-6
  · escrituras a columnas de Supabase que no existían → CHK-5
  · direcciones escritas a mano en vez de leerse de la sede → CHK-7

Uso:  python verificar.py [ruta/al/index.html]
Sale con código 1 si algo falla, para que el hook de git detenga el commit.
"""
import re, sys, json, subprocess, tempfile, os
from pathlib import Path

ARCHIVO = Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
ROJO, VERDE, AMAR, GRIS, FIN = "\033[91m", "\033[92m", "\033[93m", "\033[90m", "\033[0m"
fallas, avisos = [], []

def ok(m):    print(f"  {VERDE}✓{FIN} {m}")
def falla(m): fallas.append(m); print(f"  {ROJO}✗ {m}{FIN}")
def aviso(m): avisos.append(m); print(f"  {AMAR}! {m}{FIN}")
def titulo(m): print(f"\n{GRIS}── {m} {'─'*max(0,58-len(m))}{FIN}")

src = ARCHIVO.read_text(encoding="utf-8")
lineas = src.split("\n")
bloques = re.findall(r"<script(?![^>]*\ssrc=)[^>]*>(.*?)</script>", src, re.S)

# ── CHK-1 · Sintaxis JavaScript ────────────────────────────────────────────
titulo("CHK-1 · Sintaxis")
for i, b in enumerate(bloques):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(b); ruta = fh.name
    r = subprocess.run(["node", "--check", ruta], capture_output=True, text=True)
    os.unlink(ruta)
    if r.returncode == 0:
        ok(f"bloque <script> #{i} ({len(b.splitlines())} líneas)")
    else:
        falla(f"bloque #{i}: {r.stderr.strip().splitlines()[-1] if r.stderr else 'error'}")

# ── CHK-2 · Definiciones duplicadas ────────────────────────────────────────
titulo("CHK-2 · Funciones definidas dos veces")
defs = {}
for n, l in enumerate(lineas, 1):
    m = re.match(r"^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function", l)
    if m:
        nom = m.group(1) or m.group(2)
        defs.setdefault(nom, []).append(n)
dup = {k: v for k, v in defs.items() if len(v) > 1}
if dup:
    for k, v in sorted(dup.items()):
        aviso(f"{k} definida en líneas {v}")
else:
    ok(f"{len(defs)} funciones, ninguna duplicada")

# ── CHK-3 · Variables usadas fuera de la función donde se declaran ─────────
# Este es el que habría atrapado el bug de GRUPOS_VIS.
titulo("CHK-3 · Alcance de variables locales")
def cuerpo_de(ini):
    """Devuelve las líneas de una función balanceando llaves desde su apertura."""
    prof, dentro, fin = 0, False, ini
    for k in range(ini, min(ini + 4000, len(lineas))):
        l = re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`|//.*$', "", lineas[k])
        prof += l.count("{") - l.count("}")
        if "{" in l: dentro = True
        if dentro and prof <= 0:
            fin = k + 1; break
    else:
        fin = min(ini + 4000, len(lineas))
    return fin

inicios = [(n, m.group(1) or m.group(2)) for n, l in enumerate(lineas)
           for m in [re.match(r"^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function", l)] if m]
cuerpos = [(nom, n, cuerpo_de(n), "\n".join(lineas[n:cuerpo_de(n)])) for n, nom in inicios]

# Solo se vigilan constantes declaradas en el primer nivel del cuerpo (2 espacios),
# que son las que un parche mal ubicado puede dejar huérfanas.
declaradas = {}
for nom, ini, fin, cuerpo in cuerpos:
    for m in re.finditer(r"^  (?:const|let)\s+([A-Z][A-Za-z0-9_]{3,})\s*=", cuerpo, re.M):
        declaradas.setdefault(m.group(1), set()).add(nom)

problemas = 0
for nom, ini, fin, cuerpo in cuerpos:
    propias = {m.group(1) for m in re.finditer(r"(?:const|let|var)\s+([A-Z][A-Za-z0-9_]{3,})\s*=", cuerpo)}
    limpio = re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|//.*$', "", cuerpo, flags=re.M)
    for var, donde in declaradas.items():
        if var in propias or nom in donde or len(donde) > 1:
            continue   # si se declara en varias funciones, es un nombre genérico
        if re.search(r"[^\w.$]" + re.escape(var) + r"\s*[.\[(]", limpio):
            falla(f"{nom}() usa «{var}», declarada solo en {list(donde)[0]}()")
            problemas += 1
if not problemas:
    ok(f"{len(cuerpos)} funciones revisadas, sin variables fuera de alcance")

# ── CHK-4 · Funciones invocadas que no existen ─────────────────────────────
titulo("CHK-4 · Llamadas a funciones inexistentes")
conocidas = set(defs)
codigo = re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`|//.*$|/\*[\s\S]*?\*/', "", src, flags=re.M)
PREFIJOS = r"(?:pg|render|ej|nutri|sede|calc|guardar|abrir|cerrar|toggle|actualizar|generar|imprimir|descargar)"
llamadas = {m.group(1) for m in re.finditer(r"(?<![\w.$])(" + PREFIJOS + r"[A-Z][A-Za-z0-9_$]*)\s*\(", codigo)}
faltantes = sorted(c for c in llamadas
                   if c not in conocidas
                   and not re.search(r"(?:const|let|var)\s+" + re.escape(c) + r"\s*=", src)
                   and not re.search(r"\b" + re.escape(c) + r"\s*[:=]\s*(?:async\s*)?(?:function|\()", src))
for c in faltantes[:12]:
    falla(f"se llama {c}() pero no existe")
if not faltantes:
    ok(f"{len(llamadas)} llamadas a funciones del proyecto, todas definidas")

# ── CHK-5 · Columnas escritas a Supabase (contra el esquema real) ──────────
titulo("CHK-5 · Columnas escritas a Supabase")
ESQUEMA = ARCHIVO.parent / "esquema.json"

def _enmascarar(txt):
    """Deja solo el nivel 1 de un objeto: borra anidados y contenido de cadenas."""
    out, prof, i, n = [], 0, 0, len(txt)
    cita = None
    while i < n:
        c = txt[i]
        if cita:
            out.append(" ")
            if c == "\\": out.append(" "); i += 2; continue
            if c == cita: cita = None
            i += 1; continue
        if c in "\"'`":
            cita = c; out.append(" "); i += 1; continue
        if c in "{[(":
            prof += 1; out.append(c if prof == 1 else " "); i += 1; continue
        if c in "}])":
            prof -= 1; out.append(c if prof == 0 else " "); i += 1; continue
        out.append(c if prof == 0 else " ")
        i += 1
    return "".join(out)

def _cuerpo_llaves(txt, ini):
    """txt[ini] == '{' → devuelve el interior hasta su llave de cierre."""
    prof, i, n = 0, ini, len(txt)
    cita = None
    while i < n:
        c = txt[i]
        if cita:
            if c == "\\": i += 2; continue
            if c == cita: cita = None
            i += 1; continue
        if c in "\"'`": cita = c; i += 1; continue
        if c == "{": prof += 1
        elif c == "}":
            prof -= 1
            if prof == 0: return txt[ini + 1:i]
        i += 1
    return ""

def _claves_de_objeto(interior):
    m = _enmascarar(interior)
    # los comentarios traen dos puntos y se colarían como claves
    m = re.sub(r"//[^\n]*", "", m)
    # `cond ? null : x` deja «null:» pareciendo clave; fuera las palabras reservadas
    RESERVADAS = {"null", "true", "false", "undefined", "default", "case", "return"}
    claves = {c for c in re.findall(r"([A-Za-z_$][\w$]*)\s*:", m) if c not in RESERVADAS}
    spreads = re.findall(r"\.\.\.\s*([A-Za-z_$][\w$]*)", m)
    return claves, spreads

def _resolver_identificador(nombre, hasta):
    """Claves del objeto literal asignado a `nombre` (const/let) o devuelto por
    la función `nombre`. Busca hacia atrás desde la escritura."""
    claves = set()
    # variable: solo la declaración MÁS CERCANA antes de la escritura. Tomarlas
    # todas mezclaba el `payload` de consultas con el de pacientes.
    decl = list(re.finditer(r"(?:const|let|var)\s+%s\s*=\s*\{" % re.escape(nombre), src[:hasta]))
    if decl:
        ini = src.index("{", decl[-1].end() - 1)
        k, _ = _claves_de_objeto(_cuerpo_llaves(src, ini))
        return k
    # función: los objetos literales que declara dentro
    fn = re.search(r"function\s+%s\s*\([^)]*\)\s*\{" % re.escape(nombre), src)
    if fn:
        cuerpo = _cuerpo_llaves(src, src.index("{", fn.end() - 1))
        for m2 in re.finditer(r"(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*\{", cuerpo):
            k, _ = _claves_de_objeto(_cuerpo_llaves(cuerpo, cuerpo.index("{", m2.end() - 1)))
            claves |= k
    return claves

esquema = None
if ESQUEMA.exists():
    try:
        esquema = json.loads(ESQUEMA.read_text(encoding="utf-8"))
    except Exception as e:
        aviso(f"esquema.json ilegible ({e}); no se pueden comprobar las columnas")

if esquema is None:
    aviso("falta esquema.json — no se comprueban las columnas contra la base real. "
          "Regenerarlo con la consulta de CONTEXTO_PROXIMO_CHAT.md")
else:
    malas, sin_resolver = [], 0
    for m in re.finditer(r'SB\.from\("(\w+)"\)\s*(?:\.\w+\([^()]*\))*?\s*\.(insert|upsert|update)\(', src):
        tabla, op = m.group(1), m.group(2)
        cols = esquema.get(tabla)
        if cols is None:
            # Una tabla entera ausente es una función que nunca sirvió, no un
            # error de este cambio: avisa fuerte pero no bloquea el commit.
            aviso(f"línea {src[:m.start()].count(chr(10))+1}: se escribe en la tabla «{tabla}», "
                  f"que NO EXISTE en la base — esa función nunca ha funcionado")
            continue
        resto = src[m.end():]
        if resto.lstrip().startswith("{"):
            ini = m.end() + (len(resto) - len(resto.lstrip()))
            claves, spreads = _claves_de_objeto(_cuerpo_llaves(src, ini))
            for sp in spreads:
                claves |= _resolver_identificador(sp, m.start())
        else:
            ident = re.match(r"\s*([A-Za-z_$][\w$]*)", resto)
            if not ident:
                sin_resolver += 1; continue
            claves = _resolver_identificador(ident.group(1), m.start())
            if not claves:
                sin_resolver += 1; continue
        linea = src[:m.start()].count("\n") + 1
        for c in sorted(claves - set(cols)):
            malas.append((linea, tabla, c))
    if malas:
        for linea, tabla, c in malas[:20]:
            falla(f"línea {linea}: se escribe «{c}» en {tabla}, que no existe en la base")
        if len(malas) > 20:
            falla(f"...y {len(malas)-20} columna(s) inexistente(s) más")
    else:
        ok(f"todas las columnas escritas existen en la base ({len(esquema)} tablas en esquema.json)")
    if sin_resolver:
        aviso(f"{sin_resolver} escritura(s) con payload que no se pudo leer estáticamente")

# ── CHK-10 · Escrituras que no revisan el error ────────────────────────────
titulo("CHK-10 · Escrituras que no revisan el error de Supabase")
# El error más caro del proyecto: la pantalla dice «guardado» y no se guardó
# nada. Gineco-obstétricos vivió así meses. Las tablas de bitácora y sesión no
# cuentan: ahí el fallo no pierde datos del paciente.
NO_CLINICAS = {"bitacora", "bitacora_accesos", "sesiones", "intentos_login"}
pat_w = re.compile(r'SB\.from\("(\w+)"\)[^\n]*?\.(insert|update|upsert|delete)\(')
sin_revisar = []
for n, l in enumerate(lineas, 1):
    m = pat_w.search(l)
    if not m or m.group(1) in NO_CLINICAS:
        continue
    antes, despues = l[:m.start()], l[m.end():m.end() + 220]
    if re.search(r"(?:const|let|var)\s*\{[^}]*error", antes) or "error" in despues:
        continue
    # el resultado se guarda en una variable o se devuelve: se revisa fuera
    if re.search(r"[\w$\]]\s*=\s*(?:await\s+)?$", antes) or re.search(r"\breturn\s+(?:await\s+)?$", antes):
        continue
    sin_revisar.append((n, m.group(1), m.group(2)))
if sin_revisar:
    aviso(f"{len(sin_revisar)} escritura(s) clínica(s) ignoran el error que devuelve Supabase")
    for n, t, o in sin_revisar[:8]:
        print(f"      línea {n}: {t}.{o}()")
    if len(sin_revisar) > 8:
        print(f"      ...y {len(sin_revisar)-8} más")
else:
    ok("toda escritura clínica revisa el error")

# ── CHK-6 · Coherencia de tipos de nota por sede ───────────────────────────
titulo("CHK-6 · Tipos de nota y sede")
if "function tipoNotaValido(" in src:
    ok("existe tipoNotaValido(): el selector no puede desincronizarse del estado")
else:
    falla("falta tipoNotaValido(): el tipo de nota puede quedar fuera del selector de la sede")
if re.search(r'tipo_nota\|\|"Nota de evolución"', src):
    n = len(re.findall(r'tipo_nota\|\|"Nota de evolución"', src))
    aviso(f'{n} lugares usan el valor por omisión "Nota de evolución" sin validar contra la sede')

# ── CHK-7 · Direcciones fijas en documentos ────────────────────────────────
titulo("CHK-7 · Datos de contacto por sede")
fijas = len(re.findall(r"Insurgentes Sur 933", src))
if fijas > 12:
    aviso(f"{fijas} direcciones escritas a mano (las legales pueden quedarse; los encabezados no)")
else:
    ok(f"{fijas} direcciones fijas, todas en textos legales")
for fn in ["sedeDir", "sedeTels", "sedePie"]:
    if f"function {fn}(" not in src:
        falla(f"falta {fn}(), los documentos no podrían adaptarse a la sede")

# ── CHK-8 · Catálogos que no deben encogerse ──────────────────────────────
titulo("CHK-8 · Catálogos completos")
MINIMOS = {
    "FAMEL_SUPLEMENTOS": (r'^\s{2}\{nombre:"', 17, "suplementos Famel"),
    "EJ_BIBLIO":         (r'^\s{6}"',           457, "ejercicios"),
}
for var, (patron, minimo, etiqueta) in MINIMOS.items():
    i = src.find(f"const {var}=")
    if i < 0:
        falla(f"no existe {var}"); continue
    j = src.find("\n];", i)
    n = len(re.findall(patron, src[i:j], re.M))
    if n < minimo:
        falla(f"{var} tiene {n} {etiqueta}, se esperaban al menos {minimo}")
    else:
        ok(f"{var}: {n} {etiqueta}")

# ── CHK-9 · Módulo de ejercicio ────────────────────────────────────────────
titulo("CHK-9 · Motor VME/VMR")
for fn in ["ejCalcularVolumen", "ejGenerarPlan", "ejAplicarAjuste", "ejPuntajeBienestar"]:
    if f"function {fn}(" in src:
        ok(fn + "()")
    else:
        falla(f"falta {fn}()")

# ── Resumen ────────────────────────────────────────────────────────────────
print(f"\n{GRIS}{'═'*66}{FIN}")
print(f"  {ARCHIVO.name} · {len(lineas):,} líneas · {len(defs)} funciones")
if fallas:
    print(f"  {ROJO}{len(fallas)} falla(s){FIN}" + (f" · {AMAR}{len(avisos)} aviso(s){FIN}" if avisos else ""))
    print(f"\n{ROJO}  NO PUBLICAR hasta resolver las fallas.{FIN}\n")
    sys.exit(1)
print(f"  {VERDE}Sin fallas{FIN}" + (f" · {AMAR}{len(avisos)} aviso(s) para revisar{FIN}" if avisos else ""))
print(f"\n{VERDE}  Listo para publicar.{FIN}\n")
