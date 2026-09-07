import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PAINEL } from '@maestra/core/constants/design';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';

import { Relatorio } from '@/casca/diagnostico/Relatorio';
import { useArtistaDaRota } from '@/nucleo/artista';
import { AvisoDoPro } from '@/casca/AvisoDoPro';

// A página do diagnóstico de um perfil: só a moldura. O relatório inteiro é o `Relatorio`, que
// o fluxo de criação também usa — é o mesmo documento nos dois lugares, como na web.

export default function Diagnostico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artista = useArtistaDaRota(id);
  const conteudo = artista?.content as Record<string, any> | undefined;
  const [avisandoDoPro, setAvisandoDoPro] = useState(false);

  // Quem pode refazer é quem o MODELO diz: `manageTasks` — "edições avançadas (adicionar
  // estratégia/tarefa, editar/excluir campos, refazer diagnóstico): PRO obrigatório pra TODOS
  // (inclusive dono); membro também precisa do nível 'plan'/'full'".
  //
  // Estava amarrado a ser DONO, e não era isso que o modelo dizia: um membro com acesso total —
  // que a dona do perfil escolheu deliberadamente — não via o botão. O corte por dono continua
  // valendo dentro da edge, e é lá que ele precisa mudar junto; aqui a regra volta a ser a que
  // o produto declara.
  const capacidades = useArtistCapabilities(artista);
  const podeVerORefazer = capacidades.viewPlanning && (capacidades.isOwner || capacidades.editPlanning);

  // Loop de crescimento: executou o plano e cresceu? Refaz o REAL pra fase subir. Sem PRO, o
  // aviso explica o que é antes de qualquer checkout.
  const refazer = () => {
    if (capacidades.manageTasks) {
      router.push({ pathname: '/criar-artista', params: { refazer: String(id) } });
    } else setAvisandoDoPro(true);
  };

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Relatorio
          real={conteudo?.realIndex as Record<string, any> | undefined}
          chartmetric={conteudo?.chartmetricProfile ?? null}
          artista={{
            id: artista?.id,
            nome: artista?.name,
            foto: conteudo?.spotifyProfile?.image,
            vinculo: conteudo?.titularidade?.vinculo,
          }}
          acaoDoPerfil={podeVerORefazer ? (
            <Pressable
              style={estilos.refazer}
              onPress={refazer}
              accessibilityRole="button"
              accessibilityLabel={capacidades.manageTasks
                ? 'Refazer o diagnóstico'
                : 'Refazer o diagnóstico é um recurso PRO'}
            >
              <Feather
                name={capacidades.manageTasks ? 'refresh-cw' : 'lock'}
                size={13}
                color={COR_PAINEL.pilulaTexto}
              />
              <Text style={estilos.refazerTexto}>Refazer</Text>
            </Pressable>
          ) : undefined}
        />
      </ScrollView>

      <AvisoDoPro
        recurso="refazer"
        visivel={avisandoDoPro}
        aoFechar={() => setAvisandoDoPro(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: {
    // Sem recuo de cima: ele é todo do `CabecalhoDoModulo`, para o título nascer à mesma
    // altura em todos os módulos.
    // O ritmo da pilha NÃO é decidido aqui: mora dentro do próprio `Relatorio`, que aparece
    // nesta tela, no fim da criação e no desbloqueio. Era essa decisão espalhada por três
    // molduras que fazia o mesmo documento sair com espaçamentos diferentes em cada uma.
    // O recuo de baixo é da barra de abas, que flutua sobre o conteúdo.
    paddingHorizontal: 16, paddingBottom: 122,
  },
  // Sobre o azul-noite do cartão: contorno claro e fundo translúcido, o mesmo tratamento das
  // pílulas do herói do painel. Discreto de propósito — refazer é manutenção, não o próximo passo.
  refazer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9999,
    borderWidth: 1, borderColor: COR_PAINEL.pilulaContorno, backgroundColor: COR_PAINEL.pilulaFundo,
  },
  refazerTexto: { fontSize: 12, fontWeight: '800', color: COR_PAINEL.pilulaTexto },
});
