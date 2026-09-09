import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COR, COR_EQUIPE } from '@maestra/core/constants/design';
import type { AccessLevel, ArtistMember } from '@maestra/core/interfaces/maestra';
import * as membrosDb from '@maestra/core/services/db/members';

import { Bloco, Folha, Linha } from '@/casca/Folha';

import { Permissoes } from '@/casca/equipe/Permissoes';

// Convidar alguém para o perfil.
//
// Eu tinha escrito que isto "se faz melhor sentado, e a web já tem" e deixado a tela em leitura.
// É um e-mail, um nome e quatro caixas de seleção — cabe no celular sem esforço, e quem precisa
// dar acesso a alguém costuma precisar disso no momento em que a pessoa está do lado.
//
// O convite parte com `plan` marcado, como na web: é o acesso que quase todo colaborador
// precisa, e sai da tela com uma decisão a menos.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FolhaDeConvite = ({ aberta, artistaId, aoFechar, aoConvidar }: {
  aberta: boolean;
  artistaId: string;
  aoFechar: () => void;
  aoConvidar: (membro: ArtistMember) => void;
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [niveis, setNiveis] = useState<AccessLevel[]>(['plan']);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setNome('');
    setEmail('');
    setNiveis(['plan']);
    setErro(null);
  }, [aberta]);

  const convidar = async () => {
    const endereco = email.trim();
    if (!EMAIL.test(endereco)) { setErro('Informe um e-mail válido.'); return; }
    // Convite sem nenhum acesso entra na equipe sem poder abrir nada — provável esquecimento,
    // já que dá para desmarcar tudo de uma vez pelo "Acesso completo".
    if (!niveis.length) {
      setErro('Escolha ao menos um módulo que esta pessoa poderá acessar.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const membro = await membrosDb.inviteMember({
        artistId: artistaId, email: endereco, name: nome.trim(), accessLevels: niveis,
      });
      aoConvidar(membro);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao convidar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Folha
      aberta={aberta}
      titulo="Convidar membro"
      aoFechar={aoFechar}
      acao={{ rotulo: 'Enviar convite', aoTocar: convidar, carregando: enviando }}
    >
      {/* Mesmo caso da agenda: o primeiro bloco não leva rótulo, porque o título da folha
          ("Convidar membro") já diz de que se trata. */}
      <Bloco>
        <Linha primeira>
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>Nome</Text>
            <TextInput
              style={estilos.entrada}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome do convidado"
              placeholderTextColor={COR_EQUIPE.email}
              accessibilityLabel="Nome do convidado"
            />
          </View>
        </Linha>

        <Linha>
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>E-mail *</Text>
            <TextInput
              style={estilos.entrada}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@exemplo.com"
              placeholderTextColor={COR_EQUIPE.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="E-mail do convidado"
            />
          </View>
        </Linha>
      </Bloco>

      {/* A explicação das permissões FICA: ela não descreve a tela, descreve a regra (marcar um
          módulo libera ver e editar, e dá para mudar depois). Sem ela, a pessoa marca no escuro. */}
      <Bloco rotulo="O que esta pessoa pode acessar">
        <Linha primeira>
          <Text style={estilos.apoioDoCampo}>
            Cada módulo marcado libera ver e editar aquele módulo. Pode marcar mais de um, e dá
            para alterar depois.
          </Text>
          <Permissoes escolhidos={niveis} aoMudar={setNiveis} />
        </Linha>
      </Bloco>

      {!!erro && <Text style={estilos.erro}>{erro}</Text>}
    </Folha>
  );
};

// A casca mora na `Folha`. Aqui ficam só os campos.
const estilos = StyleSheet.create({
  campo: { gap: 6 },
  rotulo: { fontSize: 13, fontWeight: '700', color: COR_EQUIPE.email },
  apoioDoCampo: { fontSize: 12, lineHeight: 18, color: COR_EQUIPE.permissaoApoio, marginBottom: 10 },
  // Sem moldura: o campo já está dentro do bloco branco, e quem separa é a divisória.
  entrada: { paddingVertical: 2, fontSize: 15, color: COR_EQUIPE.nome },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19, paddingHorizontal: 4 },
});
