import { COR, COR_AGENDA } from '@maestra/core/constants/design';

// A Agenda é CLARA.
//
// Este arquivo já testou o contrário. A folha tem um `.agenda-reference-page` com
// `background: #0d2146 !important`, e eu o tomei como vencedor — mas a página real leva as duas
// classes (`calendar-page agenda-reference-page`), e a de `.calendar-page` ganha. Dois
// `!important` não se resolvem lendo o arquivo; só o navegador diz quem vence.
//
// Por isso este teste não lê CSS: ele guarda a CONCLUSÃO que veio do DOM em execução, para que
// uma nova leitura apressada da folha não reintroduza a agenda escura.

describe('cromo da agenda', () => {
  it('a agenda usa o mesmo fundo claro do resto do app', () => {
    expect(COR_AGENDA.fundo).toBe(COR.fundo);
  });

  it('o texto é o mesmo azul-acinzentado dos outros módulos', () => {
    expect(COR_AGENDA.texto).toBe('#52668d');
  });

  // A cor que NÃO pode voltar.
  it('nada na agenda é o azul-noite da folha de referência', () => {
    expect(Object.values(COR_AGENDA)).not.toContain('#0d2146');
  });
});
