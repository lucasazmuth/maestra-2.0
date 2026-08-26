import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, Input, InputNumber, Modal, message } from 'antd';
import { FiPlus, FiMoreVertical } from 'react-icons/fi';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';

import {
  carregarNegocios,
  carregarQuadro,
  criarNegocio,
  emReais,
  moverNegocio,
  posicaoEntre,
  totalDaEtapa,
  type Etapa,
  type Funil,
  type Negocio,
} from './dados';
import styles from './Sales.module.scss';

// Quadro de negócios do CRM de vendas da Maestra.

const Cartao: FC<{ negocio: Negocio; etapas: Etapa[]; onMover: (destino: Etapa) => void }> = ({
  negocio,
  etapas,
  onMover,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: negocio.id });

  return (
    <article
      ref={setNodeRef}
      className={`${styles.cartao} ${isDragging ? styles.cartaoArrastando : ''}`}
    >
      {/* O arrasto fica no corpo do cartão, e NÃO no menu: com os listeners no elemento inteiro,
          abrir o menu iniciava um arrasto e o clique nunca chegava ao item. */}
      <div className={styles.cartaoCorpo} {...listeners} {...attributes}>
        <strong className={styles.cartaoTitulo}>{negocio.title}</strong>
        <span className={styles.cartaoValor}>{emReais(Number(negocio.value || 0))}</span>
      </div>

      {/* Mover sem arrastar. Um quadro que só responde a arrasto é inoperável por teclado e
          desconfortável no celular, e o time de vendas vive no celular. */}
      <Dropdown
        trigger={['click']}
        menu={{
          items: etapas
            .filter((e) => e.id !== negocio.stage_id)
            .map((e) => ({ key: e.id, label: `Mover para ${e.name}` })),
          onClick: ({ key }) => {
            const destino = etapas.find((e) => e.id === key);
            if (destino) onMover(destino);
          },
        }}
      >
        <button type='button' className={styles.cartaoMenu} aria-label={`Mover ${negocio.title}`}>
          <FiMoreVertical />
        </button>
      </Dropdown>
    </article>
  );
};

const Coluna: FC<{
  etapa: Etapa;
  negocios: Negocio[];
  etapas: Etapa[];
  onMover: (negocio: Negocio, destino: Etapa) => void;
  onNovo: (etapa: Etapa) => void;
}> = ({ etapa, negocios, etapas, onMover, onNovo }) => {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const total = totalDaEtapa(negocios, etapa.id);
  const daColuna = negocios.filter((n) => n.stage_id === etapa.id);

  return (
    <section className={`${styles.coluna} ${isOver ? styles.colunaAlvo : ''}`} ref={setNodeRef}>
      <header className={styles.colunaTopo} style={{ '--cor-etapa': etapa.color || '#7c8db3' } as any}>
        <div>
          <h2 className={styles.colunaNome}>{etapa.name}</h2>
          {/* Contagem e soma no cabeçalho: é o que faz o quadro ser lido como funil, e não
              apenas como uma lista de cartões. */}
          <span className={styles.colunaTotal}>
            {total.quantidade} · {emReais(total.valor)}
          </span>
        </div>
        <button
          type='button'
          className={styles.colunaAdd}
          onClick={() => onNovo(etapa)}
          aria-label={`Novo negócio em ${etapa.name}`}
        >
          <FiPlus />
        </button>
      </header>

      <div className={styles.colunaLista}>
        {daColuna.map((n) => (
          <Cartao key={n.id} negocio={n} etapas={etapas} onMover={(destino) => onMover(n, destino)} />
        ))}
        {daColuna.length === 0 && <p className={styles.colunaVazia}>Nenhum negócio aqui.</p>}
      </div>
    </section>
  );
};

export const Kanban: FC = () => {
  const [funil, setFunil] = useState<Funil | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<Negocio | null>(null);
  // A perda vira estado, e nao Modal.confirm: a funcao estatica do antd v5 nao renderiza nada
  // sob React 19 (sem o patch de compatibilidade) e falha EM SILENCIO — o cartao simplesmente
  // nao se mexia. O resto do projeto ja usa <Modal> controlado por isso.
  const [perdendo, setPerdendo] = useState<{ negocio: Negocio; destino: Etapa } | null>(null);
  const [motivoDaPerda, setMotivoDaPerda] = useState('');
  const [novoEm, setNovoEm] = useState<Etapa | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoValor, setNovoValor] = useState<number>(0);

  // Um toque curto não pode virar arrasto: sem a distância mínima, abrir o menu do cartão
  // arrastava o cartão junto.
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { funil: f, etapas: e } = await carregarQuadro();
      setFunil(f);
      setEtapas(e);
      setNegocios(await carregarNegocios(f.id));
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível carregar o quadro.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const aplicarMovimento = useCallback(
    (negocio: Negocio, destino: Etapa, motivo?: string) => {
      const daColuna = negocios.filter((n) => n.stage_id === destino.id);
      const posicao = posicaoEntre(daColuna[daColuna.length - 1]?.board_position, undefined);
      const antes = negocios;

      // Otimista: o cartão troca de coluna na hora. Vendedor arrastando não deve esperar a ida
      // e volta do banco; se falhar, o estado anterior volta e o erro aparece.
      setNegocios((atual) =>
        atual.map((n) =>
          n.id === negocio.id
            ? { ...n, stage_id: destino.id, board_position: posicao, status: destino.kind }
            : n
        )
      );
      moverNegocio({ negocio, etapaDestino: destino, posicao, motivoDaPerda: motivo }).catch(
        (err: any) => {
          setNegocios(antes);
          message.error(err?.message || 'Não foi possível mover o negócio.');
        }
      );
    },
    [negocios]
  );

  const mover = useCallback(
    (negocio: Negocio, destino: Etapa) => {
      if (negocio.stage_id === destino.id) return;
      // Perda sem motivo não vira relatório depois, só vira "perdemos vários". O banco recusa
      // (constraint sales_deals_perda_tem_motivo), então perguntar aqui evita o erro cru.
      if (destino.kind === 'lost') {
        setMotivoDaPerda('');
        setPerdendo({ negocio, destino });
        return;
      }
      aplicarMovimento(negocio, destino);
    },
    [aplicarMovimento]
  );

  const confirmarPerda = () => {
    if (!perdendo || !motivoDaPerda.trim()) return;
    aplicarMovimento(perdendo.negocio, perdendo.destino, motivoDaPerda.trim());
    setPerdendo(null);
    setMotivoDaPerda('');
  };

  const aoSoltar = (evento: DragEndEvent) => {
    setArrastando(null);
    const destino = etapas.find((e) => e.id === evento.over?.id);
    const negocio = negocios.find((n) => n.id === evento.active.id);
    if (destino && negocio) mover(negocio, destino);
  };

  const aoPegar = (evento: DragStartEvent) =>
    setArrastando(negocios.find((n) => n.id === evento.active.id) || null);

  const criar = async () => {
    if (!funil || !novoEm || !novoTitulo.trim()) return;
    try {
      const daColuna = negocios.filter((n) => n.stage_id === novoEm.id);
      const novo = await criarNegocio({
        pipelineId: funil.id,
        etapa: novoEm,
        title: novoTitulo.trim(),
        value: novoValor || 0,
        posicao: posicaoEntre(daColuna[daColuna.length - 1]?.board_position, undefined),
      });
      setNegocios((atual) => [...atual, novo]);
      setNovoEm(null);
      setNovoTitulo('');
      setNovoValor(0);
    } catch (err: any) {
      message.error(err?.message || 'Não foi possível criar o negócio.');
    }
  };

  const totalGeral = useMemo(
    () => negocios.reduce((s, n) => s + Number(n.value || 0), 0),
    [negocios]
  );

  if (carregando) return <p className={styles.aviso}>Carregando o quadro…</p>;
  if (erro) return <p className={styles.avisoErro}>{erro}</p>;

  return (
    <div className={styles.quadroWrap}>
      <div className={styles.resumo}>
        <strong>{negocios.length}</strong> negócios abertos · <strong>{emReais(totalGeral)}</strong> em jogo
      </div>

      <DndContext sensors={sensores} onDragStart={aoPegar} onDragEnd={aoSoltar}>
        {/* Rolagem horizontal no próprio quadro: com sete colunas ele não cabe, e deixar a
            página inteira rolar de lado quebraria o resto do admin. */}
        <div className={styles.quadro}>
          {etapas.map((etapa) => (
            <Coluna
              key={etapa.id}
              etapa={etapa}
              etapas={etapas}
              negocios={negocios}
              onMover={mover}
              onNovo={setNovoEm}
            />
          ))}
        </div>

        <DragOverlay>
          {arrastando && (
            <article className={`${styles.cartao} ${styles.cartaoFantasma}`}>
              <div className={styles.cartaoCorpo}>
                <strong className={styles.cartaoTitulo}>{arrastando.title}</strong>
                <span className={styles.cartaoValor}>{emReais(Number(arrastando.value || 0))}</span>
              </div>
            </article>
          )}
        </DragOverlay>
      </DndContext>

      <Modal
        open={!!perdendo}
        title={`Marcar "${perdendo?.negocio.title ?? ''}" como perdido`}
        onCancel={() => setPerdendo(null)}
        onOk={confirmarPerda}
        okText='Marcar como perdido'
        cancelText='Cancelar'
        okButtonProps={{ danger: true, disabled: !motivoDaPerda.trim() }}
      >
        <Input.TextArea
          autoFocus
          rows={3}
          value={motivoDaPerda}
          onChange={(e) => setMotivoDaPerda(e.target.value)}
          placeholder='Por que este negócio foi perdido?'
        />
      </Modal>

      <Modal
        open={!!novoEm}
        title={`Novo negócio em ${novoEm?.name ?? ''}`}
        onCancel={() => setNovoEm(null)}
        onOk={criar}
        okText='Criar'
        cancelText='Cancelar'
        okButtonProps={{ disabled: !novoTitulo.trim() }}
      >
        <div className={styles.formNovo}>
          <label>
            Título
            <Input
              autoFocus
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              placeholder='Ex.: Gravadora X, plano anual'
              onPressEnter={criar}
            />
          </label>
          <label>
            Valor
            <InputNumber
              value={novoValor}
              onChange={(v) => setNovoValor(Number(v || 0))}
              min={0}
              style={{ width: '100%' }}
              prefix='R$'
            />
          </label>
        </div>
      </Modal>

      <Button type='link' onClick={carregar} className={styles.recarregar}>
        Recarregar
      </Button>
    </div>
  );
};

export default Kanban;
