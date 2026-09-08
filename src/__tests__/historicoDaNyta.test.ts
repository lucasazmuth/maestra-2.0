import reducer, { addMessage, prependMessages } from '@maestra/core/store/slices/nytaChat';
import type { NytaChatMessage, NytaChatState } from '@maestra/core/store/slices/nytaChat';

// "Uma mensagem, um id" — a regra que faltava no `prependMessages`.
//
// A carga do histórico pode rodar duas vezes (dois efeitos, uma reconexão, um remount), e
// prepender cego punha a conversa inteira em dobro no store. O React reclamava no console
// ("Encountered two children with the same key") e escondia metade, então o sintoma visível era
// só o aviso — nada na tela dizia que o estado estava errado.
//
// Não é hipótese: `src/index.tsx` desligou o StrictMode citando duplicatas como motivo.

const msg = (id: string, content = 'oi'): NytaChatMessage => ({
  id,
  role: 'assistant',
  content,
  createdAt: '2026-09-08T00:00:00Z',
  status: 'sent',
});

const comMensagens = (...ids: string[]): NytaChatState =>
  ids.reduce<NytaChatState>((estado, id) => reducer(estado, addMessage(msg(id))), reducer(undefined, { type: '@@init' }));

describe('o histórico da Nyta', () => {
  it('põe as mensagens antigas na frente das que já estão na tela', () => {
    const depois = reducer(comMensagens('c'), prependMessages([msg('a'), msg('b')]));

    expect(depois.messages.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  // O CASO QUE DEIXAVA O STORE EM DOBRO.
  it('carregar o mesmo histórico duas vezes não duplica nada', () => {
    const historico = [msg('a'), msg('b'), msg('c')];

    let estado = reducer(undefined, prependMessages(historico));
    estado = reducer(estado, prependMessages(historico));

    expect(estado.messages.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  // A página seguinte do histórico chega com mensagens novas E, na virada, pode repetir a
  // última já carregada. As novas precisam entrar; a repetida, não.
  it('numa carga parcialmente repetida, só o que é novo entra', () => {
    let estado = reducer(undefined, prependMessages([msg('b'), msg('c')]));
    estado = reducer(estado, prependMessages([msg('a'), msg('b')]));

    expect(estado.messages.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  // Prepender nada não pode mexer na referência: um `state.messages` novo a cada carga sem
  // novidade faria a lista inteira re-renderizar à toa.
  it('sem novidade, a lista não é recriada', () => {
    const estado = reducer(undefined, prependMessages([msg('a')]));
    const depois = reducer(estado, prependMessages([msg('a')]));

    expect(depois.messages).toBe(estado.messages);
  });
});
