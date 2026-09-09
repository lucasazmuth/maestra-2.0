import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM } from '@maestra/core/constants/design';
import { PAPEIS_SUGERIDOS_DA_PISTA } from '@maestra/core/constants/maestra';
import type { CatalogVersionFile } from '@maestra/core/interfaces/maestra';

import { Bloco, Folha, Linha } from '@/casca/Folha';

// O que se faz com uma pista fora de tocar: renomear, mover, remover.
//
// Estas três não cabem na linha da pista. A linha tem quatro alvos (mutar, solar, o volume e a
// própria onda) e é onde o dedo trabalha enquanto ouve; pôr lá um "remover" é convidar ao
// engano. Aqui elas ficam à distância de um toque a mais, que é a distância certa para uma
// ação que apaga 40 MB.
//
// ⚠️ REMOVER APAGA O FICHEIRO DO BALDE, e não só a linha do banco. Um stem é grande; deixar o
// arquivo órfão no armazenamento é custo que ninguém volta a olhar. Daí a confirmação.

export const FolhaDaPista = ({ aberta, pista, primeira, ultima, aoFechar, aoRenomear, aoMover, aoRemover }: {
  aberta: boolean;
  pista: CatalogVersionFile | null;
  primeira: boolean;
  ultima: boolean;
  aoFechar: () => void;
  aoRenomear: (nome: string) => Promise<void>;
  aoMover: (direcao: -1 | 1) => Promise<void>;
  aoRemover: () => Promise<void>;
}) => {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  // O campo parte SEMPRE do nome que está no banco quando a folha abre. Sem isto, abrir a folha
  // de outra pista mostraria o texto que ficou da anterior.
  useEffect(() => { if (aberta) setNome(pista?.name ?? ''); }, [aberta, pista]);

  if (!pista) return null;

  const limpo = nome.trim();

  const salvar = async () => {
    setSalvando(true);
    try {
      if (limpo && limpo !== pista.name) await aoRenomear(limpo);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  };

  const remover = () => {
    Alert.alert(
      'Remover esta pista?',
      `"${pista.name}" sai da mesa e o arquivo é apagado. Não dá para desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => { void aoRemover().then(aoFechar); },
        },
      ],
    );
  };

  return (
    <Folha
      aberta={aberta}
      titulo="Pista"
      aoFechar={aoFechar}
      acao={{ rotulo: 'Salvar', aoTocar: salvar, carregando: salvando, desabilitada: !limpo }}
      destrutiva={{ rotulo: 'Remover', aoTocar: remover }}
    >
      <Bloco>
        <Linha primeira>
          <View style={estilos.campo}>
            <Text style={estilos.rotulo}>NOME DA PISTA</Text>
            <TextInput
              style={estilos.entrada}
              value={nome}
              onChangeText={setNome}
              maxLength={40}
              placeholder="Ex.: voz, bateria, 808"
              placeholderTextColor={COR_JAM.rotulo}
              accessibilityLabel="Nome da pista"
            />
          </View>
        </Linha>

        {/* Atalhos, e não uma lista fechada: um menu obrigaria "808" e "voz dobra" a virarem
            "Outros", e o nome da pista é justamente o que diz o que ela é. */}
        <Linha>
          <View style={estilos.sugestoes}>
            {PAPEIS_SUGERIDOS_DA_PISTA.map((papel) => (
              <Pressable
                key={papel}
                style={[estilos.sugestao, limpo === papel && estilos.sugestaoEscolhida]}
                onPress={() => setNome(papel)}
                accessibilityRole="button"
                accessibilityLabel={`Chamar esta pista de ${papel}`}
              >
                <Text style={[estilos.sugestaoTexto, limpo === papel && estilos.sugestaoTextoEscolhido]}>
                  {papel}
                </Text>
              </Pressable>
            ))}
          </View>
        </Linha>
      </Bloco>

      <Bloco rotulo="Ordem na mesa">
        <Linha primeira>
          <Pressable
            style={[estilos.mover, primeira && estilos.moverInerte]}
            onPress={() => { void aoMover(-1); }}
            disabled={primeira}
            accessibilityRole="button"
            accessibilityState={{ disabled: primeira }}
            accessibilityLabel="Mover esta pista para cima"
          >
            <Feather name="arrow-up" size={17} color={primeira ? COR_JAM.estrela : COR.primaria} />
            <Text style={[estilos.moverTexto, primeira && estilos.moverTextoInerte]}>
              Mover para cima
            </Text>
          </Pressable>
        </Linha>
        <Linha>
          <Pressable
            style={[estilos.mover, ultima && estilos.moverInerte]}
            onPress={() => { void aoMover(1); }}
            disabled={ultima}
            accessibilityRole="button"
            accessibilityState={{ disabled: ultima }}
            accessibilityLabel="Mover esta pista para baixo"
          >
            <Feather name="arrow-down" size={17} color={ultima ? COR_JAM.estrela : COR.primaria} />
            <Text style={[estilos.moverTexto, ultima && estilos.moverTextoInerte]}>
              Mover para baixo
            </Text>
          </Pressable>
        </Linha>
      </Bloco>
    </Folha>
  );
};

const estilos = StyleSheet.create({
  campo: { gap: 6 },
  rotulo: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: COR_JAM.rotulo },
  entrada: { paddingVertical: 2, fontSize: 15, color: COR_JAM.texto },
  sugestoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sugestao: {
    height: 32, paddingHorizontal: 12, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_JAM.fio, backgroundColor: COR_JAM.papel,
  },
  sugestaoEscolhida: { borderColor: COR.primaria, backgroundColor: COR.primaria },
  sugestaoTexto: { fontSize: 13, fontWeight: '600', color: COR_JAM.texto },
  sugestaoTextoEscolhido: { color: COR_JAM.papel },
  mover: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moverInerte: { opacity: 0.6 },
  moverTexto: { fontSize: 15, fontWeight: '600', color: COR.primaria },
  moverTextoInerte: { color: COR_JAM.estrela },
});
