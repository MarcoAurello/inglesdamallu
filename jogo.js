(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Configuração ----------
  const PROFESSORA = 'Mallu';
  const TELEFONE_PRO = '5531992704914';   // WhatsApp da Mallu (site inglesdamallu.com.br)
  const TEMPO_VEZ = 30;           // Desafio: segundos para cada jogada sua
  const RAPIDA = 8;               // Desafio: jogada certa em até 8 s ganha bônus
  const DICA_APOS = 2;            // Aprender: depois de 2 erros seguidos, a peça certa brilha
  const ESPERA_ROBO = { aprender: 1300, desafio: 750 };   // tempo (ms) que os colegas levam para jogar
  const COLEGAS = [null, { nome: 'Ben', avatar: '🧑🏽' }, { nome: 'Kate', avatar: '👩🏼‍🦰' }, { nome: 'Sam', avatar: '🧑🏿‍🦱' }];
  const CHAVE_NOME = 'domino:nome';
  const CHAVE_PREF = 'domino:pref';
  const CHAVE_PAL = 'domino:palavras:';    // + nome: { id: { vistas, erros, acertos } }
  const CHAVE_HIST = 'domino:historico:';  // + nome: últimas partidas
  const CHAVE_CATS = 'domino:professor';

  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch (e) { return padrao; } };

  let nome = ler(CHAVE_NOME, '');
  const pref = ler(CHAVE_PREF, { musica: true, voz: true });
  // link da turma: ?cat=ABF (categorias escolhidas pelo professor)
  const turma = (() => {
    const c = (new URLSearchParams(location.search).get('cat') || '').toUpperCase().split('').filter((x) => CATEGORIAS[x]);
    return c.length ? [...new Set(c)] : null;
  })();

  const porId = Object.fromEntries(PALAVRAS.map((p) => [p.id, p]));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Telas ----------
  function mostrar(id) {
    document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === id));
    $('placar').hidden = id !== 'tela-jogo';
    document.body.dataset.tela = id;
    window.scrollTo(0, 0);
  }

  // ---------- Voz (voz do aparelho: inglês em en-US, português em pt-BR) ----------
  function falar(texto, idioma = 'pt-BR') {
    if (!pref.voz || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = idioma;
    u.rate = idioma === 'en-US' ? 0.85 : 0.95;
    const voz = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').startsWith(idioma));
    if (voz) u.voice = voz;
    u.onend = u.onerror = () => Musica.abaixar(false);
    speechSynthesis.cancel();
    Musica.abaixar(true);
    speechSynthesis.speak(u);
  }
  const calar = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); Musica.abaixar(false); };
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  // efeitos curtinhos gerados no navegador
  let ctxSom = null;
  function som(tipo) {
    if (!pref.voz) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctxSom = ctxSom || new AC();
    if (ctxSom.state !== 'running') ctxSom.resume().catch(() => {});
    const notas = {
      peca: [[520, 0, 0.07], [780, 0.05, 0.08]],
      certo: [[660, 0, 0.1], [880, 0.09, 0.16]],
      ops: [[330, 0, 0.14], [294, 0.12, 0.18]],
      passo: [[440, 0, 0.08]],
      fim: [[523, 0, 0.14], [659, 0.13, 0.14], [784, 0.26, 0.14], [1047, 0.39, 0.4]],
    }[tipo] || [];
    const t0 = ctxSom.currentTime + 0.02;
    notas.forEach(([f, d, dur]) => {
      const o = ctxSom.createOscillator(), g = ctxSom.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + d);
      g.gain.linearRampToValueAtTime(0.16, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d + dur);
      o.connect(g).connect(ctxSom.destination);
      o.start(t0 + d); o.stop(t0 + d + dur + 0.05);
    });
  }
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (ctxSom && ctxSom.state !== 'running') ctxSom.resume().catch(() => {});
  }, { capture: true, passive: true }));

  function atualizarBotoesSom() {
    $('btn-musica').setAttribute('aria-pressed', String(pref.musica));
    $('btn-som').setAttribute('aria-pressed', String(pref.voz));
    $('btn-musica').setAttribute('aria-label', pref.musica ? 'Desligar música' : 'Ligar música');
    $('btn-som').setAttribute('aria-label', pref.voz ? 'Desligar voz e sons' : 'Ligar voz e sons');
  }
  Musica.alternar(false);
  $('btn-musica').onclick = () => { pref.musica = !pref.musica; guardar(CHAVE_PREF, pref); Musica.alternar(pref.musica); atualizarBotoesSom(); };
  $('btn-som').onclick = () => { pref.voz = !pref.voz; guardar(CHAVE_PREF, pref); if (!pref.voz) calar(); atualizarBotoesSom(); };
  atualizarBotoesSom();
  const ligarMusica = () => { if (pref.musica) Musica.alternar(true); };

  // ---------- Nome e início ----------
  function telaNome() {
    $('campo-nome').value = nome;
    $('erro-nome').textContent = '';
    mostrar('tela-nome');
    $('campo-nome').focus();
  }
  $('form-nome').onsubmit = (e) => {
    e.preventDefault();
    const n = $('campo-nome').value.trim().replace(/\s+/g, ' ');
    if (n.length < 2) { $('erro-nome').textContent = 'Escreva o seu nome, por favor.'; return; }
    nome = n.toUpperCase();
    guardar(CHAVE_NOME, nome);
    telaInicio(true);
  };
  function telaInicio(saudar) {
    if (!nome) return telaNome();
    $('nome-jogador').textContent = nome;
    $('turma').hidden = !turma;
    if (turma) $('turma').innerHTML = `📚 Conjunto da turma: <b>${turma.map((c) => CATEGORIAS[c].nome).join(', ')}</b>`;
    mostrar('tela-inicio');
    if (saudar) { ligarMusica(); falar(`Hi, ${nome.toLowerCase()}!`, 'en-US'); }
  }
  $('btn-trocar').onclick = () => { calar(); nome = ''; try { localStorage.removeItem(CHAVE_NOME); } catch (e) {} telaNome(); };
  $('btn-aprender').onclick = () => preparar('aprender', turma);
  $('btn-desafio').onclick = () => preparar('desafio', turma);

  // ---------- Preparando a partida (Mallu correndo) ----------
  let jogo = null;
  let timerRobo = null, timerVez = null;
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

  async function preparar(modo, cats) {
    calar();
    clearTimeout(timerRobo); clearInterval(timerVez);
    ligarMusica();
    mostrar('tela-carregando');
    const etapas = [...$('etapas').children];
    etapas.forEach((li) => li.className = '');
    $('barra-carregando').style.width = '0%';
    const historico = ler(CHAVE_PAL + nome.toLowerCase(), {});
    let sel, pecas, erros;
    for (let t = 0; t < 5; t++) {   // na prática, sai na primeira: o circuito é validado antes de jogar
      sel = Domino.selecionar(PALAVRAS, historico, cats);
      pecas = Domino.montarCircuito(sel.palavras);
      erros = Domino.validar(pecas);
      if (!erros.length) break;
    }
    for (let k = 0; k < etapas.length; k++) {
      etapas[k].className = 'fazendo';
      await esperar(560);
      etapas[k].className = 'feito';
      $('barra-carregando').style.width = `${((k + 1) / etapas.length) * 100}%`;
    }
    await esperar(250);
    novaPartida(modo, cats, sel, pecas);
  }

  function novaPartida(modo, cats, sel, pecas) {
    const maos = Domino.distribuir(pecas);
    jogo = {
      modo, cats, aviso: sel.aviso, inicio: new Date(),
      palavras: sel.palavras, pecas, maos, mesa: [],
      vez: 0, terminados: [],
      tempo: 0, marco: null, pausado: false, acabou: false, bloqueado: true,
      pontos: 0,
      jogadas: [],           // suas peças: { palavra, peca, tempo, erros, dica, esgotado }
      erros: [],             // { precisava, tentou } (ids das palavras)
      passes: { certos: 0, errados: 0 }, dicas: 0, esgotados: 0,
      errosNaVez: 0, usouDica: false, inicioVez: 0,
      selecionada: null, dicaAtual: null, ultima: null, situacao: {},
    };
    // palavras vistas: entram no histórico do aluno
    const hist = ler(CHAVE_PAL + nome.toLowerCase(), {});
    sel.palavras.forEach((p) => { (hist[p.id] ??= { vistas: 0, erros: 0, acertos: 0 }).vistas++; });
    guardar(CHAVE_PAL + nome.toLowerCase(), hist);

    $('pontos').hidden = modo !== 'desafio';
    $('trilho-vez').hidden = modo !== 'desafio';
    $('btn-dica').hidden = modo !== 'aprender';
    mostrar('tela-jogo');
    ligarRelogio();
    desenhar();
    mallu('aponta', modo === 'aprender'
      ? `Você começa! Toque numa <b>peça sua</b> (lá embaixo) e depois na <b>mesa</b>. Ao tocar na peça, você ouve a palavra em inglês. 🔊`
      : `Desafio! <b>${TEMPO_VEZ} s</b> por jogada. Toque numa peça sua e depois na ponta da mesa que pisca. Boa sorte! 🍀`);
    if (jogo.aviso) mallu('aponta', jogo.aviso);
    comecarVez();
  }

  // ---------- Relógio ----------
  function ligarRelogio() { if (jogo.marco === null && !jogo.pausado && !jogo.acabou) jogo.marco = performance.now(); }
  function pararRelogio() { if (jogo.marco !== null) { jogo.tempo += (performance.now() - jogo.marco) / 1000; jogo.marco = null; } }
  const segundos = () => jogo.tempo + (jogo.marco !== null ? (performance.now() - jogo.marco) / 1000 : 0);
  const mmss = (s) => { s = Math.floor(s); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  setInterval(() => {
    if (!jogo || jogo.acabou || !$('tela-jogo').classList.contains('ativa')) return;
    $('relogio').textContent = mmss(segundos());
    if (jogo.modo === 'desafio' && jogo.vez === 0 && !jogo.bloqueado) {
      const resta = Math.max(0, TEMPO_VEZ - (segundos() - jogo.inicioVez));
      $('vez-cheio').style.width = `${(resta / TEMPO_VEZ) * 100}%`;
      $('trilho-vez').classList.toggle('acabando', resta <= 8);
      if (resta <= 0) tempoEsgotado();
    }
  }, 200);

  // ---------- Desenho da mesa, pontas, mão e colegas ----------
  // palavra longa ganha letra menor (para não quebrar no meio, ex.: "everybody")
  const meia = (txt, cls) => {
    const ehEn = cls.startsWith('en');
    const longa = ehEn ? txt.length > 7 : txt.length > 14;
    const muito = ehEn ? txt.length > 10 : txt.length > 22;
    return `<span class="${cls}${muito ? ' muito-longa' : longa ? ' longa' : ''}">${esc(txt)}</span>`;
  };

  function desenhar() {
    // colegas
    $('oponentes').innerHTML = [1, 2, 3].map((p) => {
      const s = jogo.situacao[p] || '';
      const n = jogo.maos[p].length;
      return `<div class="colega${jogo.vez === p && !jogo.acabou ? ' vez' : ''}${n ? '' : ' bateu'}">
        <span class="colega-avatar" aria-hidden="true">${COLEGAS[p].avatar}</span>
        <span class="colega-info"><b>${COLEGAS[p].nome}</b><span class="costas" aria-label="${n} peças">${'<i></i>'.repeat(n)}</span></span>
        <span class="colega-sit">${s}</span></div>`;
    }).join('');

    // mesa (da ponta esquerda para a direita). Com uma peça escolhida, as duas pontas piscam: é só tocar nelas.
    const piscar = jogo.selecionada !== null && jogo.vez === 0 && !jogo.bloqueado && !jogo.acabou;
    const dicaLado = jogo.dicaAtual ? jogo.dicaAtual.lado : null;
    const encaixe = (lado) => `<button class="encaixe ${lado}${piscar ? ' piscando' : ''}${dicaLado === lado ? ' dica' : ''}" type="button" data-lado="${lado}" aria-label="Colocar na ponta ${lado}">${lado === 'esquerda' ? '◀' : '▶'}</button>`;
    $('mesa').innerHTML = jogo.mesa.length
      ? encaixe('esquerda') + jogo.mesa.map((p, k) => {
        const ini = k === 0, fim = k === jogo.mesa.length - 1;
        return `<span class="peca-mesa${p.id === jogo.ultima ? ' nova' : ''}">${meia(p.en.en, `en${ini ? ' aberta' : ''}${ini && piscar ? ' piscando' : ''}`)}${meia(p.pt.pt, `pt${fim ? ' aberta' : ''}${fim && piscar ? ' piscando' : ''}`)}</span>`;
      }).join('') + encaixe('direita')
      : `<button class="encaixe comeco${piscar ? ' piscando' : ''}" type="button" data-lado="direita">${piscar ? 'Toque aqui para colocar a primeira peça' : 'Mesa vazia: escolha uma peça sua para começar 👇'}</button>`;
    const nova = $('mesa').querySelector('.nova');
    if (nova) nova.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    // sua mão
    const minhaVez = jogo.vez === 0 && !jogo.acabou;
    $('mao').classList.toggle('sua-vez', minhaVez);
    $('mao').innerHTML = jogo.maos[0].map((p) => `<button class="peca${jogo.selecionada === p.id ? ' escolhida' : ''}${jogo.dicaAtual && jogo.dicaAtual.peca === p.id ? ' dica' : ''}" type="button" data-id="${p.id}" aria-label="Peça ${esc(p.en.en)} e ${esc(p.pt.pt)}">${meia(p.en.en, 'en')}${meia(p.pt.pt, 'pt')}</button>`).join('')
      || '<p class="mao-vazia">🎉 Você bateu! Acabaram suas peças.</p>';
    $('btn-passo').disabled = !minhaVez || jogo.bloqueado;
  }

  // balão da Mallu
  function mallu(pose, html) {
    $('pose-mallu').className = `pose mini ${pose}`;
    $('fala').innerHTML = html;
  }

  // ---------- Vez de cada jogador ----------
  function comecarVez() {
    if (jogo.acabou || jogo.pausado) return;
    if (jogo.mesa.length === Domino.PECAS) return fimDaPartida();
    const p = jogo.vez;
    if (!jogo.maos[p].length) return proximaVez();
    jogo.dicaAtual = null;
    if (p === 0) {
      jogo.bloqueado = false;
      jogo.errosNaVez = 0;
      jogo.errosInicioVez = jogo.erros.length;
      jogo.usouDica = false;
      jogo.inicioVez = segundos();
      desenhar();
      return;
    }
    jogo.bloqueado = true;
    jogo.situacao[p] = '🤔';
    desenhar();
    clearTimeout(timerRobo);
    timerRobo = setTimeout(() => jogadaColega(p), ESPERA_ROBO[jogo.modo]);
  }

  let timerProx = null;
  function agendar(ms) { clearTimeout(timerProx); jogo.pendente = true; timerProx = setTimeout(() => { jogo.pendente = false; proximaVez(); }, ms); }

  function proximaVez() {
    if (jogo.acabou) return;
    if (jogo.mesa.length === Domino.PECAS) return fimDaPartida();
    jogo.vez = (jogo.vez + 1) % 4;
    comecarVez();
  }

  function jogadaColega(p) {
    if (jogo.acabou || jogo.pausado) return;
    const op = Domino.jogaveis(jogo.mesa, jogo.maos[p]);
    if (!op.length) {
      jogo.situacao[p] = 'passou';
      som('passo');
    } else {
      const peca = op[Math.floor(Math.random() * op.length)];
      const e = Domino.encaixe(jogo.mesa, peca);
      const lado = e === 'qualquer' ? 'direita' : e[Math.floor(Math.random() * e.length)];
      colocar(p, peca, lado);
      jogo.situacao[p] = `jogou <b>${esc(peca.en.en)}</b>`;
    }
    // quando você já bateu, os colegas terminam mais rápido
    const espera = jogo.maos[0].length ? 450 : 150;
    desenhar();
    agendar(espera);
  }

  // coloca a peça na mesa
  function colocar(p, peca, lado) {
    if (lado === 'esquerda' && jogo.mesa.length) jogo.mesa.unshift(peca); else jogo.mesa.push(peca);
    jogo.maos[p] = jogo.maos[p].filter((x) => x.id !== peca.id);
    jogo.ultima = peca.id;
    som('peca');
    if (!jogo.maos[p].length && !jogo.terminados.includes(p)) {
      jogo.terminados.push(p);
      if (p) jogo.situacao[p] = '🏁 bateu!';
    }
  }

  // palavra que a jogada ligou (a que ficou "no meio" da conexão)
  function palavraLigada(peca, lado) {
    if (!jogo.mesa.length) return peca.en;
    return lado === 'esquerda' ? peca.pt : peca.en;
  }

  // ---------- Suas jogadas ----------
  function escolher(id) {
    if (!jogo || jogo.acabou) return;
    const peca = jogo.maos[0].find((p) => p.id === id);
    if (!peca) return;
    jogo.selecionada = jogo.selecionada === id ? null : id;
    desenhar();
    if (jogo.selecionada === null) return;
    falar(peca.en.en, 'en-US');
    if (jogo.vez === 0 && !jogo.bloqueado) {
      mallu('aponta', jogo.mesa.length
        ? `<b class="en">${esc(peca.en.en)}</b> | ${esc(peca.pt.pt)} — agora toque na <b>ponta da mesa</b> onde ela encaixa (as pontas estão piscando ✨).`
        : 'Agora toque na mesa para colocar a primeira peça. ✨');
    }
  }

  function tentar(id, lado) {
    if (!jogo || jogo.acabou) return;
    if (jogo.vez !== 0 || jogo.bloqueado) { mallu('pensa', `Espere a sua vez: agora é a vez de <b>${COLEGAS[jogo.vez]?.nome || '...'}</b>. ✋`); return; }
    const peca = jogo.maos[0].find((p) => p.id === id);
    if (!peca) { mallu('aponta', 'Primeiro toque numa das suas peças. 👇'); return; }
    const e = Domino.encaixe(jogo.mesa, peca);
    if (e === 'qualquer' || e.includes(lado)) return acertou(peca, e === 'qualquer' ? 'direita' : lado);
    if (e.length) {   // encaixa, mas na outra ponta: vale, e a peça vai para o lugar certo
      mallu('aponta', 'Essa peça encaixa na <b>outra ponta</b>. Coloquei lá para você! 😉');
      return acertou(peca, e[0], true);
    }
    errou(peca, lado);
  }

  function acertou(peca, lado, outraPonta) {
    const w = palavraLigada(peca, lado);
    const tempo = segundos() - jogo.inicioVez;
    // erros desta vez que foram justamente nesta ligação (errar na outra ponta não conta contra esta palavra)
    const errosAqui = jogo.erros.slice(jogo.errosInicioVez).filter((e) => e.precisava === w.id).length;
    const deprimeira = errosAqui === 0 && !jogo.usouDica;
    const inicio = !jogo.mesa.length;   // a 1ª peça da mesa não liga com nada: não conta
    colocar(0, peca, lado);
    jogo.jogadas.push({ palavra: w.id, peca: peca.id, tempo, erros: errosAqui, dica: jogo.usouDica, esgotado: false, inicio });
    if (jogo.modo === 'desafio' && !inicio) jogo.pontos += deprimeira ? 10 + (tempo <= RAPIDA ? 5 : 0) : 3;
    // histórico da palavra
    const hist = ler(CHAVE_PAL + nome.toLowerCase(), {});
    if (deprimeira && !inicio) (hist[w.id] ??= { vistas: 1, erros: 0, acertos: 0 }).acertos++;
    guardar(CHAVE_PAL + nome.toLowerCase(), hist);

    jogo.selecionada = null;
    jogo.dicaAtual = null;
    jogo.bloqueado = true;
    som('certo');
    $('pontos').textContent = `⭐ ${jogo.pontos}`;
    const bateu = !jogo.maos[0].length;
    const exemplo = `“${esc(w.exEn)}” — <i>${esc(w.exPt)}</i>`;
    if (!outraPonta) {
      const ganho = inicio ? 'Primeira peça na mesa!' : deprimeira && tempo <= RAPIDA ? '+15 pontos ⚡' : deprimeira ? '+10 pontos' : '+3 pontos';
      mallu('feliz', `${bateu ? '🎉 <b>Você bateu!</b> ' : '✅ '}<b class="en">${esc(w.en.toUpperCase())}</b> = ${esc(w.pt)}<br>${jogo.modo === 'aprender' ? exemplo : ganho}`);
    }
    falar(jogo.modo === 'aprender' ? w.exEn : w.en, 'en-US');
    desenhar();
    agendar(jogo.modo === 'aprender' ? 1400 : 700);
  }

  function errou(peca, lado) {
    // o que a ponta pedia e o que a peça trouxe
    const esq = jogo.mesa[0], dir = jogo.mesa[jogo.mesa.length - 1];
    const precisava = lado === 'esquerda' ? esq.en : dir.pt;
    const tentou = lado === 'esquerda' ? peca.pt : peca.en;
    jogo.erros.push({ precisava: precisava.id, tentou: tentou.id });
    jogo.errosNaVez++;
    const hist = ler(CHAVE_PAL + nome.toLowerCase(), {});
    (hist[precisava.id] ??= { vistas: 1, erros: 0, acertos: 0 }).erros++;
    guardar(CHAVE_PAL + nome.toLowerCase(), hist);
    som('ops');
    // o erro vira aprendizado: mostra o que a palavra escolhida significa
    const significado = `<b class="en">${esc(tentou.en.toUpperCase())}</b> = ${esc(tentou.pt)} · “${esc(tentou.exEn)}” — <i>${esc(tentou.exPt)}</i>`;
    const pedido = lado === 'esquerda'
      ? `Aqui precisa da tradução de <b class="en">${esc(precisava.en.toUpperCase())}</b>.`
      : `Aqui precisa da palavra em inglês para <b>${esc(precisava.pt)}</b>.`;
    mallu(jogo.errosNaVez > 1 ? 'duvida' : 'pensa', `Quase! ${significado}<br>${pedido} Tente de novo!`);
    falar(tentou.en, 'en-US');
    if (jogo.modo === 'aprender' && jogo.errosNaVez >= DICA_APOS) mostrarDica(false);
    else desenhar();
  }

  function mostrarDica(pedida) {
    if (!jogo || jogo.acabou || jogo.vez !== 0 || jogo.bloqueado || jogo.modo !== 'aprender') return;
    const op = Domino.jogaveis(jogo.mesa, jogo.maos[0]);
    if (!op.length) {
      mallu('aponta', 'Nenhuma das suas peças encaixa agora. Toque em <b>✋ PASSO</b>.');
      desenhar();
      return;
    }
    const peca = op[0];
    const e = Domino.encaixe(jogo.mesa, peca);
    jogo.dicaAtual = { peca: peca.id, lado: e === 'qualquer' ? 'direita' : e[0] };
    jogo.selecionada = peca.id;
    if (!jogo.usouDica) { jogo.usouDica = true; jogo.dicas++; }
    const w = palavraLigada(peca, jogo.dicaAtual.lado);
    mallu('aponta', `${pedida ? 'Dica' : 'Vou te ajudar'}: a peça <b class="en">${esc(peca.en.en)}</b> | ${esc(peca.pt.pt)} encaixa na ponta da mesa que está brilhando, porque <b class="en">${esc(w.en.toUpperCase())}</b> = ${esc(w.pt)}. 💡`);
    desenhar();
  }
  $('btn-dica').onclick = () => mostrarDica(true);

  $('btn-passo').onclick = () => {
    if (!jogo || jogo.acabou || jogo.vez !== 0 || jogo.bloqueado) return;
    const op = Domino.jogaveis(jogo.mesa, jogo.maos[0]);
    if (op.length) {
      jogo.passes.errados++;
      som('ops');
      mallu('pensa', `Espere! Você <b>tem uma peça que encaixa</b>. Olhe de novo as duas pontas da mesa. 👀`);
      if (jogo.modo === 'aprender') mostrarDica(false);
      return;
    }
    jogo.passes.certos++;
    if (jogo.modo === 'desafio') { jogo.pontos += 2; $('pontos').textContent = `⭐ ${jogo.pontos}`; }
    jogo.bloqueado = true;
    som('passo');
    mallu('aponta', 'Isso! Nenhuma peça encaixava, então você passou. 👍');
    desenhar();
    agendar(500);
  };

  // Desafio: acabou o tempo da jogada
  function tempoEsgotado() {
    if (jogo.bloqueado) return;
    jogo.bloqueado = true;
    jogo.esgotados++;
    const op = Domino.jogaveis(jogo.mesa, jogo.maos[0]);
    if (!op.length) {
      mallu('pensa', '⏰ O tempo acabou! Nenhuma peça encaixava: você passou.');
      desenhar();
      return agendar(900);
    }
    const peca = op[0];
    const e = Domino.encaixe(jogo.mesa, peca);
    const lado = e === 'qualquer' ? 'direita' : e[0];
    const w = palavraLigada(peca, lado);
    colocar(0, peca, lado);
    jogo.jogadas.push({ palavra: w.id, peca: peca.id, tempo: TEMPO_VEZ, erros: jogo.errosNaVez, dica: false, esgotado: true, inicio: jogo.mesa.length === 1 });
    const hist = ler(CHAVE_PAL + nome.toLowerCase(), {});
    (hist[w.id] ??= { vistas: 1, erros: 0, acertos: 0 }).erros++;
    guardar(CHAVE_PAL + nome.toLowerCase(), hist);
    jogo.selecionada = null;
    mallu('duvida', `⏰ O tempo acabou! A peça certa era <b class="en">${esc(peca.en.en)}</b> | ${esc(peca.pt.pt)}, porque <b class="en">${esc(w.en.toUpperCase())}</b> = ${esc(w.pt)}.`);
    desenhar();
    agendar(1600);
  }

  // ---------- Toques e arrastar ----------
  let arrasto = null;
  $('mao').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.peca');
    if (!b || !jogo) return;
    e.preventDefault();
    arrasto = { id: Number(b.dataset.id), el: b, x0: e.clientX, y0: e.clientY, pid: e.pointerId, fantasma: null };
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
  });
  $('mao').addEventListener('pointermove', (e) => {
    if (!arrasto || e.pointerId !== arrasto.pid) return;
    if (!arrasto.fantasma && Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) > 10) {
      const f = arrasto.el.cloneNode(true);
      f.classList.add('fantasma');
      f.style.width = `${arrasto.el.offsetWidth}px`;
      document.body.appendChild(f);
      arrasto.fantasma = f;
      arrasto.el.classList.add('arrastando');
      if (jogo.selecionada !== arrasto.id) escolher(arrasto.id);
    }
    if (arrasto.fantasma) {
      arrasto.fantasma.style.left = `${e.clientX}px`;
      arrasto.fantasma.style.top = `${e.clientY}px`;
      const alvo = pontaEm(e.clientX, e.clientY);
      document.querySelectorAll('#mesa .alvo').forEach((p) => p !== alvo && p.classList.remove('alvo'));
      if (alvo) alvo.classList.add('alvo');
    }
  });
  function soltar(e, cancelado) {
    if (!arrasto || e.pointerId !== arrasto.pid) return;
    const a = arrasto;
    arrasto = null;
    document.querySelectorAll('#mesa .alvo').forEach((p) => p.classList.remove('alvo'));
    if (a.fantasma) { a.fantasma.remove(); a.el.classList.remove('arrastando'); }
    if (cancelado) return;
    if (!a.fantasma) return escolher(a.id);
    const alvo = pontaEm(e.clientX, e.clientY);
    if (alvo) tentar(a.id, ladoDe(alvo)); else desenhar();
  }
  $('mao').addEventListener('pointerup', (e) => soltar(e, false));
  $('mao').addEventListener('pointercancel', (e) => soltar(e, true));
  $('mao').addEventListener('click', (e) => { const b = e.target.closest('.peca'); if (b && e.detail === 0) escolher(Number(b.dataset.id)); });
  // ponta da mesa debaixo do dedo (com margem, para mãos com pouca precisão)
  function pontaEm(x, y) {
    const alvos = [...document.querySelectorAll('#mesa .encaixe, #mesa .aberta')];
    let melhor = null, menor = Infinity;
    alvos.forEach((a) => {
      const r = a.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < Math.max(r.width, r.height) + 30 && d < menor) { menor = d; melhor = a; }
    });
    return melhor;
  }
  const ladoDe = (el) => el.dataset.lado || (el.classList.contains('en') ? 'esquerda' : 'direita');
  $('mesa').addEventListener('click', (e) => {
    const alvo = e.target.closest('.encaixe, .aberta');
    if (!alvo || !jogo) return;
    if (jogo.selecionada === null) { mallu('aponta', 'Primeiro toque numa das suas peças lá embaixo. 👇'); return; }
    tentar(jogo.selecionada, ladoDe(alvo));
  });

  // ---------- Pausa ----------
  $('btn-pausa').onclick = () => {
    if (!jogo || jogo.acabou) return;
    pararRelogio();
    jogo.pausado = true;
    clearTimeout(timerRobo);
    clearTimeout(timerProx);
    $('pausa').hidden = false;
  };
  $('btn-continuar').onclick = () => {
    $('pausa').hidden = true;
    jogo.pausado = false;
    ligarRelogio();
    if (jogo.pendente) { jogo.pendente = false; proximaVez(); }
    else if (jogo.vez !== 0) timerRobo = setTimeout(() => jogadaColega(jogo.vez), ESPERA_ROBO[jogo.modo]);
  };
  $('btn-terminar').onclick = () => { $('pausa').hidden = true; fimDaPartida(true); };

  // ---------- Fim e relatório ----------
  const NOME_CLASSE = { otimo: 'Ótimo', regular: 'Regular', treinar: 'Precisa treinar mais' };
  const MEDALHA = { ouro: '🥇 Medalha de ouro', prata: '🥈 Medalha de prata', bronze: '🥉 Medalha de bronze' };
  const COR_CLASSE = { otimo: '#2e7d32', regular: '#b45309', treinar: '#c62828' };
  const fmt = (n) => n.toFixed(1).replace('.', ',');
  const vezes = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  function fimDaPartida(interrompida) {
    if (jogo.acabou) return;
    clearTimeout(timerRobo);
    clearTimeout(timerProx);
    pararRelogio();
    jogo.acabou = true;
    jogo.interrompida = !!interrompida;
    const r = calcularRelatorio();
    salvarHistorico(r);
    mostrarRelatorio(r);
  }

  function calcularRelatorio() {
    const js = jogo.jogadas.filter((j) => !j.inicio);   // a 1ª peça da mesa não liga com nada
    const n = js.length;
    const deprimeira = js.filter((j) => !j.erros && !j.dica && !j.esgotado).length;
    const pct = n ? Math.round((deprimeira / n) * 100) : 0;
    const media = n ? js.reduce((s, j) => s + j.tempo, 0) / n : 0;
    const colocacao = jogo.terminados.indexOf(0) + 1 || null;
    let classe = pct >= 80 ? 'otimo' : pct >= 50 ? 'regular' : 'treinar';
    let medalha = null;
    if (jogo.modo === 'desafio' && !jogo.interrompida) {
      medalha = deprimeira >= n - 1 && !jogo.passes.errados && !jogo.esgotados ? 'ouro' : pct >= 60 ? 'prata' : 'bronze';
    }
    // palavras com dificuldade (erros na partida)
    const porPalavra = {};
    jogo.erros.forEach((e) => { (porPalavra[e.precisava] ??= { id: e.precisava, erros: 0, confundiu: [] }).erros++; porPalavra[e.precisava].confundiu.push(e.tentou); });
    js.filter((j) => j.esgotado).forEach((j) => { (porPalavra[j.palavra] ??= { id: j.palavra, erros: 0, confundiu: [] }).erros++; });
    const dificeis = Object.values(porPalavra).sort((a, b) => b.erros - a.erros);

    const pontos = [];
    jogo.erros.forEach((e) => {
      const p = porId[e.precisava], t = porId[e.tentou];
      pontos.push(`Precisava de <b>${esc(p.en)}</b> (${esc(p.pt)}) e tentou <b>${esc(t.en)}</b> (${esc(t.pt)}).`);
    });
    if (jogo.passes.errados) pontos.push(`Tentou passar ${vezes(jogo.passes.errados, 'vez', 'vezes')} tendo uma peça que encaixava (atenção às duas pontas).`);
    if (jogo.esgotados) pontos.push(`O tempo da jogada acabou ${vezes(jogo.esgotados, 'vez', 'vezes')}.`);
    if (jogo.dicas) pontos.push(`Usou dica ${vezes(jogo.dicas, 'vez', 'vezes')}.`);
    const lentas = js.filter((j) => !j.esgotado && j.tempo > 20).map((j) => `<b>${esc(porId[j.palavra].en)}</b> (${fmt(j.tempo)} s)`);
    if (lentas.length) pontos.push(`Demorou para achar: ${lentas.join(', ')}.`);
    if (!pontos.length) pontos.push('Nenhuma confusão nesta partida. Excelente! 🌟');

    return {
      nome, modo: jogo.modo, data: jogo.inicio, cats: jogo.cats, tempo: jogo.tempo,
      jogadas: js, n, deprimeira, pct, media, colocacao, classe, medalha, pontos: jogo.pontos,
      erros: jogo.erros.length, passes: jogo.passes, dicas: jogo.dicas, esgotados: jogo.esgotados,
      dificeis, observacoes: pontos, palavras: jogo.palavras, interrompida: jogo.interrompida,
    };
  }

  function salvarHistorico(r) {
    if (!r.n) return;
    const h = ler(CHAVE_HIST + nome.toLowerCase(), []);
    h.push({ data: r.data.toISOString(), modo: r.modo, pct: r.pct, erros: r.erros, pontos: r.pontos, colocacao: r.colocacao });
    guardar(CHAVE_HIST + nome.toLowerCase(), h.slice(-20));
  }

  let ultimo = null;
  const ORDEM = ['1º', '2º', '3º', '4º'];
  function mostrarRelatorio(r) {
    ultimo = r;
    $('dica-envio').hidden = true;
    mostrar('tela-relatorio');
    const ganhou = r.colocacao === 1;
    $('pose-fim').className = r.interrompida ? 'pose aponta' : ganhou || r.classe === 'otimo' ? 'pulando' : 'pose feliz';
    $('fim-titulo').textContent = r.interrompida ? 'Partida terminada' : ganhou ? `Congratulations, ${nome}! 🎉` : `Well done, ${nome}!`;
    $('fim-resumo').innerHTML = r.interrompida
      ? 'Veja abaixo como foi até aqui.'
      : `O circuito das 28 peças fechou! Você ficou em <b>${ORDEM[r.colocacao - 1] || '-'} lugar</b>${r.medalha ? ` e ganhou a <b>${MEDALHA[r.medalha].slice(3).toLowerCase()}</b> ${MEDALHA[r.medalha].slice(0, 2)}` : ''}.`;
    if (!r.interrompida) { som('fim'); setTimeout(() => falar(ganhou ? `Congratulations, ${nome.toLowerCase()}!` : `Well done, ${nome.toLowerCase()}!`, 'en-US'), 400); }

    $('relatorio-info').textContent = `${r.nome} · modo ${r.modo === 'aprender' ? 'Aprender' : 'Desafio'} · ${r.data.toLocaleDateString('pt-BR')} às ${r.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${r.cats ? ` · categorias ${r.cats.join(', ')}` : ''}`;
    $('selo').className = `selo ${r.classe}`;
    $('selo').innerHTML = r.medalha
      ? `${MEDALHA[r.medalha]}<small>${r.pontos} pontos · ${r.pct}% certas de primeira</small>`
      : `${NOME_CLASSE[r.classe]}<small>${r.pct}% das peças certas de primeira</small>`;
    $('numeros').innerHTML = [
      ['Colocação', r.colocacao ? `${ORDEM[r.colocacao - 1]}` : '-'],
      ['Certas de primeira', `${r.deprimeira}/${r.n}`],
      ['Erros', r.erros],
      ['Passes certos', r.passes.certos],
      ['Passes com peça', r.passes.errados],
      ['Tempo por peça', `${fmt(r.media)} s`],
      ...(r.modo === 'desafio' ? [['Pontos', r.pontos]] : [['Dicas', r.dicas]]),
      ['Tempo total', mmss(r.tempo)],
    ].map(([t, v]) => `<div class="numero"><b>${v}</b>${t}</div>`).join('');
    $('dificuldades').innerHTML = r.observacoes.map((d) => `<li>${d}</li>`).join('');
    $('revisar').innerHTML = r.dificeis.length
      ? r.dificeis.map((d) => { const p = porId[d.id]; return `<div class="cartao-palavra"><b class="en">${esc(p.en)}</b> = ${esc(p.pt)}<small>“${esc(p.exEn)}” — ${esc(p.exPt)}</small></div>`; }).join('')
      : '<p>Nada para revisar desta vez! 🎉</p>';
    $('lista-palavras').innerHTML = r.palavras.map((p) => `<span><b class="en">${esc(p.en)}</b> ${esc(p.pt)}</span>`).join('');
    graficoPecas($('grafico-pecas'), r);
    graficoPalavras($('grafico-palavras'), r);
    const h = ler(CHAVE_HIST + nome.toLowerCase(), []);
    $('evolucao-area').hidden = h.length < 2;
    if (h.length >= 2) graficoEvolucao($('grafico-evolucao'), h);
  }

  // ---------- Gráficos ----------
  const FONTE = '"Source Sans 3", Verdana, sans-serif';
  function eixo(ctx, W, H, m, maxV, passo, sufixo) {
    ctx.font = `22px ${FONTE}`; ctx.fillStyle = '#6B625B'; ctx.strokeStyle = '#EAE1D5'; ctx.lineWidth = 2;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= maxV + 0.001; v += passo) {
      const y = H - m.b - (v / maxV) * (H - m.t - m.b);
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(W - m.r, y); ctx.stroke();
      ctx.fillText(`${Math.round(v)}${sufixo}`, m.l - 10, y);
    }
  }
  function semDados(ctx, W, H, texto) {
    ctx.fillStyle = '#6B625B'; ctx.font = `28px ${FONTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, W / 2, H / 2);
  }
  function graficoPecas(cv, r) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, m = { l: 64, r: 20, t: 30, b: 70 };
    ctx.clearRect(0, 0, W, H);
    if (!r.jogadas.length) return semDados(ctx, W, H, 'Ainda sem peças jogadas.');
    const maxV = Math.max(10, Math.ceil(Math.max(...r.jogadas.map((j) => j.tempo)) + 2));
    eixo(ctx, W, H, m, maxV, maxV > 30 ? 10 : 5, ' s');
    const larg = (W - m.l - m.r) / r.jogadas.length, barra = Math.min(90, larg * 0.6);
    r.jogadas.forEach((j, k) => {
      const x = m.l + larg * k + (larg - barra) / 2, h = (j.tempo / maxV) * (H - m.t - m.b);
      ctx.fillStyle = j.esgotado ? COR_CLASSE.treinar : j.erros || j.dica ? COR_CLASSE.regular : COR_CLASSE.otimo;
      ctx.fillRect(x, H - m.b - h, barra, Math.max(h, 3));
      ctx.fillStyle = '#2B2320'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = `bold 21px ${FONTE}`;
      ctx.fillText(`${fmt(j.tempo)}s`, x + barra / 2, H - m.b - h - 4);
      ctx.textBaseline = 'top'; ctx.fillStyle = '#1E6CBA'; ctx.font = `bold ${r.jogadas.length > 8 ? 17 : 20}px ${FONTE}`;
      ctx.fillText(porId[j.palavra].en, x + barra / 2, H - m.b + 10);
      if (j.erros) { ctx.fillStyle = '#c62828'; ctx.font = `17px ${FONTE}`; ctx.fillText(`✗${j.erros}`, x + barra / 2, H - m.b + 36); }
    });
  }
  function graficoPalavras(cv, r) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, m = { l: 64, r: 20, t: 30, b: 60 };
    ctx.clearRect(0, 0, W, H);
    const itens = r.dificeis.slice(0, 8);
    if (!itens.length) return semDados(ctx, W, H, 'Nenhuma palavra com erro! 🎉');
    const maxV = Math.max(3, Math.max(...itens.map((d) => d.erros)));
    eixo(ctx, W, H, m, maxV, 1, '');
    const larg = (W - m.l - m.r) / itens.length, barra = Math.min(80, larg * 0.6);
    itens.forEach((d, k) => {
      const x = m.l + larg * k + (larg - barra) / 2, h = (d.erros / maxV) * (H - m.t - m.b);
      ctx.fillStyle = '#D12E39'; ctx.fillRect(x, H - m.b - h, barra, h);
      ctx.fillStyle = '#2B2320'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = `bold 21px ${FONTE}`;
      ctx.fillText(`✗${d.erros}`, x + barra / 2, H - m.b - h - 4);
      ctx.textBaseline = 'top'; ctx.fillStyle = '#1E6CBA'; ctx.font = `bold 20px ${FONTE}`;
      ctx.fillText(porId[d.id].en, x + barra / 2, H - m.b + 10);
    });
  }
  function graficoEvolucao(cv, h) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, m = { l: 70, r: 30, t: 34, b: 50 };
    ctx.clearRect(0, 0, W, H);
    eixo(ctx, W, H, m, 100, 25, '%');
    const px = (i) => m.l + (h.length === 1 ? 0 : (i / (h.length - 1)) * (W - m.l - m.r));
    const py = (v) => H - m.b - (v / 100) * (H - m.t - m.b);
    ctx.strokeStyle = '#1E6CBA'; ctx.lineWidth = 4; ctx.beginPath();
    h.forEach((x, i) => (i ? ctx.lineTo(px(i), py(x.pct)) : ctx.moveTo(px(i), py(x.pct)))); ctx.stroke();
    h.forEach((x, i) => {
      ctx.fillStyle = x.modo === 'desafio' ? '#D12E39' : '#1E6CBA';
      ctx.beginPath(); ctx.arc(px(i), py(x.pct), 9, 0, Math.PI * 2); ctx.fill();
      const d = new Date(x.data);
      ctx.fillStyle = '#6B625B'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `17px ${FONTE}`;
      ctx.fillText(`${d.getDate()}/${d.getMonth() + 1}`, px(i), H - m.b + 12);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `19px ${FONTE}`; ctx.fillStyle = '#6B625B';
    ctx.fillText('% de peças certas de primeira · azul = Aprender, vermelho = Desafio', m.l, 4);
  }

  // ---------- PDF e compartilhar ----------
  const limpar = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const semEmoji = (t) => t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();

  function gerarPDF(r) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const L = 15, Wp = 180;
    let y;
    const nova = () => { doc.addPage(); y = 18; };
    const titulo = (t) => { if (y > 262) nova(); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30, 108, 186); doc.text(t, L, y); y += 7; };
    doc.setFillColor(209, 46, 57); doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(`Verbs Domino - Relatório de ${r.nome}`, L, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(`Inglês da Mallu  ·  modo ${r.modo === 'aprender' ? 'Aprender' : 'Desafio'}  ·  ${r.data.toLocaleDateString('pt-BR')} ${r.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, L, 23);
    y = 40;
    const cor = { otimo: [46, 125, 50], regular: [180, 83, 9], treinar: [198, 40, 40] }[r.classe];
    doc.setFillColor(...cor); doc.roundedRect(L, y, Wp, 16, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(r.medalha ? `${semEmoji(MEDALHA[r.medalha])}  ·  ${r.pontos} pontos  ·  ${r.pct}% certas de primeira` : `${NOME_CLASSE[r.classe]}  ·  ${r.pct}% das peças certas de primeira`, L + 5, y + 10.5);
    y += 24;
    doc.setTextColor(43, 35, 32); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(`Colocação: ${r.colocacao ? ORDEM[r.colocacao - 1] : '-'}   Certas de primeira: ${r.deprimeira}/${r.n}   Erros: ${r.erros}   Passes certos: ${r.passes.certos}   Passes com peça: ${r.passes.errados}`, L, y); y += 6;
    doc.text(`Tempo médio por peça: ${fmt(r.media)} s   Tempo total: ${mmss(r.tempo)}   ${r.modo === 'desafio' ? `Tempo esgotado: ${r.esgotados}` : `Dicas: ${r.dicas}`}`, L, y); y += 8;
    const imagem = (cv, t) => {
      const h = (cv.height / cv.width) * Wp;
      if (y + h + 10 > 285) nova();
      titulo(t); y -= 4;
      doc.addImage(cv.toDataURL('image/png'), 'PNG', L, y, Wp, h, undefined, 'FAST');
      y += h + 8;
    };
    imagem($('grafico-pecas'), 'Tempo por peça');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 98, 91);
    doc.text('verde: certa de primeira  ·  laranja: certa depois de errar  ·  vermelho: tempo esgotado', L, y - 5); y += 2;
    imagem($('grafico-palavras'), 'Palavras com mais dificuldade');
    titulo('Confusões e pontos de atenção');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(43, 35, 32);
    r.observacoes.forEach((d) => {
      const linhas = doc.splitTextToSize(`• ${semEmoji(limpar(d))}`, Wp);
      if (y + linhas.length * 5.2 > 285) nova();
      doc.text(linhas, L, y); y += linhas.length * 5.2 + 1;
    });
    y += 3;
    if (r.dificeis.length) {
      titulo('Palavras para revisar');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(43, 35, 32);
      r.dificeis.forEach((d) => {
        const p = porId[d.id];
        const linhas = doc.splitTextToSize(`${p.en} = ${p.pt}  ·  "${p.exEn}" - ${p.exPt}`, Wp);
        if (y + linhas.length * 5.2 > 285) nova();
        doc.text(linhas, L, y); y += linhas.length * 5.2 + 1;
      });
      y += 3;
    }
    titulo('As 28 palavras desta partida');
    doc.setFontSize(10); doc.setTextColor(43, 35, 32);
    r.palavras.forEach((p, i) => {
      const col = i % 2, x = L + col * 92;
      if (col === 0 && y > 285) nova();
      doc.setFont('helvetica', 'bold'); doc.text(p.en, x, y);
      doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(p.pt, 52)[0], x + 36, y);
      if (col === 1) y += 5.2;
    });
    y += 8;
    const h = ler(CHAVE_HIST + nome.toLowerCase(), []);
    if (h.length >= 2) imagem($('grafico-evolucao'), 'Evolução nas últimas partidas');
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i); doc.setFontSize(9); doc.setTextColor(120, 110, 105);
      doc.text('Verbs Domino · Inglês da Mallu (31) 99270-4914  ·  Pedagogia Gamificada · © Marco Nunes', L, 292);
    }
    return doc;
  }
  const nomeArquivo = (r) => `relatorio-domino-${r.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}-${r.data.toISOString().slice(0, 10)}.pdf`;
  $('btn-pdf').onclick = () => { if (ultimo) gerarPDF(ultimo).save(nomeArquivo(ultimo)); };
  $('btn-compartilhar').onclick = async () => {
    if (!ultimo) return;
    const doc = gerarPDF(ultimo);
    const arquivo = new File([doc.output('blob')], nomeArquivo(ultimo), { type: 'application/pdf' });
    const texto = `Oi ${PROFESSORA}, segue o relatório do Verbs Domino de ${ultimo.nome}`;
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo], title: `Relatório de ${ultimo.nome}`, text: texto }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    $('dica-envio').hidden = false;
    $('dica-envio').innerHTML = 'O PDF foi baixado e a conversa da Mallu abriu no WhatsApp. <b>Arraste o PDF para a conversa</b> (ou toque no clipe 📎) e envie.';
    doc.save(nomeArquivo(ultimo));
    window.open(`https://wa.me/${TELEFONE_PRO}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  };
  $('btn-de-novo').onclick = () => preparar(jogo.modo, jogo.cats);
  $('btn-sair').onclick = () => { calar(); telaInicio(false); };

  // ---------- Modo Professor ----------
  let catsProf = ler(CHAVE_CATS, Object.keys(CATEGORIAS));
  function telaProfessor() {
    $('categorias').innerHTML = Object.entries(CATEGORIAS).map(([k, c]) =>
      `<label class="categoria"><input type="checkbox" value="${k}"${catsProf.includes(k) ? ' checked' : ''}> <b>${k}</b> ${esc(c.nome)} <small>(${c.itens.length})</small></label>`).join('');
    atualizarLink();
    // dificuldades somando todos os alunos do aparelho
    const soma = {}, alunos = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(CHAVE_PAL)) {
        const quem = k.slice(CHAVE_PAL.length).toUpperCase();
        Object.entries(ler(k, {})).forEach(([id, s]) => { if (s.erros) { (soma[id] ??= { erros: 0, alunos: [] }).erros += s.erros; soma[id].alunos.push(quem); } });
      }
      if (k.startsWith(CHAVE_HIST)) {
        const h = ler(k, []);
        if (h.length) alunos.push({ nome: k.slice(CHAVE_HIST.length).toUpperCase(), partidas: h.length, ultima: h[h.length - 1] });
      }
    }
    const top = Object.entries(soma).sort((a, b) => b[1].erros - a[1].erros).slice(0, 15);
    $('prof-dificuldades').innerHTML = top.length
      ? `<table class="tabela"><thead><tr><th>Palavra</th><th>Tradução</th><th>Erros</th><th>Alunos</th></tr></thead><tbody>${top.map(([id, s]) => `<tr><td><b class="en">${esc(porId[id].en)}</b></td><td>${esc(porId[id].pt)}</td><td>${s.erros}</td><td>${esc([...new Set(s.alunos)].join(', '))}</td></tr>`).join('')}</tbody></table>`
      : '<p>Ainda não há erros registrados neste aparelho.</p>';
    $('prof-alunos').innerHTML = alunos.length
      ? `<table class="tabela"><thead><tr><th>Aluno</th><th>Partidas</th><th>Última: certas de primeira</th></tr></thead><tbody>${alunos.map((a) => `<tr><td>${esc(a.nome)}</td><td>${a.partidas}</td><td>${a.ultima.pct}%</td></tr>`).join('')}</tbody></table>`
      : '<p>Nenhuma partida registrada ainda.</p>';
    mostrar('tela-professor');
  }
  function catsMarcadas() { return [...$('categorias').querySelectorAll('input:checked')].map((i) => i.value); }
  function atualizarLink() {
    catsProf = catsMarcadas();
    guardar(CHAVE_CATS, catsProf);
    $('erro-cat').textContent = catsProf.length ? '' : 'Marque pelo menos uma categoria.';
    const todas = catsProf.length === Object.keys(CATEGORIAS).length;
    $('link-turma').textContent = catsProf.length ? `${location.origin}${location.pathname}${todas ? '' : `?cat=${catsProf.join('')}`}` : '';
  }
  $('categorias').addEventListener('change', atualizarLink);
  $('btn-todas').onclick = () => { $('categorias').querySelectorAll('input').forEach((i) => { i.checked = true; }); atualizarLink(); };
  $('btn-copiar').onclick = async () => {
    if (!catsProf.length) return;
    try { await navigator.clipboard.writeText($('link-turma').textContent); $('btn-copiar').textContent = '✅ Link copiado!'; }
    catch (e) { $('btn-copiar').textContent = '📋 Copie o link abaixo'; }
    setTimeout(() => { $('btn-copiar').textContent = '🔗 Copiar link para a turma'; }, 2500);
  };
  const jogarProf = (modo) => { if (!catsProf.length) return; preparar(modo, catsProf.length === Object.keys(CATEGORIAS).length ? null : catsProf); };
  $('btn-prof-aprender').onclick = () => jogarProf('aprender');
  $('btn-prof-desafio').onclick = () => jogarProf('desafio');
  $('btn-professor').onclick = telaProfessor;
  $('btn-prof-voltar').onclick = () => telaInicio(false);

  // ---------- Instalar como app ----------
  let pedidoInstalacao = null;
  const rodandoComoApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalacao = e; $('btn-instalar').hidden = false; });
  window.addEventListener('appinstalled', () => { pedidoInstalacao = null; $('btn-instalar').hidden = true; });
  if (!rodandoComoApp()) $('btn-instalar').hidden = false;
  $('btn-instalar').onclick = async () => {
    if (pedidoInstalacao) {
      pedidoInstalacao.prompt();
      const { outcome } = await pedidoInstalacao.userChoice;
      pedidoInstalacao = null;
      if (outcome === 'accepted') $('btn-instalar').hidden = true;
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const fim = 'Abra pelo <b>ícone do jogo</b> na tela do celular.';
    const passos = ios
      ? ['Toque em <b>Compartilhar</b> (quadrado com a seta ⬆).', 'Escolha <b>Adicionar à Tela de Início</b>.', 'Toque em <b>Adicionar</b>.', fim]
      : ['Toque em <b>⋮</b> no canto de cima do navegador.', 'Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).', fim];
    if (/FBAN|FBAV|Instagram|WhatsApp/i.test(ua)) passos.unshift('⚠ Abra este link no navegador (⋮ → Abrir no navegador; no iPhone, no <b>Safari</b>).');
    $('passos-instalar').innerHTML = passos.map((p) => `<li>${p}</li>`).join('');
    mostrar('tela-instalar');
  };
  $('btn-fechar-instalar').onclick = () => telaInicio(false);

  if (nome) telaInicio(false); else telaNome();

  // atalhos para testes no console
  window.__domino = { get jogo() { return jogo; }, tentar: (id, lado) => tentar(id, lado), escolher, fim: () => fimDaPartida(true), passo: () => $('btn-passo').click() };
})();
