# SITMAUD — Etapa 1: preparación para operación real

Fecha de auditoría: 2026-11-14  
Repositorio: `jleonesl/IMAUD`  
Rama de trabajo: `stage-1/production-readiness`  
Proyecto Supabase inspeccionado: `vlgvojndrmvwhfjlpbid`

## Objetivo

Preparar SITMAUD para operar con contribuyentes, inmuebles, obligaciones tributarias, pagos definitivos, validación de Tesorería, comprobantes y reportes oficiales. Las rutas y tablas DEMO son mecanismos de prueba temporales; no deben ser el flujo operativo final.

## Estado verificado

- Supabase registra **19 migraciones aplicadas**.
- El repositorio contiene solo **3 archivos** en `supabase/migrations`.
- La base de datos tiene 28 tablas públicas con RLS habilitado.
- Hay 1 usuario autenticado y 1 perfil de funcionario activo.
- Datos actuales: 1 contribuyente, 1 inmueble, 1 obligación marcada como DEMO, 1 pago DEMO y 0 pagos en la tabla definitiva `payments`.
- No hay calendarios tarifarios aprobados (`tariff_schedules.is_approved = false` para todos los registros existentes).
- Existen las tablas definitivas `payments` y `payment_allocations`, pero las funciones de registro/validación detectadas para el flujo actual usan `demo_payments` y nombres `register_demo_*` / `review_demo_*`.
- Supabase Security Advisor informa que la protección de contraseñas comprometidas está desactivada, que `pg_net` está instalado en `public`, y que 12 funciones `SECURITY DEFINER` son ejecutables por usuarios autenticados. Estas funciones requieren revisión individual; el aviso no demuestra por sí solo que todas deban dejar de exponerse.
- Los depósitos `imaud-contributor-files` e `imaud-payment-proofs` son privados y limitan archivos a PDF/JPEG/PNG/WebP de hasta 10 MiB.

## Historial de migraciones aplicado en Supabase

1. `20261111215728 imaud_initial_schema_security`
2. `20261111215922 tighten_function_security`
3. `20261112180429 add_property_contract_numbers`
4. `20261112180457 complete_property_registration_fields`
5. `20261112180730 grant_authenticated_contract_number_generation`
6. `20261112180801 add_contributor_contact_location_and_status`
7. `20261112194448 move_contract_number_to_contributors`
8. `20261112194837 hide_contributor_contract_generator`
9. `20261112220958 create_udc_rates_and_scheduler_extensions`
10. `20261112221218 add_udc_tariff_calculation_function`
11. `20261113101824 add_sector_udc_preview_no_billing`
12. `20261113104944 auto_create_current_month_demo_assessment`
13. `20261113110115 property_typology_overrides_authorized_and_audited`
14. `20261113110242 ensure_intendente_required_for_typology_change`
15. `20261113110352 controlled_sector_typology_corrections`
16. `20261113111113 correct_legal_unit_abbreviation_to_ucd`
17. `20261113111833 add_payment_bank_catalog_from_excel`
18. `20261113112803 persist_atomic_demo_payments_and_settle_demo_assessments`
19. `20261113113004 fix_demo_payment_receipt_returning_ambiguity`

## Riesgos y bloqueos antes de operar

1. **Deriva de migraciones:** no se debe reconstruir, resetear ni aplicar una restauración sobre producción hasta recuperar una fuente reproducible del esquema vivo y conciliarla con el historial. Los tres SQL actualmente versionados son un diseño inicial y no representan por sí solos el esquema de producción actual.
2. **Flujo de cobro:** no conectar la interfaz a `payments` hasta implementar y probar funciones transaccionales equivalentes para registro, asignación, conciliación, reverso y auditoría. No copiar pagos DEMO a pagos oficiales.
3. **Tarifas:** no generar obligaciones oficiales mientras no exista una tarifa aprobada y verificada contra la ordenanza y la UCD vigente del BCV.
4. **Autorización:** revisar cada función privilegiada, sus grants, comprobaciones internas y permisos por rol. No revocar en bloque funciones que la aplicación necesite.
5. **Autenticación:** activar protección de contraseñas comprometidas y revisar recuperación, sesiones y cuentas de funcionarios.
6. **Respaldo y recuperación:** confirmar política de backups/PITR y ensayar restauración en un entorno aislado antes de tocar datos operativos.
7. **Documentos:** verificar políticas de Storage, acceso por rol, rutas por contribuyente y retención de comprobantes.

## Secuencia de trabajo

- [ ] Capturar un inventario completo y reproducible del esquema vivo: tablas, columnas, tipos, constraints, índices, secuencias, triggers, funciones, vistas, grants, RLS/policies y Storage policies.
- [ ] Respaldar el estado actual y documentar el procedimiento de recuperación.
- [ ] Recuperar o reconstruir las migraciones faltantes como baseline fiel, sin reejecutarlas sobre producción.
- [ ] Crear y validar el flujo definitivo de obligaciones y pagos sobre tablas oficiales.
- [ ] Reemplazar referencias DEMO en interfaz, facturación, Tesorería y reportes después de probar sus equivalentes reales.
- [ ] Ejecutar pruebas de permisos por cada rol y pruebas de extremo a extremo en un entorno aislado.
- [ ] Autorizar el piloto institucional solo después de validar ordenanza, tarifas, datos y conciliación.

## Regla de seguridad

No borrar tablas, filas, funciones ni comprobantes DEMO durante esta etapa. No convertir registros DEMO en oficiales. No habilitar cobros reales hasta que el flujo definitivo y las tarifas estén aprobados y probados.


## Verificaciones adicionales

- Proyecto Supabase: estado `ACTIVE_HEALTHY`, PostgreSQL 17.11, región `us-east-1`.
- Catálogo tarifario: 1 calendario, 3 reglas y 0 calendarios aprobados.
- UDC: 2 registros disponibles; la fecha efectiva más reciente consultada es `2026-11-13`.
- La Edge Function `sync-udc-bcv` está activa y requiere JWT. Su código consulta el origen BCV y actualiza `udc_rates`; debe probarse su programación/ejecución y validar los datos de origen antes de depender de ella para liquidaciones oficiales.
- La ordenanza 2024 establece para residencial `TAR = FAO × FAR`, con FAR = 1, y para comercial/industrial/institucional `TAC = FAO × FAC`, con FAC = 1 salvo modificación aprobada. Define la unidad de cuenta dinámica como la moneda de mayor valor publicada por BCV y exige que el pago se acredite en cuentas autorizadas. La implementación actual de UDC debe conciliarse con el texto y anexos completos de la ordenanza antes de aprobar el calendario tarifario.
- Security Advisor: 12 funciones `SECURITY DEFINER` ejecutables por `authenticated`, `pg_net` en `public` y protección de contraseñas comprometidas desactivada.
- Performance Advisor: 26 claves foráneas sin índice de cobertura, 2 políticas RLS con llamadas auth que pueden optimizarse y 2 casos de políticas permisivas duplicadas. No eliminar índices no usados durante la preparación sin medir carga real.
- Health Advisor: sin hallazgos al momento de la consulta.
- La interfaz actual de facturación y Tesorería está explícitamente conectada a `demo_payments`, `demo_payment_allocations` y funciones DEMO; el recibo actual se marca como no fiscal. El reemplazo debe cubrir también reportes, tablero, registro de condominios y generación automática de obligaciones.

## Estado de avance de esta rama

- [x] Crear rama aislada `stage-1/production-readiness`.
- [x] Registrar auditoría inicial en este documento.
- [x] Generar y guardar `supabase/database.types.ts` desde el esquema vivo.
- [ ] Recuperar un respaldo verificable y comprobar restauración.
- [ ] Reconstruir el baseline/migraciones de forma fiel y validada.
- [ ] Implementar flujos oficiales de obligaciones, pagos, Tesorería, facturación y reportes.


## Hallazgo funcional crítico: obligación y tablero

- `get_dashboard_metrics()` ya consulta las tablas oficiales `payments` y `assessments`.
- `get_demo_dashboard_metrics()` consulta `demo_payments`; no debe alimentar el tablero oficial.
- El trigger `auto_current_month_demo_on_property` llama a `create_current_month_demo_obligation()`, que inserta obligaciones con `is_demo = true`. Por tanto, registrar un inmueble actualmente genera una obligación DEMO, no una obligación oficial.
- La función de cálculo residencial `calculate_udc_tariff()` usa coeficientes 3.0 / 1.5 / 0.5 y la UDC más reciente a la fecha solicitada. La función de creación automática actual usa `tariff_rules.amount × udc_rates.udc_value`, pero marca la obligación como DEMO y no verifica `tariff_schedules.is_approved`. No debe reutilizarse tal cual para obligaciones oficiales.
- El flujo oficial requiere una función transaccional que seleccione únicamente una tarifa aprobada y vigente, con snapshots de tarifa y UDC, control de duplicados por inmueble/período, soporte de condominios consolidados y registro de auditoría.


## Inventario de dependencias DEMO en la interfaz

La revisión estática de los archivos actuales confirma que el uso de DEMO no está aislado a una sola pantalla:

- `billing.js`: lee `demo_payments` y `demo_payment_allocations`; imprime comprobantes con marca de agua DEMO / NO FISCAL y QR informativo de prueba.
- `treasury-validation.js`: consulta `demo_payments`, registra eventos de tesorería DEMO y llama a `review_demo_payment_treasury`.
- `reports.js`: usa `get_filtered_demo_report`, etiqueta recaudación y estado de cuenta como DEMO y exporta archivos con prefijo `SITMAUD_DEMO`.
- `app.js`: usa `get_demo_dashboard_metrics`, incluye tarjetas e indicadores DEMO y consulta simultáneamente tablas definitivas y DEMO en algunos listados.
- `condominium-registration.js`: llama a `register_demo_condominium_full` y muestra estimación de obligación DEMO.
- `payment-proofs.js`: recupera comprobantes desde `demo_payments`.
- `auth.js`: muestra el banner de entorno de pruebas al autenticar al funcionario.

No es seguro hacer una sustitución global de nombres: cada módulo debe migrarse al contrato de datos definitivo y sus reglas de autorización, estados, recibos y conciliación.

## Requisitos de portabilidad a hosting y dominio institucional

- La aplicación debe seguir siendo estática/portable y poder alojarse en cualquier hosting HTTPS compatible, sin depender de rutas especiales de GitHub Pages.
- El dominio final será propiedad de la Alcaldía/Instituto y no una URL personal o de GitHub. El nombre de dominio queda pendiente de aprobación institucional y disponibilidad; no se asume que `sitmaud.gob.ve` esté disponible.
- Separar configuración pública del cliente (URL Supabase y publishable key) de secretos de servidor. La publishable key puede estar en el navegador si RLS está correctamente configurado; nunca incluir service-role/secret keys en archivos públicos.
- Configurar en Supabase Auth las URL permitidas de sitio y redirección para el dominio definitivo, incluyendo recuperación de contraseña y enlaces de acceso.
- Configurar CORS/orígenes, HTTPS, DNS, certificados, política de caché y cabeceras de seguridad del hosting.
- No migrar datos ni cambiar la URL de Supabase solo por mover el hosting: el frontend puede seguir usando el backend actual si la Alcaldía lo autoriza y se cumplen disponibilidad, protección de datos y respaldo.
- Mantener entornos de configuración separados (desarrollo/pruebas/producción); no poner datos reales en el hosting de pruebas.
- Si la Alcaldía exige infraestructura propia, evaluar hosting estático institucional y, por separado, si necesita también autohospedar PostgreSQL/Supabase. No confundir dominio/hosting web con migración del backend.
- La automatización actual `.github/workflows/pages.yml` despliega solo a GitHub Pages desde `main`; debe mantenerse como preview y no ser el despliegue institucional definitivo.

## Compatibilidad Supabase CLI

El changelog oficial informa que Supabase CLI v3 es local-first: comandos de base de datos operan en local por defecto y los cambios remotos requieren `--remote`; las acciones remotas en CI requieren confirmación explícita `--yes`. Los scripts de despliegue deben fijar versión y destino para evitar ejecutar accidentalmente comandos contra producción.


## Directiva institucional del propietario del proyecto (2026-11-14)

SITMAUD es un sistema tributario municipal de uso real. No se autoriza desarrollar ni presentar los módulos financieros, tributarios o documentales como simulaciones, ni usar registros ficticios como si fueran actividad del Instituto. El objetivo no es conservar una modalidad DEMO como producto alternativo: es reemplazar los flujos de prueba por implementaciones oficiales verificadas.

### Criterios obligatorios

1. No mostrar pagos, contribuyentes, deudas, facturas, recibos, reportes, condominios ni indicadores ficticios.
2. No emitir comprobantes marcados como DEMO ni documentos presentados como fiscales antes de tener la autorización y validación institucional correspondientes.
3. No generar obligaciones oficiales con tarifas no aprobadas ni sin validación normativa.
4. No permitir registrar, validar, revertir o conciliar pagos mediante las funciones `register_demo_*` o `review_demo_*`.
5. No convertir, copiar ni importar automáticamente registros DEMO a tablas oficiales.
6. No eliminar físicamente las tablas o evidencias DEMO antes de evaluar dependencias, preservar auditoría y recibir autorización institucional para la retención/eliminación.
7. Mientras un flujo oficial no exista y no supere pruebas, ese flujo debe permanecer bloqueado para operación institucional con un mensaje neutral de "módulo en preparación", sin ofrecer simulaciones como sustituto.
8. La interfaz debe mostrar únicamente datos procedentes de las tablas oficiales y funciones autorizadas. Los valores inexistentes deben presentarse como no disponibles, nunca como datos inventados.
9. Cada operación crítica debe tener validación en servidor, autorización por rol, transacción atómica, idempotencia, auditoría, manejo de errores y reconciliación.
10. No afirmar que SITMAUD está listo para uso oficial hasta completar pruebas de extremo a extremo, restauración de respaldos, revisión legal/contable, aceptación de la Alcaldía y aprobación formal de los responsables.

### Secuencia de sustitución, no de renombrado

- Obligaciones: diseñar y probar el motor oficial de liquidación con tarifas aprobadas, vigencia, UCD/BCV, tipología, sector, excepciones, condominios consolidados, snapshots y prevención de duplicados.
- Recaudación: crear el flujo definitivo sobre `payments` y `payment_allocations`, con métodos autorizados, referencias, evidencias, idempotencia y estados controlados.
- Tesorería: implementar revisión y conciliación de pagos definitivos con separación de funciones, eventos inmutables y reversos justificados.
- Facturación: emitir el documento institucional aprobado solo desde un pago confirmado, con numeración, integridad y consulta verificable.
- Reportes: calcularlos desde tablas oficiales y permitir exportaciones auditables, con filtros y zona horaria institucional.
- Condominios: registrar cuentas matrices y unidades con funciones oficiales, reglas de contrato y obligaciones consolidadas verificadas.
- Dashboard: usar exclusivamente métricas oficiales; sin datos de ejemplo ni combinación de tablas temporales.
- Portal contribuyente: exponer únicamente información propia y operaciones autorizadas con RLS y controles de identidad.

### Estado de los módulos

El código actual de varios módulos aún depende de funciones y tablas de prueba. Por lo tanto, esta directiva no se considera satisfecha por la auditoría ni por cambios de texto. Cada módulo requiere implementación, revisión, pruebas y aprobación antes de habilitarlo.


## Adenda — 19/11/2026: pruebas autorizadas en entorno aislado

El propietario solicita ahora pruebas con personas reales autorizadas y operaciones de pago **simuladas** antes de desplegar en hosting e importar la base histórica. Esto **no modifica** la prohibición de presentar pagos simulados como ingresos reales ni permite ensuciar el Supabase principal.

Las pruebas se realizarán exclusivamente en una base Supabase independiente y una web QA identificada inequívocamente como **ENTORNO DE PRUEBAS · SIN VALIDEZ FISCAL**. No deben insertarse pagos no acreditados en las tablas oficiales de producción, emitirse facturas oficiales ficticias ni migrarse estos datos a la versión definitiva.

La limpieza de pruebas afectará solo al entorno aislado y se ejecutará tras revisar conservación de auditoría, autorizaciones y respaldos; nunca como un `TRUNCATE` general contra el principal. La importación heredada será posterior a la comprobación del hosting definitivo.

Estado: se preparó la rama `qa-pre-hosting-2026` y el paquete de hosting. La creación de base QA requiere aprobación de su costo. Plan operativo: [PLAN_QA_HOSTING_MIGRACION_2026.md](PLAN_QA_HOSTING_MIGRACION_2026.md).
