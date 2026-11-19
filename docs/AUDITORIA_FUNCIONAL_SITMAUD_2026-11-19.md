# SITMAUD — Auditoría funcional y estado de preparación
**Fecha:** 19 de noviembre de 2026  
**Ámbito:** repositorio `jleonesl/IMAUD`, GitHub Pages y Supabase del sistema municipal.

## Dictamen
**La publicación web no equivale a autorización para recaudar.** Se corrigieron fallos funcionales y el flujo financiero pasa pruebas transaccionales reversibles. Aún no se acredita funcionamiento real integral: faltan autorización de tarifa de pruebas, tasa BCV directamente verificable, usuarios separados para recaudación/Tesorería y pruebas de impresión/navegador.

## Correcciones aplicadas
1. **Motor de mensualidades:** cuatro generadores PL/pgSQL utilizaban una cláusula `ON CONFLICT(property_id,period_start,period_end)` ambigua por los parámetros `RETURNS TABLE`. Se reemplazó por la restricción única explícita `assessments_property_id_period_start_period_end_key`. Ver migración `20261119210000_fix_billing_period_start_ambiguous_upsert.sql`.
2. **Recaudación / deudores:** la búsqueda anterior solo consultaba los primeros 500 contribuyentes. Nuevo RPC `list_official_debtors` con permisos, filtros, búsqueda por nombre/identificación/contrato, normalización de tildes y páginas de 50. Ahora se sirve desde `official-finance.js`.
3. **Exoneraciones:** se excluyeron las obligaciones exoneradas de los deudores pendientes, se etiquetan correctamente en el portal ciudadano y se impide cotizarlas o cobrarlas por cualquier canal. Permite exoneración del ciclo piloto únicamente si el tabulador correspondiente está autorizado. Migración `20261119221000_exoneration_enforced_in_payment_quotes_and_debtor_views.sql`.
4. **Estado del sistema:** se sustituyó el mensaje genérico engañoso de «operaciones deshabilitadas» por la explicación de los requisitos efectivos de autorización tarifaria y tasa BCV.
5. **Publicación:** `.github/workflows/pages.yml` separa los trabajos build y deploy para esperar el artefacto generado y añade pruebas estructurales de regresión.

## Ensayos ejecutados sin persistencia
Se ejecutaron consultas PostgreSQL dentro de `BEGIN … ROLLBACK` usando un actor autenticado **simulado solo en la transacción**, un tabulador de pruebas **temporalmente habilitado** y una tasa etiquetada **temporalmente como directa del BCV solo para comprobar el código**. Los cambios se revirtieron y nunca deben interpretarse como verificación oficial de tasa.

| Flujo | Resultado |
| --- | --- |
| Generar tres mensualidades para un inmueble Tipo III | 3 creadas, 0 errores |
| Consultar deudas desde Recaudación, con paginación y búsqueda acentuada | 3 meses; encontrado |
| Portal ciudadano autenticado: carga de mensualidades | 3 mensualidades visibles en respuesta JSON |
| Cotizar 1 mes y 3 meses a tasa UCD del mismo día | Sumas coherentes |
| Registrar pago por terminal municipal | Pago pendiente e ID de terminal vinculados |
| Asignación de número de recibo y fecha de emisión de factura | Inmediata, antes de Tesorería |
| Impedir validación por el mismo funcionario | Rechazo correcto |
| Rechazar pago pendiente | Estado reversed |
| Validar pago usando separación de actor simulada | Estado confirmed, obligación paid |
| Recalcular el dashboard | Pendiente/validado no se duplican |
| Reporte por punto de venta | Una transacción registrada |
| Exoneración y protección de cotización | Mes desaparece del saldo y no puede cobrarse |
| Ciudadano intenta registrar pago de funcionario y autorizar tarifas | Acceso denegado |

**Límite:** estos resultados verifican reglas de base de datos, no una operación bancaria real, impresión física, navegador con sesión de funcionario recaudador o validación con dos personas reales. No existe aún prueba de estrés a 20.000–50.000 contribuyentes.

## Situación de los datos al terminar la auditoría
- Un contribuyente y un inmueble residencial activos.
- **0 obligaciones oficiales persistentes**; las generadas durante la revisión se revirtieron.
- **0 pagos oficiales persistentes**, sin liquidaciones ni solvencias emitidas.
- Tabulador de septiembre–diciembre 2026 **no aprobado**. El de enero 2027 sí figura aprobado.
- Tasas UCD disponibles proceden de `bcv.today`; los RPC de cobro oficiales requieren fuente BCV directamente verificada.
- Una cuenta de funcionario activa; no es posible completar una aceptación real de segregación recaudador/Tesorería.
- Sin terminales físicos ni condominios cargados para validación real.

## Bloqueos de salida a producción
**P0 — Indispensables antes de recaudar:**
1. Aprobación institucional explícita del tabulador aplicable a pruebas 2026, registrada por la cuenta autorizada; ejecutar el lote y comprobar las mensualidades persistentes. No aprobar sin decisión institucional.
2. Obtener tasa con fecha valor verificable desde BCV oficial o diseñar un procedimiento auditado de validación oficial; nunca etiquetar una fuente de terceros como verificada de manera automática.
3. Crear dos usuarios reales autorizados diferentes y probar registro, emisión/impresión de factura, Tesorería y reverso con evidencia.
4. Verificar en navegador las pantallas, la impresión de facturas y los registros reales, y ejecutar pruebas con distintos métodos bancarios.

**P1 — Escala y cobertura:**
1. Extender paginación/búsqueda a historial de pagos y facturación: hoy las vistas operativas siguen con un límite de 500 movimientos, aunque Reportes ya usa RPC paginada.
2. Probar condominios con cuenta matriz, pagos consolidados y múltiples viviendas; todavía no hay condominios de prueba válidos.
3. Probar solvencias reales para el ciclo permitido: la emisión exige períodos desde enero 2027.
4. Realizar pruebas de carga, respaldo, recuperación y migración total a Contabo. GitHub Pages sigue siendo vista previa, y Supabase permanece como backend.
5. Revisar avisos de seguridad del linter, incluida función pública de consulta QR, funciones SECURITY DEFINER, políticas RLS restringidas y extensión `pg_net` en public.

## Criterio de aceptación
No declarar SITMAUD «completamente operativo» por el estado verde de GitHub. Requerir un expediente real con tres períodos pendientes persistidos; un pago registrado y factura imprimible; validación y conciliación por otro funcionario; reportes coincidentes; solvencia en período válido; y una tasa BCV verificable con trazabilidad.
