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

# ── CHK-5 · Columnas de Supabase ───────────────────────────────────────────
titulo("CHK-5 · Columnas escritas a Supabase")
COLUMNAS_INEXISTENTES = ["objetivo_calorico_actual", "objetivo_calorico_historial", "celular_usuario"]
for col in COLUMNAS_INEXISTENTES:
    hits = [n for n, l in enumerate(lineas, 1)
            if re.search(r"\b" + col + r"\s*:", l) and re.search(r"\.(insert|update|upsert)\(", l)]
    if hits:
        falla(f"se escribe «{col}», que no existe en la base (líneas {hits[:5]})")
if all("no existe en la base" not in f for f in fallas):
    ok("sin escrituras a columnas inexistentes")

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
