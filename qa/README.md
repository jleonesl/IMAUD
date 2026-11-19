# Rama QA pre-hosting 2026

Esta rama **no** se despliega a GitHub Pages (pipeline solo en `main`). **No** está conectada de forma segura a una base de pruebas todavía: varios archivos heredados contienen la URL de Supabase principal.

### Bloqueo obligatorio antes de probar

1. Obtener una rama/proyecto Supabase independiente con sus propias credenciales públicas.
2. Reemplazar **todas** las referencias a la URL y clave pública de Supabase principal en esta rama para usar exclusivamente QA.
3. Configurar Auth Redirect URLs y Storage/Edge Functions de QA.
4. Publicar en un dominio de QA accesible solo a probadores autorizados, con marca «ENTORNO DE PRUEBAS — SIN VALIDEZ FISCAL», también en PDF/impresiones.
5. Validar automáticamente que los endpoints y claves QA no coincidan con producción. **Hasta entonces esta rama no está autorizada para pruebas con personas reales ni pagos simulados.**

### Criterio para borrar los datos QA

- Exportar registros de ejecución no personales y cumplir la política de conservación.
- Revocar cuentas de prueba y eliminar solo datos del proyecto QA o retirar ese proyecto completo.
- **Nunca limpiar `main` ni Supabase principal** para borrar las pruebas.
- Validar backup restaurado, desplegar primero en hosting y luego importar la lista del sistema anterior con reconciliación.

Plan completo en [docs/PLAN_QA_HOSTING_MIGRACION_2026.md](../docs/PLAN_QA_HOSTING_MIGRACION_2026.md).
