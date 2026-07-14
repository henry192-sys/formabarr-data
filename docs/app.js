// ── Config ──────────────────────────────────────────────────────────────
const PICKS_URL = 'https://raw.githubusercontent.com/henry192-sys/formabarr-data/refs/heads/main/picks.json';
const TELEGRAM_PAYMENT_DOMAIN = 'ApuestasBar'; // coordinación manual de pago
const PREMIUM_STORAGE_KEY = 'formabarr_premium';
const LICENSE_STORAGE_KEY = 'formabarr_license_code';

// t.me suele fallar por bloqueo de DNS del proveedor en algunas redes.
// Esta página intenta abrir la app (tg://) y si no responde, cae a t.me/.
function telegramRedirectUrl(domain) {
  return 'telegram-redirect.html?domain=' + encodeURIComponent(domain);
}

// Lista mock de códigos válidos — misma lista que la extensión mientras no
// exista el backend real de licencias (POST /verify-license).
const VALID_LICENSE_CODES = ['FORMABARR-VIP-0001', 'FORMABARR-VIP-0002', 'HENRYBARR-DEMO'];

// ── Fechas ──────────────────────────────────────────────────────────────
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateLabel(dateStr) {
  if (dateStr === todayStr()) return 'Hoy';
  if (dateStr === addDays(todayStr(), 1)) return 'Mañana';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

// Datos de ejemplo (hardcodeados), todos fechados hoy. valorEsperado siempre
// trae el dato real, incluso en el pick bloqueado — la página decide si lo
// muestra o no según el plan del usuario, el dato nunca es null.
const FALLBACK_PICKS = [
  {
    local: 'Real Potosí',
    visita: 'Bulo Bulo',
    hora: '17:00',
    mercado: 'Over 2.5 goles',
    valorEsperado: '+15%',
    bloqueado: false,
    fecha: todayStr(),
  },
  {
    local: 'The Strongest',
    visita: 'Nacional Potosí',
    hora: '19:30',
    mercado: 'Local o empate (Doble Oportunidad)',
    valorEsperado: '+9%',
    bloqueado: false,
    fecha: todayStr(),
  },
  {
    local: 'Always Ready',
    visita: 'San Antonio',
    hora: '21:00',
    mercado: 'Ambos anotan',
    valorEsperado: '+18%',
    bloqueado: true,
    fecha: todayStr(),
  },
];

// ── Estado ──────────────────────────────────────────────────────────────
let isPremium = false;
let picks = FALLBACK_PICKS;
let selectedDate = todayStr(); // navegable por cualquier usuario, con o sin código

// Rango navegable: cada día desde hoy hasta la fecha futura más lejana
// cargada en el JSON (continuo, no solo los días que tienen partidos —
// si no, las flechas se saltarían los días vacíos sin mostrarlos nunca).
function getDateRange() {
  const today = todayStr();
  const maxDate = picks.reduce((max, p) => (p.fecha && p.fecha > max ? p.fecha : max), today);
  const range = [];
  for (let d = today; d <= maxDate; d = addDays(d, 1)) range.push(d);
  return range;
}

// ── Render ──────────────────────────────────────────────────────────────
function buildCard(pick) {
  const card = document.createElement('article');
  card.className = 'pick-card';

  const teams = document.createElement('div');
  teams.className = 'pick-teams';
  teams.textContent = `${pick.local} vs ${pick.visita}`;
  card.appendChild(teams);

  const meta = document.createElement('div');
  meta.className = 'pick-meta';
  meta.textContent = pick.hora;
  card.appendChild(meta);

  const footerRow = document.createElement('div');
  footerRow.className = 'pick-footer';

  const market = document.createElement('span');
  market.className = 'pick-market';
  market.textContent = pick.mercado;
  footerRow.appendChild(market);

  // El dato (valorEsperado) siempre viene completo desde el JSON. Lo que
  // decide si se ve es el plan: gratis + bloqueado = oculto, todo lo demás
  // se muestra (incluye premium viendo un pick que para free está bloqueado).
  const showVe = !pick.bloqueado || isPremium;
  if (showVe && pick.valorEsperado) {
    const badge = document.createElement('span');
    badge.className = 've-badge';
    badge.textContent = `✅ V.E. ${pick.valorEsperado}`;
    footerRow.appendChild(badge);
  }

  card.appendChild(footerRow);
  return card;
}

function renderEmptyState(container) {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = 'Sin pronósticos para este día todavía.';
  container.appendChild(empty);
}

// La navegación por fecha está abierta a todos (con o sin código).
function renderDateNav() {
  const dates = getDateRange();
  const idx = dates.indexOf(selectedDate);

  document.getElementById('date-label').textContent = formatDateLabel(selectedDate);
  document.getElementById('date-prev').disabled = idx <= 0;
  document.getElementById('date-next').disabled = idx === -1 || idx >= dates.length - 1;
}

function navigateDate(delta) {
  const dates = getDateRange();
  const idx = dates.indexOf(selectedDate);
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= dates.length) return;
  selectedDate = dates[newIdx];
  renderPicks();
}

// El límite "2 visibles + resumen" aplica a CUALQUIER día navegado mientras
// no haya código activado (no solo a hoy). Con código, sin límite en ningún día.
function renderPicks() {
  const container = document.getElementById('picks');
  container.innerHTML = '';

  document.getElementById('premium-banner').hidden = !isPremium;
  renderDateNav();

  const dayPicks = picks.filter((p) => p.fecha === selectedDate);

  if (dayPicks.length === 0) {
    renderEmptyState(container);
    return;
  }

  if (isPremium) {
    dayPicks.forEach((pick) => container.appendChild(buildCard(pick)));
    return;
  }

  const visiblePicks = dayPicks.filter((p) => !p.bloqueado).slice(0, 2);
  visiblePicks.forEach((pick) => container.appendChild(buildCard(pick)));

  const lockedCount = dayPicks.filter((p) => p.bloqueado).length;
  if (lockedCount > 0) {
    const summary = document.createElement('div');
    summary.className = 'locked-summary';
    const text = document.createElement('p');
    text.className = 'locked-summary-text';
    text.textContent = `🔒 +${lockedCount} pronósticos más disponibles`;
    summary.appendChild(text);
    container.appendChild(summary);
  }
}

// ── Licencia (mock) ────────────────────────────────────────────────────
function setLicenseMsg(text, ok) {
  const msg = document.getElementById('license-msg');
  msg.textContent = text;
  msg.className = 'license-msg ' + (ok ? 'ok' : 'error');
}

function activateLicense() {
  const input = document.getElementById('license-input');
  const code = input.value.trim().toUpperCase();

  if (!code) {
    setLicenseMsg('Ingresa un código.', false);
    return;
  }

  // TODO: reemplazar por fetch(POST /verify-license) cuando exista el backend real.
  const valid = VALID_LICENSE_CODES.includes(code);

  if (valid) {
    isPremium = true;
    selectedDate = todayStr();
    localStorage.setItem(PREMIUM_STORAGE_KEY, 'true');
    localStorage.setItem(LICENSE_STORAGE_KEY, code);
    setLicenseMsg('Código activado. ¡Bienvenido!', true);
    renderPicks();
  } else {
    setLicenseMsg('Código inválido.', false);
  }
}

// ── Fetch de picks (con fallback a datos hardcodeados) ─────────────────
async function loadPicks() {
  try {
    const res = await fetch(PICKS_URL);
    if (!res.ok) throw new Error('respuesta no OK');
    const data = await res.json();
    if (Array.isArray(data) && data.length) picks = data;
  } catch (err) {
    console.info('[FormaBarr] usando picks de ejemplo (fetch a PICKS_URL falló):', err.message);
    picks = FALLBACK_PICKS;
  }
  renderPicks();
}

// ── Init ────────────────────────────────────────────────────────────────
function init() {
  document.getElementById('activate-btn').addEventListener('click', activateLicense);
  document.getElementById('license-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') activateLicense();
  });
  document.getElementById('unlock-btn').addEventListener('click', () => {
    window.open(telegramRedirectUrl(TELEGRAM_PAYMENT_DOMAIN), '_blank');
  });
  document.getElementById('date-prev').addEventListener('click', () => navigateDate(-1));
  document.getElementById('date-next').addEventListener('click', () => navigateDate(1));

  document.getElementById('no-code-link').href = telegramRedirectUrl(TELEGRAM_PAYMENT_DOMAIN);

  isPremium = localStorage.getItem(PREMIUM_STORAGE_KEY) === 'true';
  loadPicks();
}

document.addEventListener('DOMContentLoaded', init);
