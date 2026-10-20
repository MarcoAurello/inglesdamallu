# Let’s play with Mallu · Inglês da Mallu (dominó de palavras)

Dominó de palavras em inglês e português (HTML5, funciona como app/PWA, offline), feito para a professora
**Mallu** ([inglesdamallu.com.br](https://inglesdamallu.com.br/)). Regras completas em `referencias/regras.txt`.
Mesmo padrão do jogoABC: HTML/CSS/JS puros, relatório com PDF e Dockerfile nginx.

## Como funciona
- Banco de **200 palavras e expressões** (10 categorias) em `palavras.js`, cada uma com tradução e **frase de exemplo**.
- A cada partida o jogo sorteia **28 palavras distintas**, embaralha e monta um **circuito**: a peça k tem o inglês da
  palavra k e o português da palavra k+1; a última volta para a primeira. As 28 conexões são **conferidas antes de começar**
  (tela de carregamento com a Mallu correndo).
- Nunca entram juntas duas palavras que dividem uma tradução (ex.: someone/somebody = alguém, did/made = fez),
  então **cada ponta tem uma só peça que encaixa**.
- Seleção inteligente: no máximo ~1/3 da partida de uma categoria (nunca só verbos ou só preposições), prioridade para
  palavras ainda não vistas e para as que o aluno **errou**; as que ele já domina aparecem pouco.
- Mesa com **4 jogadores** (você, Ben, Kate e Sam), **7 peças cada**. Você começa com qualquer peça. Na sua vez, toque numa peça sua:
  as duas pontas da mesa **piscam**; toque na ponta onde ela encaixa (ou arraste a peça até lá). Sem peça que encaixa: **✋ PASSO**. Quem fica sem peças "bate"; a partida termina quando o
  circuito das 28 peças fecha.
- **O erro vira aprendizado**: ao errar, a Mallu mostra o significado e um exemplo da palavra escolhida e o que a ponta pedia
  (ex.: "WHERE = onde · Where are you?... Aqui precisa da palavra em inglês para foi / foram"). Passar tendo peça também é avisado.
- Toque numa peça para **ouvir a palavra em inglês** (voz do aparelho, en-US).
- A primeira peça fica **no meio da mesa** e a corrente cresce para os dois lados.
- Os colegas jogam devagar e **cada jogada aparece num aviso** no alto da mesa ("Ben conectou went em foi / foram", com exemplo
  no Aprender). Na **sua vez**, as peças do meio apagam e só as **pontas** ficam em destaque; a Mallu diz quais são as palavras das pontas.
  O ritmo fica em `RITMO` no `jogo.js`.

## Modos
- **Aprender**: sem pressa, com tradução, frase de exemplo a cada jogada e dica (depois de 2 erros a peça certa brilha).
- **Dica da Mallu**: a fala da Mallu fica num botão (com um **!** quando há mensagem nova), para não cobrir a mesa. Ela só abre sozinha
  nos avisos importantes (erro, passe com peça, tempo esgotado) e fecha em 6 s ou com um toque. No Aprender, sem mensagem nova,
  o botão mostra a dica da jogada.
- **Desafio**: 30 s por jogada (barra), pontos (+10 de primeira, +5 se em até 8 s, +3 depois de errar, +2 por passe certo)
  e **medalhas** ao fechar as 28 peças (ouro: quase tudo de primeira, sem passe errado nem tempo esgotado; prata: 60%+; bronze).
- **Professor**: escolhe as categorias, copia um **link para a turma** (`?cat=ABF`), vê as palavras mais erradas e os alunos do aparelho.

## Relatório
Selo/medalha, colocação, certas de primeira, erros, passes, tempo por peça (gráfico), palavras com mais dificuldade (gráfico),
confusões ("precisava de X e tentou Y"), palavras para revisar com exemplo, as 28 palavras da partida e evolução.
**Enviar para a Mallu** compartilha o PDF (celular) ou baixa e abre o WhatsApp (31) 99270-4914 (`TELEFONE_PRO` no `jogo.js`).

## Arquivos
- `palavras.js`: o banco (categorias A a J). `domino.js`: seleção, circuito, validação e regras (roda também no Node).
- `jogo.js`: telas, jogadas, colegas, relatório, PDF e Professor. `musica.js`, `vendor/jspdf.umd.min.js`.
- `assets/mallu/`: retrato e sprites da Mallu, recortados de `referencias/sprites.jpg` por `ferramentas/sprites.py`.

## Testar no computador
```
python -m http.server 8138 --directory C:\dev\pedagogia
```
e abrir http://localhost:8138/domino/

## Atualizar
Ao mudar arquivos, aumente `VERSAO` no `service-worker.js` e o `?v=` no `index.html`.

## Publicar na VPS (Dokploy)
O `Dockerfile` serve o jogo em `/domino/`. No Dokploy: Build Type **Dockerfile**, path `/domino`, **Strip Path desligado**, porta **80**.

© Marco Nunes — Pedagogia Gamificada
