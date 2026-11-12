# IMAUD — Matriz de control interno, auditoría y trazabilidad

**Ámbito:** Sistema Integral de Recaudación de Aseo Domiciliario (IMАUD), Alcaldía del Municipio Miranda, Coro, estado Falcón.  
**Estado:** Requisitos de diseño propuestos; sujetos a validación formal por Consultoría Jurídica, Administración, Auditoría Interna y Contraloría Municipal.  
**Regla:** Este documento no constituye dictamen jurídico ni certificación de cumplimiento normativo.

## 1. Referencias normativas a verificar y aplicar

1. Constitución de la República Bolivariana de Venezuela.
2. Ley Orgánica de la Contraloría General de la República y del Sistema Nacional de Control Fiscal, Gaceta Oficial N.º 6.013 Extraordinario, 23-12-2010. Relevancia: arts. 2, 9, 35–41 y 42–43, entre otros. Control fiscal, control interno, evaluación de legalidad, exactitud, sinceridad, eficacia, eficiencia y economía.
3. Normas Generales de Control Interno, Gaceta Oficial N.º 40.851, 18-02-2016. Debe utilizarse el texto oficial completo vigente para el análisis artículo por artículo.
4. Normas Generales de Auditoría de Estado, Gaceta Oficial N.º 40.172, 22-05-2013.
5. Reglamento de la LOCGRSNCF, Gaceta Oficial N.º 39.240, 12-08-2009.
6. Lineamientos para la Organización y Funcionamiento de las Unidades de Auditoría Interna, Gaceta Oficial N.º 39.408, 22-04-2010.
7. Ley Orgánica del Poder Público Municipal y legislación tributaria aplicable.
8. Ordenanzas vigentes del Municipio Miranda: aseo domiciliario, hacienda/tributos, presupuesto, administración financiera, procedimientos administrativos, archivo y organización municipal, más reformas y gacetas posteriores que correspondan.

**Pendiente obligatorio:** obtener copias certificadas o publicaciones oficiales de las ordenanzas y gacetas municipales vigentes del Municipio Miranda. No asumir que las tarifas, tipologías, procedimientos, competencias ni plazos se desprenden solo de la ley nacional.

## 2. Principios de diseño de control

- Segregación de funciones: autorización, ejecución, registro, conciliación y custodia no deben recaer sin control en la misma persona.
- Mínimo privilegio y permisos granulares.
- Evidencia documental suficiente, íntegra, cronológica, localizable y conservada conforme al plazo legal que determine el municipio.
- Trazabilidad de extremo a extremo, con actor, fecha/hora, operación, motivo, valores anteriores/nuevos, expediente asociado y autorizaciones.
- Integridad: no borrar ni sobrescribir movimientos financieros; corregir mediante reversos, notas y operaciones compensatorias vinculadas.
- Revisión independiente y conciliaciones periódicas.
- Alertas por excepciones, sin sustituir el juicio del auditor.
- Exportaciones auditables con filtros, fecha de generación, responsable, totales, criterios y huella de integridad.
- Control de acceso a datos personales y financieros por función y necesidad.

## 3. Roles y segregación propuesta

| Perfil | Capacidades | Restricciones / controles |
|---|---|---|
| Intendente (máximo 5) | Administración integral, usuarios y permisos, configuración y supervisión | No puede eliminar evidencia; acciones críticas quedan registradas; cambios sensibles requieren doble aprobación cuando se configure |
| Administrador analista | Solo permisos expresamente concedidos | No puede elevarse permisos ni autoaprobar operaciones |
| Recaudador | Identificación, cobro, emisión de recibo, consulta limitada | No modifica tarifas, no anula ni concilia su propio cobro, no borra movimientos |
| Supervisor de caja | Apertura/cierre, revisión y conciliación de caja | No altera pagos confirmados; diferencias requieren incidencia y aprobación |
| Auditor interno / consulta fiscal | Acceso de lectura a expedientes, evidencias, reportes y bitácora según competencia | Sin permisos operativos de recaudación, edición ni administración de usuarios |
| Administrador técnico | Infraestructura y soporte | Sin autorización para alterar operaciones tributarias; acceso privilegiado temporal y auditado |

Los perfiles finales, sus competencias y la independencia de Auditoría Interna deben ser aprobados por la autoridad competente. El sistema no debe convertir al auditor en operador.

## 4. Libro de auditoría inmutable

Cada evento crítico debe registrar:
- ID de evento y correlación.
- Fecha/hora UTC y zona local institucional.
- Usuario, rol, sesión y método de autenticación.
- Acción y módulo.
- Tipo e ID del registro afectado.
- Estado anterior y posterior (con protección de datos sensibles).
- Motivo obligatorio para cambios sensibles.
- Aprobador(es), cuando aplique.
- IP, dispositivo y agente de usuario cuando sea lícito y necesario.
- Resultado, error, origen y evidencia adjunta.
- Versión de regla, tarifa, ordenanza o procedimiento utilizado.

Implementación:
- Tabla append-only; prohibir UPDATE/DELETE para usuarios de aplicación.
- Escritura mediante funciones/servicios controlados; no confiar en que el navegador reporte eventos.
- Hash encadenado o manifiestos firmados por lotes para detectar alteraciones; almacenar copias periódicas fuera de la base principal.
- Acceso de lectura limitado, exportaciones registradas y alertas ante intentos de alteración.
- Auditoría de accesos a la propia bitácora.
- Sincronización horaria y política de retención aprobada.
- No almacenar contraseñas, tokens, secretos ni datos de autenticación en bitácoras.

## 5. Controles por proceso

### Registro de contribuyente e inmueble
- Identificador único y validación de duplicados.
- Historial de cambios con documentos de respaldo.
- Vinculación fechada de propietarios, copropietarios, representantes y responsables de pago.
- Aprobación o revisión para cambios críticos de identificación, titularidad o responsabilidad.
- Registro de fuente y funcionario que verificó documentos.

### Ordenanza, tarifas y liquidaciones
- Biblioteca de instrumentos legales con número de gaceta, fecha, vigencia, artículos, archivo y hash.
- Tarifas versionadas por período de vigencia, parroquia/sector, tipología, clase y unidad de cálculo.
- Simulador previo y comparación de impacto antes de activar una regla.
- Doble aprobación para publicar tarifas y cambios normativos.
- Cada liquidación guarda snapshot de la regla y fuente jurídica aplicada.
- Bloquear generación si no hay regla aprobada vigente y jurisdicción inequívoca.
- No modificar liquidaciones históricas al cambiar una tarifa.

### Cobros, recibos y cajas
- Numeración única, secuencial y controlada de recibos.
- Registro de forma de pago, referencia, caja, funcionario, fecha, monto y moneda/unidad.
- Separar pago recibido de su distribución entre períodos/liquidaciones.
- Cierre de caja por turno, arqueo, conciliación y diferencias justificadas.
- Reversos, anulaciones y devoluciones mediante flujo con causa y aprobación independiente.
- No permitir que el recaudador concilie su propia caja sin revisión.
- Recibos reimpresos identificados como copia, sin crear un nuevo cobro.

### Solvencias y certificados
- Validar saldo y estado al momento de emisión.
- Código único y QR verificable.
- Historial de emisión, consulta, revocación y reemisión.
- No borrar certificados; revocación motivada y auditable.

### Usuarios y permisos
- Cuentas individuales; prohibidas las cuentas compartidas.
- MFA para roles privilegiados.
- Revisión periódica de permisos y baja inmediata al cesar funciones.
- Registro de altas, cambios, bloqueos, recuperaciones y accesos.
- Ningún usuario puede concederse permisos a sí mismo.
- Separación entre administración técnica y autorización administrativa.

## 6. Módulo de auditoría y contraloría

1. Buscador de eventos por funcionario, período, módulo, contribuyente, inmueble, pago, liquidación y tipo de acción.
2. Expediente digital por operación con documentos, aprobaciones y cronología.
3. Conciliación diaria de caja y pagos; conciliación por banco/pasarela cuando aplique.
4. Reportes de diferencias, reversos, duplicados, modificaciones de datos maestros y operaciones fuera de horario.
5. Matriz de permisos efectiva por usuario y su historial.
6. Muestreo de transacciones y exportación de evidencia.
7. Plan de acciones correctivas: hallazgo, riesgo, responsable, fecha compromiso, evidencia, revisión y cierre.
8. Informes periódicos por período fiscal, unidad, funcionario, parroquia, sector y canal.
9. Paquetes de auditoría descargables con índice, CSV/PDF, totales, filtros, hash y fecha de extracción.
10. Registro de requerimientos de órganos de control y entregas de información, con cadena de custodia.

## 7. Funcionalidades operativas fluidas

- Búsqueda global por cédula/RIF, nombre, contrato, inmueble, recibo o referencia.
- Perfil 360 del contribuyente con línea de tiempo y todas sus propiedades.
- Bandeja de trabajo por rol: pendientes, incidencias, aprobaciones y tareas.
- Registro rápido de pago con selección de períodos y distribución automática revisable.
- Liquidaciones masivas en lotes con simulación, vista previa y aprobación.
- Cuentas consolidadas de condominios con trazabilidad individual de cada unidad.
- Alertas de deuda y vencimiento, sin enviar mensajes externos hasta aprobación de plantillas, consentimiento/base jurídica y pruebas.
- Reportes configurables y exportación con controles de acceso.
- Centro de incidencias y solicitudes con SLA interno.
- Mapa de organizaciones residenciales y estatus agregado, con acceso restringido a información individual.
- Modo de conectividad limitada para consulta/captura controlada, con sincronización y detección de conflictos; no permitir cobros offline no verificables sin procedimiento aprobado.

## 8. Pruebas y criterios de aceptación

- Pruebas de autorización para cada permiso y combinación de roles.
- Intentos de modificación/borrado de bitácora deben fallar y generar alerta.
- Reverso de pago conserva el evento original y la razón.
- Cada liquidación se reproduce con la tarifa y regla vigentes al momento.
- Totales de caja y reportes concilian con transacciones fuente.
- Simular doble cobro, recibo duplicado, pago parcial, pago aplicado a varios períodos, cierre con diferencia y cambios retroactivos.
- Verificar restauración de copias de seguridad y continuidad.
- Auditor independiente puede reconstruir una muestra sin intervención del operador.
- Pruebas de seguridad, privacidad, rendimiento y accesibilidad antes de producción.

## 9. Gobierno, límites y aprobaciones

IMАUD facilita evidencia y controles, pero no sustituye:
- La aprobación de ordenanzas, tarifas, manuales y procedimientos por autoridades competentes.
- La independencia y competencias de Auditoría Interna y Contraloría Municipal.
- La revisión jurídica, contable y tributaria.
- Los controles de caja, arqueos físicos, conciliación bancaria y supervisión humana.
- La conservación documental y los plazos legales aplicables.

Antes de declarar cumplimiento se requiere una matriz jurídica artículo-por-artículo elaborada y validada por Consultoría Jurídica y la unidad de Auditoría Interna, con las ordenanzas y gacetas municipales vigentes.

## 10. Condiciones de seguridad para el desarrollo actual

- Seguir en entorno de pruebas y con datos ficticios.
- No importar datos del respaldo SUTRAMIRANDA hasta autorización expresa posterior a pruebas.
- No enviar correos ni crear credenciales para contribuyentes reales durante desarrollo.
- No publicar datos personales, financieros, claves ni respaldos en GitHub.
- Mantener la autenticación y políticas RLS bajo pruebas; no exponer service-role keys en cliente.
- No habilitar recaudación real hasta completar conciliaciones, controles y aceptación institucional.
