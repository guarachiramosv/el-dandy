# Revision de reportes y seguridad: 14/11/2026

## Correccion comprobada

Se verifico el caso de una venta ingresada el 31/10/2026 para la jornada del 30/10/2026 como correccion de cierre: aparece en el reporte de su fecha de caja y conserva la fecha de registro. No se modificaron ventas, cierres ni stock durante esta revision.

- Web: recarga al cambiar filtros, al volver a la ventana y cada 30 segundos mientras es visible. Las respuestas antiguas no reemplazan una consulta nueva. Si falla la consulta, se retira el reporte anterior y se muestra el error.
- Descargar e imprimir consulta nuevamente el servidor y cancela la exportacion si falla. Los PDF anteriores son archivos estaticos y deben descargarse otra vez.
- Pantalla, PDF e historial de inventario muestran fecha de caja y correccion; se conserva la fecha original de registro. El resumen diario de ganancias usa fechaNegocio.
- Movil: conserva ambas fechas, muestra correcciones, recarga al volver a la app y consulta nuevamente antes de imprimir. Los cambios moviles requieren un nuevo APK; Render publica backend y web.

## Controles reforzados

- Autenticacion valida HS256 y consulta usuario/cliente activo y permisos actuales. Desactivar o cambiar el rol/sucursal surte efecto en la siguiente peticion.
- Se elimina la clave JWT publica de respaldo; el servidor exige JWT_SECRET configurado.
- Administrador obligatorio para modificar categorias, proveedores, sucursales, borrar clientes y subir imagenes. Reportes/finanzas e inventario administrativo ya requieren administrador.
- El listado de ventas de un vendedor queda limitado a sus ventas.
- Los clientes relacionados en respuestas de ventas, cuentas y reportes omiten password.
- Limites de intentos de ingreso y registro; respuestas API con no-store y JSON limitado a 100 KB.
- Fechas de calendario reales en ventas, cierres, compras y finanzas. Los reportes validan periodo, UUID y filtros.
- Ventas futuras rechazadas. Correcciones requieren cierre observado del mismo vendedor, sucursal y fecha. Las transacciones de venta existentes usan aislamiento Serializable.
- Los errores de remachado conservan la respuesta de validacion 400 y ya no imprimen el cuerpo completo de la peticion.

## Verificacion y prevencion

22 pruebas backend y 3 pruebas de fechas/PDF. Incluyen el caso 30/10-31/10, cruce de mes, permisos, sesion inactiva, rol cambiado, fechas imposibles, cantidades negativas, productos duplicados, autorizacion de correcciones y limite de ingreso. Compilacion backend, web y TypeScript movil. Exportacion Android/Hermes y revision visual del PDF del 30/10.

GitHub Actions ejecuta compilaciones, pruebas y auditorias en cada push a main y pull request. Los endpoints de salud y HTML publicado identifican el commit para comprobar Render.

## Limites de la revision

Una revision de codigo, dependencias y pruebas no certifica ausencia total de vulnerabilidades. No incluye pentest externo, configuracion privada de Render, recuperacion de backups, pruebas en dispositivos fisicos ni revision exhaustiva de cada combinacion de operaciones concurrentes.

Backend y frontend: auditoria npm sin vulnerabilidades al momento de la revision. Movil: sin alertas moderadas, altas ni criticas despues de las actualizaciones; quedan alertas bajas heredadas de deepmerge en herramientas de configuracion Expo. No hay version corregida de deepmerge publicada en la auditoria realizada. No se rebajo a una version anterior ni se ocultaron alertas.

El control de intentos usa memoria de cada proceso; se reinicia al redesplegar. Una configuracion con varias instancias requiere un almacen de limites compartido. La revocacion por cambio de contrasena sigue dependiendo del vencimiento del token; desactivar la cuenta si se requiere cortar inmediatamente todas sus sesiones.
