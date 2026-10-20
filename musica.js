/* Musiquinha tranquila de fundo, tocada pelo próprio navegador (sem arquivo de áudio).
   Notas suaves de uma escala pentatônica em Dó, como uma caixinha de música. */
const Musica = (() => {
  let ctx = null, saida = null, ligada = true, tocando = false, timer = null, passo = 0;
  const VOLUME = 0.035, VOLUME_BAIXO = 0.012;
  const nota = (n) => 261.63 * Math.pow(2, n / 12);
  // melodia em graus da escala (semitons a partir do Dó); null = pausa
  const MELODIA = [12, 16, 19, 16, 14, null, 12, null, 9, 12, 14, 12, 7, null, null, null,
                   12, 16, 19, 21, 19, null, 16, null, 14, 12, 9, 12, 12, null, null, null];
  const BAIXO = [0, 0, -3, -3, -7, -7, -5, -5];
  const TEMPO = 0.42; // segundos por nota

  function iniciar() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    saida = ctx.createGain();
    saida.gain.value = VOLUME;
    saida.connect(ctx.destination);
  }

  function tocarNota(freq, quando, dur, vol, tipo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, quando);
    g.gain.linearRampToValueAtTime(vol, quando + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, quando + dur);
    o.connect(g).connect(saida);
    o.start(quando);
    o.stop(quando + dur + 0.05);
  }

  function agendar() {
    const t = ctx.currentTime + 0.05;
    const m = MELODIA[passo % MELODIA.length];
    if (m !== null) tocarNota(nota(m), t, 1.4, 0.5, 'sine');
    if (passo % 4 === 0) tocarNota(nota(BAIXO[(passo / 4) % BAIXO.length] - 12), t, TEMPO * 4, 0.35, 'triangle');
    passo++;
  }

  function play() {
    if (!ligada) return;
    iniciar();
    if (!ctx || tocando) return;
    ctx.resume();
    tocando = true;
    timer = setInterval(agendar, TEMPO * 1000);
  }

  function parar() {
    tocando = false;
    clearInterval(timer);
  }

  // abaixa a música enquanto a Tia Ana fala
  function abaixar(sim) {
    if (!ctx) return;
    saida.gain.cancelScheduledValues(ctx.currentTime);
    saida.gain.linearRampToValueAtTime(sim ? VOLUME_BAIXO : VOLUME, ctx.currentTime + 0.3);
  }

  function alternar(valor) {
    ligada = valor;
    if (ligada) play(); else parar();
  }

  return { play, parar, abaixar, alternar, get ligada() { return ligada; } };
})();
