# SITMAUD · Configuración de correos institucionales

Los correos para contribuyentes **no están activados con esta apariencia solo por guardar las plantillas en GitHub**. Supabase Auth controla las plantillas del proyecto en producción.

## Ajustes imprescindibles en Supabase

1. Entrar a https://supabase.com/dashboard/project/vlgvojndrmvwhfjlpbid/auth/url-configuration
2. Configurar **Site URL**: `https://jleonesl.github.io/IMAUD/`
3. Agregar a **Redirect URLs**: `https://jleonesl.github.io/IMAUD/activar-contribuyente.html`
4. Guardar. Esto evita que el enlace de correo redirija a `localhost:3000`.

## Plantillas de correo

Abrir **Authentication → Email Templates**:
https://supabase.com/dashboard/project/vlgvojndrmvwhfjlpbid/auth/templates

- En **Invite user**: asunto `SITMAUD | Acceso al Portal del Contribuyente` y pegar íntegro el contenido de `supabase/templates/sitmaud-citizen-invite.html`.
- En **Reset password**: asunto `SITMAUD | Acceso y contraseña del Portal del Contribuyente` y pegar íntegro el contenido de `supabase/templates/sitmaud-citizen-recovery.html`.

Las plantillas condicionan el contenido con `{{ if .Data.citizen_portal }}` y admiten también cuentas de funcionarios con el diseño institucional genérico.

Las variables de Supabase Auth `{{ .ConfirmationURL }}` y `{{ .Data.citizen_username }}` se sustituyen dinámicamente en cada correo. No transformar `ConfirmationURL` en un enlace fijo, porque contiene el token necesario para activar o recuperar el acceso.

El sistema establece `citizen_username` a partir de la cédula/RIF registrada. Ese identificador se muestra también en la página de activación. **La contraseña NO se envía por correo:** el contribuyente la crea desde el enlace de un solo uso y luego inicia sesión.

## Prueba con el contribuyente previamente registrado

1. Una vez configuradas las URLs y plantillas, ingresar al panel de funcionarios.
2. Abrir el expediente del contribuyente de prueba existente.
3. Presionar **Reenviar acceso al correo**. No crear un segundo contribuyente.
4. Confirmar recepción y apertura del correo con asunto institucional.
5. Crear contraseña y entrar en `https://jleonesl.github.io/IMAUD/contribuyente-v2.html` con la cédula/RIF.

El servicio Edge de reenvío solo afirma que Supabase aceptó la solicitud de envío; no confirma entrega final en la bandeja de entrada.
