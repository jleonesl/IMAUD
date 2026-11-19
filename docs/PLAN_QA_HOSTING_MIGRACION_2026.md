# SITMAUD — Plan controlado de pruebas, hosting y migración de contribuyentes

**Estado:** preparación técnica. **No implica autorización para cobrar ni para publicar datos reales de prueba.**
**Proyecto actual:** `jleonesl/IMAUD` / Supabase principal `vlgvojndrmvwhfjlpbid`.

## 1. Regla fundamental

Se admiten personas reales durante las pruebas **solo si existe autorización para usar sus datos** y en un **Supabase independiente del principal** (branch con base separada o proyecto de pruebas).
- Ningún pago simulado debe insertarse en `public.payments`, `payment_allocations` ni en las tablas oficiales de la base principal.
- No crear transferencias, depósitos ni números de referencia que se presenten como acreditaciones bancarias reales.
- En el entorno QA se marcará visiblemente **ENTORNO DE PRUEBAS — SIN VALIDEZ FISCAL** en toda pantalla, recibo y exportación.
- La fase QA no contará para ingresos del día, informes municipales ni saldos reales. No se vinculará con bancos, ni sistemas externos de recaudación.
- Las claves de acceso, fotografías de documentos y comprobantes no se guardan en GitHub, hojas públicas ni incidencias.

## 2. Separación técnica obligatoria

1. Crear **Supabase de QA** por rama/proyecto independiente; el sistema no deberá usar el identificador `vlgvojndrmvwhfjlpbid`.
2. Configurar Edge Functions, buckets privados, políticas RLS, correos de pruebas y credenciales **exclusivamente de QA**.
3. Validar con comprobación de origen en pantalla y configuración, **antes del primer alta**. Usar exclusivamente URL y clave pública de QA. No almacenar una clave de servicio en el frontend.
4. Publicar una copia web de QA en URL de pruebas con encabezado `ENTORNO DE PRUEBAS`, `noindex`, acceso controlado y documentos rotulados sin validez fiscal. Nunca confundirla con `/IMAUD/` productivo.
5. Ejecutar en QA un recorrido realista: contribuyente consentido → inmueble → tarifa/obligaciones de prueba → pago **simulado** → revisión simulada → recibo de prueba → reporte → exoneración y reverso.
6. Comprobar permisos: superusuario, recaudador, Tesorería, analista y contribuyente. Negar consultas de otro contribuyente, autorrevisión del recaudador y acceso no autenticado.

**La base actual mantiene un expediente ciudadano y registros históricos de prueba. No se purgan ni se tratan como migración final sin respaldo y aprobación.**

## 3. Qué se prueba y qué bloquea el pase

| Área | Evidencia de aceptación |
| --- | --- |
| Acceso | Invitación, recuperación, inicio y salida en móvil/escritorio; aislamiento entre cuentas |
| Tarifa | Ordenanza y anexos verificados, tipología y sector correctos, tasa directa BCV verificable |
| Condominio | Contrato matriz, número de unidades, una obligación consolidada y una factura por cuenta |
| Pago | Sin doble cobro, mes correcto, archivo privado, idempotencia, no cuenta como ingreso antes de confirmarse |
| Tesorería | Separación de funciones, rechazo motivado, liquidación correcta, bitácora íntegra |
| Factura | Exactamente la misma plantilla en funcionario/contribuyente y formato carta/media carta aprobado |
| Solvencia | Solo funcionario autorizado; no se emite con obligaciones pendientes |
| Exoneración | Aplicación directa con permiso de exoneración y registro en bitácora, sin solicitudes al público |
| Reportes | Reconciliación con pagos confirmados, tasas y fecha local de Coro |
| Seguridad | RLS, SECURITY DEFINER, Storage, contraseñas filtradas, respaldos y restauración |

Cada flujo debe tener pruebas exitosas y pruebas de rechazo. **No se considera aprobado por pasar solo pruebas estáticas.**

## 4. Limpieza y separación final

- Congelar las altas en QA, revocar sesiones/cuentas de prueba y exportar únicamente **evidencia de resultados sin datos personales**.
- Revisar retención legal, autorizaciones y respaldos; eliminar datos personales, comprobantes y cuentas de prueba del **entorno QA** o retirar el entorno completo después de confirmar la retención obligatoria.
- Jamás ejecutar `TRUNCATE`, `DELETE FROM` ni reset sobre el proyecto principal como procedimiento genérico de limpieza.
- Documentar fecha, responsable, conteos y verificación de aislamiento. Confirmar que pruebas y reportes no ingresaron en la contabilidad real.

## 5. Hosting definitivo ANTES de importar el sistema anterior

El pipeline `.github/workflows/pages.yml` produce `sitmaud-hosting-ready.zip` como artefacto de GitHub Actions, además de GitHub Pages.
- El archivo contiene únicamente los recursos estáticos permitidos. El proceso revisa presencia de claves privadas comunes.
- Obtener acceso autorizado al hosting y dominio/SSL, publicar en la carpeta pública correcta, revisar rutas, CORS y los enlaces de Auth de Supabase.
- Ajustar Site URL y redirecciones de recuperación/invitación al dominio final. No borrar GitHub Pages hasta probar la nueva URL.
- Comprobar inicio de sesión, navegación, facturas, carga segura de archivos, reversión, observabilidad y respaldo en el dominio final.
- Activar bloqueos de cobros mientras falte tasa BCV oficial, permiso de Tesorería o revisión de cuentas bancarias.
- Verificar que ninguna cuenta/operación QA esté conectada al proyecto de producción.

**La publicación en GitHub Pages no equivale a estar desplegado en Hostinger u otro hosting definitivo.**

## 6. Importación del sistema anterior

Necesita exportación autorizada del software anterior, identificación del esquema y revisión legal. No importar antes del dominio final aprobado y backup probado.

Campos mínimos esperados para mapeo:
`tipo_documento`, `numero_documento`, `nombre_razon_social`, `correo`, `telefono`, `direccion`, `parroquia`, `sector`, `tipologia`, `numero_contrato_origen`, `tipo_inmueble`, `tipo_persona`.

Antes de importar:
- normalizar cédulas y RIF; verificar duplicados entre personas y condominios;
- respetar las asociaciones de inmuebles/condominios y preservar identificador anterior;
- definir si se migrarán estados de cuenta/saldos y **su respaldo jurídico y conciliación bancaria**; nunca inventar deudas;
- registrar total de filas, aceptadas, duplicadas, rechazadas y cambios, con identificador de lote y auditoría;
- probar un lote reducido en un entorno aislado y aprobar una muestra representativa;
- ejecutar importación oficial con procedimiento transaccional, reanudable y con respaldo;
- repetir validaciones postimportación: conteos, contratos, permisos, acceso ciudadano, cálculos y reportes.

## 7. Pendientes administrativos

- Autorización del costo de un entorno Supabase QA, si aplica. No se creó automáticamente por motivos de facturación.
- Dominio, hosting, credenciales y configuración DNS/SSL; no disponibles todavía.
- Listado exportado del sistema anterior y especificaciones de columnas; no suministrados todavía.
- Confirmación bancaria de las cuentas receptoras reales, aprobación legal de la ordenanza y plan de conservación de registros.
- Activación de protección contra contraseñas filtradas en Auth y revisión puntual de avisos de Supabase.

## 8. Estado a 19/11/2026

El frontend y los servicios principales existen; no hay pagos oficiales, cuentas receptoras publicadas ni obligaciones oficiales generadas. El calendario 2027 figura aprobado y existen sectores tipificados. La actualización BCV usa también fuentes secundarias en el registro histórico; **la cotización de pagos oficiales ahora está restringida a la procedencia directa BCV**, por lo que puede permanecer bloqueada hasta disponer de una tasa oficial reciente.
