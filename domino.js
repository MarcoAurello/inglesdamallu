/* Regras do Verbs Domino (referencias/regras.txt):
   - sorteia 28 palavras distintas do banco de 200 (equilibradas entre categorias, com peso para as que o aluno errou);
   - encadeamento circular: a peça k tem o INGLÊS da palavra k e o PORTUGUÊS da palavra k+1 (a última volta para a primeira);
   - na mesa, a ponta em português liga com a peça que começa com a palavra em inglês equivalente;
   - 4 jogadores com 7 peças cada; quem não tem peça que encaixa, passa.
   Como as traduções da partida nunca se repetem, cada ponta tem UMA só peça que encaixa. */
const Domino = (() => {
  const PECAS = 28;
  const POR_JOGADOR = 7;

  // "qual / quais" -> ["qual", "quais"]; tira o que está entre parênteses e os acentos para comparar
  const normal = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').trim();
  const sentidos = (pt) => pt.split('/').map(normal).filter(Boolean);

  // duas palavras não podem estar na mesma partida se dividem um sentido em português (ou são a mesma em inglês)
  function conflitam(a, b) {
    if (normal(a.en) === normal(b.en)) return true;
    const sa = sentidos(a.pt), sb = sentidos(b.pt);
    return sa.some((x) => sb.includes(x));
  }

  const embaralhar = (lista) => {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  /* Seleção inteligente.
     historico: { [id]: { vistas, erros, acertos } } do aluno.
     cats: categorias permitidas (modo Professor) ou null para todas. */
  function selecionar(palavras, historico = {}, cats = null) {
    let base = palavras.filter((p) => !cats || cats.includes(p.cat));
    let aviso = null;
    const catsUsadas = [...new Set(base.map((p) => p.cat))];
    const peso = (p) => {
      const h = historico[p.id];
      if (!h) return 2;                                     // ainda não vista: prioridade
      const dominio = h.acertos - h.erros * 2;
      if (h.erros > 0 && dominio < 3) return 3 + Math.min(h.erros, 4);   // errou e ainda não domina: volta
      if (dominio >= 4) return 0.4;                         // já domina: aparece pouco
      return 1;
    };
    // sorteio ponderado (cada palavra ganha uma "chave"; as maiores saem primeiro)
    const ordenadas = (lista) => lista.map((p) => ({ p, k: Math.pow(Math.random(), 1 / peso(p)) })).sort((a, b) => b.k - a.k).map((x) => x.p);
    const tentar = (lista, limitePorCat) => {
      const escolha = [], porCat = {};
      for (const p of ordenadas(lista)) {
        if (escolha.length === PECAS) break;
        if ((porCat[p.cat] || 0) >= limitePorCat) continue;
        if (escolha.some((q) => conflitam(p, q))) continue;
        escolha.push(p);
        porCat[p.cat] = (porCat[p.cat] || 0) + 1;
      }
      return escolha;
    };
    // equilibrado: no máximo ~1/3 da partida de uma categoria só (nunca só verbos ou só preposições)
    let limite = Math.max(4, Math.ceil(PECAS / Math.max(1, catsUsadas.length)) + 1);
    let escolha = [];
    for (let t = 0; t < 30 && escolha.length < PECAS; t++) {
      escolha = tentar(base, limite);
      if (t > 10) limite = PECAS;   // poucas categorias escolhidas: libera o limite
    }
    if (escolha.length < PECAS && cats) {
      // categorias da turma não dão 28 palavras sem traduções repetidas: completa com outras
      aviso = 'As categorias escolhidas não têm 28 palavras sem traduções parecidas; completamos com outras categorias.';
      const resto = palavras.filter((p) => !escolha.includes(p) && !escolha.some((q) => conflitam(p, q)));
      for (const p of ordenadas(resto)) {
        if (escolha.length === PECAS) break;
        if (!escolha.some((q) => conflitam(p, q))) escolha.push(p);
      }
    }
    return { palavras: embaralhar(escolha), aviso };
  }

  // monta o circuito: peça k = [inglês da palavra k | português da palavra k+1]
  function montarCircuito(palavras) {
    return palavras.map((p, k) => ({ id: k, en: p, pt: palavras[(k + 1) % palavras.length] }));
  }

  // confere as 28 conexões antes de começar
  function validar(pecas) {
    const erros = [];
    if (pecas.length !== PECAS) erros.push(`são ${pecas.length} peças, deveriam ser ${PECAS}`);
    const ids = new Set(pecas.map((p) => p.en.id));
    if (ids.size !== pecas.length) erros.push('há palavras repetidas');
    pecas.forEach((p, k) => {
      const prox = pecas[(k + 1) % pecas.length];
      if (p.pt.id !== prox.en.id) erros.push(`a peça ${k + 1} não liga com a ${k + 2}`);
      // a ponta em português só pode encaixar numa peça
      const encaixes = pecas.filter((q) => sentidos(q.en.pt).some((s) => sentidos(p.pt.pt).includes(s)));
      if (encaixes.length !== 1) erros.push(`a tradução "${p.pt.pt}" encaixa em ${encaixes.length} peças`);
    });
    return erros;
  }

  function distribuir(pecas, jogadores = 4) {
    const mao = Array.from({ length: jogadores }, () => []);
    embaralhar(pecas).forEach((p, i) => mao[i % jogadores].push(p));
    return mao;
  }

  /* Mesa: lista de peças na ordem (da ponta esquerda para a direita).
     Ponta esquerda = palavra em INGLÊS da primeira peça (precisa da peça com essa tradução no lado direito).
     Ponta direita = tradução em PORTUGUÊS da última peça (precisa da peça que começa com essa palavra em inglês). */
  function encaixe(mesa, peca) {
    if (!mesa.length) return 'qualquer';
    const lados = [];
    if (peca.pt.id === mesa[0].en.id) lados.push('esquerda');
    if (peca.en.id === mesa[mesa.length - 1].pt.id) lados.push('direita');
    return lados;   // [] = não encaixa; as duas = última peça, fecha o circuito
  }
  const encaixaEm = (mesa, peca, lado) => {
    const e = encaixe(mesa, peca);
    return e === 'qualquer' || e.includes(lado);
  };
  const jogaveis = (mesa, mao) => mao.filter((p) => { const e = encaixe(mesa, p); return e === 'qualquer' || e.length > 0; });

  // a peça que a ponta pede (está com alguém)
  function pecaQuePede(todas, mesa, lado) {
    if (!mesa.length) return null;
    return lado === 'esquerda'
      ? todas.find((p) => p.pt.id === mesa[0].en.id)
      : todas.find((p) => p.en.id === mesa[mesa.length - 1].pt.id);
  }

  return { PECAS, POR_JOGADOR, normal, sentidos, conflitam, selecionar, montarCircuito, validar, distribuir, encaixe, encaixaEm, jogaveis, pecaQuePede, embaralhar };
})();
if (typeof module !== 'undefined') module.exports = Domino;
