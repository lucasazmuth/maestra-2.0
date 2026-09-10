import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM, RAIO } from '@maestra/core/constants/design';
import type { CatalogVersion } from '@maestra/core/interfaces/maestra';
import { tituloDoArquivo } from '@maestra/core/services/armazenamento';
import * as catalogo from '@maestra/core/services/db/catalog';

import { Bloco, Folha, Linha } from '@/casca/Folha';
import { RegistroDeAutoria } from '@/casca/jam/RegistroDeAutoria';

import {
  duracaoDoAudio, enviarParaOCatalogo, escolherAudio, type ArquivoEscolhido,
} from '@/nucleo/arquivos';

// A folha da VERSÃO (a gravação), irmã da ficha da música.
//
// A versão é só isto: um nome que a equipe reconheça ("guia vocal", "mix v2"), o arquivo e a
// marca de qual é a principal — os mesmos três campos do `VersionModal` da web. Serve pra
// enviar e pra editar: a diferença é existir ou não `versao`.

export const FolhaDaVersao = ({
  aberta, artistaId, projetoId, nomeDoProjeto, versao, proximoNumero, ehPrincipal,
  herdar, autor, arquivoInicial, aoFechar, aoSalvar, aoExcluir,
}: {
  aberta: boolean;
  artistaId: string;
  projetoId: string;
  nomeDoProjeto: string;
  versao?: CatalogVersion | null;
  proximoNumero?: number;
  ehPrincipal?: boolean;
  herdar?: { bpm?: string | null; key?: string | null; genre?: string | null };
  autor: { id?: string | null; nome?: string | null; foto?: string | null };
  arquivoInicial?: ArquivoEscolhido | null;
  aoFechar: () => void;
  aoSalvar: () => void | Promise<void>;
  aoExcluir?: () => void | Promise<void>;
}) => {
  const editando = Boolean(versao);
  const numero = proximoNumero ?? 1;

  const [titulo, setTitulo] = useState('');
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [duracao, setDuracao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [promovendo, setPromovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Recarrega ao abrir, senão a versão anterior "vaza" pra próxima. Quando o arquivo veio de
  // fora (o botão Upload já abriu os arquivos), o formulário nasce preenchido e só resta enviar.
  useEffect(() => {
    if (!aberta) return;
    setErro(null);
    if (arquivoInicial && !versao) {
      setArquivo(arquivoInicial);
      setTitulo(tituloDoArquivo(arquivoInicial.nome));
      setDuracao('');
      void duracaoDoAudio(arquivoInicial.uri).then((lida) => setDuracao(lida ?? ''));
      return;
    }
    setArquivo(null);
    setTitulo(versao?.title || '');
    setDuracao(versao?.duration || '');
  }, [aberta, versao, arquivoInicial]);

  const trocarArquivo = async () => {
    try {
      const escolhido = await escolherAudio();
      if (!escolhido) return;
      setArquivo(escolhido);
      if (!titulo.trim()) setTitulo(tituloDoArquivo(escolhido.nome));
      setDuracao(await duracaoDoAudio(escolhido.uri) ?? '');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir os arquivos.');
    }
  };

  const salvar = async () => {
    if (!titulo.trim()) {
      setErro('Dê um nome à versão (ex.: guia vocal, mix v2).');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const enviado = arquivo
        ? await enviarParaOCatalogo(`${artistaId}/${projetoId}/versions`, arquivo)
        : null;

      if (versao) {
        await catalogo.updateCatalogVersion(versao.id, {
          title: titulo.trim(),
          duration: duracao.trim() || versao.duration || null,
          // Sem arquivo novo o áudio atual permanece — substituir é opcional.
          ...(enviado ? { audio_file: enviado.url, audio_file_name: enviado.name } : {}),
        });
      } else {
        await catalogo.createCatalogVersion({
          project_id: projetoId,
          version_number: numero,
          title: titulo.trim(),
          duration: duracao.trim() || null,
          audio_file: enviado?.url ?? null,
          audio_file_name: enviado?.name ?? null,
          bpm: herdar?.bpm ?? null,
          key: herdar?.key ?? null,
          genre: herdar?.genre ?? null,
          author_id: autor.id ?? null,
          author_name: autor.nome ?? null,
          author_avatar: autor.foto ?? null,
        } as Parameters<typeof catalogo.createCatalogVersion>[0]);
      }
      await aoSalvar();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : `Não consegui ${editando ? 'atualizar' : 'enviar'} a versão.`);
    } finally {
      setSalvando(false);
    }
  };

  // Marcar a principal é decisão à parte de salvar: acontece na hora e não depende do
  // formulário. Tocar de novo desmarca — a música fica sem principal até outra ser escolhida.
  const alternarPrincipal = async () => {
    if (!versao) return;
    setPromovendo(true);
    try {
      await catalogo.setPrimaryVersion(projetoId, ehPrincipal ? null : versao.id);
      await aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui definir como principal.');
    } finally {
      setPromovendo(false);
    }
  };

  const excluir = () => {
    if (!versao) return;
    Alert.alert(
      'Excluir esta versão?',
      'O áudio e os comentários dela saem do Espaço JAM.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await catalogo.deleteCatalogVersion(versao.id);
              await (aoExcluir ? aoExcluir() : aoSalvar());
              aoFechar();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Não consegui excluir a versão.');
            }
          },
        },
      ],
    );
  };

  return (
    <Folha
      aberta={aberta}
      titulo={editando ? `Editar V${versao!.version_number}` : `Nova versão (V${numero})`}
      aoFechar={aoFechar}
      acao={{
        rotulo: editando ? 'Salvar alterações' : 'Enviar versão',
        aoTocar: salvar,
        carregando: salvando,
      }}
      destrutiva={editando ? { rotulo: 'Excluir', aoTocar: excluir } : undefined}
    >
      <Bloco>
        <Linha primeira>
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>Título da versão *</Text>
            <TextInput
              style={estilos.entrada}
              value={titulo}
              onChangeText={setTitulo}
              maxLength={80}
              placeholder="Ex.: guia vocal, mix v2"
              placeholderTextColor={COR_JAM.rotulo}
              accessibilityLabel="Título da versão"
            />
          </View>
        </Linha>

        <Linha>
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>
              {editando ? 'Substituir áudio (opcional)' : 'Áudio da versão'}
            </Text>
            <Pressable
              style={estilos.caixaDeArquivo}
              onPress={trocarArquivo}
              accessibilityRole="button"
              accessibilityLabel="Escolher o áudio"
            >
              <View style={estilos.iconeDoArquivo}>
                <Feather name={arquivo ? 'music' : 'upload-cloud'} size={18} color={COR.primaria} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.nomeDoArquivo} numberOfLines={1}>
                  {arquivo ? arquivo.nome : 'Toque para escolher'}
                </Text>
                {/* A duração sai do arquivo assim que ele é escolhido, como na web — é o
                    campo somente-leitura de lá, aqui na linha de apoio. */}
                <Text style={estilos.apoioDoArquivo} numberOfLines={1}>
                  {duracao
                    ? `${duracao} · MP3 ou WAV`
                    : versao?.audio_file_name && !arquivo
                      ? `Atual: ${versao.audio_file_name}`
                      : 'MP3 ou WAV'}
                </Text>
              </View>
            </Pressable>
          </View>
        </Linha>

        {editando && (
          <Linha>
            <Pressable
              style={estilos.principal}
              onPress={alternarPrincipal}
              disabled={promovendo}
              accessibilityRole="button"
              accessibilityState={{ selected: Boolean(ehPrincipal) }}
              accessibilityLabel={
                ehPrincipal ? 'Desmarcar como versão principal' : 'Tornar versão principal'
              }
            >
              {promovendo ? (
                <ActivityIndicator size="small" color={COR_JAM.estrelaAcesa} />
              ) : (
                <Feather
                  name="star"
                  size={17}
                  color={ehPrincipal ? COR_JAM.estrelaAcesa : COR_JAM.estrela}
                />
              )}
              <Text style={estilos.principalTexto}>
                {ehPrincipal ? 'Desmarcar como principal' : 'Tornar principal'}
              </Text>
            </Pressable>
          </Linha>
        )}
      </Bloco>

      {/* Só ao EDITAR: uma versão que ainda não nasceu não tem arquivo no Storage para o
          servidor somar, e um botão de registrar antes do envio prometeria o impossível. */}
      {editando && <RegistroDeAutoria versaoId={versao!.id} temAudio={!!versao!.audio_file} />}

      {!!erro && <Text style={estilos.erro}>{erro}</Text>}
    </Folha>
  );
};

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  // Mesmo molde da folha de compromisso da Agenda, que é a referência.
  campo: { gap: 6 },
  rotulo: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: COR_JAM.rotulo },
  entrada: { paddingVertical: 2, fontSize: 15, color: COR_JAM.texto },
  // A caixa do arquivo MANTÉM a moldura tracejada: ela não é um campo de texto, é um alvo de
  // toque para escolher um arquivo, e o tracejado é o que diz isso sem uma palavra.
  caixaDeArquivo: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_JAM.fio,
    borderStyle: 'dashed', backgroundColor: COR_JAM.cabecaDaVersao,
  },
  iconeDoArquivo: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_JAM.acaoFundo,
  },
  nomeDoArquivo: { fontSize: 14, fontWeight: '700', color: COR_JAM.titulo },
  apoioDoArquivo: { fontSize: 11, color: COR_JAM.apoio, marginTop: 3 },
  principal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  principalTexto: { fontSize: 13, fontWeight: '800', color: COR_JAM.texto },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
});
