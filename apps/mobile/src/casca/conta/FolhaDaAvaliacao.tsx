import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CONTA } from '@maestra/core/constants/design';
import { getMyPlatformReview, savePlatformReview } from '@maestra/core/services/db/platformReviews';

import { Bloco, Folha, Linha } from '@/casca/Folha';

// "Avaliar a Maestra": nota de 1 a 5 e um comentário opcional.
//
// É a avaliação DO PRODUTO, guardada no banco — não a da App Store. As duas coisas se parecem e
// não são a mesma: esta a equipe lê e responde; a da loja é pública e o app nem está publicado.
//
// Abre com o que a pessoa já respondeu antes, como na web: avaliar de novo é REVER a nota, e
// começar do zero faria parecer que a anterior sumiu.

const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Boa', 'Excelente'];
const LIMITE = 2000;

export const FolhaDaAvaliacao = ({ aberta, usuarioId, aoFechar }: {
  aberta: boolean;
  usuarioId?: string | null;
  aoFechar: () => void;
}) => {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta || !usuarioId) return undefined;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    getMyPlatformReview(usuarioId)
      .then((avaliacao) => {
        if (!vivo) return;
        setNota(avaliacao?.rating || 0);
        setComentario(avaliacao?.comment || '');
      })
      .catch(() => { if (vivo) { setNota(0); setComentario(''); } })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [aberta, usuarioId]);

  const enviar = async () => {
    if (!usuarioId || !nota) return;
    setEnviando(true);
    setErro(null);
    try {
      await savePlatformReview({
        userId: usuarioId,
        rating: nota,
        comment: comentario,
        // Na web isto é o caminho da página; aqui é a tela de onde a avaliação partiu.
        pagePath: '/conta',
      });
      aoFechar();
    } catch {
      setErro('Não foi possível enviar sua avaliação agora.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Folha
      aberta={aberta}
      titulo="Avalie a Maestra"
      aoFechar={aoFechar}
      acao={{
        rotulo: 'Enviar avaliação',
        aoTocar: enviar,
        carregando: enviando,
        desabilitada: !nota || carregando,
      }}
    >
      {/* O "Agora não" do rodapé saiu junto com a casca antiga: quem fecha uma folha é o
          círculo no canto, em toda tela do app, e um segundo jeito de sair só nesta seria
          mais uma coisa para reaprender. */}
      <Bloco rotulo="Sua nota">
        <Linha primeira>
          <View style={estilos.bloco}>
            <View style={estilos.estrelas}>
              {[1, 2, 3, 4, 5].map((valor) => (
                <Pressable
                  key={valor}
                  onPress={() => setNota(valor)}
                  disabled={carregando || enviando}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ selected: nota >= valor }}
                  accessibilityLabel={`${valor} ${valor === 1 ? 'estrela' : 'estrelas'}`}
                >
                  <Feather
                    name="star"
                    size={32}
                    color={nota >= valor ? COR_CONTA.estrela : COR_CONTA.contorno}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={estilos.dica}>
              {carregando
                ? 'Carregando sua avaliação…'
                : ROTULOS[nota] || 'Selecione de 1 a 5 estrelas'}
            </Text>
          </View>
        </Linha>
      </Bloco>

      {/* Sem rótulo dentro da linha: "Comentário" já está em cima do bloco, e a pergunta
          antiga ("Quer contar um pouco mais?") é uma frase inteira num lugar que o resto do
          app usa para uma palavra. O que ela pedia, o texto de exemplo já pede. */}
      <Bloco rotulo="Comentário (opcional)">
        <Linha primeira>
          <View style={estilos.campo}>
            <TextInput
              style={estilos.entrada}
              value={comentario}
              onChangeText={setComentario}
              maxLength={LIMITE}
              multiline
              editable={!carregando && !enviando}
              placeholder="O que está funcionando bem? O que podemos melhorar?"
              placeholderTextColor={COR_CONTA.texto}
              accessibilityLabel="Comentário da avaliação"
            />
            <Text style={estilos.contador}>{comentario.length}/{LIMITE}</Text>
          </View>
        </Linha>
      </Bloco>

      {!!erro && <Text style={estilos.erro}>{erro}</Text>}
    </Folha>
  );
};

// A casca (fundo, cabeçalho, teclado e rodapé) mora na `Folha`. Aqui ficam só os campos, no
// mesmo molde da folha de compromisso da Agenda: rótulo miúdo em cima, campo sem moldura.
const estilos = StyleSheet.create({
  bloco: { alignItems: 'center', gap: 12 },
  estrelas: { flexDirection: 'row', gap: 10 },
  dica: { fontSize: 13, color: COR_CONTA.texto },
  campo: { gap: 6 },
  entrada: {
    minHeight: 110, paddingVertical: 2, textAlignVertical: 'top',
    fontSize: 15, color: COR_CONTA.titulo,
  },
  contador: { fontSize: 11, color: COR_CONTA.texto, textAlign: 'right' },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19, paddingHorizontal: 4 },
});
