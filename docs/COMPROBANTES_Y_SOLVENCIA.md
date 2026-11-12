# SITMAUD — Gestión independiente de comprobantes y certificados de solvencia

## Decisión funcional aprobada

SITMAUD manejará dos documentos distintos, con flujos, numeración, controles y propósitos diferentes:

1. **Comprobante oficial de pago:** constancia transaccional que se genera después de que el pago haya sido registrado y confirmado. Refleja el importe efectivamente recibido y los períodos/conceptos a los que se aplicó.
2. **Certificado de solvencia:** documento administrativo formal que el contribuyente solicita expresamente. No se genera automáticamente por el hecho de pagar. Se emite solo después de verificar las obligaciones exigibles dentro del alcance definido y de obtener la autorización del funcionario competente.

## Flujo de solicitud de certificado

1. El contribuyente solicita el certificado en la oficina o mediante el portal, si este canal se habilita.
2. El funcionario registra la solicitud y el motivo/finalidad declarada (por ejemplo, trámite de vivienda, registro, actualización documental u otro).
3. El sistema identifica al solicitante, contribuyente, número de contrato e inmueble objeto del certificado.
4. SITMAUD ejecuta una consulta de estado de cuenta a una fecha de corte; considera liquidaciones exigibles, pagos confirmados, aplicaciones, reversos, ajustes y posibles operaciones pendientes de conciliación.
5. El expediente queda en estado pendiente de revisión si hay diferencias, pagos sin confirmar, deudas o datos incompletos.
6. Si cumple los criterios de solvencia aprobados por la normativa y el procedimiento municipal, se envía a autorización del jefe de la Oficina de Recaudación o del funcionario formalmente delegado.
7. El funcionario autorizado revisa el expediente y aprueba o rechaza con motivo registrado.
8. Tras la aprobación, SITMAUD genera el certificado con folio único, fecha de emisión, fecha de corte, alcance, firma y sello autorizados, y QR de validación.
9. Se registra entrega/descarga, reimpresión, consulta, revocación o sustitución.

## Controles y responsabilidades

- No emitir certificados automáticamente después de un pago.
- No considerar solvente una cuenta solo porque no muestra saldo si existen pagos pendientes de conciliación, reversos, liquidaciones aún no aplicadas u otras excepciones.
- La regla exacta de solvencia, el alcance de obligaciones, el período de validez, las tasas y los requisitos deben validarse con la ordenanza y el procedimiento municipal vigente.
- La autorización corresponde al jefe de la Oficina de Recaudación o a quien tenga delegación formal vigente. No debe quedar ligada a un nombre fijo: SITMAUD debe administrar el cargo, funcionario titular, suplente/delegación, vigencia y muestra de firma/sello aprobados.
- La firma digital o electrónica solo se utilizará si su validez, certificado y procedimiento están aprobados institucional y jurídicamente. De lo contrario, el sistema generará el documento para firma manuscrita y sello físico.
- La cuenta que verifica, la que aprueba y la que entrega deben quedar registradas; se aplicará segregación de funciones según el procedimiento aprobado.
- El certificado emitido no se elimina ni se sobrescribe. Una corrección, revocación o sustitución crea un nuevo evento relacionado y conserva el documento anterior.
- El QR permitirá validar autenticidad, estado (vigente/revocado), folio, fecha de emisión y alcance, sin exponer datos personales innecesarios.

## Contenido mínimo propuesto del certificado

- Identidad gráfica oficial de Alcaldía e IMAU/ente competente, según manual institucional.
- Título: CERTIFICADO DE SOLVENCIA.
- Número de certificado y código de verificación.
- Nombre o razón social y cédula/RIF del contribuyente.
- Número de contrato y descripción/dirección del inmueble.
- Parroquia y sector.
- Fecha de corte de la consulta.
- Declaración de solvencia con alcance explícito (inmueble/contrato y concepto tributario).
- Finalidad declarada por el solicitante, cuando proceda.
- Fecha de emisión y período de validez, si la normativa lo establece.
- Nombre y cargo del funcionario autorizante.
- Firma y sello institucional autorizados.
- Código QR para validación pública controlada.

## Estados de la solicitud

- Recibida
- En verificación
- Observada
- Pendiente de conciliación
- Pendiente de autorización
- Aprobada
- Rechazada
- Emitida
- Entregada
- Revocada
- Sustituida

## Diseño de pantallas

- Bandeja de solicitudes con filtros por estado, fecha, funcionario, contrato y contribuyente.
- Vista de expediente con estado de cuenta y cronología.
- Panel de revisión del jefe de Recaudación.
- Vista previa del certificado antes de firmar.
- Registro de firmas, sellos, delegaciones y vigencias.
- Consulta pública de autenticidad mediante QR con exposición mínima de datos.

## Auditoría

Registrar actor, fecha/hora, motivo de solicitud, verificaciones ejecutadas, estado de cuenta usado, resultado, observaciones, aprobador, delegación vigente, versión del documento, huella del PDF, entrega, descargas, reimpresiones y eventos posteriores. Ningún certificado se genera sin expediente y autorización registrados.
