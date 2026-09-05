import Feather from '@expo/vector-icons/Feather';
import { Redirect, router as rota, useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, Share,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COR, RAIO, COR_CONTA } from '@maestra/core/constants/design';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import { supabase } from '@maestra/core/lib/supabase';
import { BALDE_DE_AVATARES } from '@maestra/core/services/armazenamento';
import { cancelSubscription, fetchSubscriptionStatus } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

import { FolhaDaAvaliacao } from '@/casca/conta/FolhaDaAvaliacao';
import { enviarEscolhido, escolherImagem } from '@/nucleo/arquivos';
import { sair } from '@/nucleo/entrar';
import { irParaOCheckout } from '@/nucleo/loja';
import { useVoltar } from '@/nucleo/navegar';
import { useSessao } from '@/nucleo/sessao';

// A conta.
//
// Existe por uma exigência da App Store (regra 5.1.1 v): quem cria conta dentro do app precisa
// conseguir excluí-la dentro do app. Mandar a pessoa falar com o suporte — que é o que a web faz
// hoje — é justamente o que a regra recusa.
//
// O pedido NÃO apaga na hora, e isso é deliberado: `account_deletion_requests` guarda um prazo
// de 30 dias como janela de arrependimento e de verificação de fraude (pedido feito por quem
// invadiu a conta), amarrado à Política de Privacidade. Vencido o prazo, o cron
// `account-purge-due` executa sem depender de ninguém lembrar. A tela diz isso em vez de
// prometer um "apagado" que não acontece naquele instante.

const COBRAVEL = ['active', 'overdue', 'pending'];

/** Planos, termos, suporte e exportacao de dados vivem na web. */
const SITE = 'https://www.maestramanager.com';

export default function Conta() {
  const { sessao, carregando: carregandoSessao } = useSessao();
  const router = useRouter();
  const voltar = useVoltar('/perfis');
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.subscription.status);

  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const usuario = sessao?.user;
  const dados = (usuario?.user_metadata ?? {}) as Record<string, string | undefined>;
  const nomeSalvo = dados.full_name ?? '';
  const fotoSalva = dados.avatar_url ?? dados.picture ?? '';

  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(nomeSalvo);
  const [foto, setFoto] = useState(fotoSalva);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [avaliando, setAvaliando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const comecarAEditar = () => {
    setNome(nomeSalvo);
    setFoto(fotoSalva);
    setErro(null);
    setEditando(true);
  };

  // A foto sobe pro balde `avatars` na hora da escolha; só a URL fica guardada até salvar — é
  // o mesmo desenho da web, e é o que permite desistir sem deixar o perfil pela metade.
  const trocarFoto = async () => {
    setErro(null);
    try {
      const escolhida = await escolherImagem();
      if (!escolhida || !usuario) return;
      setEnviandoFoto(true);
      const enviada = await enviarEscolhido(BALDE_DE_AVATARES, usuario.id, escolhida);
      setFoto(enviada.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const salvarPerfil = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: nome.trim(), avatar_url: foto },
      });
      if (error) throw error;
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  // A exportação é a MESMA função de borda da web (`account-data-export`). O que muda é o
  // destino: no navegador vira download, aqui vira arquivo mais folha de partilha — de onde sai
  // "Guardar em Ficheiros", que é o download do celular.
  const exportarDados = async () => {
    setExportando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('account-data-export', { body: {} });
      if (error || (data as { error?: string })?.error) {
        throw error || new Error((data as { error?: string }).error);
      }
      const arquivo = new File(
        Paths.cache,
        `maestra-meus-dados-${new Date().toISOString().slice(0, 10)}.json`,
      );
      if (arquivo.exists) arquivo.delete();
      arquivo.create();
      arquivo.write(JSON.stringify(data, null, 2));
      await Share.share({ url: arquivo.uri });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o arquivo. Tente novamente.');
    } finally {
      setExportando(false);
    }
  };
  useEffect(() => {
    if (usuario) dispatch(fetchSubscriptionStatus());
  }, [usuario, dispatch]);

  const temAssinatura = COBRAVEL.includes(String(status));

  const excluir = async () => {
    if (!usuario) return;
    setErro(null);
    setExcluindo(true);
    try {
      // A assinatura sai primeiro: pedido de exclusão com cobrança viva seguiria cobrando uma
      // conta que a pessoa pediu para apagar.
      if (temAssinatura) {
        try {
          await dispatch(cancelSubscription()).unwrap();
        } catch {
          setErro('Não consegui cancelar sua assinatura. Cancele a assinatura antes de excluir a conta.');
          return;
        }
      }

      const { error } = await supabase.from('account_deletion_requests').insert({
        user_id: usuario.id,
        email: usuario.email,
        subscription_status: status,
        subscription_cancelled: temAssinatura,
      });
      if (error) throw error;

      // Conta em processo de exclusão não fica logada.
      await sair();
      router.replace('/entrar');
    } catch {
      setErro('Não foi possível registrar o pedido. Tente de novo.');
    } finally {
      setExcluindo(false);
    }
  };

  const confirmar = () => {
    Alert.alert(
      'Excluir sua conta?',
      temAssinatura
        ? 'Sua assinatura será cancelada e a conta e todos os perfis serão apagados em 30 dias. Não dá para desfazer depois desse prazo.'
        : 'Sua conta e todos os perfis serão apagados em 30 dias. Não dá para desfazer depois desse prazo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir conta', style: 'destructive', onPress: excluir },
      ]
    );
  };

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  return (
    <SafeAreaView style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Text style={estilos.voltar} onPress={voltar}>‹  Perfis</Text>

        {/* As secoes sao as da web, na ordem dela: Perfil, Notificacoes, Assinatura, Historico
            de pagamentos, Suporte e termos, Seus dados e Conta. */}
        <View style={estilos.cartao}>
          <View style={estilos.linhaDoCartao}>
            <Text style={estilos.tituloDoCartao}>Perfil</Text>
            {!editando && (
              <Pressable
                style={estilos.editar}
                onPress={comecarAEditar}
                accessibilityRole="button"
                accessibilityLabel="Editar perfil"
              >
                <Feather name="edit-2" size={13} color={COR.primaria} />
                <Text style={estilos.editarTexto}>Editar</Text>
              </Pressable>
            )}
          </View>

          <View style={estilos.perfil}>
            <Pressable
              onPress={editando ? trocarFoto : undefined}
              disabled={!editando || enviandoFoto}
              accessibilityRole={editando ? 'button' : undefined}
              accessibilityLabel={editando ? 'Trocar a foto' : undefined}
            >
              {enviandoFoto
                ? <View style={estilos.foto}><ActivityIndicator color={COR.primaria} /></View>
                : <Image source={{ uri: (editando ? foto : fotoSalva) || ARTISTS_DEFAULT_IMAGE }} style={estilos.foto} />}
            </Pressable>
            <View style={estilos.flex}>
              {!editando && <Text style={estilos.nome}>{nomeSalvo || 'Sem nome'}</Text>}
              <Text style={estilos.email}>{usuario?.email}</Text>
              {editando && <Text style={estilos.dica}>Toque na foto para trocar</Text>}
            </View>
          </View>

          {editando && (
            <>
              <View style={estilos.campo}>
                <Text style={estilos.rotulo}>Nome</Text>
                <TextInput
                  style={estilos.entrada}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Seu nome"
                  placeholderTextColor={COR_CONTA.texto}
                  accessibilityLabel="Seu nome"
                />
              </View>
              <View style={estilos.acoesDoPerfil}>
                <Pressable
                  onPress={() => setEditando(false)}
                  disabled={salvando}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar edição"
                >
                  <Text style={estilos.cancelar}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[estilos.salvar, salvando && estilos.tocada]}
                  onPress={salvarPerfil}
                  disabled={salvando}
                  accessibilityRole="button"
                  accessibilityLabel="Salvar perfil"
                >
                  {salvando
                    ? <ActivityIndicator size="small" color={COR.superficie} />
                    : <Text style={estilos.salvarTexto}>Salvar</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* Notificações. A seção existe porque a web tem, e o texto é o dela; o interruptor NÃO
            aparece porque o push do app ainda não está configurado (falta o projeto EAS e a
            chave APNs). A web faz o mesmo quando o navegador não suporta: mostra a seção e
            explica por que não há botão. Um interruptor que não liga nada seria pior. */}
        <View style={estilos.cartao}>
          <View style={estilos.linhaDeNotificacao}>
            <View style={estilos.sino}>
              <Feather name="bell" size={20} color={COR.primaria} />
            </View>
            <View style={estilos.flex}>
              <Text style={estilos.tituloDoCartao}>Notificações no dispositivo</Text>
              <Text style={estilos.explicacao}>
                Receba lembretes da Maestra mesmo quando o app estiver fechado.
              </Text>
            </View>
          </View>
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTexto}>
              Os avisos no aparelho ainda não estão disponíveis nesta versão do app. Enquanto
              isso, o sino no topo mostra tudo o que aconteceu.
            </Text>
          </View>
        </View>

        <View style={estilos.cartao}>
          <Text style={estilos.tituloDoCartao}>Assinatura</Text>
          <Text style={estilos.explicacao}>
            {temAssinatura
              ? 'Sua assinatura Maestra Pro está ativa. A gestão do plano é feita na web.'
              : 'Você está no plano gratuito. Assine o Pro para desbloquear todo o potencial da plataforma.'}
          </Text>
          <Pressable
            style={({ pressed }) => [estilos.linha, pressed && estilos.tocada]}
            onPress={() => void irParaOCheckout({ destino: 'assinatura' })}
            accessibilityRole="link"
          >
            <Text style={estilos.linhaTexto}>
              {temAssinatura ? 'Gerenciar assinatura' : 'Ver planos'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [estilos.linha, pressed && estilos.tocada]}
          onPress={() => rota.push('/pagamentos')}
          accessibilityRole="button"
          accessibilityLabel="Histórico de pagamentos"
        >
          <Feather name="clock" size={16} color={COR_CONTA.rotulo} />
          <Text style={estilos.linhaTexto}>Histórico de pagamentos</Text>
          <Feather name="chevron-right" size={16} color={COR_CONTA.rotulo} />
        </Pressable>

        <View style={estilos.cartao}>
          <Text style={estilos.tituloDoCartao}>Suporte e termos</Text>

          {/* "Avaliar a Maestra" é o primeiro da lista, como na web — e é o único que não sai do
              app: a avaliação vai pro banco, e a equipe lê. */}
          <Pressable
            style={({ pressed }) => [estilos.linha, pressed && estilos.tocada]}
            onPress={() => setAvaliando(true)}
            accessibilityRole="button"
            accessibilityLabel="Avaliar a Maestra"
          >
            <Feather name="star" size={16} color={COR_CONTA.rotulo} />
            <Text style={estilos.linhaTexto}>Avaliar a Maestra</Text>
            <Feather name="chevron-right" size={16} color={COR_CONTA.rotulo} />
          </Pressable>

          {([
            ['Termos de uso', '/termos'],
            ['Política de privacidade', '/privacidade'],
            ['Falar com o suporte', '/suporte'],
          ] as const).map(([rotulo, caminho]) => (
            <Pressable
              key={caminho}
              style={({ pressed }) => [estilos.linha, pressed && estilos.tocada]}
              onPress={() => Linking.openURL(`${SITE}${caminho}`)}
              accessibilityRole="link"
            >
              <Feather name="external-link" size={16} color={COR_CONTA.rotulo} />
              <Text style={estilos.linhaTexto}>{rotulo}</Text>
              <Feather name="chevron-right" size={16} color={COR_CONTA.rotulo} />
            </Pressable>
          ))}
        </View>

        <View style={estilos.cartao}>
          <Text style={estilos.tituloDoCartao}>Seus dados</Text>
          <Text style={estilos.explicacao}>
            Baixe uma cópia de tudo que a Maestra guarda sobre você: conta, perfis de artista,
            catálogo, agenda, planejamento e conversas com a Nyta.
          </Text>
          <Pressable
            style={({ pressed }) => [estilos.linha, (pressed || exportando) && estilos.tocada]}
            onPress={exportarDados}
            disabled={exportando}
            accessibilityRole="button"
            accessibilityLabel="Baixar meus dados"
          >
            <Feather name="download" size={16} color={COR_CONTA.rotulo} />
            <Text style={estilos.linhaTexto}>
              {exportando ? 'Preparando…' : 'Baixar meus dados'}
            </Text>
            {exportando && <ActivityIndicator size="small" color={COR.primaria} />}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [estilos.linha, pressed && estilos.tocada]}
          onPress={sair}
          accessibilityRole="button"
        >
          <Text style={estilos.linhaTexto}>Sair da conta</Text>
        </Pressable>

        <Text style={estilos.secao}>Conta</Text>
        <Text style={estilos.explicacao}>
          Ao confirmar, {temAssinatura ? 'sua assinatura é cancelada e ' : ''}sua conta e todos os
          perfis entram na fila de exclusão. Eles são apagados definitivamente em 30 dias — prazo
          que existe para você poder desistir e para proteger contas invadidas.
        </Text>

        <Pressable
          style={({ pressed }) => [estilos.perigo, (pressed || excluindo) && estilos.tocada]}
          onPress={confirmar}
          disabled={excluindo}
          accessibilityRole="button"
          accessibilityLabel="Excluir minha conta"
        >
          {excluindo
            ? <ActivityIndicator color={COR.erro} />
            : <Text style={estilos.perigoTexto}>Excluir minha conta</Text>}
        </Pressable>

        {!!erro && <Text style={estilos.erro}>{erro}</Text>}
      </ScrollView>

      <FolhaDaAvaliacao
        aberta={avaliando}
        usuarioId={usuario?.id}
        aoFechar={() => setAvaliando(false)}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  // Os cartoes sao do MESMO cinza do fundo, com contorno fino e sem sombra — o oposto do cartao
  // branco elevado que a mesma classe usa no desktop. Ver `COR_CONTA`.
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { paddingHorizontal: 18, paddingTop: 27, paddingBottom: 48, gap: 10 },
  voltar: { fontSize: 16, color: COR.primaria, fontWeight: '600', paddingVertical: 4 },
  cartao: {
    padding: 25, gap: 10, marginBottom: 8,
    borderRadius: 8, borderWidth: 1, borderColor: COR_CONTA.contorno,
  },
  flex: { flex: 1, minWidth: 0 },
  tituloDoCartao: { fontSize: 16, fontWeight: '800', color: COR_CONTA.tituloDoCartao },
  linhaDoCartao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editarTexto: { fontSize: 13, fontWeight: '700', color: COR.primaria },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  foto: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COR_CONTA.disco,
    alignItems: 'center', justifyContent: 'center',
  },
  nome: { fontSize: 15, fontWeight: '700', color: COR_CONTA.titulo },
  email: { fontSize: 13, color: COR_CONTA.apoio, marginTop: 3 },
  dica: { fontSize: 12, color: COR.primaria, marginTop: 6 },
  campo: { gap: 8, marginTop: 6 },
  rotulo: { fontSize: 13, fontWeight: '700', color: COR_CONTA.rotulo },
  entrada: {
    minHeight: 46, paddingHorizontal: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_CONTA.contorno,
    backgroundColor: COR.superficie, fontSize: 15, color: COR_CONTA.titulo,
  },
  acoesDoPerfil: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 18, marginTop: 4,
  },
  cancelar: { fontSize: 14, color: COR_CONTA.apoio },
  salvar: {
    minHeight: 42, minWidth: 110, paddingHorizontal: 20, borderRadius: RAIO.campo,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  salvarTexto: { fontSize: 14, fontWeight: '700', color: COR.superficie },

  linhaDeNotificacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  sino: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CONTA.disco,
  },
  aviso: {
    padding: 14, borderRadius: RAIO.campoDeEntrada, backgroundColor: COR_CONTA.avisoFundo,
  },
  avisoTexto: { fontSize: 12, lineHeight: 19, color: COR_CONTA.aviso },

  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: COR_CONTA.contorno, borderRadius: 8,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  tocada: { opacity: 0.6 },
  linhaTexto: { flex: 1, fontSize: 15, fontWeight: '700', color: COR_CONTA.tituloDoCartao },
  secao: {
    fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    color: COR_CONTA.rotulo, fontWeight: '800', marginTop: 25,
  },
  explicacao: { fontSize: 12, color: COR_CONTA.texto, lineHeight: 19 },
  perigo: {
    borderWidth: 1, borderColor: COR.erro, borderRadius: 8,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  perigoTexto: { fontSize: 16, fontWeight: '800', color: COR.erro },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19, marginTop: 4 },
});
