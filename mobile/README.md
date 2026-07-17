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
