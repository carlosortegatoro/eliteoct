/* Pruebas de DOM y contrato del SDK. No necesitan servidor ni hacen peticiones. */
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
  const requests = [];
  const append = window.document.head.appendChild.bind(window.document.head);
  window.document.head.appendChild = function (element) {
    if (element.tagName === 'SCRIPT' && element.src) {
      requests.push(element.src);
      if (options.sdk) {
        window.SalesforceInteractions = options.sdk(window);
        queueMicrotask(() => element.onload());
      } else queueMicrotask(() => element.onerror());
      return element;
    }
    return append(element);
  };
  for (const file of ['js/config.js','js/products.js','js/app.js','js/sitemap.js','js/tracking.js']) {
    if (file === 'js/tracking.js' && options.sdkUrl) {
      window.SOMA_CONFIG = Object.assign({}, window.SOMA_CONFIG, { salesforceSdkUrl: options.sdkUrl });
    }
    window.eval(read(file));
  }
  await tick();
  return {
    window, document: window.document, requests, errors,
    click: async selector => { const el = window.document.querySelector(selector); assert.ok(el, selector); el.click(); await tick(); },
    state: () => window.SomaTracking.getState(),
    session: () => JSON.parse(window.sessionStorage.getItem(key)),
    close: () => dom.window.close()
  };
}

function fakeSdk(log, options = {}) {
  return window => {
    let map, page;
    const sdk = {
      CatalogObjectInteractionName: { ViewCatalogObjectDetail: 'View Catalog Object Detail' },
      CartInteractionName: { AddToCart: 'Add To Cart' },
      init: async settings => { log.push(['init', settings]); if (options.wait) await options.wait; },
      updateConsents: values => log.push(['consent', values]),
      resetAnonymousId: () => log.push(['reset']),
      listener: (type, selector, callback) => ({ type, selector, callback }),
      initSitemap: config => {
        log.push(['sitemap']); map = config;
        page = config.pageTypes.find(p => p.isMatch()) || config.pageTypeDefault;
        [...config.global.listeners, ...(page.listeners || [])].forEach(b => {
          window.document.addEventListener(b.type, event => { if (event.target.closest(b.selector)) b.callback(event); });
        });
        if (page.interaction) sdk.sendEvent({ interaction: page.interaction, pageView: true });
      },
      sendEvent: event => {
        log.push(['send', JSON.parse(JSON.stringify(event))]);
        if (map) map.global.onActionEvent(event);
        return Promise.resolve();
      }
    };
    return sdk;
  };
}

test('Home: seis productos, filtros y cero peticiones/eventos antes de consentir', async () => {
  const s = await site();
  assert.equal(s.document.querySelectorAll('.product-card').length, 6);
  assert.equal(s.state().events.length, 0);
  assert.equal(s.requests.length, 0);
  await s.click('[data-filter="Textil"]');
  assert.equal(s.document.querySelectorAll('.product-card').length, 1);
  assert.equal(s.state().events.length, 0);
  await s.click('#reject-tracking');
  assert.equal(s.state().consent, 'rejected');
  await s.click('#open-consent');
  await s.click('#accept-tracking');
  assert.equal(s.state().mode, 'demo');
  assert.deepEqual(Array.from(s.state().events, e => e.payload.interaction.name), ['View Home']);
  await s.click('[data-filter="Todos"]');
  assert.equal(s.document.querySelectorAll('.product-card').length, 6);
  assert.equal(s.state().events.at(-1).payload.interaction.categoryName, 'Todos');
  assert.equal(s.errors.length, 0); s.close();
});

test('Los seis productos tienen tres recursos locales, carrusel circular y payload de catálogo', async () => {
  const home = await site();
  const products = JSON.parse(JSON.stringify(home.window.SOMA_PRODUCTS)); home.close();
  assert.equal(new Set(products.flatMap(p => p.images)).size, 18);
  for (const p of products) {
    const s = await site('producto.html?id=' + p.id, { session: { consent: 'accepted' } });
    assert.equal(s.document.querySelector('h1').textContent, p.name);
    assert.equal(s.document.querySelectorAll('.gallery-thumb').length, 3);
    p.images.forEach(src => {
      assert.ok(fs.existsSync(path.join(root, src)), src);
      const xml = new s.window.DOMParser().parseFromString(read(src), 'image/svg+xml');
      assert.equal(xml.querySelector('parsererror'), null);
    });
    const catalog = s.state().events[0].payload.interaction;
    assert.equal(catalog.name, 'View Catalog Object Detail');
    assert.equal(catalog.catalogObject.attributes.sku, p.sku);
    assert.equal(catalog.catalogObject.attributes.price, p.price);
    await s.click('[data-gallery-step="-1"]');
    assert.equal(s.window.SomaShop.galleryIndex, 2);
    assert.equal(s.state().events.at(-1).payload.interaction.imageIndex, 3);
    await s.click('[data-gallery-step="1"]');
    assert.equal(s.window.SomaShop.galleryIndex, 0);
    await s.click('[data-gallery-index="1"]');
    assert.ok(s.document.querySelector('#gallery-image').src.endsWith(p.images[1]));
    await s.click('#quantity-plus');
    await s.click('#add-to-bag');
    const item = s.state().events.at(-1).payload.interaction.lineItem;
    assert.equal(item.catalogObjectId, p.id); assert.equal(item.quantity, 2);
    assert.equal(s.document.querySelector('#bag-count').textContent, '2');
    assert.equal(s.errors.length, 0); s.close();
  }
});

test('Login: identifica por email, no captura la contraseña y conserva el producto de retorno', async () => {
  const s = await site('login.html?product=lampara-duna', { session: { consent: 'accepted' } });
  s.document.querySelector('#email').value = 'ALUMNO@example.com';
  s.document.querySelector('#password').value = 'NO_DEBE_SALIR_esta_clave';
  s.document.querySelector('#login-form').dispatchEvent(new s.window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(s.document.querySelector('#login-success').hidden, false);
  assert.equal(s.document.querySelector('#password').value, '');
  assert.equal(s.session().email, 'alumno@example.com');
  assert.ok(s.document.querySelector('#login-continue').href.endsWith('producto.html?id=lampara-duna'));
  const profiles = s.state().events.filter(e => e.payload.user).map(e => e.payload.user.attributes);
  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].eventType, 'identity'); assert.equal(profiles[0].isAnonymous, 0);
  assert.equal(profiles[1].eventType, 'contactPointEmail'); assert.equal(profiles[1].email, 'alumno@example.com');
  assert.equal(s.state().events.at(-1).payload.interaction.name, 'Login');
  assert.ok(!JSON.stringify(s.session()).includes('NO_DEBE_SALIR'));
  assert.ok(!JSON.stringify(s.state().events).includes('password'));
  const next = await site('producto.html?id=lampara-duna', { session: s.session() });
  assert.equal(next.document.querySelector('.account-label').textContent, 'Hola, alumno');
  await s.click('#change-user'); assert.equal(s.session().email, '');
  assert.equal(s.document.querySelector('#login-fields').hidden, false);
  assert.equal(s.state().events.length, 0);
  assert.equal(s.errors.length, 0); s.close(); next.close();
});

test('Login antes de consentir: sin eventos; el perfil se prepara al aceptar', async () => {
  const s = await site('login.html');
  s.document.querySelector('#email').value = 'antes@example.com';
  s.document.querySelector('#login-form').dispatchEvent(new s.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(s.state().events.length, 0);
  await s.click('#accept-tracking');
  assert.equal(s.state().events.filter(e => e.payload.user).length, 2);
  await s.click('#open-consent'); await s.click('#reject-tracking');
  assert.equal(s.state().events.length, 0);
  await s.click('[data-track-login]');
  assert.equal(s.state().events.length, 0); s.close();
});

test('Archivo local: utiliza el mismo sitemap sin red y transporta la sesión en la pestaña', async () => {
  const base = 'file:///demo/';
  const s = await site('login.html', { base, sdkUrl: 'https://cdn.example.com/sdk.js' });
  await s.click('#accept-tracking');
  s.document.querySelector('#email').value = 'local@example.com';
  s.document.querySelector('#login-form').dispatchEvent(new s.window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(s.requests.length, 0);
  assert.equal(s.state().mode, 'demo');
  const next = await site('index.html', { base, windowName: s.window.name });
  assert.equal(next.document.querySelector('.account-label').textContent, 'Hola, local');
  assert.equal(next.state().consent, 'accepted');
  assert.ok(next.state().events.some(e => e.payload.user?.attributes.email === 'local@example.com'));
  s.close(); next.close();
});

test('IDs desconocidos o HTML en la URL: estado no encontrado y ninguna inyección', async () => {
  const s = await site('producto.html?id=%3Cscript%3Ealert(1)%3C%2Fscript%3E', { session: { consent: 'accepted' } });
  assert.ok(s.document.querySelector('.error-panel'));
  assert.equal(s.document.querySelector('#add-to-bag'), null);
  assert.equal(s.state().events.length, 0);
  const login = await site('login.html?product=https://evil.example');
  assert.ok(login.document.querySelector('#login-continue').href.endsWith('/index.html#coleccion'));
  s.close(); login.close();
});

test('SDK real simulado: URL configurada, init antes de initSitemap, un solo arranque', async () => {
  const log = [];
  const s = await site('index.html', { sdkUrl: 'https://cdn.example.com/sdk.js', sdk: fakeSdk(log) });
  assert.equal(log.length, 0); assert.equal(s.requests.length, 0);
  await s.click('#accept-tracking');
  assert.equal(s.state().mode, 'live'); assert.equal(s.requests.length, 1);
  assert.equal(log.filter(x => x[0] === 'init').length, 1);
  assert.equal(log.filter(x => x[0] === 'sitemap').length, 1);
  assert.ok(log.findIndex(x => x[0] === 'init') < log.findIndex(x => x[0] === 'sitemap'));
  assert.equal(log[0][1].consents[0].status, 'Opt In');
  assert.equal(s.state().events.filter(e => e.payload.interaction?.name === 'View Home').length, 1);
  await s.click('#open-consent'); await s.click('#reject-tracking');
  assert.equal(log.at(-1)[1][0].status, 'Opt Out');
  const before = log.filter(e => e[0] === 'send').length;
  await s.click('[data-filter="Textil"]');
  assert.equal(log.filter(e => e[0] === 'send').length, before);
  await s.click('#open-consent'); await s.click('#accept-tracking');
  assert.equal(log.filter(x => x[0] === 'init').length, 1);
  s.close();
});

test('Revocar durante la inicialización respeta Opt Out', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const log = [];
  const s = await site('login.html', { sdkUrl: 'https://cdn.example.com/sdk.js', sdk: fakeSdk(log, { wait }) });
  await s.click('#accept-tracking');
  await s.click('#open-consent'); await s.click('#reject-tracking');
  release(); await tick();
  assert.equal(s.state().consent, 'rejected');
  assert.equal(s.state().events.length, 0);
  assert.equal(log.filter(x => x[0] === 'consent').at(-1)[1][0].status, 'Opt Out');
  s.close();
});

test('Un CDN roto o una URL insegura da un error explícito, nunca un falso éxito', async () => {
  for (const sdkUrl of ['https://cdn.example.com/broken.js', 'javascript:alert(1)']) {
    const s = await site('index.html', { sdkUrl, session: { consent: 'accepted' } });
    assert.equal(s.state().mode, 'error'); assert.equal(s.state().ready, false);
    assert.equal(s.state().events.length, 0); assert.match(s.state().status, /Error/); s.close();
  }
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

test('Todos los HTML usan recursos relativos existentes y scripts clásicos', () => {
  for (const file of ['index.html', 'producto.html', 'login.html']) {
    const dom = new JSDOM(read(file));
    for (const el of dom.window.document.querySelectorAll('script[src], link[href], img[src]')) {
      const resource = el.getAttribute('src') || el.getAttribute('href');
      assert.ok(!/^(https?:|\/)/.test(resource), resource);
      assert.ok(fs.existsSync(path.join(root, resource)), resource);
      assert.notEqual(el.getAttribute('type'), 'module');
    }
    dom.window.close();
  }
});
