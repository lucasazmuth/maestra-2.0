import { Capacitor } from '@capacitor/core';

/**
 * True quando o codigo roda dentro do app iOS/Android empacotado, e nao no navegador.
 *
 * A mesma base de codigo serve as duas superficies, mas elas nao sao a mesma coisa: no app
 * empacotado o cache e o ciclo de atualizacao pertencem ao sistema, o push e do sistema
 * operacional, e a cobranca precisa ser a da loja. Cada um desses pontos consulta esta funcao em
 * vez de tentar adivinhar pelo user agent.
 */
export const rodandoNativo = (): boolean => Capacitor.isNativePlatform();

/** 'ios' | 'android' | 'web'. */
export const plataforma = (): string => Capacitor.getPlatform();
