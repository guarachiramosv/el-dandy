# El Dandy Móvil

Aplicación React Native con Expo para Android y iOS.

El proyecto usa Expo SDK 54, compatible con Expo Go distribuido actualmente en el App Store para dispositivos físicos.

## Funciones incluidas

- Login con usuarios y roles del sistema.
- Consulta y búsqueda de inventario.
- Registro de ventas al contado.
- Alertas de stock.
- Persistencia segura de la sesión en el dispositivo.
- Restricción de productos y alertas a la sucursal del vendedor.

## Ejecutar en un teléfono

1. Inicia el backend desde `backend`:

   ```powershell
   npm run build
   npm start
   ```

2. Verifica que el teléfono y la computadora estén conectados al mismo Wi-Fi.

3. Configura `.env` con la IP local de la computadora:

   ```env
   EXPO_PUBLIC_API_URL=http://192.168.0.4:4000/api
   ```

4. Inicia la aplicación:

   ```powershell
   npm run start:lan
   ```

5. Escanea el QR con Expo Go en Android o con la cámara en iPhone.

El comando `start:lan` detecta automáticamente la IP actual de la computadora.

### iPhone: permiso de red local

En el iPhone abre:

`Configuración > Apps > Expo Go > Red local`

Activa **Red local**. Este permiso es necesario porque la app consulta el backend de la computadora.
