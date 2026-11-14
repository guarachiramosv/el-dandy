# El Dandy Mobile

Aplicacion React Native con Expo para Android y iOS.

El proyecto usa el backend hosteado:

```env
EXPO_PUBLIC_API_URL=https://sistema-el-dandy.onrender.com/api
```

El frontend web hosteado esta en:

```text
https://sistema-el-dandy-ibb8.onrender.com
```

## Ejecutar en un telefono

Desde esta carpeta:

```powershell
cd C:\Users\guara\Documents\Tienda\el-dandy\mobile
npm start
```

Tambien puedes usar el comando que ya venias usando:

```powershell
npm run start:lan
```

Ambos comandos usan el backend publico. Ya no intentan conectar a
`http://192.168.0.54:4000/api`.

Si el QR no abre en Expo Go por LAN, usa tunel:

```powershell
npm run start:tunnel
```

El tunel suele funcionar mejor cuando Windows Firewall, la red Wi-Fi o el router
bloquean la conexion local entre el telefono y la computadora.

## Funciones incluidas

- Login con usuarios y roles del sistema.
- Consulta y busqueda de inventario.
- Registro de ventas al contado.
- Alertas de stock.
- Persistencia de la sesion en el dispositivo.
- Restriccion de productos y alertas a la sucursal del vendedor.

## Administracion movil 1.1.0

- Productos y detalle muestran Cochabamba y Santa Cruz, incluso si una sucursal aun no tiene stock registrado.
- Disponible total suma las sucursales activas; el stock fuera de venta se identifica por separado.
- Agregar stock permite seleccionar sucursal, cantidad, estante, costo unitario en Bs o R$, tipo de cambio, proveedor, comprobante y notas.
- Nuevo producto admite compra inicial en ambas monedas. El costo en Bs y el total se calculan antes de guardar.
- Para registrar tambien la compra financiera, seleccionar un proveedor. Sin proveedor, el ingreso queda en el historial de inventario.
- Editar conserva la moneda/costo anterior y valida el stock esperado del formulario.

Estos cambios requieren instalar el APK nuevo. Una actualizacion de Render no modifica un APK ya instalado. Generar con `npm run build:apk`; conserva la firma release existente y usa el backend publico configurado en `.env`.
