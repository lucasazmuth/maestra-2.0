import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COR, RAIO, COR_CONTA } from '@maestra/core/constants/design';
import { supabase } from '@maestra/core/lib/supabase';
import { cancelSubscription, fetchSubscriptionStatus } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { sair } from '@/nucleo/entrar';
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

        {/* As secoes sao as da web, em cartoes: Perfil, Assinatura, Suporte e termos, Seus dados
            e Conta. "Notificacoes no dispositivo" fica de fora enquanto o push nao existe no
            app — um interruptor que nao liga nada e pior do que a ausencia dele. */}
        <View style={estilos.cartao}>
          <Text style={estilos.tituloDoCartao}>Perfil</Text>
          <Text style={estilos.nome}>{usuario?.user_metadata?.full_name ?? 'Sua conta'}</Text>
          <Text style={estilos.email}>{usuario?.email}</Text>
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
            onPress={() => Linking.openURL(`${SITE}/assinatura`)}
            accessibilityRole="link"
          >
            <Text style={estilos.linhaTexto}>
              {temAssinatura ? 'Gerenciar assinatura' : 'Ver planos'}
            </Text>
          </Pressable>
        </View>

        <View style={estilos.cartao}>
          <Text style={estilos.tituloDoCartao}>Suporte e termos</Text>
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
              <Text style={estilos.linhaTexto}>{rotulo}</Text>
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
            style={({ pressed }) => [estilos.linha, pressed && estilos.tocada]}
            onPress={() => Linking.openURL(`${SITE}/settings`)}
            accessibilityRole="link"
          >
            <Text style={estilos.linhaTexto}>Baixar meus dados</Text>
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
  tituloDoCartao: { fontSize: 16, fontWeight: '800', color: COR_CONTA.tituloDoCartao },
  nome: { fontSize: 15, fontWeight: '700', color: COR_CONTA.titulo, marginTop: 4 },
  email: { fontSize: 13, color: COR_CONTA.apoio },
  linha: {
    borderWidth: 1, borderColor: COR_CONTA.contorno, borderRadius: 8,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  tocada: { opacity: 0.6 },
  linhaTexto: { fontSize: 16, fontWeight: '700', color: COR_CONTA.tituloDoCartao },
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
