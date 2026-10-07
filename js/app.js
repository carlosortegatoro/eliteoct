(function () {
  "use strict";
  var products = window.SOMA_PRODUCTS;
  var key = "soma.demo.v1";
  var memory = {};
  try {
    var raw = location.protocol === "file:" && window.name.indexOf(key + ":") === 0
      ? window.name.slice(key.length + 1) : sessionStorage.getItem(key);
    memory = JSON.parse(raw || "{}");
    if (!memory || typeof memory !== "object" || Array.isArray(memory)) memory = {};
  } catch (_) { memory = {}; }
  function save() {
    try { sessionStorage.setItem(key, JSON.stringify(memory)); } catch (_) { /* Modo privado: solo memoria. */ }
    // file:// no garantiza almacenamiento compartido entre documentos.
    // window.name conserva esta demo en la MISMA pestaña, sin PII en las URLs.
    if (location.protocol === "file:") window.name = key + ":" + JSON.stringify(memory);
  }
  function get(name, fallback) { return memory[name] === undefined ? fallback : memory[name]; }
  function set(name, value) { memory[name] = value; save(); }
  function escape(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; });
  }
  var icons = {
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    bag: '<path d="M5 7h14l1 14H4zM9 8V6a3 3 0 0 1 6 0v2"/>',
    truck: '<path d="M2 5h12v12H2zM14 10h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    return: '<path d="M5 7a8 8 0 1 1-1 9M5 2v5h5"/>',
    leaf: '<path d="M20 3C6 2 1 11 6 17s15-1 14-14ZM5 20l10-11"/>'
  };
  function icon(name) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>'; }
  var page = document.body.dataset.page;
  var params = new URLSearchParams(location.search);
  var current = products.find(function (p) { return p.id === params.get("id"); });
  var returnTo = current ? "producto.html?id=" + encodeURIComponent(current.id) : "index.html#coleccion";
  var requestedProduct = products.find(function (p) { return p.id === params.get("product"); });
  var loginDestination = requestedProduct ? "producto.html?id=" + encodeURIComponent(requestedProduct.id) : "index.html#coleccion";
  window.SomaShop = { get: get, set: set, escape: escape, currentProduct: current,
    galleryIndex: 0, quantity: 1, products: products };
  var shop = window.SomaShop;
  var loginHref = "login.html" + (current ? "?product=" + encodeURIComponent(current.id) : "");
  document.getElementById("site-header").innerHTML = '<div class="announcement">UN POCO MÁS DE CALMA, UN POCO MÁS DE CASA.</div><header class="header"><div class="wrap header-inner"><a class="brand" href="index.html" aria-label="SOMA Casa, inicio">soma<span>CASA & OBJETOS</span></a><nav class="navigation" aria-label="Navegación principal"><a href="index.html"' + (page === "home" ? ' aria-current="page"' : '') + '>Inicio</a><a href="index.html#coleccion">La colección</a><a href="index.html#filosofia">Nuestra esencia</a></nav><div class="header-actions"><a class="account-link" href="' + loginHref + '" data-track-login>' + icon("user") + '<span class="account-label">Mi espacio</span></a><button class="bag-button" id="open-bag" aria-label="Abrir bolsa de demostración">' + icon("bag") + '<span id="bag-count">0</span></button></div></div></header>';
  document.getElementById("site-footer").innerHTML = '<footer class="footer"><div class="wrap"><div class="footer-top"><a class="brand footer-brand" href="index.html" aria-label="SOMA Casa, inicio">soma.</a><p>Habitar lo sencillo.<br>Diseño que se siente como casa.</p></div><div class="footer-bottom"><span>© 2026 SOMA Casa · Tienda ficticia con fines educativos.</span></div></div></footer>';
  document.body.insertAdjacentHTML("beforeend", '<div id="toast" class="toast" role="status" hidden></div><dialog id="bag-dialog" class="dialog" aria-labelledby="bag-title"><div class="dialog-header"><h2 id="bag-title">Tu bolsa</h2><button class="dialog-close" data-close-dialog aria-label="Cerrar bolsa">×</button></div><div id="bag-content"></div><p class="demo-note">Esta bolsa es una demostración. No se realizan pedidos ni cobros.</p></dialog>');
  function price(amount) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount); }
  function card(p) {
    return '<article class="product-card"><a href="producto.html?id=' + p.id + '" data-product-link="' + p.id + '"><div class="product-image"><img src="' + p.images[0] + '" alt="' + p.name + ', ' + p.color.toLowerCase() + '" width="600" height="560" loading="lazy">' + (p.tag ? '<span class="product-tag">' + p.tag + '</span>' : '') + '</div><div class="product-info"><div><h3>' + p.name + '</h3><p>' + p.type + '</p></div><span class="product-price">' + price(p.price) + '</span></div><span class="swatch" style="background:' + ({"sillon-alba":"#c7b897","lampara-duna":"#b46e50","jarron-tierra":"#a5573e","mesa-noma":"#b18752","cojin-brisa":"#747959","espejo-arco":"#c3a278"}[p.id]) + '" aria-hidden="true"></span></a></article>';
  }
  if (page === "home") {
    document.getElementById("product-grid").innerHTML = products.map(card).join("");
    document.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll("[data-filter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === button)); });
        var visible = products.filter(function (p) { return button.dataset.filter === "Todos" || p.category === button.dataset.filter; });
        document.getElementById("product-grid").innerHTML = visible.map(card).join("");
        document.getElementById("product-count").textContent = visible.length + (visible.length === 1 ? " producto" : " productos");
      });
    });
  }
  if (page === "product") {
    if (!current) {
      document.getElementById("product-content").innerHTML = '<section class="error-panel"><p class="eyebrow">No encontramos esta pieza</p><h1>Hay más por descubrir.</h1><p>El producto solicitado no está en nuestra colección.</p><a class="button" href="index.html#coleccion">Volver a la colección ↗</a></section>';
      document.title = "Producto no encontrado · SOMA Casa";
    } else {
      var p = current;
      document.title = p.name + " · SOMA Casa";
      document.getElementById("product-content").innerHTML = '<nav class="breadcrumb" aria-label="Ruta de navegación"><a href="index.html">Inicio</a><span>/</span><a href="index.html#coleccion">La colección</a><span>/</span><span aria-current="page">' + p.name + '</span></nav><div class="product-layout"><section class="gallery" aria-label="Imágenes de ' + p.name + '"><div class="gallery-frame"><img id="gallery-image" src="' + p.images[0] + '" alt="' + p.name + ': vista general" width="600" height="560"><button class="gallery-arrow prev" data-gallery-step="-1" aria-label="Imagen anterior">←</button><button class="gallery-arrow next" data-gallery-step="1" aria-label="Imagen siguiente">→</button><span class="gallery-caption" id="gallery-caption" aria-live="polite">01 / 03 · Vista general</span></div><div class="gallery-thumbs">' + p.images.map(function (src, i) { return '<button class="gallery-thumb" data-gallery-index="' + i + '" aria-label="Ver imagen ' + (i + 1) + ' de ' + p.name + '" aria-pressed="' + (i === 0) + '"><img src="' + src + '" alt="" width="600" height="560"></button>'; }).join("") + '</div></section><section class="product-detail" aria-labelledby="product-title"><p class="eyebrow">La colección / ' + p.category + '</p><h1 id="product-title">' + p.name + '</h1><p class="product-subtitle">' + p.type + '</p><div class="detail-price">' + price(p.price) + '</div><p class="tax-note">IVA incluido · Envío gratis desde 100 €</p><p class="description">' + p.description + '</p><div class="color-info"><span class="swatch" aria-hidden="true"></span>Color: ' + p.color + '</div><p class="stock">En stock · ' + p.stock + ' unidades disponibles</p><div class="purchase-row"><div class="quantity" aria-label="Cantidad"><button id="quantity-minus" aria-label="Reducir cantidad" disabled>−</button><output id="quantity-value" aria-live="polite">1</output><button id="quantity-plus" aria-label="Aumentar cantidad">+</button></div><button class="button" id="add-to-bag">Añadir a la bolsa ' + icon("bag") + '</button></div><p class="purchase-note">Compra simulada · No se realiza ningún cobro.</p><div class="detail-services"><span>' + icon("truck") + 'Entrega en 3–5 días</span><span>' + icon("return") + 'Devoluciones en 30 días</span></div><details open><summary>Los detalles que importan</summary><dl><dt>SKU</dt><dd>' + p.sku + '</dd><dt>Material</dt><dd>' + p.material + '</dd><dt>Dimensiones</dt><dd>' + p.size + '</dd><dt>Peso</dt><dd>' + p.weight + '</dd><dt>Colección</dt><dd>La calma de casa · 01</dd></dl></details><details><summary>Cuida de tu pieza</summary><p>' + p.care + '</p></details><details><summary>Envíos y devoluciones</summary><p>En esta tienda ficticia, el envío cuesta 4,90 € y es gratis desde 100 €. Plazo orientativo: 3–5 días laborables en la península. Devoluciones dentro de 30 días. No se gestionan envíos reales.</p></details></section></div>';
      document.querySelectorAll("[data-gallery-step], [data-gallery-index]").forEach(function (button) {
        button.addEventListener("click", function () {
          shop.galleryIndex = button.hasAttribute("data-gallery-index") ? Number(button.dataset.galleryIndex) : (shop.galleryIndex + Number(button.dataset.galleryStep) + 3) % 3;
          var labels = ["Vista general", "En ambiente", "Detalle de la pieza"];
          document.getElementById("gallery-image").src = p.images[shop.galleryIndex];
          document.getElementById("gallery-image").alt = p.name + ": " + labels[shop.galleryIndex].toLowerCase();
          document.getElementById("gallery-caption").textContent = "0" + (shop.galleryIndex + 1) + " / 03 · " + labels[shop.galleryIndex];
          document.querySelectorAll("[data-gallery-index]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.dataset.galleryIndex) === shop.galleryIndex)); });
        });
      });
      function quantity(delta) {
        shop.quantity = Math.max(1, Math.min(p.stock, shop.quantity + delta));
        document.getElementById("quantity-value").textContent = shop.quantity;
        document.getElementById("quantity-minus").disabled = shop.quantity === 1;
        document.getElementById("quantity-plus").disabled = shop.quantity === p.stock;
      }
      document.getElementById("quantity-minus").addEventListener("click", function () { quantity(-1); });
      document.getElementById("quantity-plus").addEventListener("click", function () { quantity(1); });
      document.getElementById("add-to-bag").addEventListener("click", function () {
        var bag = get("bag", {});
        bag[p.id] = (bag[p.id] || 0) + shop.quantity;
        set("bag", bag); updateBag(); toast(p.name + " añadido a tu bolsa de demostración");
      });
    }
  }
  function updateAccount() {
    var email = get("email", "");
    document.querySelector(".account-label").textContent = email ? "Hola, " + email.split("@")[0] : "Mi espacio";
  }
  if (page === "login") {
    document.getElementById("login-back").href = loginDestination;
    document.getElementById("login-continue").href = loginDestination;
    function showSuccess() {
      document.getElementById("success-email").textContent = get("email", "");
      document.getElementById("login-fields").hidden = true;
      document.getElementById("login-success").hidden = false;
    }
    if (get("email", "")) showSuccess();
    document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!event.currentTarget.checkValidity()) return;
      set("email", document.getElementById("email").value.trim().toLowerCase());
      document.getElementById("password").value = "";
      updateAccount(); showSuccess(); document.getElementById("login-success").focus();
    });
    document.getElementById("toggle-password").addEventListener("click", function () {
      var input = document.getElementById("password");
      input.type = input.type === "password" ? "text" : "password";
      this.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
      this.setAttribute("aria-pressed", String(input.type === "text"));
    });
    document.getElementById("change-user").addEventListener("click", function () {
      set("email", "");
      document.getElementById("login-form").reset();
      document.getElementById("login-fields").hidden = false;
      document.getElementById("login-success").hidden = true;
      updateAccount(); document.getElementById("email").focus();
    });
  }
  function updateBag() {
    var bag = get("bag", {}), count = 0, total = 0;
    var items = products.filter(function (p) { return Number(bag[p.id]) > 0; });
    var html = items.map(function (p) {
      var q = Math.max(0, Math.floor(Number(bag[p.id]) || 0)); count += q; total += q * p.price;
      return '<li><span>' + p.name + ' × ' + q + '</span><span>' + price(q * p.price) + '</span></li>';
    }).join("");
    document.getElementById("bag-count").textContent = count;
    document.getElementById("bag-content").innerHTML = items.length ? '<ul class="bag-list">' + html + '</ul><p class="bag-total">Total: ' + price(total) + '</p>' : '<p class="empty-state">Tu bolsa está esperando sus primeras piezas.</p>';
  }
  var toastTimer;
  function toast(message) {
    var el = document.getElementById("toast"); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 3000);
  }
  document.getElementById("open-bag").addEventListener("click", function () { updateBag(); document.getElementById("bag-dialog").showModal(); });
  document.querySelectorAll("[data-close-dialog]").forEach(function (b) { b.addEventListener("click", function () { b.closest("dialog").close(); }); });
  document.querySelectorAll("[data-icon]").forEach(function (el) { el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon)); });
  updateAccount(); updateBag();
}());
