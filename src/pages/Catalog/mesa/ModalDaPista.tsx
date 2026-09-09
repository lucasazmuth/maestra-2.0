import { FC, useEffect, useState } from 'react';
import { Button, Input, Modal, Popconfirm } from 'antd';
import { FiArrowDown, FiArrowUp } from 'react-icons/fi';

import { PAPEIS_SUGERIDOS_DA_PISTA } from '@maestra/core/constants/maestra';
import type { CatalogVersionFile } from '@maestra/core/interfaces/maestra';

import styles from './mesa.module.scss';

// O que se faz com uma pista fora de tocar: renomear, mover, remover.
//
// Estas três não cabem na linha da pista. A linha tem quatro alvos (mutar, solar, o volume e a
// própria onda) e é onde se trabalha enquanto se ouve; pôr lá um "remover" é convidar ao
// engano. Aqui elas ficam a um clique a mais, que é a distância certa para uma ação que apaga
// dezenas de MB.
//
// ⚠️ REMOVER APAGA O FICHEIRO DO BALDE, e não só a linha do banco — daí a confirmação.

export const ModalDaPista: FC<{
  pista: CatalogVersionFile | null;
  primeira: boolean;
  ultima: boolean;
  aoFechar: () => void;
  aoRenomear: (nome: string) => Promise<void>;
  aoMover: (direcao: -1 | 1) => Promise<void>;
  aoRemover: () => Promise<void>;
}> = ({ pista, primeira, ultima, aoFechar, aoRenomear, aoMover, aoRemover }) => {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  // O campo parte SEMPRE do nome que está no banco quando o modal abre. Sem isto, abrir o de
  // outra pista mostraria o texto que ficou da anterior.
  useEffect(() => { if (pista) setNome(pista.name); }, [pista]);

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

  return (
    <Modal
      open={Boolean(pista)}
      title='Pista'
      onCancel={aoFechar}
      onOk={salvar}
      okText='Salvar'
      cancelText='Cancelar'
      confirmLoading={salvando}
      okButtonProps={{ disabled: !limpo }}
    >
      <div className={styles.folhaDaPista}>
        <label>
          NOME DA PISTA
          <Input value={nome} maxLength={40} placeholder='Ex.: voz, bateria, 808' onChange={(e) => setNome(e.target.value)} />
        </label>

        {/* Atalhos, e não uma lista fechada: um menu obrigaria "808" e "voz dobra" a virarem
            "Outros", e o nome da pista é justamente o que diz o que ela é. */}
        <div className={styles.papeis}>
          {PAPEIS_SUGERIDOS_DA_PISTA.map((papel) => (
            <button
              key={papel}
              type='button'
              className={`${styles.papel} ${limpo === papel ? styles.papelEscolhido : ''}`}
              onClick={() => setNome(papel)}
            >
              {papel}
            </button>
          ))}
        </div>

        <div className={styles.mover}>
          <Button icon={<FiArrowUp />} disabled={primeira} onClick={() => { void aoMover(-1); }}>
            Mover para cima
          </Button>
          <Button icon={<FiArrowDown />} disabled={ultima} onClick={() => { void aoMover(1); }}>
            Mover para baixo
          </Button>
          <Popconfirm
            title='Remover esta pista?'
            description='Ela sai da mesa e o arquivo é apagado. Não dá para desfazer.'
            okText='Remover'
            cancelText='Cancelar'
            okButtonProps={{ danger: true }}
            onConfirm={() => { void aoRemover(); }}
          >
            <Button danger>Remover</Button>
          </Popconfirm>
        </div>
      </div>
    </Modal>
  );
};
