import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CATALOGO, COR_JAM, RAIO } from '@maestra/core/constants/design';
import type { CatalogVersion } from '@maestra/core/interfaces/maestra';
import * as catalogo from '@maestra/core/services/db/catalog';

import { escolherAudio, enviarParaOCatalogo } from '@/nucleo/arquivos';

// A lista de versões, dentro da ficha da música.
//
// As gravações vivem no Espaço Jam, mas anexar uma versão a partir da ficha é o caminho mais
// curto para quem acabou de cadastrar a obra — é o que a web faz, e por isso a seção existe aqui.
//
// A versão PRINCIPAL é a que toca na lista de músicas e no painel. Quem a define é o núcleo:
// `createCatalogVersion` promove qualquer versão que chegue COM áudio, e essa é a regra do
// produto — a gravação mais recente é a que representa a música até alguém dizer o contrário.
// A estrela aqui serve para dizer o contrário.

export const Versoes = ({ artistaId, projetoId, autor, aoMudar }: {
  artistaId: string;
  projetoId?: string | null;
  autor: { id?: string | null; nome?: string | null };
  aoMudar?: () => void;
}) => {
  const [versoes, setVersoes] = useState<CatalogVersion[]>([]);
  const [principalId, setPrincipalId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    if (!projetoId) return;
    setCarregando(true);
    try {
      const projeto = await catalogo.getCatalogProject(projetoId);
      // Mais recente primeiro: é a que se acabou de mandar, e a que se quer ouvir.
      setVersoes((projeto.versions ?? []).slice().sort((a, b) => b.version_number - a.version_number));
      setPrincipalId(projeto.primary_version_id ?? null);
    } catch {
      setErro('Não consegui carregar as versões.');
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => { void buscar(); }, [buscar]);

  const anexar = async () => {
    if (!projetoId) return;
    setErro(null);
    try {
      const escolhido = await escolherAudio();
      if (!escolhido) return;

      setEnviando(true);
      const enviado = await enviarParaOCatalogo(`${artistaId}/${projetoId}/versions`, escolhido);
      const numero = versoes.length ? Math.max(...versoes.map((v) => v.version_number)) + 1 : 1;

      await catalogo.createCatalogVersion({
        project_id: projetoId,
        version_number: numero,
        stage: 'guia',
        status: 'draft',
        // O nome do arquivo sem a extensão vira o título da versão, como na web.
        title: escolhido.nome.replace(/\.[^.]+$/, ''),
        audio_file: enviado.url,
        audio_file_name: enviado.name,
        author_id: autor.id ?? null,
        author_name: autor.nome ?? null,
      } as Parameters<typeof catalogo.createCatalogVersion>[0]);

      // O `createCatalogVersion` já promoveu a nova a principal (ela veio com áudio); o
      // `buscar` traz de volta quem é ela.
      await buscar();
      aoMudar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui anexar o áudio.');
    } finally {
      setEnviando(false);
    }
  };

  const tornarPrincipal = async (versao: CatalogVersion) => {
    if (!projetoId) return;
    try {
      await catalogo.setPrimaryVersion(projetoId, versao.id);
      setPrincipalId(versao.id);
      aoMudar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui trocar a versão principal.');
    }
  };

  const excluir = (versao: CatalogVersion) => {
    Alert.alert(
      `Excluir a V${versao.version_number}?`,
      'O áudio e os comentários dela serão apagados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await catalogo.deleteCatalogVersion(versao.id);
              await buscar();
              aoMudar?.();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Não consegui excluir a versão.');
            }
          },
        },
      ],
    );
  };

  if (!projetoId) {
    return (
      <Text style={estilos.aviso}>
        Salve a música primeiro; depois disso dá para anexar as versões.
      </Text>
    );
  }

  return (
    <View style={estilos.bloco}>
      {carregando && versoes.length === 0 ? (
        <ActivityIndicator color={COR.primaria} style={estilos.espera} />
      ) : versoes.length === 0 ? (
        <Text style={estilos.aviso}>Nenhuma versão anexada ainda.</Text>
      ) : (
        versoes.map((versao) => {
          const principal = versao.id === principalId;
          return (
            <View key={versao.id} style={estilos.versao}>
              <View style={estilos.numero}>
                <Text style={estilos.numeroTexto}>V{versao.version_number}</Text>
              </View>

              <View style={estilos.flex}>
                {/* O nome do arquivo NÃO entra aqui: no Espaço Jam a mesma versão aparece como
                    "Versão 1", e duas grafias para a mesma gravação leem como duas gravações. */}
                <Text style={estilos.titulo} numberOfLines={1}>
                  {versao.title || `Versão ${versao.version_number}`}
                </Text>
                <Text style={estilos.legenda}>
                  {[versao.duration, principal ? 'principal' : null].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>

              {/* A estrela é dourada quando acesa, como no Espaço Jam — azul dizia "ação", e
                  aqui ela diz ESTADO: esta é a versão que toca no catálogo e no painel. */}
              {!principal && (
                <Pressable
                  onPress={() => tornarPrincipal(versao)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Tornar a V${versao.version_number} principal`}
                >
                  <Feather name="star" size={17} color={COR_JAM.estrela} />
                </Pressable>
              )}
              {principal && <Feather name="star" size={17} color={COR_JAM.estrelaAcesa} />}

              <Pressable
                onPress={() => excluir(versao)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Excluir a V${versao.version_number}`}
              >
                <Feather name="trash-2" size={16} color={COR_CATALOGO.legenda} />
              </Pressable>
            </View>
          );
        })
      )}

      <Pressable
        style={estilos.anexar}
        onPress={anexar}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel="Adicionar versão"
      >
        {enviando ? (
          <ActivityIndicator size="small" color={COR.primaria} />
        ) : (
          <>
            <Feather name="plus" size={14} color={COR.primaria} />
            <Text style={estilos.anexarTexto}>Adicionar versão</Text>
          </>
        )}
      </Pressable>

      {!!erro && <Text style={estilos.erro}>{erro}</Text>}
    </View>
  );
};

const estilos = StyleSheet.create({
  bloco: { gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  espera: { marginVertical: 16 },
  aviso: { fontSize: 13, color: COR_CATALOGO.legenda, lineHeight: 19, paddingVertical: 10 },
  versao: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR.contorno,
  },
  numero: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR_CATALOGO.tocarFundo,
  },
  numeroTexto: { fontSize: 12, fontWeight: '800', color: COR_CATALOGO.tocarIcone },
  titulo: { fontSize: 14, fontWeight: '600', color: COR_CATALOGO.titulo },
  legenda: { fontSize: 12, color: COR_CATALOGO.legenda, marginTop: 2 },
  anexar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  anexarTexto: { fontSize: 13, fontWeight: '800', color: COR.primaria },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
});
