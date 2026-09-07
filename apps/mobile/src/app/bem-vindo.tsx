import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { BOAS_VINDAS } from '@maestra/core/constants/landing';
import { COR, COR_CABECALHO_DE_MODULO, RAIO } from '@maestra/core/constants/design';
import { supabase } from '@maestra/core/lib/supabase';
import * as membersDb from '@maestra/core/services/db/members';

import { MaestraMarca } from '@/icones';

// A TELA DE BOAS-VINDAS — o primeiro instante de quem acabou de criar a conta.
//
// Ela existia só na web. No app, o código de confirmação levava direto para a criação do
// primeiro perfil: a conta nascia e a pessoa já estava dentro de um formulário, sem uma linha
// dizendo onde tinha chegado.
//
// E ela não é só uma saudação. Quem chega aqui pode ser dois tipos de pessoa, e mandar as duas
// para o mesmo lugar confunde justamente quem tem menos contexto:
//
//   • artista sem perfil nenhum          → criar o primeiro perfil
//   • convidado para a equipe de alguém  → ver e aceitar o convite
//
// O convite pendente NÃO conta como perfil: `get_shared_artist_ids_v2` só devolve membros com
// status 'active', então a contagem de artistas dá zero para quem ainda não aceitou. Sem a
// checagem de convites, o convidado era empurrado a criar um perfil que ele não veio criar.

type Chegada = { rota: '/perfis' | '/criar-artista'; convidado: boolean };

const VELOCIDADE_DA_DIGITACAO = 32;

export default function BemVindo() {
  const router = useRouter();

  const [chegada, setChegada] = useState<Chegada | null>(null);
  const saudacao = chegada?.convidado ? BOAS_VINDAS.convidado : BOAS_VINDAS.artista;

  const [digitado, setDigitado] = useState('');
  const pronto = digitado.length >= saudacao.length;
  const surgir = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let vivo = true;
    const decidir = (c: Chegada) => { if (vivo) setChegada(c); };

    Promise.all([
      // Sem filtro por user_id: a RLS de `artists` já devolve os próprios E os compartilhados.
      supabase.from('artists').select('id', { count: 'exact', head: true }),
      membersDb.fetchPendingInvites().catch(() => []),
    ])
      .then(([perfis, convites]) => {
        const temPerfil = !perfis.error && (perfis.count ?? 0) > 0;
        const temConvite = convites.length > 0;
        decidir({
          rota: temPerfil || temConvite ? '/perfis' : '/criar-artista',
          convidado: !temPerfil && temConvite,
        });
      })
      // Em caso de falha, a lista de perfis é o destino seguro: ela lida com os dois casos e é
      // onde o convite pendente aparece.
      .catch(() => decidir({ rota: '/perfis', convidado: false }));

    return () => { vivo = false; };
  }, []);

  // A digitação só começa quando sabemos qual das duas saudações usar — senão a frase trocaria
  // no meio, na frente da pessoa.
  useEffect(() => {
    if (!chegada) return;
    let cancelado = false;

    // O id do intervalo mora FORA do `then`: um `return` de dentro dele não é a limpeza do
    // efeito, e o relógio seguiria correndo depois da tela sair — pintando estado em componente
    // desmontado.
    let relogio: ReturnType<typeof setInterval> | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduzir) => {
      if (cancelado) return;
      if (reduzir) { setDigitado(saudacao); return; }
      let i = 0;
      relogio = setInterval(() => {
        i += 1;
        setDigitado(saudacao.slice(0, i));
        if (i >= saudacao.length && relogio) clearInterval(relogio);
      }, VELOCIDADE_DA_DIGITACAO);
    });

    return () => { cancelado = true; if (relogio) clearInterval(relogio); };
  }, [chegada, saudacao]);

  // O botão só aparece quando a frase termina: ele é a resposta ao que foi dito.
  useEffect(() => {
    if (!pronto) return;
    Animated.timing(surgir, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [pronto, surgir]);

  const comecar = () => router.replace(chegada?.rota ?? '/perfis');

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.miolo}>
        {/* Só a `MaestraMarca`: ela JÁ é o símbolo mais a palavra no lettering oficial. Escrever
            "Maestra" ao lado escrevia a palavra duas vezes, a segunda na fonte do app. */}
        <View style={estilos.pilula}>
          <MaestraMarca size={32} color={COR_CABECALHO_DE_MODULO.titulo} />
        </View>

        <Text style={estilos.saudacao} accessibilityLiveRegion="polite">{digitado}</Text>

        <Animated.View style={{ opacity: surgir, transform: [{ translateY: surgir.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <Pressable
            style={[estilos.botao, !pronto && estilos.botaoApagado]}
            onPress={comecar}
            disabled={!pronto}
            accessibilityRole="button"
            accessibilityLabel={chegada?.convidado ? BOAS_VINDAS.botaoDoConvite : BOAS_VINDAS.botao}
          >
            <Text style={estilos.botaoTexto}>
              {chegada?.convidado ? BOAS_VINDAS.botaoDoConvite : BOAS_VINDAS.botao}
            </Text>
            <Feather name="arrow-right" size={18} color={COR.sobrePrimaria} />
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  // Tudo centrado, como na web: lá a página é `align-items: center` com `text-align: center`.
  miolo: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24, gap: 36,
  },
  pilula: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 30, borderRadius: RAIO.pilula,
    borderWidth: 1, borderColor: COR.divisoria, backgroundColor: COR.superficie,
  },
  // A altura mínima segura o botão no lugar enquanto a frase é digitada: sem ela, ele sobe e
  // desce a cada linha nova.
  saudacao: {
    fontSize: 26, lineHeight: 35, fontWeight: '800', letterSpacing: -0.4,
    textAlign: 'center', color: COR_CABECALHO_DE_MODULO.titulo, minHeight: 175,
  },
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 26, borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },
  botaoApagado: { opacity: 0.5 },
  botaoTexto: { fontSize: 16, fontWeight: '800', color: COR.sobrePrimaria },
});
