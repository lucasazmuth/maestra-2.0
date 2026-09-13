// O ANDAMENTO E O TOM, enquanto se escrevem.
//
// Os dois campos vivem na barra de controlos do editor, nas duas superfícies. O que eles aceitam
// é a mesma decisão nos dois sítios — e é por isso que mora aqui: a web filtra no `onChange` e o
// aplicativo no `onChangeText`, e duas cópias da mesma expressão regular divergem no primeiro
// ajuste.
//
// ⚠️ FILTRAM ENQUANTO SE ESCREVE, e não validam no fim. A diferença importa: um campo que aceita
// tudo e recusa ao gravar deixa a pessoa escrever "128bpm", sair da tela e descobrir mais tarde
// que nada foi salvo. Filtrar na tecla faz o campo ensinar o que ele é, sem uma mensagem.

/**
 * O que fica do que se escreveu no campo do andamento: só algarismos.
 *
 * No telemóvel o teclado numérico já ajuda, mas não decide — há teclados que trazem símbolos ao
 * lado dos números, e colar de outro sítio passa por cima de qualquer teclado.
 */
export const soOAndamento = (texto: string): string => texto.replace(/[^0-9]/g, '');

/**
 * O que fica do que se escreveu no campo do tom: letras, e os dois sinais que um tom leva.
 *
 * ⚠️ O SUSTENIDO E O BEMOL NÃO SÃO PONTUAÇÃO. Um filtro de "só letras" apaga o `#` de `C#m` e
 * deixa a pessoa a lutar com o campo sem perceber porquê. O bemol escreve-se `b`, que já é letra;
 * o `♯`/`♭` de verdade entra por teclado de música e vale o mesmo.
 */
export const soOTom = (texto: string): string => texto.replace(/[^A-Za-z#♯♭]/g, '');
