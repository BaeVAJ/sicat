import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Base from './baseline/facturas.jsx';
import Next from '../src/components/Facturas/facturas.jsx';
import { DB } from './mocks/client.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const initialDb = JSON.stringify(DB);

const all = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const byText = (sel, text, { exact = false, scope = document, nth = 0 } = {}) => {
  const list = all(sel, scope).filter((el) => {
    const t = el.textContent.replace(/\s+/g, ' ').trim();
    return exact ? t === text : t.startsWith(text);
  });
  return list[nth];
};
const click = async (el, label) => {
  if (!el) throw new Error(`No se encontro: ${label}`);
  el.click();
  await sleep(90);
};
const setValue = async (el, value, label) => {
  if (!el) throw new Error(`No se encontro: ${label}`);
  const isSelect = el instanceof HTMLSelectElement;
  const proto = isSelect ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(isSelect ? 'change' : 'input', { bubbles: true }));
  await sleep(90);
};
const groupInput = (labelText) =>
  all('.facturas-form-group').find((g) => g.querySelector('label')?.textContent.trim().startsWith(labelText))
    ?.querySelector('input, select');

const steps = [
  ['01 inicial', async () => {}],
  ['02 kpi saldo pendiente', () => click(byText('button.facturas-kpi-card', 'Saldo Pendiente PPD'), 'kpi saldo')],
  ['03 kpi total', () => click(byText('button.facturas-kpi-card', 'Facturas Totales'), 'kpi total')],
  ['04 busqueda perez', () => setValue(document.querySelector('input[aria-label="Buscar facturas"]'), 'perez', 'search')],
  ['05 busqueda por forma de pago', () => setValue(document.querySelector('input[aria-label="Buscar facturas"]'), 'cheque', 'search')],
  ['06 limpiar busqueda', () => click(document.querySelector('.facturas-search-clear'), 'clear')],
  ['07 orden total', () => click(byText('th button.facturas-sort', 'Total y Avance de Pago'), 'sort')],
  ['08 filtro empresa', () => setValue(document.querySelector('select[aria-label="Filtrar por empresa"]'), 'Operadora Trajes Espanoles', 'empresa')],
  ['09 filtro archivos', () => setValue(document.querySelector('select[aria-label="Filtrar por comprobantes"]'), 'NONE', 'archivos')],
  ['10 limpiar filtros', () => click(byText('button', 'Limpiar filtros'), 'limpiar')],
  ['11 chip PUE', () => click(byText('button.facturas-chip', 'PUE ('), 'chip')],
  ['12 chip todas', () => click(byText('button.facturas-chip', 'Todas ('), 'chip todas')],
  ['13 acordeon', () => click(byText('button', 'Pagos (2)'), 'acordeon')],
  ['14 detalle de pago', () => click(byText('.facturas-subtable button', 'Detalles'), 'pago detalles')],
  ['15 escape cierra', async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await sleep(90); }],
  ['16 detalle factura', () => click(byText('td button', 'Detalle', { exact: true }), 'detalle')],
  ['17 editar desde detalle', () => click(byText('.facturas-modal__footer button', 'Editar'), 'editar')],
  ['18 editar subtotal', () => setValue(groupInput('Monto Subtotal'), '200', 'subtotal')],
  ['19 guardar edicion', () => click(byText('button[type=submit]', 'Actualizar Factura'), 'actualizar')],
  ['20 esperar sync', () => sleep(150)],
  ['21 abonar', () => click(byText('td button', '+ Abonar'), 'abonar')],
  ['22 liquidar saldo', () => click(byText('button', 'Liquidar saldo total'), 'liquidar')],
  ['23 forma de pago', () => setValue(document.querySelector('#p-forma'), 'Efectivo', 'forma')],
  ['24 guardar pago', () => click(byText('button[type=submit]', 'Guardar Complemento de Pago'), 'guardar pago')],
  ['25 esperar sync', () => sleep(150)],
  ['26 editar pago (acordeon)', () => click(byText('.facturas-subtable button', 'Editar', { nth: 0 }), 'editar pago')],
  ['27 pago: monto invalido', async () => {
    await setValue(document.querySelector('#p-monto'), '99999', 'monto');
    await click(byText('button[type=submit]', 'Actualizar Complemento'), 'submit pago');
  }],
  ['28 cerrar modal pago', () => click(document.querySelector('.facturas-modal__close'), 'cerrar')],
  ['29 nueva factura', () => click(byText('button', 'Nueva Factura'), 'nueva')],
  ['30 nueva: compra', () => setValue(groupInput('Compra Asociada'), '20', 'compra')],
  ['31 nueva: montos', async () => {
    await setValue(groupInput('Monto Subtotal'), '10', 'subtotal');
    await setValue(groupInput('Monto IVA'), '1.6', 'iva');
  }],
  ['32 nueva: metodo PUE', () => setValue(groupInput('Método de Pago'), 'PUE', 'metodo')],
  ['33 cerrar nueva', () => click(document.querySelector('.facturas-modal__close'), 'cerrar')],
  ['34 exportar csv', () => click(byText('button', 'Exportar CSV'), 'csv')],
  ['35 confirmar borrar factura', () => click(document.querySelector('button[aria-label="Eliminar factura"]'), 'eliminar')],
  ['36 cancelar borrar', () => click(byText('.facturas-modal__footer button', 'Cancelar'), 'cancelar')],
  ['37 tamano pagina', () => setValue(document.querySelector('#facturas-page-size'), '10', 'page size')],
];

const norm = (html) => html
  .replace(/class="([^"]*)"/g, (_, c) => `class="${c.trim().replace(/\s+/g, ' ')}"`)
  .replace(/ role="button" tabindex="0"/g, '')
  .replace(/ accept="[^"]*"/g, '')
  .replace(/ data-continue="true"/g, '')
  .replace(/ aria-label="[^"]*"/g, '')
  .replace(/ title="Quitar (PDF|XML)"/g, '')
  .replace(/\s+/g, ' ')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID')
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g, 'DT');

async function runOne(Component) {
  Object.assign(DB, JSON.parse(initialDb));
  window.__calls = [];
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  root.render(<MemoryRouter><Component /></MemoryRouter>);
  await sleep(500);
  const snaps = [];
  const errors = [];
  for (const [name, fn] of steps) {
    try {
      await fn();
      snaps.push([name, norm(document.getElementById('root').innerHTML)]);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
      snaps.push([name, `ERROR ${e.message}`]);
    }
  }
  const calls = JSON.parse(JSON.stringify(window.__calls)).filter((c) => c.method !== 'GET');
  root.unmount();
  return { snaps, calls, errors };
}

window.runQA = async () => {
  const base = await runOne(Base);
  const next = await runOne(Next);
  const report = [];
  base.snaps.forEach(([name, html], i) => {
    const other = next.snaps[i][1];
    if (html === other && html.length > 20) { report.push(`${name}: OK (${html.length} chars)`); return; }
    let d = 0;
    while (d < html.length && html[d] === other[d]) d += 1;
    report.push(`${name}: DIFF @${d} base=${html.length} next=${other.length}\n   base: ...${html.slice(Math.max(0, d - 60), d + 140)}\n   next: ...${other.slice(Math.max(0, d - 60), d + 140)}`);
  });
  return {
    report,
    baseErrors: base.errors,
    nextErrors: next.errors,
    callsEqual: JSON.stringify(base.calls) === JSON.stringify(next.calls),
    baseCalls: base.calls,
    nextCalls: next.calls,
  };
};
window.__ready = true;
