import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as Clipboard from 'expo-clipboard';

import { COR, COR_SUPORTE, RAIO } from '@maestra/core/constants/design';
import {
  SUPPORT_EMAIL, SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_DISPLAY,
} from '@maestra/core/constants/legal';

import { GmailIcon, WhatsappIcon } from '@/icones';
import { useVoltar } from '@/nucleo/navegar';

// SUPORTE: os dois canais, como na web (`src/pages/Support`).
//
// Os textos e os endereços vêm do núcleo (`constants/legal`), que é onde já viviam — o e-mail
// esteve copiado em três telas da web, e um endereço errado num dos lugares só apareceria em
// produção.
//
// A web mostra os dois cartões lado a lado e empilha-os abaixo de 700px; no telemóvel só existe
// a segunda forma, então é essa.

/** O que cada canal faz, e o que fazer quando o aparelho não sabe abri-lo. */
const ASSUNTO_DO_EMAIL = 'Suporte Maestra';
const PRIMEIRA_MENSAGEM = 'Olá! Preciso de ajuda com a Maestra.';

export default function Suporte() {
  const voltar = useVoltar('/conta');
  const [copiado, setCopiado] = useState<string | null>(null);

  /**
   * Abre o canal — e, se o aparelho não souber, COPIA o endereço.
   *
   * ⚠️ ISTO NÃO É ZELO. O próprio comentário da tela da web diz de onde veio: o suporte era um
   * `mailto:` direto, "que só servia para quem tem cliente de e-mail configurado — no celular
   * costuma abrir nada". Um toque que não faz nada é pior do que um botão ausente: a pessoa
   * conclui que o suporte não funciona, e é justamente quem já está com um problema.
   *
   * Com a cópia, o pior caso vira "o endereço está na área de transferência".
   */
  const abrir = async (url: string, valor: string) => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* cai na cópia */
    }
    await Clipboard.setStringAsync(valor);
    setCopiado(valor);
  };

  const canais = [
    {
      chave: 'email',
      icone: <GmailIcon size={22} />,
      fundo: COR_SUPORTE.disco,
      titulo: 'E-mail',
      apoio: 'Melhor para dúvidas com detalhes, prints ou algo que precise de registro.',
      valor: SUPPORT_EMAIL,
      acao: 'Enviar e-mail',
      url: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(ASSUNTO_DO_EMAIL)}`,
    },
    {
      chave: 'whatsapp',
      icone: <WhatsappIcon size={22} />,
      fundo: COR_SUPORTE.discoWhatsapp,
      titulo: 'WhatsApp',
      apoio: 'Melhor para resolver rápido, quando você precisa de uma resposta na hora.',
      valor: SUPPORT_WHATSAPP_DISPLAY,
      acao: 'Abrir conversa',
      url: `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(PRIMEIRA_MENSAGEM)}`,
    },
  ];

  return (
    <SafeAreaView style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Pressable onPress={voltar} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={estilos.voltar}>‹  Voltar</Text>
        </Pressable>

        <Text style={estilos.sobretitulo}>AJUDA</Text>
        <Text style={estilos.titulo}>Suporte</Text>
        <Text style={estilos.apoio}>
          Fale com a gente pelo canal que preferir. Respondemos em horário comercial.
        </Text>

        {canais.map((canal) => (
          <Pressable
            key={canal.chave}
            style={({ pressed }) => [estilos.cartao, pressed && estilos.tocado]}
            onPress={() => { void abrir(canal.url, canal.valor); }}
            accessibilityRole="button"
            accessibilityLabel={`${canal.acao}: ${canal.valor}`}
          >
            <View style={[estilos.disco, { backgroundColor: canal.fundo }]}>{canal.icone}</View>
            <Text style={estilos.tituloDoCartao}>{canal.titulo}</Text>
            <Text style={estilos.apoioDoCartao}>{canal.apoio}</Text>
            <Text style={estilos.valor}>{canal.valor}</Text>
            <Text style={estilos.acao}>
              {copiado === canal.valor ? 'Copiado para a área de transferência' : `${canal.acao}  →`}
            </Text>
          </Pressable>
        ))}

        <Text style={estilos.nota}>
          Para agilizar, conte o que você estava fazendo quando o problema apareceu e, se der,
          mande um print da tela.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, paddingBottom: 40, gap: 10 },

  voltar: { fontSize: 15, fontWeight: '700', color: COR.primaria, marginBottom: 6 },
  sobretitulo: {
    fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    color: COR_SUPORTE.apoio, fontWeight: '800',
  },
  titulo: { fontSize: 26, fontWeight: '800', color: COR.titulo },
  apoio: { fontSize: 13.5, color: COR_SUPORTE.apoio, lineHeight: 20, marginBottom: 8 },

  cartao: {
    padding: 22, gap: 0,
    borderRadius: RAIO.cartao, backgroundColor: COR.superficie,
    borderWidth: 1, borderColor: COR_SUPORTE.contorno,
  },
  tocado: { opacity: 0.7 },
  disco: {
    width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  tituloDoCartao: {
    fontSize: 17, fontWeight: '800', color: COR_SUPORTE.titulo, marginTop: 18, marginBottom: 6,
  },
  apoioDoCartao: { fontSize: 12.5, color: COR_SUPORTE.apoio, lineHeight: 20 },
  valor: { fontSize: 13, fontWeight: '700', color: COR_SUPORTE.valor, marginTop: 14 },
  acao: { fontSize: 11.5, fontWeight: '800', color: COR.primaria, marginTop: 16 },

  nota: { fontSize: 12.5, color: COR_SUPORTE.apoio, lineHeight: 20, marginTop: 12 },
});
