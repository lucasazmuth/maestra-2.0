// As palavras do chat da Nyta.
//
// Moram no core porque a web e o app precisam dizer a MESMA coisa. Já aconteceu de as duas
// superfícies divergirem em copy do diagnóstico, e a correção foi trazer o texto para cá; este
// nasce assim para não repetir o percurso.

/**
 * A saudação da conversa em branco.
 *
 * Ela substitui a apresentação de sete linhas que a Nyta dava a cada conversa nova ("Oi! Eu sou
 * a Nyta, sua assistente estratégica..."). Aquilo ocupava a primeira tela inteira e ninguém lia
 * duas vezes: quem abre o chat pela décima vez já sabe quem é a Nyta.
 *
 * Quem é cumprimentado é a PESSOA, e não o perfil, por duas razões. A primeira é gramatical:
 * "ajudo com Madhá" pede artigo, e o artigo depende do nome — "com a Madhá", "com o Dudu", "com
 * Anavitória" —, o que não se resolve com uma interpolação. A segunda é que o perfil já está
 * dito na faixa do topo, e repeti-lo aqui não acrescenta.
 *
 * Só o primeiro nome: o cadastro guarda o nome inteiro, e "Em que eu ajudo hoje, Lucas Andrade
 * Santos?" não é como ninguém cumprimenta ninguém.
 *
 * E com a inicial maiúscula, porque o campo do cadastro é livre e muita gente digita tudo em
 * caixa baixa. "Em que eu ajudo hoje, lucas?" lê como defeito da tela, e não como o nome que a
 * pessoa escreveu. Só a PRIMEIRA letra é tocada: o resto fica como veio, senão "McCartney"
 * viraria "Mccartney" e "MC Bin" viraria "Mc Bin".
 */
export const saudacaoDaNyta = (nomeDeQuemEntrou?: string | null): string => {
  const primeiro = (nomeDeQuemEntrou ?? '').trim().split(/\s+/)[0];
  if (!primeiro) return 'Em que eu ajudo hoje?';
  return `Em que eu ajudo hoje, ${primeiro[0].toUpperCase()}${primeiro.slice(1)}?`;
};

/** O convite dentro do campo. Curto: a saudação acima já fez as honras. */
export const CONVITE_DO_CAMPO = 'Pergunte algo à Nyta';

/**
 * A ressalva embaixo do campo.
 *
 * Fica, e fica miúda: é obrigação de quem entrega texto de modelo, e não um rótulo do campo.
 * Ela dividia a linha com um contador "0/1000" que agora só aparece perto do limite.
 */
export const RESSALVA_DA_NYTA = 'A Nyta pode cometer erros. Confira informações importantes.';
