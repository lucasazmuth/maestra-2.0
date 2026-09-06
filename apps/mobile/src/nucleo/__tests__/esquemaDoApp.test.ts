import fs from 'fs';
import path from 'path';

import { ESQUEMA, enderecoDeRetorno } from '@/nucleo/entrar';

// O ESQUEMA DE DEEP LINK, ESCRITO EM DOIS LUGARES.
//
// Ele mora no `app.json` (é o que registra o `maestra://` no aparelho) e no código, que monta o
// endereço de retorno do OAuth. Não dá para o código ler o `app.json` em tempo de execução sem
// arrastar o `expo-constants` para dentro de uma função que roda antes de tudo — então os dois
// ficam escritos, e este teste é o que garante que continuam iguais.
//
// Se divergirem, o Google leva a pessoa para um endereço que o aparelho não conhece, e ela nunca
// volta para o app. O erro não aparece em lugar nenhum: o navegador simplesmente fica aberto.

describe('o esquema do app', () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app.json'), 'utf8'),
  ) as { expo: { scheme: string } };

  it('é o mesmo do app.json', () => {
    expect(ESQUEMA).toBe(appJson.expo.scheme);
  });

  // O `Linking.createURL` costura o host do ambiente no meio da URL, e num build de
  // desenvolvimento devolve `maestra://192.168.0.10:8082/auth/callback` — um endereço que nunca
  // vai estar na lista de Redirect URLs do Supabase.
  it('o retorno do OAuth não carrega host nenhum', () => {
    expect(enderecoDeRetorno()).toBe('maestra://auth/callback');
  });
});
