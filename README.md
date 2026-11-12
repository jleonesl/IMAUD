# SITMAUD — Sistema Integral Tributario Municipal de Aseo Urbano y Domiciliario

Proyecto independiente para la Alcaldía del Municipio Miranda, Coro, estado Falcón.

## Vista previa
La interfaz estática puede publicarse mediante GitHub Pages cuando el despliegue del repositorio esté habilitado. Esta versión es exclusivamente demostrativa.

## Estado actual
Primera base de interfaz web estática, adaptable a escritorio y móvil. Incluye navegación por módulos y flujos locales de demostración.

## Módulos visibles
- Inicio / Dashboard
- Contribuyentes
- Inmuebles
- Organizaciones residenciales
- Recaudación y pagos (simulación)
- Facturación (muestra no fiscal)
- Reportes CSV de demostración
- Mapa territorial (marcador de integración pendiente)
- Ordenanza y tarifas (sin tarifas legales cargadas)
- Funcionarios y permisos (matriz conceptual)
- Bitácora (datos de ejemplo)

## Límites obligatorios
- Solo datos ficticios.
- No procesar pagos reales.
- No representa una liquidación tributaria ni factura fiscal válida.
- El login requiere perfiles administrativos creados y habilitados en Supabase; no se han creado credenciales de usuario final.
- No incluye todavía persistencia funcional de los módulos ni autorización completa en servidor.
- No cargar datos de SUTRAMIRANDA ni tarifas reales hasta autorización y validación normativa.
- No enviar comunicaciones a contribuyentes.
- No publicar para uso institucional hasta completar backend, pruebas, revisión legal y auditoría de seguridad.

## Próximas etapas
1. Publicar y verificar la vista previa.
2. Completar autenticación y alta segura del usuario intendente.
3. Conectar módulos a Supabase con permisos RLS probados.
4. Implementar bitácora protegida y controles financieros.
5. Implementar comprobante de pago y certificado de solvencia como documentos independientes.
6. Validar reglas tributarias contra ordenanzas vigentes.
7. Pruebas integrales, respaldos y despliegue en hosting autorizado.
