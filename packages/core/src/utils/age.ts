// Idade a partir de uma data ISO (AAAA-MM-DD).
//
// Espelha a lógica da edge function `account-consent`, mas serve só para dar retorno imediato na
// tela: quem decide se a conta passa é sempre o servidor, porque qualquer coisa validada aqui é
// contornável pelo DevTools. Mantenha os dois lados iguais ao mexer.
export const IDADE_MINIMA = 18;

/** Anos completos, ou null se a data for malformada ou não existir no calendário. */
export const idadeEmAnos = (iso: string, hoje: Date = new Date()): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);

  // Date.UTC em vez de `new Date('2008-08-15')` lido com getters locais: no fuso do Brasil a data
  // recuaria um dia, e quem faz aniversário hoje seria barrado por 24 horas.
  const nasc = new Date(Date.UTC(ano, mes - 1, dia));
  if (Number.isNaN(nasc.getTime())) return null;
  // O construtor remonta datas impossíveis (31/02 vira 03/03). Comparar de volta rejeita isso.
  if (nasc.getUTCFullYear() !== ano || nasc.getUTCMonth() !== mes - 1 || nasc.getUTCDate() !== dia) return null;

  const hy = hoje.getUTCFullYear();
  const hm = hoje.getUTCMonth() + 1;
  const hd = hoje.getUTCDate();
  let idade = hy - ano;
  const jaFezAniversario = hm > mes || (hm === mes && hd >= dia);
  if (!jaFezAniversario) idade -= 1;
  return idade;
};

export const ehMaiorDeIdade = (iso: string, hoje?: Date): boolean => {
  const idade = idadeEmAnos(iso, hoje);
  return idade !== null && idade >= IDADE_MINIMA;
};
