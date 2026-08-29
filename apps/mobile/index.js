// A entrada do app.
//
// Existe por causa de UMA ordem: a porta de ambiente do núcleo (onde a sessão é guardada)
// precisa estar registrada antes que qualquer coisa a consulte — e quem consulta primeiro é o
// `supabase-js`, que ao ser criado já dispara a recuperação da sessão, ainda durante a
// avaliação dos imports.
//
// Registrar no layout raiz não bastava: em ES modules os imports são avaliados ANTES do corpo do
// módulo, então `store`/`supabase` já tinham lido — do depósito em memória, e não do MMKV. O
// app abria logado assim mesmo, mas por corrida: a leitura seguinte já pegava o depósito certo.
//
// O idioma entra junto: o dayjs nasce em inglês, e a agenda mostra o mês por extenso.
//
// `src/nucleo/__tests__/ordemDoBoot.test.ts` guarda esta ordem.
import './src/nucleo/ambienteApp';
import './src/nucleo/idioma';

import 'expo-router/entry';
