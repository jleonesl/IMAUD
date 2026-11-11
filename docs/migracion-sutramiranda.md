# IMAUD — Inventario de fuentes SUTRAMIRANDA y plan de migración

Fecha del corte de las exportaciones: 2026-11-11. Este documento describe únicamente los dos libros Excel entregados para análisis. No contiene datos personales de contribuyentes.

## 1. Archivos de origen

### A. Exportación estructural de la base de datos
Libro: `sutramiranda-20261111T163506Z.xlsx`

Incluye tablas del sistema anterior, entre ellas:
- `contribuyentes`, `inmuebles`, `inmueble_roles`, `historial_cambios_propiedad`
- `parroquias`, `sectores`, `categorias`
- `liquidaciones`, `pagos`, `solicitudes_pago`
- `bancos`, `puntos_venta`, `certificados_solvencia`
- `parametros_generales`, `historial_tcmmv_bcv`
- `users`, `roles`, `permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions`
- `activity_log`, `notifications`
- tablas técnicas de colas, caché, sesiones y migraciones.

La hoja RESUMEN del origen indica 34 tablas exportadas. Varias columnas sensibles/técnicas fueron omitidas deliberadamente, por ejemplo contraseñas, tokens, payloads de colas y determinados datos de sesión. El libro incluye rutas de adjuntos almacenadas en la base, pero no los archivos externos originales (S3). Por tanto, no debe describirse como una copia binaria completa de todos los adjuntos.

### B. Exportación detallada para consulta
Libro: `contribuyentes-detallado-20261111T163506Z.xlsx`

Hojas: LEER PRIMERO, Contribuyentes, Inmuebles, Liquidaciones y Pagos.

El resumen del libro indica:
- 1.132 contribuyentes
- 1.156 inmuebles
- 3.454 liquidaciones
- 1.117 pagos

Las diferencias aparentes de filas entre los dos libros pueden deberse a filas de título/encabezado y formato. Para la migración, la fuente estructural debe ser la referencia primaria y el libro detallado se utilizará como reporte de control y conciliación.

## 2. Reglas/catálogos observados en los datos exportados

### Categorías residenciales existentes
La tabla `categorias` contiene:
- TIPO I: urbanizaciones privadas, villas cerradas, conjuntos residenciales, townhouse, terrazas o similares / comunidades organizadas. Valor registrado: 3 TCMMV.
- TIPO II: sectores consolidados y urbanizaciones o comunidades organizadas. Valor registrado: 1.5 TCMMV.
- TIPO III: sectores consolidados populares o comunidades organizadas. Valor registrado: 0.5 TCMMV.

Estos valores son datos históricos/configurados en SUTRAMIRANDA, NO una validación jurídica independiente. Antes de activar el motor de cobro de IMAUD deben cotejarse con la ordenanza vigente, reformas, anexos y actos administrativos del Municipio Miranda.

### Parroquias exportadas
- San Gabriel
- San Antonio
- Santa Ana

### Parámetros monetarios
La exportación incluye `parametros_generales` y `historial_tcmmv_bcv`, con TCMMV, tasas euro/dólar, fuente y fecha de vigencia/valor. Deben migrarse como historial auditable, no reemplazarse por una tasa actual inventada.

### Roles del sistema anterior
Se observan roles `admin`, `analista`, `user` y `contribuidor`, además de un catálogo de permisos. No se deben copiar automáticamente los privilegios al nuevo modelo IMAUD. Se usarán como referencia para diseñar una matriz nueva de usuarios intendentes, administradores analistas y recaudadores, bajo control de los intendentes.

## 3. Modelo de destino IMAUD

Correspondencias iniciales:
- `contribuyentes` → `contributors`
- `inmuebles` + `inmueble_roles` → `properties` + relación de titulares/ocupantes/responsables
- `parroquias` → `parishes`
- `sectores` → `sectors`
- `categorias` → catálogo de tipologías y reglas tarifarias versionadas
- `liquidaciones` → `assessments`
- `pagos` + `solicitudes_pago` → `payments`, allocations y revisión/conciliación
- `certificados_solvencia` → certificados con historial y verificación
- `bancos` + `puntos_venta` → catálogos de medios/canales de recaudación
- `historial_tcmmv_bcv` + `parametros_generales` → historial de unidad de cuenta y tipos de cambio
- `activity_log` → bitácora de auditoría IMAUD, preservando actor, evento, entidad y fecha cuando los datos lo permitan.

El nuevo modelo debe conservar las relaciones históricas y las claves de origen para trazabilidad, por ejemplo `legacy_source` y `legacy_id`, evitando duplicados al reimportar.

## 4. Controles antes de migrar

1. Crear un área de staging separada de las tablas operativas.
2. Normalizar cédulas/RIF sin perder el valor original.
3. Detectar contribuyentes duplicados, inmuebles sin titular, contratos repetidos y relaciones huérfanas.
4. Conciliar totales por tabla, estados, períodos, bancos, puntos de venta y montos.
5. Comparar el reporte detallado con la exportación estructural.
6. Mantener importes originales en TCMMV y bolívares, junto con tasa y fecha usadas en cada cálculo.
7. No recalcular ni modificar obligaciones históricas durante la importación.
8. Importar pagos y liquidaciones como registros históricos; bloquear cualquier doble contabilización.
9. Validar rutas de documentos y recuperar adjuntos externos por separado, si se obtiene acceso autorizado al almacenamiento S3.
10. Generar un informe de diferencias y excepciones antes de aprobar la migración.

## 5. Datos sensibles y seguridad

Los libros contienen información personal y financiera, contactos, identificaciones, direcciones, referencias de pago y registros de actividad. No subir estos libros ni volcarlos a un repositorio público. No copiar contraseñas, tokens, cookies, sesiones ni secretos del sistema anterior. Los datos reales deben mantenerse fuera del repositorio Git y solo importarse a un proyecto Supabase privado con controles de acceso, RLS, respaldo y autorización institucional.

## 6. Estado

Este documento es un inventario y plan de migración. Todavía no se ha importado ningún dato personal a IMAUD ni se ha activado ningún cobro real. La ordenanza municipal debe validar las reglas tributarias antes de su puesta en producción.
