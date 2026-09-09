import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM } from '@maestra/core/constants/design';
import {
  AVISO_DO_CERTIFICADO, certificarVersao, hashLegivel, listarCertificados,
  type CertificadoDeAutoria,
} from '@maestra/core/services/db/certificados';

import { Bloco, Linha } from '@/casca/Folha';
import { baixarCertificado } from '@/nucleo/documentos';

// O REGISTRO DE AUTORIA de uma versão, dentro da folha dela.
//
// Carimba a existência: a impressão digital do arquivo, a data e o nome de quem declara. O hash
// é calculado no SERVIDOR, a partir do arquivo que está no Storage — ver a edge function
// `version-certify`. Um hash que saísse daqui não certificaria nada, porque quem carimba seria
// quem é carimbado.
//
// ⚠️ O AVISO NÃO É OPCIONAL, e não é rodapé miúdo. "Certificado", num produto de música, puxa
// ECAD e Biblioteca Nacional sozinho. A frase vem do núcleo (`AVISO_DO_CERTIFICADO`), a mesma
// que sai impressa no PDF, para as duas superfícies e o documento dizerem o mesmo.

/** `2026-09-08T14:30:00Z` → `08/09/2026`, no fuso de Brasília, como no documento. */
const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

export const RegistroDeAutoria = ({ versaoId, temAudio }: {
  versaoId: string;
  /** Sem áudio não há o que carimbar, e o botão explica isso em vez de falhar no toque. */
  temAudio: boolean;
}) => {
  const [certificados, setCertificados] = useState<CertificadoDeAutoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carimbando, setCarimbando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      setCertificados(await listarCertificados(versaoId));
    } catch {
      // Silêncio de propósito: não conseguir LISTAR não é um erro que interrompe quem está a
      // editar a versão. O erro que interessa é o de carimbar, e esse aparece.
    } finally {
      setCarregando(false);
    }
  }, [versaoId]);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const carimbar = async () => {
    setErro(null);
    setCarimbando(true);
    try {
      const { certificado, novo } = await certificarVersao(versaoId);
      // Certificar de novo o mesmo arquivo devolve o carimbo antigo, com a data original. A
      // lista é remontada de qualquer jeito, mas só entra linha nova quando de facto houve uma.
      if (novo) setCertificados((antes) => [certificado, ...antes]);
      else await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar a autoria.');
    } finally {
      setCarimbando(false);
    }
  };

  const ultimo = certificados[0];

  return (
    <Bloco rotulo="Autoria">
      {carregando ? (
        <Linha primeira>
          <ActivityIndicator size="small" color={COR.primaria} />
        </Linha>
      ) : (
        <>
          {certificados.map((c, i) => (
            <Linha key={c.id} primeira={i === 0}>
              <View style={estilos.certificado}>
                <View style={estilos.selo}>
                  <Feather name="shield" size={16} color={COR.primaria} />
                </View>
                <View style={estilos.corpo}>
                  <Text style={estilos.data}>Registrado em {dataCurta(c.certificado_em)}</Text>
                  {/* Os primeiros dezasseis caracteres bastam para conferir de relance; o hash
                      inteiro sai no PDF, que é onde ele serve para comparar. */}
                  <Text style={estilos.hash} numberOfLines={1}>
                    {hashLegivel(c.sha256).slice(0, 17)}…
                  </Text>
                  <Text style={estilos.autor} numberOfLines={1}>{c.autor_nome}</Text>
                </View>
                <Pressable
                  onPress={() => baixarCertificado({
                    musica: c.musica,
                    versao: c.versao,
                    artista: c.artista,
                    autorNome: c.autor_nome,
                    sha256: c.sha256,
                    algoritmo: c.algoritmo,
                    arquivoNome: c.arquivo_nome,
                    arquivoBytes: c.arquivo_bytes,
                    certificadoEm: c.certificado_em,
                  })}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Baixar o certificado de ${dataCurta(c.certificado_em)}`}
                >
                  <Feather name="download" size={18} color={COR_JAM.legenda} />
                </Pressable>
              </View>
            </Linha>
          ))}

          <Linha primeira={certificados.length === 0}>
            <Pressable
              style={estilos.acao}
              onPress={carimbar}
              disabled={carimbando || !temAudio}
              accessibilityRole="button"
              accessibilityState={{ disabled: carimbando || !temAudio }}
              accessibilityLabel={ultimo ? 'Registrar de novo' : 'Registrar autoria'}
            >
              {carimbando
                ? <ActivityIndicator size="small" color={COR.primaria} />
                : <Feather name="shield" size={16} color={temAudio ? COR.primaria : COR_JAM.rotulo} />}
              <Text style={[estilos.acaoTexto, !temAudio && estilos.acaoInerte]}>
                {!temAudio
                  ? 'Envie o áudio para poder registrar'
                  : ultimo ? 'Registrar de novo' : 'Registrar autoria'}
              </Text>
            </Pressable>
          </Linha>

          <Linha>
            <Text style={estilos.aviso}>{AVISO_DO_CERTIFICADO}</Text>
          </Linha>
        </>
      )}

      {!!erro && (
        <Linha>
          <Text style={estilos.erro}>{erro}</Text>
        </Linha>
      )}
    </Bloco>
  );
};

const estilos = StyleSheet.create({
  certificado: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selo: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_JAM.acaoFundo,
  },
  corpo: { flex: 1, minWidth: 0 },
  data: { fontSize: 14, fontWeight: '700', color: COR_JAM.titulo },
  // Monoespaçada: um hash lê-se caractere a caractere, e é assim que ele bate com o do PDF.
  hash: { fontFamily: 'Menlo', fontSize: 11, color: COR_JAM.apoio, marginTop: 3 },
  autor: { fontSize: 11, color: COR_JAM.apoio, marginTop: 2 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acaoTexto: { fontSize: 14, fontWeight: '800', color: COR.primaria },
  acaoInerte: { color: COR_JAM.rotulo, fontWeight: '600' },
  aviso: { fontSize: 11, lineHeight: 17, color: COR_JAM.apoio },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
});
