import { mostrarBarraDoConvite } from '@/casca/diagnostico/Relatorio';

// A barra fixa do rodapé, com o convite para o planejamento.
//
// A web decide isso com dois `IntersectionObserver`; aqui é aritmética sobre `onLayout` e
// `onScroll`. Este arquivo guarda a REGRA, que é a parte que se perde numa refatoração — a
// medida em si o aparelho fornece.

/** Uma tela de 800 de altura, com o cartão do perfil terminando em 600 e o convite em 4000. */
const tela = { fimDoPerfil: 600, inicioDaChamada: 4000, alturaVisivel: 800 };

describe('a barra do convite', () => {
  // Quem acabou de ver a própria fase ainda está no "uau": pedir a decisão ali atropela a
  // leitura que a tela inteira existe para entregar.
  it('fica escondida enquanto o cartão do perfil está na tela', () => {
    expect(mostrarBarraDoConvite({ ...tela, rolagemY: 0 })).toBe(false);
    expect(mostrarBarraDoConvite({ ...tela, rolagemY: 600 })).toBe(false);
  });

  it('aparece depois que o cartão do perfil sai por cima', () => {
    expect(mostrarBarraDoConvite({ ...tela, rolagemY: 900 })).toBe(true);
  });

  // Dois botões dizendo a mesma coisa ao mesmo tempo transformam uma chamada em ruído.
  it('some quando o convite de verdade entra em cena', () => {
    // 3300 + 800 = 4100, que passa dos 4000 + 60 de folga.
    expect(mostrarBarraDoConvite({ ...tela, rolagemY: 3300 })).toBe(false);
    // E o limite exato ainda NÃO conta: a folga é para o convite entrar de fato, não encostar.
    expect(mostrarBarraDoConvite({ ...tela, rolagemY: 3260 })).toBe(true);
  });

  it('continua visível enquanto o convite ainda não assomou', () => {
    // 3100 + 800 = 3900: o convite ainda está abaixo da borda de baixo.
    expect(mostrarBarraDoConvite({ ...tela, rolagemY: 3100 })).toBe(true);
  });

  // Uma barra que aparece antes de a pessoa ler qualquer coisa é o que esta regra evita.
  it('sem medida do perfil, não aparece', () => {
    expect(mostrarBarraDoConvite({ rolagemY: 9999, alturaVisivel: 800 })).toBe(false);
  });

  // O convite só existe onde há o que oferecer; sem ele, a barra segue valendo depois do perfil.
  it('sem convite na página, segue visível depois do perfil', () => {
    expect(mostrarBarraDoConvite({
      fimDoPerfil: 600, rolagemY: 900, alturaVisivel: 800,
    })).toBe(true);
  });
});
