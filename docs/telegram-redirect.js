// Abre Telegram vía esquema nativo (tg://) que no depende de resolución DNS
// del navegador para t.me. Si la app no responde en ~1.5s (no instalada o
// el esquema no está registrado), cae al link web como respaldo.
(function () {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain');

  if (!domain) {
    document.querySelector('p').textContent = 'Falta el parámetro "domain".';
    return;
  }

  const webUrl = `https://t.me/${domain}`;
  const appUrl = `tg://resolve?domain=${domain}`;

  document.getElementById('manual-link').href = webUrl;

  let fallbackTimer = setTimeout(() => {
    window.location.href = webUrl;
  }, 1500);

  function cancelFallback() {
    clearTimeout(fallbackTimer);
  }

  // Si la app se abre, la pestaña pasa a segundo plano o pierde foco.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelFallback();
  });
  window.addEventListener('blur', cancelFallback);

  window.location.href = appUrl;
})();
