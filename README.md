# SOMA Casa · Retail demo + Salesforce Data 360

Tienda ficticia para prácticas: **Home, Login y Detalle de Producto**. HTML, CSS y JavaScript nativos, sin framework, dependencias de ejecución, compilación ni backend. Incluye seis productos, tres ilustraciones SVG locales por producto, banner, filtros, bolsa simulada y un visor de eventos.

## Abrir sin servidor

1. Descarga y descomprime **toda** la carpeta.
2. Abre `index.html` en un navegador moderno.
3. Acepta la medición de la demo, navega y abre **Ver actividad** en el pie de página.
4. Entra en **Mi espacio** y utiliza, por ejemplo, `alumno@example.com`. La contraseña es opcional, no se autentica, no se almacena y no se envía.

Todos los recursos visuales son locales. No se usan `fetch()` para cargar archivos, módulos ES, fuentes externas, CDNs de diseño ni rutas absolutas. La tienda funciona sin conexión.

**Con `file://` los eventos se simulan siempre.** No se intenta cargar el SDK remoto: no se puede garantizar un origen HTTP ni las cookies de identidad del SDK con archivos locales. La simulación ejecuta el mismo sitemap; no es una recepción real en Salesforce ni una implementación del SDK. Para enviar datos reales sin mantener un servidor, utiliza GitHub Pages.

La sesión de demostración usa `sessionStorage`. En `file://` también usa `window.name`, porque el almacenamiento de archivos no se comparte de forma fiable entre páginas. Navega en la **misma pestaña**. La sesión es de demostración y su persistencia depende del navegador. No utilices credenciales reales.

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio tuyo, con `index.html` en la raíz. Incluye `assets/`, `js/` y `.nojekyll`.
2. En el repositorio, abre **Settings → Pages → Build and deployment**.
3. Selecciona **Deploy from a branch**, tu rama y la carpeta **/ (root)**. Guarda.
4. Abre la URL HTTPS que GitHub muestre al finalizar el despliegue.

Las rutas relativas funcionan también bajo `https://USUARIO.github.io/REPOSITORIO/`. No necesitas Node ni ejecutar comandos para usar o publicar la tienda. Estos archivos están preparados para publicar; no se ha creado ni publicado ningún repositorio automáticamente.

## Conectar cada entorno de Data 360

### 1. Crear el Website Connector y cargar el esquema

En **Data 360 Setup → Websites & Mobile Apps**, crea un conector de tipo **Website**. Carga `salesforce/web-connector-schema.json`: contiene `somaActivity`, `catalog`, `cart`, `cartItem`, `identity`, `contactPointEmail` y `consentLog`, con los campos de esta demo.

Este esquema es específico del ejercicio, no una copia completa del esquema recomendado de Salesforce. Si usas un conector existente, **combina** estos eventos/campos con su esquema actual; no elimines ni cambies los campos ya desplegados. Si partes del esquema recomendado, añade `somaActivity`, los campos `attribute…` de catálogo y `email`/`userName` de `identity` que no existan.

### 2. Pegar la URL del SDK

En `js/config.js`, sustituye únicamente:

```javascript
salesforceSdkUrl: "PON_AQUI_LA_URL_DE_TU_CONECTOR_WEB_DE_DATA360",
```

por la URL **HTTPS del script CDN** que aparece en **Integration Guide** del conector. No es la URL de tu organización, un endpoint de Ingestion API ni una API key. Este proyecto no necesita secretos.

Deja `cookieDomain: ""` para utilizar el dominio actual. No establezcas `github.io` como dominio de cookies. Los repositorios de un mismo `USUARIO.github.io` comparten host: para ejercicios de identidad independientes, es preferible que cada alumno use su propio usuario/dominio o perfil de navegador.

### 3. Una sola inicialización del sitemap

Esta demo usa un **sitemap gestionado localmente**: `tracking.js` carga el CDN, espera `init()`, y ejecuta `initSitemap()` con la configuración de `js/sitemap.js`.

**No subas `js/sitemap.js` al conector ni mantengas otro sitemap con `init()` / `initSitemap()` en el CDN.** Este archivo expone una factoría que utiliza los datos de esta web; no es un script autónomo para subir sin adaptar. Conserva `sitemapOwner: "local"`. Si tu organización gestiona obligatoriamente el sitemap desde Salesforce, necesitarás adaptar este arranque para tener un único responsable y evitar eventos duplicados.

### 4. Desplegar los Data Streams y mapear los datos

Crea Data Streams a partir de ese Website Connector, selecciona los eventos y despliega los streams de **Engagement** y **Profile**. El código no crea conectores, streams, DMOs ni reglas de resolución de identidad.

| Origen | Campo | Destino orientativo |
| --- | --- | --- |
| `identity` | `deviceId` | Individual → Individual ID |
| `identity` | `isAnonymous` | Individual → Is Anonymous |
| `identity` | `userName` | Individual → External Record ID, si procede en tu modelo |
| `contactPointEmail` | `deviceId` | Contact Point Email → Contact Point Email ID y Party |
| `contactPointEmail` | `email` | Contact Point Email → Email Address |
| `catalog` | `eventId`, `deviceId`, `id` | Product Browse Engagement → ID, Individual, Product |
| `catalog` | `attributeSku` | Product Browse Engagement → Product SKU, si procede |
| `somaActivity` | Campos de la actividad | DMO de engagement elegido para el ejercicio |

Mapea también las fechas y los campos que requiera tu modelo. Revisa los nombres de destino y relaciones en tu organización. Para unificar dispositivos o perfiles por email, configura y ejecuta un **Identity Resolution Ruleset** apropiado. Enviar el email por sí solo no demuestra una unificación completada.

### 5. Verificar el recorrido real

Abre la versión HTTPS, acepta la medición y visita un producto. Entra con un email ficticio; después visita otro producto.

- **Ver actividad** debe indicar `SDK inicializado`. Los registros `Preparado` son los payloads en `onActionEvent`, antes del transporte; no prueban recepción.
- En DevTools → **Network**, comprueba la carga del CDN y las solicitudes del SDK a Salesforce. Revisa los errores de red, consentimiento, cookies, dominio/origen y bloqueadores.
- Comprueba en los **Data Streams / Data Explorer** la llegada de `catalog`, `somaActivity`, `identity` y `contactPointEmail` con el mismo `deviceId`, y posteriormente sus mapeos.
- Si aparece un error del SDK, corrige la configuración y recarga. No se cambia silenciosamente a simulación cuando falla un CDN configurado.

Sin la URL del conector y acceso a una organización no se puede verificar la ingestión real ni validar el esquema mediante su importación. El visor nunca afirma que Salesforce ha recibido un evento.

## Sitemap y eventos para los alumnos

La instrumentación está centralizada en **`js/sitemap.js`**. No hace falta editar la lógica de la tienda para cambiar los eventos.

| Acción | Interacción | Tipo en Data 360 |
| --- | --- | --- |
| Abrir Home | `View Home` | `somaActivity` |
| Pulsar banner | `Discover Collection` | `somaActivity` |
| Filtrar colección | `Filter Products` + `categoryName` | `somaActivity` |
| Seleccionar un producto | `Select Product` + `productId` | `somaActivity` |
| Abrir detalle | `View Catalog Object Detail` + objeto Product | `catalog` |
| Cambiar imagen | `View Product Image` + `productId`, `imageIndex` | `somaActivity` |
| Añadir a la bolsa | `Add To Cart` + SKU lógico, precio y cantidad | `cart` y `cartItem` |
| Pulsar Mi espacio | `Open Login` | `somaActivity` |
| Abrir Login | `View Login` | `somaActivity` |
| Enviar el login | `Login` | `somaActivity` |
| Identificarse | `user.attributes.eventType: identity` | `identity` |
| Comunicar el email | `user.attributes.eventType: contactPointEmail` | `contactPointEmail` |

El SKU comercial se incluye en los atributos de catálogo; las líneas de bolsa usan el `id` lógico del producto como `catalogObjectId`. Los clics que preceden una navegación dependen del transporte del SDK y del navegador: comprueba su entrega real en Network. La vista de producto se instrumenta además desde la página de destino.

Ejemplo de actividad personalizada:

```javascript
bridge.send({
  interaction: {
    name: "Mi acción de clase",
    eventType: "somaActivity",
    productId: "sillon-alba"
  }
});
```

`name` describe la acción. `eventType` debe coincidir con el `developerName` del evento en el esquema. Para añadir un campo, añádelo también a `externalDataTranFields` con el tipo correcto. Los atributos de `catalogObject.attributes` se traducen a `attributeName`, `attributeSku`, etc.; no son los mismos nombres que los campos personalizados directos de `somaActivity`.

El login prepara **dos eventos de perfil**, ligados por el identificador de dispositivo del SDK:

```javascript
{ user: { attributes: {
  eventType: "identity", isAnonymous: 0,
  userName: "alumno@example.com", email: "alumno@example.com"
} } }
{ user: { attributes: {
  eventType: "contactPointEmail", email: "alumno@example.com"
} } }
```

No se usa `user.identities.emailAddress`, propio de otros patrones de integración. Se reenvía el perfil conocido al inicializar una nueva página o al consentir después del login; el stream de perfil debe gestionar actualizaciones del mismo dispositivo. El botón **Usar otro email** limpia la sesión identificada y pide al SDK un nuevo identificador anónimo para el siguiente alumno.

La web no autentica a nadie. Solo exige un formato de email válido para poder ilustrar la identificación. El campo contraseña se limpia al enviar; no existe ninguna lectura de su valor para analítica o almacenamiento.

## Consentimiento y límites de la demo

No se inicia la medición hasta aceptar. **Solo necesarias** permite usar todo el catálogo y el login. El pie de página permite cambiar la decisión. Una revocación se transmite al SDK si está iniciado; impide nuevas actividades, pero no borra lo ya recibido por Salesforce. No se reproducen eventos de navegación anteriores al consentimiento. Si te identificas antes de consentir, el perfil se prepara al aceptar posteriormente.

El visor guarda hasta 40 eventos en la sesión de la pestaña, incluidos emails de prueba. Se vacía al cambiar de usuario, cambiar el consentimiento o pulsar **Limpiar visor**. La bolsa, disponibilidad, envío y precios son ficticios. No hay checkout ni pagos.

## Archivos

```text
index.html                         Home: banner y seis productos
producto.html?id=sillon-alba       Detalle reutilizable para los seis productos
login.html                         Login ficticio
assets/styles.css                  Diseño adaptable: 3 columnas / 2 filas en escritorio
assets/images/                     20 ilustraciones SVG locales
js/products.js                     Catálogo, precios, SKU y descripciones
js/app.js                          Presentación y sesión de demostración
js/config.js                       URL del conector que cambia cada alumno
js/sitemap.js                      Páginas, listeners y payloads de Data 360
js/tracking.js                     Consentimiento, SDK, simulación y visor
salesforce/web-connector-schema.json  Esquema de los eventos del ejercicio
tests/                             Comprobaciones de lógica y DOM
```

## Pruebas opcionales de desarrollo

La tienda no requiere instalaciones. Solo para ejecutar las pruebas de lógica y DOM, instala Node y ejecuta `npm install` y `npm test`. Se usa `jsdom` como dependencia de desarrollo, sin servidor ni peticiones externas. Se comprueban las tres páginas, los seis productos, las rutas de recursos, el carrusel, la sesión, el consentimiento y el contrato de arranque del SDK mediante un doble de prueba.

Estas pruebas no sustituyen una revisión visual en un navegador ni una comprobación de ingestión con un conector real. La apertura automatizada de `file://` no estaba permitida en el entorno de verificación usado para crear este proyecto.

## Referencias oficiales

- [Sitemap de Salesforce Interactions SDK](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-sitemap.html).
- [Inicialización y consentimiento](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-initialization.html).
- [User Data y perfiles](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-user-data.html).
- [Traducción de eventos al esquema del conector](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-translating-sdk-events-to-web-connector-schemas.html).
- [Eventos personalizados](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-custom-events.html).
- [Configuración, streams y mapeos](https://developer.salesforce.com/docs/marketing/einstein-personalization/guide/integrate-salesforce-interactions-sdk.html).

Los pasos de configuración y la estructura de eventos se han contrastado con estas referencias. La aceptación final del esquema y la ingestión deben comprobarse en el entorno del alumno.
