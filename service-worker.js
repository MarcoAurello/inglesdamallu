// Guarda os arquivos do jogo para funcionar offline.
// Ao mudar qualquer arquivo, aumente a VERSAO (e o ?v= no index.html) para os aparelhos baixarem a nova.
const VERSAO = 'verbs-domino-v3';

const ARQUIVOS = [
  './',
  './index.html',
  './style.css?v=3',
  './palavras.js?v=3',
  './domino.js?v=3',
  './musica.js?v=3',
  './jogo.js?v=3',
  './vendor/jspdf.umd.min.js',
  './manifest.json',
  ...['mallu.jpg', 'mallu_corre.png', 'mallu_pula.png', 'mallu_aponta.png', 'mallu_pensa.png', 'mallu_duvida.png', 'mallu_feliz.png'].map((f) => `./assets/mallu/${f}`),
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

// Apaga caches de versÃµes antigas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Fonte do Google: guarda na primeira vez para usar offline depois
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(VERSAO + '-fontes').then(async (cache) => {
        const salvo = await cache.match(e.request);
        if (salvo) return salvo;
        const resposta = await fetch(e.request);
        cache.put(e.request, resposta.clone());
        return resposta;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Sempre confere com o servidor e sÃ³ usa o cache sem internet
  const pedido = e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(pedido)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put(e.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
