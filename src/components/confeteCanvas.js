// O confete das telas de sucesso de pagamento, em JavaScript puro.
//
// Ele é plano — sem TypeScript, sem React, sem import — porque roda em DOIS lugares: no
// navegador, chamado pelo `SuccessConfetti`, e DENTRO de um WebView no app nativo, onde o
// arquivo entra embutido na página (`npm run confete:sync`, em apps/mobile). É o mesmo desenho
// nas duas superfícies porque é o mesmo código, e não um parecido escrito duas vezes.
//
// `src/__tests__/copiaDoConfete.test.ts` compara o que o app embute com este arquivo: uma
// mudança aqui que não passe pelo script quebra o teste, em vez de deixar as duas telas
// comemorando de jeitos diferentes.

// Cores de celebração — base na marca (magenta/roxo) + acentos quentes pra leitura no escuro.
var CONFETE_CORES = ['#9A4FD1', '#C97EF3', '#ffffff', '#ffd54a', '#5b8def', '#ff7ac6'];
var CONFETE_GRAVIDADE = 0.16;
var CONFETE_ARRASTO = 0.992;
/** Quanto tempo o chuvisco continua caindo depois do estouro inicial. */
var CONFETE_DURACAO = 2600;
/** O estouro de abertura, e o teto de peças vivas ao mesmo tempo. */
var CONFETE_ESTOURO = 200;
var CONFETE_TETO = 700;

/**
 * Desenha o confete num canvas e para sozinho.
 *
 * `canvas` precisa ocupar a tela toda; `largura`/`altura` são as da viewport. Devolve uma
 * função que cancela a animação (a limpeza do React, ou o fim da tela).
 */
function desenharConfete(canvas, opcoes) {
  var config = opcoes || {};
  var duracao = config.durationMs || CONFETE_DURACAO;
  var ctx = canvas.getContext('2d');
  if (!ctx) return function () {};

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = window.innerWidth;
  var H = window.innerHeight;
  var resize = function () {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  var pieces = [];
  var spawn = function (n, fromBurst) {
    for (var i = 0; i < n; i++) {
      if (fromBurst) {
        // Estouro inicial a partir do topo-centro, em leque.
        var angle = (-Math.PI / 2) + (Math.random() - 0.5) * 1.6;
        var speed = 6 + Math.random() * 7;
        pieces.push({
          x: W / 2 + (Math.random() - 0.5) * 120,
          y: H * 0.32,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.3,
          size: 6 + Math.random() * 6,
          color: CONFETE_CORES[(Math.random() * CONFETE_CORES.length) | 0],
          shape: Math.random() < 0.5 ? 0 : 1,
        });
      } else {
        // Chuvisco contínuo caindo do topo (largura toda).
        pieces.push({
          x: Math.random() * W,
          y: -20,
          vx: (Math.random() - 0.5) * 2,
          vy: 2 + Math.random() * 3,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.25,
          size: 5 + Math.random() * 6,
          color: CONFETE_CORES[(Math.random() * CONFETE_CORES.length) | 0],
          shape: Math.random() < 0.5 ? 0 : 1,
        });
      }
    }
  };

  spawn(CONFETE_ESTOURO, true); // estouro de abertura

  var start = Date.now();
  var raf = 0;
  var vivo = true;

  var frame = function () {
    if (!vivo) return;
    var elapsed = Date.now() - start;
    // Emite chuvisco enquanto dentro da duração.
    if (elapsed < duracao && pieces.length < CONFETE_TETO) spawn(6, false);

    ctx.clearRect(0, 0, W, H);
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
      p.vy += CONFETE_GRAVIDADE;
      p.vx *= CONFETE_ARRASTO;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;

      if (p.y > H + 30) {
        pieces.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 0) {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Some suavemente perto do fim, e encerra quando tudo caiu.
    if (elapsed > duracao) {
      canvas.style.opacity = String(Math.max(0, 1 - (elapsed - duracao) / 800));
    }
    if (elapsed > duracao + 800 || (elapsed > duracao && pieces.length === 0)) {
      ctx.clearRect(0, 0, W, H);
      return; // fim
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return function () {
    vivo = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}

// O arquivo é embutido INTEIRO na página do WebView, onde `export` seria erro de sintaxe. Com
// `module`, quem importa (webpack, jest) recebe a função, e no WebView a linha não faz nada —
// assim o que o app embute é byte a byte o que a web usa.
if (typeof module !== 'undefined') module.exports = { desenharConfete };
