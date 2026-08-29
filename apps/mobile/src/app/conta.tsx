import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COR, RAIO } from '@maestra/core/constants/design';
import { supabase } from '@maestra/core/lib/supabase';
import { cancelSubscription, fetchSubscriptionStatus } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { sair } from '@/nucleo/entrar';
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

export default function Conta() {
  const { sessao, carregando: carregandoSessao } = useSessao();
  const router = useRouter();
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
        <Text style={estilos.voltar} onPress={() => router.back()}>‹  Perfis</Text>
        <Text style={estilos.titulao}>Conta</Text>
        <Text style={estilos.email}>{usuario?.email}</Text>

        <Pressable
          style={({ pressed }) => [estilos.linha, pressed && estilos.tocada]}
          onPress={sair}
          accessibilityRole="button"
        >
          <Text style={estilos.linhaTexto}>Sair da conta</Text>
        </Pressable>

        <Text style={estilos.secao}>Excluir conta</Text>
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
  tela: { flex: 1, backgroundColor: COR.superficie },
  conteudo: { padding: 24, paddingBottom: 48, gap: 10 },
  voltar: { fontSize: 16, color: COR.primaria, fontWeight: '600', paddingVertical: 4 },
  titulao: { fontSize: 26, fontWeight: '800', color: COR.titulo, letterSpacing: -0.4 },
  email: { fontSize: 14, color: COR.apagado, marginBottom: 10 },
  linha: {
    borderWidth: 1, borderColor: COR.contorno, borderRadius: RAIO.cartao,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  tocada: { opacity: 0.6 },
  linhaTexto: { fontSize: 16, fontWeight: '600', color: COR.titulo },
  secao: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    color: COR.apagado, fontWeight: '700', marginTop: 22,
  },
  explicacao: { fontSize: 14, color: COR.secundario, lineHeight: 20 },
  perigo: {
    borderWidth: 1, borderColor: COR.erro, borderRadius: RAIO.cartao,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  perigoTexto: { fontSize: 16, fontWeight: '700', color: COR.erro },
  erro: { fontSize: 14, color: COR.erro, lineHeight: 20, marginTop: 4 },
});
