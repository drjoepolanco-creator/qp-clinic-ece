# Cómo desplegar la función `fijar-contrasena`

Con esta función, un administrador fija la contraseña de otra persona **directamente
desde el ECE**, sin correos de por medio. Son unos diez minutos, una sola vez.

---

## Paso 1 · Crear la función en Supabase

1. Entra al panel de Supabase → proyecto **qp-clinic-ece**.
2. En el menú lateral busca **Edge Functions**.
3. Pulsa **Deploy a new function** → **Via Editor** (el editor del navegador).
4. En el nombre escribe exactamente:

   ```
   fijar-contrasena
   ```

   El nombre debe coincidir letra por letra: así lo busca el ECE.

5. Borra el código de ejemplo que aparece.
6. Abre el archivo `index.ts` de esta misma carpeta, copia **todo** su contenido
   y pégalo en el editor.
7. Pulsa **Deploy function**.

---

## Paso 2 · Comprobar la llave de servicio

La función necesita dos variables: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

**Supabase las proporciona automáticamente a toda Edge Function**, así que lo más
probable es que no tengas que hacer nada. Solo si en el Paso 4 aparece el error
*«La función no está configurada correctamente»*, entonces:

1. Ve a **Edge Functions** → **Secrets** (o *Project Settings → Edge Functions*).
2. Agrega:
   - Nombre: `SUPABASE_SERVICE_ROLE_KEY`
   - Valor: la llave que está en **Project Settings → API Keys → `service_role`**
3. Guarda y vuelve a desplegar la función.

> ⚠️ Esa llave abre la base de datos completa, sin restricciones.
> No la pegues en un chat, ni en un correo, ni en el código del ECE.
> Solo va en el apartado de secretos de Supabase.

---

## Paso 3 · Publicar el ECE

Doble clic en `publicar.bat`, en la carpeta del proyecto. Espera uno o dos
minutos a que Vercel termine y recarga con **Ctrl + F5**.

---

## Paso 4 · Probar

1. Entra al ECE como administrador.
2. **Configuración → Gestión de médicos y usuarios**.
3. Pulsa **Editar** en cualquier persona (no en ti mismo).
4. En el recuadro **🔑 Fijar contraseña de esta persona**, escribe una contraseña
   y pulsa **Fijar contraseña**.
5. Debe aparecer un aviso con los datos de acceso listos para entregar.
6. Cierra sesión y comprueba que esa persona puede entrar con esa contraseña.

---

## Qué hace y qué no

**Sí puede:**

- Un administrador fija la contraseña de cualquier persona **de su propia unidad**.
- El cambio es inmediato: no hay correo, ni enlace, ni espera.
- La persona puede cambiarla después desde **👤 Mi perfil**.

**No puede:**

- Un administrador de QP no alcanza al personal de amfa, ni al revés.
- Las cuentas de dirección (marcadas como ocultas) no pueden modificarse.
- Quien no tenga rol de administrador recibe un rechazo, aunque llame a la
  función por su cuenta.

**Queda registrado:** cada cambio se asienta en `bitacora_accesos` con la acción
`CAMBIO DE CONTRASEÑA`, indicando quién lo hizo y sobre quién. Es indispensable:
alguien que puede fijar una contraseña puede entrar como esa persona, y la
NOM-024 exige poder reconstruir quién hizo qué.

---

## Si algo falla

| Mensaje | Qué significa |
|---|---|
| «Solo un administrador puede fijar contraseñas» | La sesión no tiene rol `admin` en la tabla `usuarios`. |
| «Esa persona pertenece a otra unidad» | Estás en QP intentando alcanzar a amfa, o al revés. Es el aislamiento funcionando. |
| «Esta cuenta no puede modificarse desde el sistema» | Es una cuenta de dirección (`usuarios.oculto = true`). |
| «La función no está configurada correctamente» | Falta la llave de servicio. Ver el Paso 2. |
| «No se pudo contactar al servidor» | La función no está desplegada, o el nombre no coincide exactamente con `fijar-contrasena`. |

---

## Lo que esto no resuelve

Sigue pendiente configurar un **remitente de correo propio (SMTP)** en
Authentication → Emails. Sin él, la opción «Olvidé mi contraseña» de la pantalla
de acceso seguirá sin funcionar para el personal, y dependerán de que un
administrador les fije la contraseña. Con SMTP, cada quien podrá recuperarla solo.
