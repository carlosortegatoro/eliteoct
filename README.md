# SOMA Casa · Retail demo + Salesforce Data 360

Tienda ficticia para prácticas: **Home, Login y Detalle de Producto**. HTML, CSS y JavaScript nativos, sin compilación ni backend. Incluye seis productos, tres ilustraciones SVG locales por producto, banner, filtros y bolsa simulada.

## Abrir sin servidor

1. Descarga y descomprime toda la carpeta.
2. Abre `index.html` en un navegador moderno.
3. Navega por los productos y entra en **Mi espacio** con un email de prueba.

La contraseña es opcional: no se autentica, no se almacena ni se envía por el código de la tienda. Se limpia al enviar el formulario. No utilices credenciales reales.

Los recursos visuales son locales y las rutas son relativas. La interfaz puede funcionar sin conexión; el script de Salesforce requiere red. La sesión usa `sessionStorage` y, con `file://`, también `window.name`: navega en la misma pestaña. La persistencia de archivos locales depende del navegador.

**Para comprobar el envío real a Data 360, usa la versión HTTPS de GitHub Pages.** El funcionamiento del SDK, sus cookies y la aceptación del origen `file://` no están garantizados. No hay un simulador de eventos local.

## Copiar y publicar en GitHub Pages

1. Abre [el repositorio base](https://github.com/carlosortegatoro/eliteoct) y pulsa **Fork** para crear tu copia.
2. Comprueba que `index.html`, `login.html`, `producto.html`, `assets/`, `js/` y `.nojekyll` están en la raíz de tu repositorio.
3. Configura el tag de tu org como se explica a continuación, antes de hacer las pruebas de medición.
4. Abre **Settings → Pages → Build and deployment**.
5. Selecciona **Deploy from a branch**, la rama `main` y **/ (root)**. Guarda.
6. Espera a que termine el despliegue y abre la URL HTTPS que muestra GitHub.

Las rutas funcionan bajo `https://USUARIO.github.io/REPOSITORIO/`. No necesitas Node ni comandos para publicar o usar la tienda. No subas solamente el ZIP: Pages necesita los archivos descomprimidos.

## Cambiar el conector de Data 360

La cabecera `<head>` de **index.html, login.html y producto.html** contiene exactamente este tag:

```html
<script src="https://cdn.c360a.salesforce.com/beacon/c360a/72b03f61-f57d-4065-a05d-7b9ab4a6d8ff/scripts/c360a.min.js"></script>
```

Cada alumno debe sustituir el valor de `src` por la URL completa del script CDN proporcionada por **Integration Guide** de su Website Connector. La URL incluida corresponde al conector del ejercicio; cámbiala por la de tu org en las tres páginas antes de probar la medición.

Desde GitHub:

1. Abre `index.html` en tu fork y pulsa el lápiz (**Edit this file**).
2. Localiza el tag anterior dentro de `<head>`.
3. Cambia solo el valor de `src`, conservando las comillas y `</script>`.
4. Guarda con **Commit changes**.
5. Repite en `login.html` y `producto.html`. Debe haber un único tag de Salesforce en cada cabecera y los tres deben apuntar a tu conector.
6. Espera al nuevo despliegue de Pages y recarga las páginas.

Usa la URL pública del script que genera tu conector. No es la URL de Salesforce Setup, de tu org ni de Ingestion API. No hacen falta contraseñas, tokens ni claves privadas en este repositorio.

## Sitemap gestionado por Data Cloud

**Data Cloud inyecta el sitemap a través de la integración del conector.** El repositorio no contiene un sitemap local, ni llama a `init()`, `initSitemap()` o `sendEvent()`. Tampoco contiene `js/config.js`, `js/sitemap.js` o `js/tracking.js`.

Crea o adapta y publica el sitemap en Data Cloud para tu org. Allí se definen la inicialización del SDK, el consentimiento, las páginas, los listeners, los eventos y la identificación por email. Evita inicializaciones duplicadas desde otro código o un tag manager. **Insertar el tag no configura por sí solo los eventos ni el identity del login.**

La tienda genera parte de su DOM con scripts `defer`. El sitemap inyectado debe esperar a que la página y `window.SomaShop` estén disponibles (por ejemplo, tras `DOMContentLoaded`) antes de leer sus datos o registrar listeners sobre elementos generados.

Puntos de integración disponibles para el sitemap remoto:

| Elemento o dato | Ubicación |
| --- | --- |
| Página | `document.body.dataset.page`: `home`, `login` o `product` |
| Productos | `window.SOMA_PRODUCTS` o `window.SomaShop.products` |
| Producto actual | `window.SomaShop.currentProduct` (puede ser nulo) |
| Enlaces de producto | `[data-product-link]` |
| Filtros | `[data-filter]` |
| Carrusel | `[data-gallery-index]`, `[data-gallery-step]`; `SomaShop.galleryIndex` |
| Bolsa | `#add-to-bag`; `SomaShop.quantity` |
| Enlace al login | `[data-track-login]` |
| Formulario de login | Evento `submit` de `#login-form`; campo `#email` |
| Email de sesión | `window.SomaShop.get("email", "")` |
| Cambio de usuario | `#change-user` |

El login guarda el email normalizado en la sesión de demostración y deja que el evento `submit` se propague. El sitemap remoto debe capturar un login válido y enviar el perfil según el esquema de tu conector. También debe gestionar la identidad del SDK al cambiar de usuario; el botón de la web solo limpia la sesión de demostración. La web no llama al SDK ni controla su consentimiento.

## Esquema, streams y comprobación

`salesforce/web-connector-schema.json` es un **ejemplo de esquema** para el ejercicio: contiene `somaActivity`, `catalog`, `cart`, `cartItem`, `identity`, `contactPointEmail` y `consentLog`. Adáptalo a los eventos del sitemap que publiques en Data Cloud. El archivo no genera eventos ni configura automáticamente la org.

1. Configura tu Website Connector y su esquema. Si reutilizas uno, conserva sus eventos y campos existentes.
2. Publica el sitemap remoto con las páginas, eventos e identidad que quieras medir. Los nombres y tipos de los campos deben coincidir con el esquema.
3. Crea y despliega los Data Streams correspondientes y configura sus mapeos a DMO.
4. Abre tu tienda por HTTPS y aplica el consentimiento definido en tu integración.
5. En DevTools → **Network**, comprueba el script CDN y las solicitudes del SDK. Revisa **Console** si faltan eventos.
6. Visita Home, un producto, cambia su imagen, añade a la bolsa y envía el login con un email de prueba.
7. Comprueba en Data 360 la recepción de los eventos que hayas configurado, el email y su relación con el identificador del dispositivo. Después verifica mapeos y, si corresponde, resolución de identidad.

Los eventos de navegación, catálogo, bolsa e identidad dependen del sitemap publicado. La bienvenida del login solo confirma la sesión ficticia; una descarga correcta del CDN no demuestra ingestión. La resolución de identidad requiere además la configuración adecuada en la org.

## Archivos

```text
index.html                           Home y tag del conector
producto.html                        Detalle reutilizable y tag del conector
login.html                           Login ficticio y tag del conector
assets/styles.css                    Diseño adaptable
assets/images/                       Ilustraciones SVG locales
js/products.js                       Catálogo, precios, SKU y descripciones
js/app.js                            Interfaz y sesión de demostración
salesforce/web-connector-schema.json  Ejemplo de esquema para el ejercicio
tests/site.test.cjs                   Pruebas de la tienda y del tag
```

## Pruebas opcionales de desarrollo

La tienda no requiere instalaciones. Para ejecutar las pruebas, instala Node y ejecuta `npm install` y `npm test`. Usan `jsdom` como dependencia de desarrollo y no descargan ni ejecutan el CDN.

Se comprueban los seis productos, carruseles, bolsa, sesión y login, los recursos locales, el tag exacto en las tres cabeceras y la ausencia de instrumentación local. Estas pruebas no verifican el sitemap remoto ni la ingestión en Salesforce.

## Referencias

- [Sitemap de Salesforce Interactions SDK](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-sitemap.html)
- [Inicialización y consentimiento](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-initialization.html)
- [User Data y perfiles](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-user-data.html)
- [Traducción de eventos al esquema](https://developer.salesforce.com/docs/data/salesforce-interactions-sdk/guide/c360a-api-translating-sdk-events-to-web-connector-schemas.html)
