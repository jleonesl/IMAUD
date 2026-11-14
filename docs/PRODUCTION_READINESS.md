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
