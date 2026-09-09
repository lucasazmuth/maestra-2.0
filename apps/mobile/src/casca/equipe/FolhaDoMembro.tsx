import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';

import { COR, COR_EQUIPE } from '@maestra/core/constants/design';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import type { AccessLevel, ArtistMember } from '@maestra/core/interfaces/maestra';
import * as membrosDb from '@maestra/core/services/db/members';

import { Bloco, Folha, Linha } from '@/casca/Folha';

import { Permissoes } from '@/casca/equipe/Permissoes';

// A folha de UM membro: o "···" da linha.
//
// Serve para os dois papéis, como o modal da web. Quem é dono do perfil edita o nome e os
// acessos e pode remover; quem é membro só lê — e o rodapé some, porque um botão "Salvar" que
// não salva é pior do que botão nenhum.
//
// O e-mail nunca se edita: é a chave do convite. Mudá-lo seria convidar outra pessoa.

const ESTADOS: Record<string, { rotulo: string; cor: string; ponto: string }> = {
  active: { rotulo: 'Ativo', cor: COR_EQUIPE.ativoTexto, ponto: COR_EQUIPE.ativoPonto },
  pending: { rotulo: 'Pendente', cor: COR_EQUIPE.pendenteTexto, ponto: COR_EQUIPE.pendentePonto },
  rejected: { rotulo: 'Recusado', cor: COR_EQUIPE.recusadoTexto, ponto: COR_EQUIPE.recusadoPonto },
};

export const SeloDeEstado = ({ estado }: { estado: string }) => {
  const visual = ESTADOS[estado] ?? { rotulo: estado, cor: COR_EQUIPE.pendente, ponto: COR_EQUIPE.pendente };
  return (
    <View style={estilos.selo}>
      <View style={[estilos.ponto, { backgroundColor: visual.ponto }]} />
      <Text style={[estilos.seloTexto, { color: visual.cor }]}>{visual.rotulo}</Text>
    </View>
  );
};

export const FolhaDoMembro = ({ membro, souODono, foto, aoFechar, aoSalvar, aoRemover }: {
  membro: ArtistMember | null;
  souODono: boolean;
  foto?: string | null;
  aoFechar: () => void;
  aoSalvar: (atualizado: ArtistMember) => void;
  aoRemover: (id: string) => void;
}) => {
  const [nome, setNome] = useState('');
  const [niveis, setNiveis] = useState<AccessLevel[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!membro) return;
    setNome(membro.name || '');
    setNiveis(membro.access_levels || []);
    setErro(null);
  }, [membro]);

  const salvar = async () => {
    if (!membro || !souODono) return;
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await membrosDb.updateMember(membro.id, {
        name: nome.trim(),
        access_levels: niveis,
      });
      aoSalvar(atualizado);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar membro.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = () => {
    if (!membro) return;
    Alert.alert(
      'Remover membro?',
      'Esta pessoa perderá o acesso ao perfil do artista.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await membrosDb.removeMember(membro.id);
              aoRemover(membro.id);
              aoFechar();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Erro ao remover.');
            }
          },
        },
      ],
    );
  };

  return (
    <Folha
      aberta={!!membro}
      titulo={membro?.name || membro?.email || 'Membro'}
      aoFechar={aoFechar}
      // Quem é membro só LÊ: sem poder salvar, um rodapé com "Salvar" seria um botão que mente.
      acao={souODono ? { rotulo: 'Salvar alterações', aoTocar: salvar, carregando: salvando } : undefined}
      destrutiva={souODono ? { rotulo: 'Excluir', aoTocar: remover } : undefined}
    >
      <Bloco>
        <Linha primeira>
          <View style={estilos.resumo}>
            <Image source={{ uri: foto || ARTISTS_DEFAULT_IMAGE }} style={estilos.avatar} />
            <View style={estilos.flex}>
              {!!membro && <SeloDeEstado estado={membro.status} />}
              <Text style={estilos.convidado}>Convidado para este perfil</Text>
            </View>
          </View>
        </Linha>

        <Linha>
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>Nome</Text>
            <TextInput
              style={[estilos.entrada, !souODono && estilos.entradaTravada]}
              value={nome}
              onChangeText={setNome}
              editable={souODono}
              placeholder="Nome do membro"
              placeholderTextColor={COR_EQUIPE.email}
              accessibilityLabel="Nome do membro"
            />
          </View>
        </Linha>

        <Linha>
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>E-mail</Text>
            {/* Não editável nem para o dono: é a chave do convite. */}
            <TextInput
              style={[estilos.entrada, estilos.entradaTravada]}
              value={membro?.email ?? ''}
              editable={false}
              accessibilityLabel="E-mail do membro"
            />
          </View>
        </Linha>
      </Bloco>

      {/* A explicação FICA: ela descreve a REGRA das permissões, não a tela. */}
      <Bloco rotulo="O que esta pessoa pode acessar">
        <Linha primeira>
          <Text style={estilos.apoioDoCampo}>
            Cada módulo marcado libera ver e editar aquele módulo. Pode marcar mais de um.
          </Text>
          <Permissoes escolhidos={niveis} travado={!souODono} aoMudar={setNiveis} />
        </Linha>
      </Bloco>

      {!!erro && <Text style={estilos.erro}>{erro}</Text>}
    </Folha>
  );
};

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COR_EQUIPE.avatarFundo },
  convidado: { fontSize: 12, color: COR_EQUIPE.email, marginTop: 6 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  seloTexto: { fontSize: 10, fontWeight: '800' },
  campo: { gap: 6 },
  rotulo: { fontSize: 11, fontWeight: '800', color: COR_EQUIPE.email, letterSpacing: 0.4 },
  apoioDoCampo: { fontSize: 12, lineHeight: 18, color: COR_EQUIPE.permissaoApoio, marginBottom: 4 },
  // Sem moldura: o campo já está dentro do bloco branco, e quem o separa do vizinho é a
  // divisória. Com a borda, cada campo virava uma caixa dentro de outra caixa.
  entrada: { paddingVertical: 2, fontSize: 15, color: COR_EQUIPE.nome },
  entradaTravada: { color: COR_EQUIPE.email },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19, paddingHorizontal: 4 },
});
