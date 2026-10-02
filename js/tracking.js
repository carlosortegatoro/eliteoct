/* Arranque del SDK y adaptador educativo. El mapa de eventos está en sitemap.js. */
(function () {
  "use strict";
  var shop = window.SomaShop, config = window.SOMA_CONFIG;
  var sdk = null, ready = false, starting = false, identifiedEmail = "";
  var mode = "pending", status = "Medición pendiente de consentimiento";
  var entries = shop.get("events", []);
  if (!Array.isArray(entries)) entries = [];
  entries = entries.filter(function (entry) { return entry && entry.payload && typeof entry.payload === "object"; });
  var consent = shop.get("consent", "pending");
  function render() {
    document.getElementById("tracking-status").textContent = status;
    document.getElementById("event-log").innerHTML = entries.length ? entries.slice().reverse().map(function (e) {
      var label = e.payload.interaction ? e.payload.interaction.name
        : e.payload.user && e.payload.user.attributes ? e.payload.user.attributes.eventType
        : e.payload.consents ? "Consent Update" : "SDK Event";
      return '<details><summary><span>' + shop.escape(e.time + " · " + label) + '</span><span>' + (e.mode === "demo" ? "Simulado" : "Preparado") + '</span></summary><pre>' + shop.escape(JSON.stringify(e.payload, null, 2)) + '</pre></details>';
    }).join("") : '<p class="empty-state">Todavía no hay eventos. Acepta la medición y explora la tienda.</p>';
  }
  function observe(event) {
    if (consent !== "accepted") return;
    entries.push({ time: new Date().toLocaleTimeString("es-ES"), mode: mode, payload: JSON.parse(JSON.stringify(event)) });
    entries = entries.slice(-40); shop.set("events", entries); render();
  }
  function failure(error) {
    ready = false; mode = "error";
    status = "Error del SDK: " + (error && error.message ? error.message : "no se pudo iniciar o enviar el evento"); render();
  }
  function send(event) {
    if (!ready || consent !== "accepted") return Promise.resolve();
    try { return Promise.resolve(sdk.sendEvent(event)).catch(failure); }
    catch (error) { failure(error); return Promise.resolve(); }
  }
  function identify(email) {
    if (!ready || consent !== "accepted" || !email || email === identifiedEmail) return;
    identifiedEmail = email;
    window.SomaSitemap.identityEvents(email).forEach(send);
  }
  function consentValue(accepted) {
    return [{ purpose: "Tracking", provider: "SOMA Demo", status: accepted ? "Opt In" : "Opt Out" }];
  }
  // No sustituye ni suplanta window.SalesforceInteractions. No hace peticiones de red.
  // Ejecuta el MISMO sitemap para enseñar la instrumentación incluso con file://.
  function demoAdapter() {
    var sitemap, active, bindings = [];
    return {
      CatalogObjectInteractionName: { ViewCatalogObjectDetail: "View Catalog Object Detail" },
      CartInteractionName: { AddToCart: "Add To Cart" },
      init: function () { return Promise.resolve(); },
      updateConsents: function () {},
      resetAnonymousId: function () {},
      listener: function (type, selector, callback) { return { type: type, selector: selector, callback: callback }; },
      sendEvent: function (event) {
        if (consent !== "accepted") return Promise.resolve();
        var result = Object.assign({}, event, { source: { channel: "Web", locale: "es_ES", pageType: active.name } });
        sitemap.global.onActionEvent(result);
        return Promise.resolve();
      },
      initSitemap: function (map) {
        bindings.forEach(function (b) { document.removeEventListener(b.type, b.handler); }); bindings = [];
        sitemap = map;
        active = map.pageTypes.find(function (p) { return p.isMatch(); }) || map.pageTypeDefault;
        (map.global.listeners || []).concat(active.listeners || []).forEach(function (binding) {
          var handler = function (event) {
            if (consent === "accepted" && event.target instanceof Element && event.target.closest(binding.selector)) binding.callback(event);
          };
          document.addEventListener(binding.type, handler); bindings.push({ type: binding.type, handler: handler });
        });
        if (active.interaction) this.sendEvent({ interaction: active.interaction, pageView: true });
      }
    };
  }
  function loadSdk(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script"); script.src = url; script.async = true;
      var timer = setTimeout(function () { reject(new Error("tiempo de carga agotado; revisa URL, red y bloqueadores")); }, 12000);
      script.onload = function () {
        clearTimeout(timer);
        try {
          var instance = typeof window.getSalesforceInteractions === "function" ? window.getSalesforceInteractions() : window.SalesforceInteractions;
          if (!instance || typeof instance.init !== "function") throw new Error("la URL no expone Salesforce Interactions SDK");
          resolve(instance);
        } catch (error) { reject(error); }
      };
      script.onerror = function () { clearTimeout(timer); reject(new Error("no se ha podido cargar el CDN del conector")); };
      document.head.appendChild(script);
    });
  }
  function timeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("tiempo de inicialización del SDK agotado")); }, ms);
      Promise.resolve(promise).then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }
  async function start() {
    if (starting || ready || consent !== "accepted" || mode === "error") return;
    starting = true;
    var url = (config.salesforceSdkUrl || "").trim();
    var placeholder = !url || url === "PON_AQUI_LA_URL_DE_TU_CONECTOR_WEB_DE_DATA360";
    var localFile = location.protocol === "file:";
    try {
      if (placeholder || localFile) {
        mode = "demo";
        status = localFile ? "Simulación local · file:// · no se envían datos a Salesforce" : "Simulación local · configura la URL del conector para enviar a Data 360";
        sdk = demoAdapter();
      } else {
        var parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("usa la URL HTTPS pública del CDN del conector");
        if (config.sitemapOwner !== "local") throw new Error("este proyecto requiere sitemapOwner: local");
        mode = "live"; status = "Cargando el SDK de Salesforce…"; render();
        sdk = await loadSdk(parsed.href);
      }
      // Una revocación mientras carga el CDN debe prevalecer sobre el Opt In inicial.
      var initConfig = { consents: consentValue(consent === "accepted") };
      if (config.cookieDomain && !localFile) initConfig.cookieDomain = config.cookieDomain;
      await timeout(sdk.init(initConfig), 12000);
      sdk.updateConsents(consentValue(consent === "accepted"));
      ready = true;
      sdk.initSitemap(window.SomaSitemap.build(sdk, { send: send, observe: observe, identify: identify }));
      if (consent === "accepted") {
        if (mode === "live") status = "SDK inicializado · recepción en Data 360 pendiente de verificar";
        identify(shop.get("email", ""));
      } else status = "Medición desactivada · sin nuevos eventos";
      render();
    } catch (error) { failure(error); }
    finally { starting = false; }
  }
  async function choose(accepted) {
    consent = accepted ? "accepted" : "rejected";
    shop.set("consent", consent);
    entries = []; shop.set("events", entries);
    document.getElementById("consent-panel").hidden = true;
    if (!accepted) {
      status = "Medición desactivada · sin nuevos eventos";
      identifiedEmail = "";
      if (sdk && ready) { try { sdk.updateConsents(consentValue(false)); } catch (error) { failure(error); } }
      render(); return;
    }
    if (ready) {
      try {
        sdk.updateConsents(consentValue(true));
        status = mode === "demo" ? "Simulación local · no se envían datos a Salesforce" : "SDK inicializado · recepción en Data 360 pendiente de verificar";
        identify(shop.get("email", ""));
        // No reproducimos navegación anterior al consentimiento.
      } catch (error) { failure(error); }
    } else await start();
    render();
  }
  window.SomaTracking = {
    getState: function () { return { mode: mode, ready: ready, consent: consent, status: status, events: entries.slice() }; },
    resetIdentity: function () {
      identifiedEmail = "";
      entries = []; shop.set("events", entries);
      if (sdk && ready) {
        try {
          if (typeof sdk.resetAnonymousId !== "function") throw new Error("recarga en una nueva sesión para cambiar de usuario");
          sdk.resetAnonymousId();
        } catch (error) { failure(error); }
      }
      render();
    }
  };
  document.getElementById("open-inspector").addEventListener("click", function () { render(); document.getElementById("inspector").showModal(); });
  document.getElementById("clear-events").addEventListener("click", function () { entries = []; shop.set("events", entries); render(); });
  document.getElementById("open-consent").addEventListener("click", function () { document.getElementById("consent-panel").hidden = false; });
  document.getElementById("accept-tracking").addEventListener("click", function () { choose(true); });
  document.getElementById("reject-tracking").addEventListener("click", function () { choose(false); });
  document.getElementById("consent-panel").hidden = consent !== "pending";
  if (consent === "rejected") status = "Medición desactivada · sin nuevos eventos";
  render(); start();
}());
