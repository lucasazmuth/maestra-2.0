import { ambiente } from '@maestra/core/nucleo/ambiente';

/**
 * A tela de apresentação já foi vista NESTE aparelho?
 *
 * Uma vez por instalação, e não a cada saída da conta: quem já entrou uma vez sabe o que o app
 * faz, e repetir a apresentação toda vez que a sessão expira transforma boas-vindas em pedágio.
 *
 * A chave mora no mesmo armazenamento que o núcleo usa (MMKV, no aparelho), então ela sobrevive
 * ao fechamento do app e some quando alguém desinstala — que é exatamente o tempo de vida certo
 * para "esta pessoa já conhece o produto".
 */
const CHAVE = 'maestra.intro.vista';

export const introJaVista = (): boolean => ambiente().armazenamento.ler(CHAVE) === 'sim';

export const marcarIntroComoVista = (): void => {
  ambiente().armazenamento.gravar(CHAVE, 'sim');
};
