# IMAUD — Evaluación de migración desde SUTRAMIRANDA

Fecha del corte indicado en los archivos: 11-11-2026 (Venezuela, UTC-4).

## Archivos recibidos

1. `sutramiranda-20261111T163506Z.xlsx`: exportación relacional de tablas del sistema anterior.
2. `contribuyentes-detallado-20261111T163506Z.xlsx`: libro de consulta con hojas Contribuyentes, Inmuebles, Liquidaciones y Pagos.

## Volumen observado en el libro detallado

| Entidad | Registros declarados/observados |
|---|---:|
| Contribuyentes | 1,132 |
| Inmuebles / contratos | 1,156 |
| Liquidaciones | 3,454 |
| Pagos aplicados | 1,117 |
| Contribuyentes con saldo | 997 |
| Saldo pendiente total | 4,340 TCMMV |
| Saldo estimado en Bs al corte | 4,374,556.54 |
| Pagos históricos registrados en Bs | 1,417,516.38 |

Tasa de referencia indicada por el libro: 1,007.9633 Bs por TCMMV, con fecha 11-11-2026. Los importes en Bs son estimaciones al corte y no deben confundirse con montos históricos emitidos ni con una nueva liquidación.

## Hallazgos del detalle

- Contribuyentes: 1,126 personas naturales y 6 personas jurídicas; todos aparecen como Residencial y Activo en este corte.
- Inmuebles: 1,150 activos y 6 inactivos.
- Tipologías registradas: Tipo I 418; Tipo II 320; Tipo III 418.
- Liquidaciones: 2,334 Pendientes; 1,117 Pagadas; 3 Anuladas.
- Fuera de plazo al corte: 1,244 Sí; 2,210 No.
- Pagos: 1,117 filas y todos figuran conciliados en este libro.
- Las claves visibles de las hojas detalladas no presentan duplicados ni valores vacíos en las columnas identificadoras revisadas: Cédula/RIF, Contrato, N.º de liquidación y N.º de pago.

## Estructura observada en el respaldo relacional

Incluye, entre otras, tablas para contribuyentes, inmuebles, roles de inmueble, historial de cambios de propiedad, parroquias, sectores, categorías, liquidaciones, pagos, solicitudes de pago, bancos, puntos de venta, certificados de solvencia, parámetros generales, historial TCMMV/BCV, usuarios, roles, permisos, relaciones de roles/permisos, notificaciones y activity_log.

Volúmenes técnicos destacados observados:
- activity_log: 20,991 filas.
- notifications: 4,074 filas.
- historial_tcmmv_bcv: 79 filas.
- permissions: 54 filas.
- sectores: 228 filas.
- users: 13 filas.
- bancos: 26 filas.
- puntos_venta: 6 filas.
- certificados_solvencia: 732 filas.

## Modelo de migración propuesto para IMAUD

| Origen SUTRAMIRANDA | Destino IMAUD | Tratamiento |
|---|---|---|
| contribuyentes | contributors | Preservar ID legado y documento; normalizar tipo y contacto sin perder valor original |
| inmuebles | properties | Preservar contrato como identificador legado; asociar parroquia, sector y tipología histórica |
| inmueble_roles | property_relationships (por crear) | Conservar roles, vigencias, responsable de pago y copropiedad |
| historial_cambios_propiedad | property_ownership_history (por crear) | Importar como historial inmutable |
| parroquias | parishes | Importar catálogo y nombres originales |
| sectores | sectors | Importar relación con parroquia y categoría original |
| categorias | legacy_tariff_categories (por crear) | Preservar código, descripción y parámetros; no asumir vigencia legal |
| liquidaciones | assessments | Conservar ID, período, estado, vencimiento, importe original, TCMMV y referencia de categoría |
| pagos | payments + payment_allocations | Distinguir operación financiera de aplicación por liquidación; preservar referencia, banco, taquilla, conciliación y usuario |
| solicitudes_pago | payment_submissions (por crear) | Mantener solicitudes, estados y revisión por analista |
| bancos / puntos_venta | banks / collection_points (por crear) | Importar catálogos y códigos históricos |
| certificados_solvencia | clearance_certificates (por crear) | Preservar código, hash, fecha, vencimiento y firmante |
| parametros_generales / historial_tcmmv_bcv | exchange_rate_history (por crear) | Preservar fuentes y fechas exactas de tasa |
| users / roles / permissions | staff_profiles / permissions | Importar solo perfiles administrativos autorizados; nunca contraseñas ni sesiones |
| activity_log | audit_log_legacy (por crear) | Archivar como historial heredado; no mezclar con auditoría nueva |

## Reglas críticas de migración

1. No cargar el Excel con datos personales en un repositorio GitHub público ni en una herramienta de demostración.
2. El archivo de respaldo relacional contiene metadatos de sesiones (IP y user-agent), cuentas de usuario, correos y registros de actividad. Tratarlo como información restringida.
3. No migrar contraseñas, tokens, sesiones activas, cache, jobs fallidos ni password reset tokens a la nueva autenticación.
4. Preservar claves originales en columnas `legacy_id` y relaciones de origen; nunca regenerar identificadores sin tabla de correspondencia.
5. La fila de Pagos del libro detallado representa una aplicación a liquidación, no necesariamente una transacción bancaria única. El mismo pago puede distribuirse entre varias liquidaciones. No sumar filas como transacciones bancarias únicas sin deduplicar por N.º de pago/referencia y validar contra pagos original.
6. Mantener separados: monto histórico recibido en Bs, monto aplicado en TCMMV, saldo pendiente TCMMV y estimación Bs al corte.
7. Estados guardados y condición "fuera de plazo al corte" son conceptos diferentes. No recalcular ni sustituir estados históricos.
8. El saldo de liquidaciones se atribuye al contribuyente facturado; no redistribuir automáticamente por propietario actual.
9. Una ausencia de saldo no equivale a certificado de solvencia.
10. Tipologías y montos históricos se importan como datos heredados pendientes de validación contra la ordenanza vigente del Municipio Miranda. No activar reglas de cobro automáticamente.

## Plan seguro

1. Conservar los archivos originales como evidencia de origen, sin alterarlos.
2. Preparar una copia de trabajo cifrada y acceso restringido fuera de GitHub.
3. Ejecutar perfilado de calidad y conciliación de conteos y sumas.
4. Construir importadores idempotentes con validación y reporte de errores.
5. Importar primero a un entorno aislado de staging, nunca directamente a producción.
6. Conciliar totales por entidad, estados, períodos, parroquias, sectores, categorías, pagos y saldos.
7. Obtener validación de la autoridad municipal y revisión jurídica/contable antes de activar las reglas y datos en el sistema operativo.

## Limitaciones de esta evaluación

Este documento resume estructura y conteos visibles en los dos libros recibidos. No verifica el sistema en vivo, los adjuntos externos referenciados por rutas, la autenticidad de cada pago ni la vigencia jurídica de las categorías y tarifas. No se han importado registros personales a IMAUD.
