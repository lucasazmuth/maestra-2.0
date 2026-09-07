import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import {
  CHAMADA_DO_DESBLOQUEIO, O_QUE_LIBERA, RECEBEDOR, VALOR_PADRAO_DO_PERFIL, parcelasPossiveis,
} from '@maestra/core/constants/checkout';
import {
  COR, COR_CHECKOUT, COR_DIAGNOSTICO, COR_SUCESSO, RAIO,
} from '@maestra/core/constants/design';
import { useCheckoutForm } from '@maestra/core/hooks/useCheckoutForm';
import { useCoupon } from '@maestra/core/hooks/useCoupon';
import { fmtBRL } from '@maestra/core/hooks/usePlanPrices';
import { CHAMADA_DO_PLANEJAMENTO } from '@maestra/core/constants/realNarrative';
import { shouldEnrichChartmetric } from '@maestra/core/lib/chartmetricFreshness';
import { supabase } from '@maestra/core/lib/supabase';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { createArtistCharge, pollArtistPurchase } from '@maestra/core/store/slices/artistPurchases';
import { createAsaasCustomer, fetchPlanConfig } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

import { Carrinho } from '@/casca/checkout/Carrinho';
import { Confete } from '@/casca/checkout/Confete';
import { CampoDeCpf, FormularioDoCartao } from '@/casca/checkout/Cartao';
import { Cupom } from '@/casca/checkout/Cupom';
import { Metodos, type MeioDePagamento } from '@/casca/checkout/Metodos';
import { Parcelas } from '@/casca/checkout/Parcelas';
import { FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';
import { Relatorio, mostrarBarraDoConvite } from '@/casca/diagnostico/Relatorio';
import { MaestraMarca } from '@/icones';
import { MODO_DE_VENDA, VENDE_DESBLOQUEIO_NO_APP, irParaOCheckout } from '@/nucleo/loja';
import { useSessao } from '@/nucleo/sessao';

// DESBLOQUEIO DO PERFIL — a tela que cobra.
//
// O perfil nasce pendente no diagnóstico; aqui ele é liberado de vez. É o mesmo checkout da web
// (`src/pages/ProfileUnlock`), com as mesmas quatro etapas: o diagnóstico salvo, o pagamento, o
// PIX e o sucesso.
//
// Regras, validações e cobrança vêm todas do NÚCLEO — `useCheckoutForm`, `useCoupon` e os thunks
// da Asaas são os mesmos das duas telas de checkout da web. O que existe aqui é o desenho.
//
// ⚠️ O CHECKOUT RODA AQUI, por decisão do produto — cartão e PIX pela Asaas. A 3.1.1 alcança o
// desbloqueio do mesmo jeito que alcança a assinatura: o texto dela cita "unlocking a full
// version" ao lado de "subscriptions". A leitura, a decisão e as duas saídas estão em
// `nucleo/loja`; a tela tem os DOIS corpos e escolhe por `VENDE_DESBLOQUEIO_NO_APP`, então
// devolver a compra ao navegador é uma linha, sem reescrever nada.
//
// A assinatura NÃO acompanha: ela é recorrente e continua saindo para o checkout da web.

type Etapa = 'diagnostico' | 'pagamento' | 'pix' | 'pronto';

const SITE = 'https://www.maestramanager.com';

export default function Desbloquear() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, carregando: carregandoSessao } = useSessao();
  const dispatch = useAppDispatch();
  const usuario = sessao?.user;

  const artista = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  const carregado = useAppSelector((s) => s.artists.loaded);
  const plano = useAppSelector((s) => s.subscription.plan);

  const [etapa, setEtapa] = useState<Etapa>('pagamento');
  const [meio, setMeio] = useState<MeioDePagamento>('PIX');
  const [parcelas, setParcelas] = useState(12);
  const [erroDoPagamento, setErroDoPagamento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resgatando, setResgatando] = useState(false);
  const [liberadoPorPasse, setLiberadoPorPasse] = useState(false);
  const [pix, setPix] = useState<{ qrCode: string | null; copyPaste: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Para levar de volta ao formulário quando faltar preencher algo (o equivalente do
  // `focusFirstInvalidField` da web: lá o campo inválido é focado e rolado até o meio da tela).
  const rolagem = useRef<ScrollView>(null);
  const alturaDoFormulario = useRef(0);

  // A barra fixa do rodapé, com o convite para o planejamento.
  //
  // Ela aparece DEPOIS que o cartão do perfil sai da tela — quem acabou de ver a própria fase
  // ainda está no "uau", e pedir a decisão ali atropela a leitura — e some quando o convite de
  // verdade entra em cena, para não haver dois botões dizendo a mesma coisa ao mesmo tempo.
  //
  // É a mesma regra dos dois `IntersectionObserver` da web, com o que o React Native tem:
  // `onLayout` para as âncoras e `onScroll` para a posição.
  const margem = useSafeAreaInsets();
  const [ancoras, setAncoras] = useState<{ fimDoPerfil?: number; inicioDaChamada?: number }>({});
  const [rolagemY, setRolagemY] = useState(0);
  const [alturaVisivel, setAlturaVisivel] = useState(0);

  const formulario = useCheckoutForm();
  const cupom = useCoupon();

  const nome = usuario?.user_metadata?.full_name
    || usuario?.user_metadata?.name
    || usuario?.email?.split('@')[0]
    || '';
  const email = usuario?.email || '';

  const barraDoConvite = mostrarBarraDoConvite({ ...ancoras, rolagemY, alturaVisivel });

  /**
   * O que "Começar meu planejamento com a Nyta" faz.
   *
   * Quando a venda é por link externo, vai DIRETO para o checkout da web. A tela de pagamento
   * no meio do caminho não decide nada — ela repete o que a pessoa acabou de ler no convite e
   * termina no mesmo botão. Um passo a mais entre a decisão e o pagamento é um passo a mais
   * para desistir.
   *
   * Ela continua existindo, e é o que se vê ao ABRIR um perfil bloqueado: ali não houve
   * convite nenhum antes, e a tela é que explica o que o desbloqueio libera.
   *
   * Nos outros modos o passo intermediário é necessário: com a venda dentro do app é lá que
   * mora o formulário de pagamento, e com a venda desligada é lá que está a explicação de que
   * a liberação se faz na conta Maestra.
   */
  const comecarOPlanejamento = () => {
    if (!VENDE_DESBLOQUEIO_NO_APP && MODO_DE_VENDA === 'link-externo') {
      void irParaOCheckout({ destino: 'desbloqueio', artistId: String(id) });
      return;
    }
    setEtapa('pagamento');
  };

  const valorDoPerfil = plano?.profileUnlockValue ?? VALOR_PADRAO_DO_PERFIL;
  const maximoDeParcelas = parcelasPossiveis(valorDoPerfil);
  const conteudo = artista?.content as Record<string, any> | undefined;
  const foto = conteudo?.spotifyProfile?.image as string | undefined;
  const real = conteudo?.realIndex as Record<string, any> | undefined;

  // A lista pode não estar carregada quando se chega aqui por link direto.
  useEffect(() => {
    if (!carregado && usuario?.id) dispatch(artistsActions.fetchArtists(usuario.id));
  }, [carregado, usuario?.id, dispatch]);

  // O preço vem da config (a mesma da assinatura), editável sem deploy.
  useEffect(() => { dispatch(fetchPlanConfig()); }, [dispatch]);

  useEffect(() => {
    setParcelas((n) => Math.min(Math.max(1, n), maximoDeParcelas));
  }, [maximoDeParcelas]);

  // Perfil já pago não tem o que desbloquear; perfil que não existe volta para a lista.
  useEffect(() => {
    if (!carregado || etapa === 'pronto') return;
    if (!artista) router.replace('/perfis');
    else if (artista.is_locked === false) {
      router.replace({ pathname: '/artista/[id]', params: { id: String(id) } });
    }
  }, [carregado, artista, id, etapa]);

  const ehCartao = meio === 'CREDIT' || meio === 'DEBIT';
  const tipoDeCobranca: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' =
    meio === 'PIX' ? 'PIX' : meio === 'CREDIT' ? 'CREDIT_CARD' : 'DEBIT_CARD';

  const { amount: descontoDoCupom, final: precoComDesconto } = cupom.discountFor(valorDoPerfil);
  const totalExibido = meio === 'CREDIT' && parcelas > 1
    ? `${parcelas}x de ${fmtBRL(precoComDesconto / parcelas)}`
    : fmtBRL(precoComDesconto);

  const concluir = useCallback(async (artistaId: string) => {
    // Destrava OTIMISTA: o pagamento já foi confirmado, então o perfil vira pago no estado
    // agora. Sem isso, o botão da tela de sucesso pode rebater para o checkout enquanto a
    // lista não recarrega.
    dispatch(artistsActions.markArtistPaidLocal({ id: artistaId }));
    setEtapa('pronto');
    // Enriquecimento profundo do Chartmetric (pós-pago), que alimenta a Nyta. Não bloqueia.
    if (shouldEnrichChartmetric(conteudo?.chartmetricProfile)) {
      supabase.functions.invoke('artist-enrich-chartmetric', { body: { artistId: artistaId } })
        .catch(() => {});
    }
    if (usuario?.id) await dispatch(artistsActions.fetchArtists(usuario.id));
  }, [dispatch, usuario?.id, conteudo]);

  // Um campo só para cupom e Pass Access: quem tem um código na mão não precisa saber qual dos
  // dois é. Tenta primeiro como passe — se não for, a function responde sem consumir nada.
  const aplicarCodigo = async () => {
    if (!id) return;
    const codigo = cupom.input.trim();
    if (!codigo) return;
    setResgatando(true);
    setErroDoPagamento('');
    try {
      const { data } = await supabase.functions.invoke('redeem-access-pass', {
        body: { code: codigo, artistId: id },
      });
      if (data?.ok) {
        setLiberadoPorPasse(true);
        await concluir(String(id));
        return;
      }
    } catch {
      /* não era um passe: segue como cupom de desconto */
    } finally {
      setResgatando(false);
    }
    await cupom.apply('one_time', valorDoPerfil, meio === 'CREDIT' ? parcelas : undefined);
  };

  const pagar = async () => {
    if (!id) return;
    if (formulario.validate(ehCartao)) {
      // Marca os campos vazios de vermelho e volta para o formulário, em vez de repetir a
      // mensagem no botão: o que falta fica NO campo, que é onde se corrige. Sem a rolagem, o
      // toque não mostraria nada — o formulário fica acima do carrinho.
      formulario.markSubmitted(ehCartao);
      rolagem.current?.scrollTo({ y: alturaDoFormulario.current, animated: true });
      return;
    }
    setErroDoPagamento('');
    setEnviando(true);
    try {
      const cpf = formulario.cpf.replace(/\D/g, '');
      const telefone = formulario.phone.replace(/\D/g, '');
      const cliente = await dispatch(createAsaasCustomer({
        name: nome, email, cpfCnpj: cpf, ...(telefone ? { mobilePhone: telefone } : {}),
      }));
      if (createAsaasCustomer.rejected.match(cliente)) {
        setErroDoPagamento((cliente.payload as string) || 'Erro ao iniciar a cobrança.');
        return;
      }
      const customerId = (cliente.payload as { customerId: string }).customerId;
      const validade = formulario.cardExpiry.replace(/\D/g, '');

      const cobranca = await dispatch(createArtistCharge({
        artistId: String(id),
        customerId,
        billingType: tipoDeCobranca,
        ...(cupom.couponCode ? { couponCode: cupom.couponCode } : {}),
        // Parcelamento só existe no crédito; débito e PIX são sempre à vista.
        ...(tipoDeCobranca === 'CREDIT_CARD' && parcelas > 1 ? { installmentCount: parcelas } : {}),
        ...(ehCartao ? {
          creditCard: {
            holderName: formulario.cardName.trim(),
            number: formulario.cardNumber.replace(/\D/g, ''),
            expiryMonth: validade.slice(0, 2),
            expiryYear: `20${validade.slice(2, 4)}`,
            ccv: formulario.cardCvv,
          },
          creditCardHolderInfo: {
            name: nome, email, cpfCnpj: cpf,
            postalCode: formulario.cep.replace(/\D/g, ''), phone: telefone,
            ...(formulario.resolvedAddress ? {
              address: formulario.resolvedAddress.logradouro,
              province: formulario.resolvedAddress.bairro,
              city: formulario.resolvedAddress.localidade,
              uf: formulario.resolvedAddress.uf,
            } : {}),
          },
        } : {}),
      }));
      if (createArtistCharge.rejected.match(cobranca)) {
        setErroDoPagamento(
          (cobranca.payload as { message: string })?.message || 'Não consegui criar a cobrança.',
        );
        return;
      }
      const { purchaseId, status, pixData } = cobranca.payload;

      if (ehCartao && status === 'received') {
        await concluir(String(id));
        return;
      }
      if (pixData?.qrCode) {
        setPix(pixData);
        setEtapa('pix');
      }
      const confirmacao = await dispatch(pollArtistPurchase({ purchaseId }));
      if (pollArtistPurchase.fulfilled.match(confirmacao)) {
        await concluir(confirmacao.payload.artistId);
      } else {
        setErroDoPagamento(
          (confirmacao.payload as { message: string })?.message
          || 'Não consegui confirmar o pagamento.',
        );
      }
    } finally {
      setEnviando(false);
    }
  };

  const copiarPix = async () => {
    if (!pix?.copyPaste) return;
    await Clipboard.setStringAsync(pix.copyPaste);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const rotuloDaParcela = useMemo(() => (n: number) => (n === 1
    ? `À vista · ${fmtBRL(precoComDesconto)}`
    : `${n}x de ${fmtBRL(precoComDesconto / n)} sem juros`), [precoComDesconto]);

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  // ── Pós-pagamento: a tela de sucesso, escura, sem o resto do checkout ──────
  if (etapa === 'pronto') {
    return (
      <View style={estilos.sucesso}>
        {/* O fundo com as auroras e o confete — os mesmos da web, dentro de um WebView. */}
        <Confete />
        <View style={estilos.sucessoMiolo}>
        <MaestraMarca size={28} color={COR.sobrePrimaria} />
        <Text style={estilos.sucessoTitulo}>
          {liberadoPorPasse ? 'Pass Access confirmado!' : 'Pagamento confirmado!'}
        </Text>
        <Text style={estilos.sucessoApoio}>Seu planejamento estratégico está liberado.</Text>
        <Text style={estilos.sucessoTexto}>
          A Nyta já vai te guiar, passo a passo, na construção do seu plano.
        </Text>
        <Pressable
          style={estilos.sucessoBotao}
          onPress={() => router.replace({ pathname: '/wizard/[id]', params: { id: String(id) } })}
          accessibilityRole="button"
          accessibilityLabel="Iniciar planejamento"
        >
          <Text style={estilos.sucessoBotaoTexto}>Iniciar planejamento →</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace({ pathname: '/artista/[id]', params: { id: String(id) } })}
          accessibilityRole="button"
          accessibilityLabel="Abrir o perfil no app"
        >
          <Text style={estilos.sucessoLink}>Abrir o perfil no app</Text>
        </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
      <View style={[estilos.topo, etapa !== 'diagnostico' && estilos.topoComFolga]}>
        {/* 24, o mesmo do cabeçalho normal do app. Era 14 — a marca ficava menor que o
            rótulo da etapa ao lado dela. */}
        <MaestraMarca size={24} color={COR_DIAGNOSTICO.titulo} />
        {/* O mesmo `aria-label` da web: quem navega por leitor de tela ouve em que ponto do
            fluxo está, e não só o nome solto da etapa. */}
        <View
          style={estilos.fase}
          accessibilityRole="header"
          accessibilityLabel={etapa === 'diagnostico'
            ? 'Etapa 2 de 3: Diagnóstico REAL'
            : 'Etapa 3 de 3: Planejamento'}
        >
          <View style={estilos.pontos}>
            {[0, 1, 2].map((i) => {
              const atual = etapa === 'diagnostico' ? 1 : 2;
              return (
                <View
                  key={i}
                  style={[
                    estilos.ponto,
                    i <= atual && estilos.pontoAceso,
                    i === atual && estilos.pontoAtual,
                  ]}
                />
              );
            })}
          </View>
          {/* O nome COMPLETO da etapa. A web encurta para "Diagnóstico" abaixo de 560px, mas
              aqui a entrega tem nome próprio — "Diagnóstico REAL" é o produto, e o REAL sai na
              Georgia itálica da marca, como no `.flowReal` da web. */}
          <Text style={estilos.faseTexto} numberOfLines={1}>
            {etapa === 'diagnostico'
              ? <>Diagnóstico <Text style={estilos.faseReal}>REAL</Text></>
              : 'Planejamento'}
          </Text>
        </View>
        <Pressable
          style={estilos.sair}
          onPress={() => router.replace('/perfis')}
          accessibilityRole="button"
          accessibilityLabel="Sair"
        >
          <Feather name="x" size={20} color={COR_DIAGNOSTICO.texto} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={estilos.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={rolagem}
          contentContainerStyle={estilos.conteudo}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onLayout={(e) => setAlturaVisivel(e.nativeEvent.layout.height)}
          onScroll={(e) => setRolagemY(e.nativeEvent.contentOffset.y)}
        >
          {/* ── O diagnóstico salvo ─────────────────────────────────────── */}
          {etapa === 'diagnostico' && (
            real
              ? (
                <Relatorio
                  real={real}
                  chartmetric={conteudo?.chartmetricProfile ?? null}
                  // Sem isto o PDF sai sem nome, sem foto e com o docId "SEM-PERF": a referência
                  // que o suporte usa para achar o diagnóstico deixa de bater com a da web.
                  artista={{
                    id: artista?.id,
                    nome: artista?.name,
                    foto: conteudo?.spotifyProfile?.image,
                    vinculo: conteudo?.titularidade?.vinculo,
                  }}
                  aoContinuar={comecarOPlanejamento}
                  aoMedirAncoras={(a) => setAncoras((atual) => ({ ...atual, ...a }))}
                />
              )
              : (
                <View style={estilos.semDiagnostico}>
                  <Text style={estilos.semDiagnosticoTexto}>
                    Diagnóstico indisponível. Você ainda pode liberar o planejamento.
                  </Text>
                  <Pressable
                    style={estilos.continuar}
                    onPress={() => setEtapa('pagamento')}
                    accessibilityRole="button"
                    accessibilityLabel="Continuar"
                  >
                    <Text style={estilos.continuarTexto}>Continuar</Text>
                  </Pressable>
                </View>
              )
          )}

          {/* ── O pagamento, quando ele NÃO acontece aqui ───────────────── */}
          {etapa === 'pagamento' && !VENDE_DESBLOQUEIO_NO_APP && (
            <>
              {!!real && (
                <Pressable
                  style={estilos.voltar}
                  onPress={() => setEtapa('diagnostico')}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar ao diagnóstico"
                >
                  <Feather name="arrow-left" size={16} color={COR.primaria} />
                  <Text style={estilos.voltarTexto}>Voltar ao diagnóstico</Text>
                </Pressable>
              )}

              <View style={estilos.chamada}>
                <Text style={estilos.chamadaTitulo}>
                  {CHAMADA_DO_DESBLOQUEIO.titulo(artista?.name)}
                </Text>
                <Text style={estilos.chamadaApoio}>{CHAMADA_DO_DESBLOQUEIO.apoio}</Text>
              </View>

              {/* O cartão com o e-mail da conta fica só no checkout da WEB.
                  Ele existe para dizer QUEM está sendo cobrado, no instante em que se cobra —
                  e aqui não se cobra nada: esta tela só descreve o que o desbloqueio libera e
                  manda a pessoa para o navegador. Repetir o e-mail antes disso é ruído entre a
                  promessa e o botão. */}

              <View style={estilos.painel}>
                <Text style={estilos.painelTitulo}>O que você libera</Text>
                {O_QUE_LIBERA.map((item) => (
                  <View key={item} style={estilos.libera}>
                    <Feather name="check" size={15} color={COR.primaria} />
                    <Text style={estilos.liberaTexto}>{item}</Text>
                  </View>
                ))}
              </View>

              {/* O código de acesso NÃO é compra: é uma cortesia que libera o perfil sem
                  cobrança, e por isso continua acontecendo aqui dentro. */}
              <View style={estilos.painel}>
                <Text style={estilos.painelTitulo}>Tem um código de acesso?</Text>
                <View style={estilos.codigo}>
                  <TextInput
                    style={estilos.codigoCampo}
                    value={cupom.input}
                    onChangeText={cupom.setInput}
                    placeholder="Digite o código"
                    placeholderTextColor={COR_DIAGNOSTICO.criarEspacoReservado}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Código de acesso"
                  />
                  <Pressable
                    style={[estilos.codigoBotao, resgatando && estilos.apagado]}
                    onPress={aplicarCodigo}
                    disabled={resgatando}
                    accessibilityRole="button"
                    accessibilityLabel="Resgatar código"
                  >
                    {resgatando
                      ? <ActivityIndicator size="small" color={COR.primaria} />
                      : <Text style={estilos.codigoBotaoTexto}>Resgatar</Text>}
                  </Pressable>
                </View>
                {!!erroDoPagamento && <Text style={estilos.erro}>{erroDoPagamento}</Text>}
              </View>

              {MODO_DE_VENDA === 'link-externo' ? (
                <Pressable
                  style={estilos.continuar}
                  onPress={() => void irParaOCheckout({ destino: 'desbloqueio', artistId: String(id) })}
                  accessibilityRole="button"
                  accessibilityLabel="Liberar este perfil"
                >
                  <Text style={estilos.continuarTexto}>Liberar este perfil</Text>
                </Pressable>
              ) : (
                <Text style={estilos.forasDoApp}>
                  A liberação deste perfil é feita na sua conta Maestra, pelo navegador.
                </Text>
              )}
            </>
          )}

          {/* ── O checkout, para as superfícies que cobram ───────────────── */}
          {etapa === 'pagamento' && VENDE_DESBLOQUEIO_NO_APP && (
            <>
              {!!real && (
                <Pressable
                  style={estilos.voltar}
                  onPress={() => setEtapa('diagnostico')}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar ao diagnóstico"
                >
                  <Feather name="arrow-left" size={16} color={COR.primaria} />
                  <Text style={estilos.voltarTexto}>Voltar ao diagnóstico</Text>
                </Pressable>
              )}

              <View style={estilos.chamada}>
                <Text style={estilos.chamadaTitulo}>
                  {CHAMADA_DO_DESBLOQUEIO.titulo(artista?.name)}
                </Text>
                <Text style={estilos.chamadaApoio}>{CHAMADA_DO_DESBLOQUEIO.apoio}</Text>
              </View>

              <View style={estilos.conta}>
                <View style={estilos.contaDisco}>
                  <Feather name="check" size={15} color={COR.primaria} />
                </View>
                <Text style={estilos.contaEmail} numberOfLines={1}>{email}</Text>
              </View>

              <View
                style={estilos.painel}
                onLayout={(e) => { alturaDoFormulario.current = e.nativeEvent.layout.y; }}
              >
                <View style={estilos.painelCabeca}>
                  <View style={estilos.painelIcone}>
                    <Feather name="credit-card" size={18} color={COR.primaria} />
                  </View>
                  <Text style={estilos.painelTitulo}>
                    Insira as informações de pagamento para começar
                  </Text>
                </View>

                <View style={estilos.cpf}><CampoDeCpf formulario={formulario} /></View>

                <Metodos
                  meios={['CREDIT', 'PIX']}
                  escolhido={meio}
                  aoEscolher={setMeio}
                  corpo={(m) => (m === 'PIX'
                    ? <Text style={estilos.notaDoPix}>{CHAMADA_DO_DESBLOQUEIO.pix}</Text>
                    : <FormularioDoCartao formulario={formulario} />)}
                />
              </View>

              <Carrinho
                topo={(
                  <View style={estilos.topoDoCarrinho}>
                    <Cupom
                      valor={cupom.input}
                      aoMudar={cupom.setInput}
                      aoAplicar={aplicarCodigo}
                      aoLimpar={cupom.clear}
                      carregando={cupom.loading || resgatando}
                      erro={cupom.error}
                      aplicado={cupom.labelFor(valorDoPerfil)}
                    />
                    {meio === 'CREDIT' && (
                      <View style={estilos.parcelas}>
                        <Parcelas
                          valor={parcelas}
                          maximo={maximoDeParcelas}
                          aoEscolher={setParcelas}
                          rotuloDa={rotuloDaParcela}
                        />
                      </View>
                    )}
                  </View>
                )}
                item={{
                  imagem: foto,
                  nome: `Planejamento — ${artista?.name || 'seu artista'}`,
                  apoio: 'Acesso vitalício ao perfil',
                  preco: fmtBRL(valorDoPerfil),
                }}
                inclui={O_QUE_LIBERA}
                linhas={[
                  { rotulo: 'Subtotal', valor: fmtBRL(valorDoPerfil) },
                  ...(cupom.applied
                    ? [{ rotulo: `Cupom ${cupom.applied.code}`, valor: `−${fmtBRL(descontoDoCupom)}` }]
                    : []),
                  { rotulo: 'Total', valor: totalExibido, forte: true },
                ]}
                legal={(
                  <Text style={estilos.legal}>
                    {CHAMADA_DO_DESBLOQUEIO.legal} Ao continuar, você concorda com os{' '}
                    <Text
                      style={estilos.legalLink}
                      onPress={() => Linking.openURL(`${SITE}/legal/termos`)}
                    >
                      Termos de uso
                    </Text>
                    {' '}e a{' '}
                    <Text
                      style={estilos.legalLink}
                      onPress={() => Linking.openURL(`${SITE}/legal/privacidade`)}
                    >
                      Política de privacidade
                    </Text>.
                  </Text>
                )}
                rotuloDoBotao={meio === 'PIX' ? 'Gerar código PIX' : 'Concordar e pagar'}
                aoPagar={pagar}
                carregando={enviando}
                motivoDoBloqueio={formulario.validate(ehCartao) || undefined}
                erro={erroDoPagamento}
              />
            </>
          )}

          {/* ── O PIX ───────────────────────────────────────────────────── */}
          {etapa === 'pix' && VENDE_DESBLOQUEIO_NO_APP && !!pix?.qrCode && (
            <View style={estilos.pix}>
              <Text style={estilos.pixFala}>
                Escaneia o PIX abaixo. Assim que cair, eu te levo direto pro planejamento.
              </Text>

              <View style={estilos.pixCartao}>
                <Text style={estilos.pixRotulo}>VALOR A PAGAR</Text>
                <Text style={estilos.pixValor}>{fmtBRL(precoComDesconto)}</Text>
                {!!cupom.applied && (
                  <Text style={estilos.pixCupom}>
                    Cupom {cupom.applied.code} · −{fmtBRL(descontoDoCupom)}
                  </Text>
                )}

                <Image
                  source={{ uri: `data:image/png;base64,${pix.qrCode}` }}
                  style={estilos.qr}
                  accessibilityLabel="QR Code do PIX"
                />

                {!!pix.copyPaste && (
                  <>
                    <Text style={estilos.copiaECola} numberOfLines={3}>{pix.copyPaste}</Text>
                    <Pressable
                      style={estilos.copiar}
                      onPress={copiarPix}
                      accessibilityRole="button"
                      accessibilityLabel="Copiar o código PIX"
                    >
                      <Feather name={copiado ? 'check' : 'copy'} size={15} color={COR.primaria} />
                      <Text style={estilos.copiarTexto}>
                        {copiado ? 'Código copiado' : 'Copiar código'}
                      </Text>
                    </Pressable>
                  </>
                )}

                <Text style={estilos.recebedor}>
                  O pagamento aparecerá no seu banco em nome de{' '}
                  <Text style={estilos.recebedorNome}>{RECEBEDOR.razaoSocial}</Text>
                  {' '}· CNPJ {RECEBEDOR.cnpj}
                </Text>

                <View style={estilos.aguardando}>
                  <Feather name="clock" size={14} color={COR_CHECKOUT.titulo} />
                  <Text style={estilos.aguardandoTexto}>Aguardando confirmação…</Text>
                </View>

                {!!erroDoPagamento && <Text style={estilos.pixErro}>{erroDoPagamento}</Text>}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* A barra fixa: fora do ScrollView de propósito. Dentro dele, `position: absolute` rola
          junto com o conteúdo e não gruda em nada. */}
      {etapa === 'diagnostico' && !!real && barraDoConvite && (
        <View style={[estilos.barraFixa, { paddingBottom: 18 + margem.bottom }]}>
          <Pressable
            style={estilos.barraBotao}
            onPress={comecarOPlanejamento}
            accessibilityRole="button"
            accessibilityLabel={CHAMADA_DO_PLANEJAMENTO.botao}
          >
            <Text style={estilos.barraBotaoTexto} numberOfLines={1}>
              {CHAMADA_DO_PLANEJAMENTO.botao}
            </Text>
            <Feather name="arrow-right" size={16} color={COR.sobrePrimaria} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1, minWidth: 0 },
  // O mesmo ritmo da página do diagnóstico: o relatório aparece nos dois lugares.
  conteudo: { paddingHorizontal: 16, paddingBottom: 40, gap: FOLGA_APOS_O_CABECALHO },

  // A barra fixa do rodapé. O degradê da web vira uma faixa sólida com fio em cima: um gradiente
  // aqui exigiria mais uma camada só para o efeito, e o fio já separa a barra do que rola atrás.
  barraFixa: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 14, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: COR_DIAGNOSTICO.barraFio,
    backgroundColor: COR.fundo,
  },
  // O rótulo é longo ("Começar meu planejamento com a Nyta") e a barra é estreita: a 15 ele
  // saía cortado em "com a…" na largura de um iPhone comum. 14 com folga menor cabe inteiro —
  // um convite reticente não convida ninguém.
  barraBotao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 50, paddingHorizontal: 16, borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },
  barraBotaoTexto: {
    fontSize: 14, fontWeight: '800', letterSpacing: 0.14, color: COR.sobrePrimaria,
    flexShrink: 1,
  },

  // A folga até o conteúdo depende do que vem depois: o relatório traz o recuo do próprio
  // cabeçalho de módulo, e o passo de pagamento não — esse pede os 24. Ver `topoComFolga`.
  topo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 76, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COR_DIAGNOSTICO.criarTrilho,
  },
  topoComFolga: { marginBottom: 24 },
  fase: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  pontos: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ponto: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: COR_DIAGNOSTICO.criarPontoApagado,
  },
  pontoAceso: { backgroundColor: COR.primaria },
  pontoAtual: { width: 18 },
  faseTexto: {
    fontSize: 13, fontWeight: '700', letterSpacing: 0.13, color: COR_DIAGNOSTICO.titulo,
    flexShrink: 1,
  },
  // O REAL da marca: Georgia itálica, como no `.flowReal` da web e na placa do diagnóstico.
  faseReal: { fontFamily: 'Georgia', fontStyle: 'italic' },
  sair: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarContorno, backgroundColor: COR.superficie,
    shadowColor: 'rgb(46, 72, 117)', shadowOpacity: 0.08, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },

  voltar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voltarTexto: { fontSize: 14, fontWeight: '700', color: COR.primaria },

  chamada: { gap: 12 },
  chamadaTitulo: {
    fontSize: 25.6, fontWeight: '800', lineHeight: 28.16, letterSpacing: -0.512,
    color: COR_CHECKOUT.titulo,
  },
  chamadaApoio: { fontSize: 16, lineHeight: 25.6, color: COR_CHECKOUT.apoio },

  conta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, paddingHorizontal: 18, borderRadius: RAIO.cartao,
    borderWidth: 1, borderColor: COR_CHECKOUT.contorno, backgroundColor: COR.superficie,
    shadowColor: 'rgb(51, 72, 110)', shadowOpacity: 0.06, shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 }, elevation: 2,
  },
  contaDisco: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CHECKOUT.disco,
  },
  contaEmail: { flex: 1, fontSize: 15, fontWeight: '600', color: COR_CHECKOUT.titulo },

  painel: {
    padding: 22, borderRadius: 16,
    borderWidth: 1, borderColor: COR_CHECKOUT.contorno, backgroundColor: COR.superficie,
    shadowColor: 'rgb(51, 72, 110)', shadowOpacity: 0.06, shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 }, elevation: 2,
  },
  painelCabeca: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  painelIcone: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CHECKOUT.disco,
  },
  painelTitulo: {
    flex: 1, fontSize: 20, fontWeight: '800', lineHeight: 24, color: COR_CHECKOUT.titulo,
  },
  cpf: { marginBottom: 16 },
  notaDoPix: { fontSize: 14, lineHeight: 21.7, color: COR_CHECKOUT.apoio },

  topoDoCarrinho: { marginBottom: 20 },
  parcelas: { marginTop: 16 },
  libera: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  liberaTexto: { flex: 1, fontSize: 14, lineHeight: 20, color: COR_DIAGNOSTICO.texto },
  codigo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  codigoCampo: {
    flex: 1, height: 48, paddingHorizontal: 14, borderRadius: RAIO.campo,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarCampoContorno,
    backgroundColor: COR.superficie, fontSize: 15, color: COR_DIAGNOSTICO.titulo,
  },
  codigoBotao: {
    height: 48, paddingHorizontal: 18, borderRadius: RAIO.campo, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: COR.primaria,
  },
  codigoBotaoTexto: { fontSize: 14, fontWeight: '800', color: COR.primaria },
  apagado: { opacity: 0.5 },
  erro: { fontSize: 13, lineHeight: 19, color: COR.erro, marginTop: 10 },
  forasDoApp: {
    fontSize: 13, lineHeight: 19, textAlign: 'center', color: COR_DIAGNOSTICO.texto,
    marginTop: 4,
  },
  legal: { fontSize: 12, lineHeight: 18, color: COR_CHECKOUT.texto },
  legalLink: { color: COR_CHECKOUT.texto, textDecorationLine: 'underline', fontWeight: '600' },

  semDiagnostico: { alignItems: 'center', gap: 18, paddingVertical: 40 },
  semDiagnosticoTexto: { fontSize: 15, textAlign: 'center', color: COR_CHECKOUT.apoio },
  // O CTA da marca: pílula, 15/32, texto 16/800 e centrado. Era 13/22 com texto 14 e cantos de
  // campo de formulário — do tamanho de um botão secundário, na hora em que a tela pede a
  // decisão mais importante dela.
  continuar: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, paddingHorizontal: 32, borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },
  continuarTexto: {
    fontSize: 16, fontWeight: '800', letterSpacing: 0.16, color: COR.sobrePrimaria,
  },

  pix: { gap: 18 },
  pixFala: {
    fontSize: 22, fontWeight: '800', lineHeight: 26.4, textAlign: 'center',
    color: COR_DIAGNOSTICO.titulo,
  },
  pixCartao: {
    alignItems: 'center', gap: 14, padding: 22, borderRadius: 16,
    borderWidth: 1, borderColor: COR_CHECKOUT.contorno, backgroundColor: COR.superficie,
  },
  pixRotulo: {
    fontSize: 13, fontWeight: '600', letterSpacing: 0.52, color: COR_CHECKOUT.apoio,
  },
  pixValor: {
    fontSize: 30, fontWeight: '800', lineHeight: 34.5, color: COR.titulo, marginTop: -12,
  },
  pixCupom: {
    fontSize: 13, fontWeight: '600', color: COR_CHECKOUT.descontoPix, marginTop: -10,
  },
  // O QR precisa de fundo BRANCO: o PNG vem com fundo transparente e a leitura depende do
  // contraste entre os quadrados e o que está atrás deles.
  qr: { width: 220, height: 220, borderRadius: 8, backgroundColor: COR.superficie },
  copiaECola: {
    width: '100%', fontSize: 12, lineHeight: 17, color: COR_CHECKOUT.texto,
    padding: 12, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_CHECKOUT.campoContorno, backgroundColor: COR.fundo,
  },
  copiar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.compartilharContorno,
  },
  copiarTexto: { fontSize: 14, fontWeight: '700', color: COR.primaria },
  recebedor: {
    fontSize: 12.5, lineHeight: 18.75, textAlign: 'center', color: COR_CHECKOUT.apoio,
  },
  recebedorNome: { fontWeight: '700', color: COR_CHECKOUT.titulo },
  aguardando: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aguardandoTexto: { fontSize: 14, color: COR_CHECKOUT.titulo },
  pixErro: { fontSize: 13, color: COR_CHECKOUT.erro, textAlign: 'center' },

  // A tela de sucesso é ESCURA, como na web: é uma tela de celebração, não de trabalho.
  sucesso: { flex: 1, backgroundColor: COR_SUCESSO.fundo },
  // O miolo fica ACIMA do confete, como na web (lá o conteúdo tem `z-index: 1` sobre o canvas).
  sucessoMiolo: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
    maxWidth: 480, alignSelf: 'center',
  },
  sucessoTitulo: {
    fontSize: 30, fontWeight: '800', lineHeight: 34.5, letterSpacing: -0.6, textAlign: 'center',
    color: COR.sobrePrimaria, marginTop: 26,
  },
  sucessoApoio: {
    fontSize: 17, lineHeight: 27.2, textAlign: 'center', color: COR_SUCESSO.apoio,
  },
  sucessoTexto: {
    fontSize: 15, lineHeight: 24, textAlign: 'center', color: COR_SUCESSO.texto, marginBottom: 22,
  },
  sucessoBotao: {
    paddingVertical: 15, paddingHorizontal: 44, borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },
  sucessoBotaoTexto: { fontSize: 16, fontWeight: '700', color: COR.sobrePrimaria },
  sucessoLink: { fontSize: 14, fontWeight: '600', color: COR_SUCESSO.texto, marginTop: 8 },
});
