# Continuidad - Mi Chofer ERP

Esta es la carpeta que el usuario indico como importante para continuar:

```txt
C:\Users\juan\Documents\Codex\2026-06-01\files-mentioned-by-the-user-texto\outputs\mi-chofer-vercel-ready
```

No usar como fuente principal el ZIP. El ZIP existe, pero el usuario dijo que no lo esta usando.

## Tipo de proyecto

Aplicacion Next.js con React y TypeScript, preparada para Vercel.

Archivos principales:

- `app\page.tsx`: aplicacion principal.
- `app\globals.css`: estilos.
- `package.json`: scripts y dependencias.
- `vercel.json`: configuracion de deploy.

## Funcionalidades detectadas

- Login de usuarios.
- Usuario admin por defecto.
- Usuario operador por defecto.
- Permisos por modulo.
- Calculadora de viajes con Google Maps.
- Choferes.
- Clientes corporativos.
- Viajes pendientes.
- Viajes confirmados.
- Cuentas corrientes de clientes.
- Cuentas de choferes.
- Caja por tipo de caja.
- Auditorias.
- Configuracion de tarifas.
- Separacion entre clientes/comisionistas y pasajeros.
- Movimientos de caja en pagina separada con filtro por caja.
- Edicion de forma de cobro y monto en viajes pendientes.
- Eliminacion de usuarios no principales desde Configuracion.
- Pasajero escribible en calculadora, con sugerencias de pasajeros guardados.
- Registro de movimientos en pantalla propia con fecha editable.
- Resumen de caja dentro de Movimientos.
- Exportacion CSV de detalles de cuenta corriente.
- Backup CSV general de viajes y movimientos.

## Credenciales por defecto

Admin:

```txt
usuario: admin
contrasena: Michofer2026
```

Operador:

```txt
usuario: operador
contrasena: Chofer2026
```

## Reglas de tarifa detectadas

Valores por defecto:

- Precio minimo: 15000
- Km 0 a 10: 1850
- Km 10 a 25: 1700
- Mas de 25 km: 1600
- Hora pico: 1.15
- Recargo posnet/tarjeta: 15%
- Recargo hotel: 5%
- Peaje por defecto: 0

La regla de calculo usa precio minimo como piso, no como suma:

```txt
precio por km = calculo escalonado
subtotal = mayor entre precio minimo y precio por km
```

Luego aplica hora pico, hotel, peajes, espera y recargo de posnet si corresponde.

## Persistencia

La app usa `localStorage` para guardar configuracion, usuarios, choferes, clientes, pasajeros, viajes, cuentas, caja, auditorias y API key.

Keys detectadas:

- `miChoferPricingConfig`
- `miChoferUsers`
- `miChoferDrivers`
- `miChoferClients`
- `miChoferPassengers`
- `miChoferPendingTrips`
- `miChoferConfirmedTrips`
- `miChoferClientLedger`
- `miChoferPassengerLedger`
- `miChoferDriverLedger`
- `miChoferCashEntries`
- `miChoferAudits`
- `miChoferGoogleMapsApiKey`

## API key de Google Maps

La app tiene esta key por defecto:

```txt
AIzaSyCbcYMbdwfcfrGFPQKs3qwKCNR0o53baJ0
```

APIs necesarias:

- Maps JavaScript API
- Places API
- Directions API

Para deploy, restringir la key por dominio en Google Cloud.

## Como seguir en un chat nuevo

Decir:

```txt
Quiero continuar el proyecto Mi Chofer ERP. Leé CONTINUIDAD-MI-CHOFER-ERP.md y trabajá sobre esta carpeta:
C:\Users\juan\Documents\Codex\2026-06-01\files-mentioned-by-the-user-texto\outputs\mi-chofer-vercel-ready
```

## Nota

El chat original puede estar bloqueado por error de modelo/cuenta, pero el proyecto no esta perdido. El codigo esta en esta carpeta.
