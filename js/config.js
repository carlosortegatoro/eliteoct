/* Configuración pública: no introduzcas contraseñas, tokens ni consumer secrets. */
window.SOMA_CONFIG = Object.freeze({
  // Pega aquí la URL completa de Integration Guide > CDN del Website Connector.
  salesforceSdkUrl: "PON_AQUI_LA_URL_DE_TU_CONECTOR_WEB_DE_DATA360",
  // Vacío usa el dominio actual. En GitHub Pages no uses «github.io».
  cookieDomain: "",
  // «local»: este proyecto inicializa js/sitemap.js. No subas otra copia al CDN.
  sitemapOwner: "local"
});
