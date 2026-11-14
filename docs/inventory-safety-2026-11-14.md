# Revision de integridad y permisos del inventario

## Datos actuales (consulta de solo lectura)

Se comprobaron productos, stock por sucursal, balatas, remaches y aritmetica de movimientos. No se encontraron cantidades negativas/no finitas, diferencias entre stock total y suma de sucursales activas, ni movimientos con diferencia entre cantidad y variacion de stock. No hubo modificaciones de existencias reales durante las pruebas. Ninguna cuenta activa utiliza las dos contrasenas publicas del antiguo seed; no se imprimieron hashes ni claves.

## Riesgos corregidos

- Todos los servicios que modifican inventario usan transacciones Serializable. Conflictos simultaneos devuelven 409; no hay reintentos automaticos de escrituras.
- Las ventas y accesorios de remachado solo descuentan de la sucursal activa indicada por el vendedor autenticado. Se elimina la seleccion automatica de otra sucursal y la venta de productos inactivos.
- El catalogo de venta se filtra por sucursal del vendedor, incluso si modifica los parametros de la peticion. Los listados administrativos conservan su alcance autorizado.
- Un formulario antiguo no puede reponer cantidades vendidas mientras estaba abierto. Los cambios numericos absolutos requieren stockEsperado coincidente; editar otros datos no reenvia el stock sin modificar.
- Ajustes negativos excesivos se rechazan en vez de recortar silenciosamente a cero. Productos por unidad requieren cantidades enteras y las ventas no pueden tener total cero.
- Compras, ingresos y ajustes no cargan cantidades en productos/sucursales inactivos sin restaurarlos primero.
- Las anulaciones usan el movimiento original de VENTA o REMACHADO y mantienen el total de sucursales activas. Una anulacion concurrente no devuelve existencias dos veces.
- Restricciones CHECK de PostgreSQL rechazan stock negativo, infinito y NaN. La migracion valida datos existentes sin corregir ni recalcular sus cantidades.
- Las operaciones de web y del nuevo codigo movil envian un identificador de repeticion. El servidor guarda resultado e identificador junto con el movimiento en una unica transaccion. El mismo identificador/datos devuelve el resultado anterior; cambiar datos con ese identificador produce 409.
- Los endpoints administrativos exigen rol ADMIN del usuario activo consultado en la base. Cantidades y actor no se toman de campos adicionales enviados por el navegador.
- Las tareas automaticas de caja no escriben inventario. Las alertas tampoco recalculan cantidades.
- El seed ya no permite crear cuentas de prueba en produccion ni restablecer contrasenas/permisos de cuentas existentes. El desarrollo requiere claves explicitas de al menos 12 caracteres; no se registran en consola.

## Pruebas

Se ejecutaron 23 pruebas backend, 6 frontend y 12 pruebas con PostgreSQL real en un contenedor local aislado. Las pruebas de integracion rechazan una URL de base remota o un nombre distinto de inventory_test. Incluyen ventas de la ultima unidad en paralelo, transferencias concurrentes, anulacion duplicada, peticiones repetidas, rollback despues de modificar stock, formularios obsoletos, producto inactivo, sucursal ajena, cantidades fraccionarias y restricciones directas de la base.

Las pruebas se incorporan a GitHub Actions, con un PostgreSQL descartable. Se verifican compilacion web/backend, TypeScript movil y exportacion Android/Hermes.

## Limites y pendientes

- Esto no es una garantia de ausencia de hackeos. Un administrador autorizado puede ajustar cantidades y un vendedor puede registrar una venta real o ficticia; ambos actos se registran. Una cuenta administradora o credencial de base comprometida requiere medidas de cuenta/infraestructura adicionales.
- La proteccion contra repeticion requiere conservar el mismo identificador. Los APK anteriores siguen compatibles, pero no incluyen ese identificador y requieren reinstalar el APK actualizado para esa proteccion de cliente. Las protecciones de permisos, transacciones, sucursal y cantidades se aplican en el servidor a todos los clientes.
- Los formularios de APK anteriores que intenten sobrescribir cantidades sin stockEsperado recibiran 409. Se impide la sobrescritura en vez de aceptar una cantidad no confirmada.
- El registro de operaciones repetibles se conserva; no se agrega ningun proceso automatico que borre o cambie movimientos de inventario.
- Las ocho alertas bajas de herramientas Expo de la revision anterior siguen documentadas. No hay prueba en un telefono fisico ni pentest externo.
- Al reconstruir una base vacia con el historial antiguo de migraciones, la migracion 20260626000000_customer_auth falla porque Cliente todavia no existe en ese punto del historial. No se alteraron migraciones ya aplicadas. El cambio nuevo se probo sobre el esquema actual y debe prepararse un baseline de instalacion/restauracion aparte antes de depender de una reconstruccion desde cero.
