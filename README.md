# IMAUD — Sistema Integral de Recaudación de Aseo Domiciliario

Proyecto independiente para la Alcaldía del Municipio Miranda, Coro, estado Falcón.

## Estado actual
Primera base de interfaz web estática, adaptable a escritorio y móvil. Incluye navegación por módulos y flujos locales de demostración.

## Ejecutar
Abrir `index.html` en un navegador moderno. No requiere compilación ni dependencias.

## Módulos incluidos
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

## Límites de seguridad
- No usar datos personales reales.
- No procesar pagos reales.
- No representa una liquidación fiscal ni una factura válida.
- No incluye autenticación, autorización de servidor ni persistencia central.
- No cargar tarifas hasta revisar la ordenanza vigente y sus reformas.
- No publicar para uso institucional hasta completar backend, pruebas, revisión legal y auditoría de seguridad.

## Próximas etapas
1. Confirmar y cargar el logotipo institucional original proporcionado por la Alcaldía.
2. Modelar esquema PostgreSQL y migraciones.
3. Implementar autenticación segura, roles y permisos en backend.
4. Implementar bitácora inmutable y controles de operaciones financieras.
5. Validar reglas tributarias contra la ordenanza.
6. Pruebas, respaldos y despliegue en hosting autorizado.
