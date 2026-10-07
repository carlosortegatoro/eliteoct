/* Pruebas de la tienda y del tag CDN. No ejecutan el SDK ni hacen peticiones. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const key = 'soma.demo.v1';
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const schema = JSON.parse(read('salesforce/web-connector-schema.json'));

async function site(file = 'index.html', options = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', e => { if (!e.message.includes('navigation')) errors.push(e); });
  const dom = new JSDOM(read(file.split('?')[0]), {
    url: (options.base || 'https://alumno.github.io/tienda/') + file,
    runScripts: 'outside-only', virtualConsole: console,
    beforeParse(window) {
      window.name = options.windowName || '';
      window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      window.HTMLDialogElement.prototype.close = function () { this.open = false; };
    }
  });
  const { window } = dom;
  if (options.session) window.sessionStorage.setItem(key, JSON.stringify(options.session));
  // No se descargan ni ejecutan recursos externos en estas pruebas.
  // La UI debe funcionar aunque el CDN no esté disponible.
  Object.defineProperty(window, 'SalesforceInteractions', {
    get() { throw new Error('La tienda no debe inicializar ni llamar al SDK'); }
  });
  Object.defineProperty(window, 'getSalesforceInteractions', {
    get() { throw new Error('La tienda no debe inicializar ni llamar al SDK'); }
  });
  for (const file of ['js/products.js','js/app.js']) window.eval(read(file));
  await tick();
  return {
    window, document: window.document, errors,
    click: async selector => { const el = window.document.querySelector(selector); assert.ok(el, selector); el.click(); await tick(); },
    session: () => JSON.parse(window.sessionStorage.getItem(key)),
    close: () => dom.window.close()
  };
}

test('Home: catálogo y filtros funcionan sin el SDK remoto', async () => {
  const s = await site();
  assert.equal(s.document.querySelectorAll('.product-card').length, 6);
  await s.click('[data-filter="Textil"]');
  assert.equal(s.document.querySelectorAll('.product-card').length, 1);
  await s.click('[data-filter="Todos"]');
  assert.equal(s.document.querySelectorAll('.product-card').length, 6);
  assert.equal(s.document.querySelector('#inspector'), null);
  assert.equal(s.document.querySelector('#open-consent'), null);
  assert.equal(s.errors.length, 0); s.close();
});

test('Los seis productos conservan datos, imágenes, carrusel y bolsa', async () => {
  const home = await site();
  const products = JSON.parse(JSON.stringify(home.window.SOMA_PRODUCTS)); home.close();
  assert.equal(new Set(products.flatMap(p => p.images)).size, 18);
  for (const p of products) {
    const s = await site('producto.html?id=' + p.id);
    assert.equal(s.document.querySelector('h1').textContent, p.name);
    assert.equal(s.document.querySelectorAll('.gallery-thumb').length, 3);
    p.images.forEach(src => {
      assert.ok(fs.existsSync(path.join(root, src)), src);
      const xml = new s.window.DOMParser().parseFromString(read(src), 'image/svg+xml');
      assert.equal(xml.querySelector('parsererror'), null);
    });
    assert.equal(s.window.SomaShop.currentProduct.sku, p.sku);
    assert.equal(s.window.SomaShop.currentProduct.price, p.price);
    await s.click('[data-gallery-step="-1"]');
    assert.equal(s.window.SomaShop.galleryIndex, 2);
    await s.click('[data-gallery-step="1"]');
    assert.equal(s.window.SomaShop.galleryIndex, 0);
    await s.click('[data-gallery-index="1"]');
    assert.ok(s.document.querySelector('#gallery-image').src.endsWith(p.images[1]));
    await s.click('#quantity-plus');
    await s.click('#add-to-bag');
    assert.equal(s.session().bag[p.id], 2);
    assert.equal(s.document.querySelector('#bag-count').textContent, '2');
    assert.equal(s.errors.length, 0); s.close();
  }
});

test('Login: conserva email y retorno sin almacenar la contraseña ni llamar al SDK', async () => {
  const s = await site('login.html?product=lampara-duna');
  s.document.querySelector('#email').value = 'ALUMNO@example.com';
  s.document.querySelector('#password').value = 'NO_DEBE_SALIR_esta_clave';
  s.document.querySelector('#login-form').dispatchEvent(new s.window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(s.document.querySelector('#login-success').hidden, false);
  assert.equal(s.document.querySelector('#password').value, '');
  assert.equal(s.session().email, 'alumno@example.com');
  assert.ok(s.document.querySelector('#login-continue').href.endsWith('producto.html?id=lampara-duna'));
  assert.equal(s.window.SomaShop.get('email', ''), 'alumno@example.com');
  assert.ok(!JSON.stringify(s.session()).includes('NO_DEBE_SALIR'));
  const next = await site('producto.html?id=lampara-duna', { session: s.session() });
  assert.equal(next.document.querySelector('.account-label').textContent, 'Hola, alumno');
  await s.click('#change-user'); assert.equal(s.session().email, '');
  assert.equal(s.document.querySelector('#login-fields').hidden, false);
  assert.equal(s.errors.length, 0); s.close(); next.close();
});

test('Archivo local: la tienda conserva la sesión aunque el SDK no se cargue', async () => {
  const base = 'file:///demo/';
  const s = await site('login.html', { base });
  s.document.querySelector('#email').value = 'local@example.com';
  s.document.querySelector('#login-form').dispatchEvent(new s.window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  const next = await site('index.html', { base, windowName: s.window.name });
  assert.equal(next.document.querySelector('.account-label').textContent, 'Hola, local');
  assert.equal(next.window.SomaShop.get('email', ''), 'local@example.com');
  s.close(); next.close();
});

test('IDs desconocidos o HTML en la URL: estado no encontrado y ninguna inyección', async () => {
  const s = await site('producto.html?id=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  assert.ok(s.document.querySelector('.error-panel'));
  assert.equal(s.document.querySelector('#add-to-bag'), null);
  const login = await site('login.html?product=https://evil.example');
  assert.ok(login.document.querySelector('#login-continue').href.endsWith('/index.html#coleccion'));
  s.close(); login.close();
});

test('Esquema: claves, campos obligatorios, PK y campos traducidos presentes', () => {
  assert.equal(new Set(schema.records.map(r => r.developerName)).size, 7);
  for (const r of schema.records) {
    const fields = new Map(r.externalDataTranFields.map(f => [f.developerName, f]));
    assert.equal(fields.size, r.externalDataTranFields.length);
    for (const key of ['deviceId','eventId','dateTime','eventType','category','sessionId']) assert.equal(fields.get(key).isDataRequired, true);
    assert.equal(fields.get(r.category === 'Profile' ? 'deviceId' : 'eventId').primaryIndexOrder, 1);
    for (const f of fields.values()) assert.match(f.developerName, /^[a-z][a-zA-Z0-9]*$/);
  }
  const catalog = schema.records.find(r => r.developerName === 'catalog').externalDataTranFields;
  for (const name of ['attributeName','attributeSku','attributePrice','attributeCurrency','attributeCategory']) assert.ok(catalog.some(f => f.developerName === name));
});

test('Cada cabecera carga exactamente el tag solicitado y conserva los recursos locales', () => {
  for (const file of ['index.html', 'producto.html', 'login.html']) {
    const dom = new JSDOM(read(file));
    const cdn = 'https://cdn.c360a.salesforce.com/beacon/c360a/72b03f61-f57d-4065-a05d-7b9ab4a6d8ff/scripts/c360a.min.js';
    const external = [...dom.window.document.querySelectorAll('script[src]')].filter(el => el.src.startsWith('https:'));
    assert.equal(external.length, 1);
    assert.equal(external[0].outerHTML, '<script src="' + cdn + '"></script>');
    assert.equal(external[0].parentElement.tagName, 'HEAD');
    assert.equal(dom.window.document.querySelectorAll('script[src]').length, 3);
    for (const el of dom.window.document.querySelectorAll('script[src], link[href], img[src]')) {
      const resource = el.getAttribute('src') || el.getAttribute('href');
      if (resource === cdn) continue;
      assert.ok(!/^(https?:|\/)/.test(resource), resource);
      assert.ok(fs.existsSync(path.join(root, resource)), resource);
      assert.notEqual(el.getAttribute('type'), 'module');
    }
    dom.window.close();
  }
});

test('No queda instrumentación ni configuración local del SDK', () => {
  for (const file of ['config.js', 'sitemap.js', 'tracking.js']) {
    assert.equal(fs.existsSync(path.join(root, 'js', file)), false);
  }
  for (const file of fs.readdirSync(path.join(root, 'js'))) {
    assert.doesNotMatch(read('js/' + file), /SalesforceInteractions|SomaSitemap|SomaTracking|initSitemap|sendEvent/);
  }
});

test('El submit sigue siendo observable desde el sitemap inyectado', async () => {
  const s = await site('login.html');
  let captured;
  s.document.addEventListener('submit', event => {
    if (event.target.id === 'login-form') captured = s.window.SomaShop.get('email', '');
  });
  s.document.querySelector('#email').value = 'hosted@example.com';
  s.document.querySelector('#login-form').dispatchEvent(new s.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(captured, 'hosted@example.com');
  assert.equal(s.document.querySelector('#email').value, 'hosted@example.com');
  assert.equal(s.errors.length, 0); s.close();
});
