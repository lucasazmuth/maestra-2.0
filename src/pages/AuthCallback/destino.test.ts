import fs from 'fs';
import path from 'path';

// PARA ONDE O /auth/callback MANDA DEPOIS DE ESTABELECER A SESSÃO.
//
// O repasse do app (edge `checkout-handoff`) traz `?next=/assinatura`: quem saiu do aplicativo
// para pagar precisa cair NO CHECKOUT, não na lista de perfis.
//
// O risco desse parâmetro é virar redirecionador aberto: `next=https://outro.site` ou
// `next=//outro.site` levaria a pessoa para fora COM a sessão recém-criada. Por isso só caminho
// relativo passa, e `//` (que o navegador lê como outro host) é recusado junto.
//
// O teste é sobre a FONTE porque a decisão vive dentro de um efeito que faz `setSession` e
// navega; montar isso em jsdom custaria mais do que entrega, e o que precisa ser garantido é a
// condição — que some fácil numa refatoração.

const fonte = fs.readFileSync(path.join(__dirname, 'index.tsx'), 'utf8');

describe('o destino do /auth/callback', () => {
  it('lê o `next` que o repasse do app manda', () => {
    expect(fonte).toContain("query.get('next')");
  });

  it('só aceita caminho relativo, e recusa `//`', () => {
    expect(fonte).toContain("startsWith('/')");
    expect(fonte).toContain("!proximo.startsWith('//')");
  });

  it('sem `next`, continua indo para os perfis', () => {
    expect(fonte).toContain(": '/artists'");
  });
});
