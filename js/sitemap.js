/*
 * SOMA · Sitemap de Salesforce Data 360 (no Marketing Cloud Personalization).
 * El bootstrap de tracking.js llama a init() y después a initSitemap().
 * La misma configuración se ejecuta con un adaptador local cuando no hay CDN.
 * EJERCICIO: cambia los nombres de las acciones y añade campos al esquema JSON.
 * No subas este archivo al conector: en esta implementación el sitemap es local.
 */
(function () {
  "use strict";
  function activity(name, fields) {
    // «somaActivity» debe existir como developerName en el esquema del conector.
    return Object.assign({ name: name, eventType: "somaActivity" }, fields || {});
  }
  function catalog(product) {
    return {
      type: "Product", id: product.id,
      attributes: {
        name: product.name, sku: product.sku, price: product.price,
        currency: "EUR", category: product.category
      }
    };
  }
  function identityEvents(email) {
    // El SDK añade el MISMO deviceId a ambos eventos. No lo reemplaces por el email.
    // Data 360 enruta los perfiles a partir de user.attributes.eventType.
    return [
      { user: { attributes: { eventType: "identity", isAnonymous: 0, userName: email, email: email } } },
      { user: { attributes: { eventType: "contactPointEmail", email: email } } }
    ];
  }
  window.SomaSitemap = {
    activity: activity, catalog: catalog, identityEvents: identityEvents,
    build: function (sdk, bridge) {
      var product = window.SomaShop.currentProduct;
      return {
        global: {
          locale: "es_ES",
          onActionEvent: function (event) {
            // Este visor muestra el payload previo a la traducción del SDK.
            bridge.observe(event);
            return event;
          },
          listeners: [
            sdk.listener("click", "[data-track-login]", function () {
              bridge.send({ interaction: activity("Open Login") });
            }),
            sdk.listener("click", "[data-track-hero]", function () {
              bridge.send({ interaction: activity("Discover Collection") });
            }),
            sdk.listener("click", "[data-filter]", function (event) {
              var target = event.target.closest("[data-filter]");
              if (target) bridge.send({ interaction: activity("Filter Products", { categoryName: target.dataset.filter }) });
            })
          ]
        },
        pageTypes: [
          {
            name: "home", isMatch: function () { return document.body.dataset.page === "home"; },
            interaction: activity("View Home"),
            listeners: [sdk.listener("click", "[data-product-link]", function (event) {
              var link = event.target.closest("[data-product-link]");
              if (link) bridge.send({ interaction: activity("Select Product", { productId: link.dataset.productLink }) });
            })]
          },
          {
            name: "product", isMatch: function () { return document.body.dataset.page === "product" && !!product; },
            interaction: product ? {
              name: sdk.CatalogObjectInteractionName.ViewCatalogObjectDetail,
              catalogObject: catalog(product)
            } : undefined,
            listeners: [
              sdk.listener("click", "[data-gallery-step], [data-gallery-index]", function () {
                bridge.send({ interaction: activity("View Product Image", {
                  productId: product.id, imageIndex: window.SomaShop.galleryIndex + 1
                }) });
              }),
              sdk.listener("click", "#add-to-bag", function () {
                bridge.send({ interaction: {
                  name: sdk.CartInteractionName.AddToCart,
                  lineItem: { catalogObjectType: "Product", catalogObjectId: product.id,
                    price: product.price, quantity: window.SomaShop.quantity, currency: "EUR" }
                } });
              })
            ]
          },
          {
            name: "login", isMatch: function () { return document.body.dataset.page === "login"; },
            interaction: activity("View Login"),
            listeners: [sdk.listener("submit", "#login-form", function () {
              var form = document.getElementById("login-form");
              if (!form.checkValidity()) return;
              // Solo leemos email. Nunca contraseña, FormData ni el formulario completo.
              var email = document.getElementById("email").value.trim().toLowerCase();
              bridge.identify(email);
              bridge.send({ interaction: activity("Login") });
            })]
          }
        ],
        pageTypeDefault: { name: "notFound" }
      };
    }
  };
}());
