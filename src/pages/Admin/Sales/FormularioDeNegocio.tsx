import { FC, useEffect, useState } from 'react';
import { Input, InputNumber, Modal, Select, message } from 'antd';

import {
  criarNegocio,
  editarNegocio,
  garantirLeadDaConta,
  tituloSugerido,
  type DadosDoNegocio,
  type Etapa,
  type Lead,
  type MembroDoTime,
  type Negocio,
} from './dados';
import styles from './Sales.module.scss';

// Formulário de negócio, o mesmo para criar e para editar.
//
// Um formulário só, e não dois: criar e editar pedem exatamente os mesmos campos, e manter duas
// cópias é como um dos dois acaba esquecendo um campo novo.

interface Props {
  aberto: boolean;
  etapa: Etapa | null;
  leads: Lead[];
  time: MembroDoTime[];
  /** Preenchido quando está editando; nulo quando está criando. */
  negocio?: Negocio | null;
  /** Lead escolhido de fora (botão "Criar negócio" na lista de leads). */
  leadInicial?: Lead | null;
  /** Conta da Maestra, quando o negócio nasce da aba Inbound. */
  inbound?: { id: string; nome: string | null; email: string } | null;
  onFechar: () => void;
  /** O segundo argumento vem preenchido quando o Inbound criou um lead novo. */
  onSalvo: (negocio: Negocio | null, leadCriado?: Lead | null) => void;
  criarComPosicao?: () => number;
  pipelineId?: string;
}

const VAZIO: DadosDoNegocio = { title: '', value: 0, contactId: null, ownerId: null, notes: '', tags: [] };

export const FormularioDeNegocio: FC<Props> = ({
  aberto,
  etapa,
  leads,
  time,
  negocio,
  leadInicial,
  inbound,
  onFechar,
  onSalvo,
  criarComPosicao,
  pipelineId,
}) => {
  const [form, setForm] = useState<DadosDoNegocio>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  // Guarda se o título ainda é o sugerido. Enquanto for, trocar o lead atualiza o título junto;
  // depois que a pessoa escreve o dela, trocar o lead não pode apagar o que ela digitou.
  const [tituloIntocado, setTituloIntocado] = useState(true);

  useEffect(() => {
    if (!aberto) return;
    if (negocio) {
      setForm({
        title: negocio.title,
        value: Number(negocio.value || 0),
        contactId: negocio.contact_id,
        ownerId: negocio.owner_id,
        notes: negocio.notes,
        tags: negocio.tags || [],
      });
      setTituloIntocado(false);
      return;
    }
    if (inbound) {
      // Vindo do Inbound o "cliente" não é um lead cadastrado, é uma conta que já existe: o
      // vínculo vai por `linked_user_id`, e o select de cliente fica vazio de propósito.
      setForm({ ...VAZIO, title: tituloSugerido(inbound.nome || inbound.email) });
      setTituloIntocado(true);
      return;
    }
    const lead = leadInicial || null;
    setForm({
      ...VAZIO,
      contactId: lead?.id ?? null,
      title: lead ? tituloSugerido(lead.name) : '',
    });
    setTituloIntocado(true);
  }, [aberto, negocio, leadInicial, inbound]);

  const escolherLead = (id: string | null) => {
    const lead = leads.find((l) => l.id === id) || null;
    setForm((atual) => ({
      ...atual,
      contactId: id,
      title: tituloIntocado && lead ? tituloSugerido(lead.name) : atual.title,
    }));
  };

  const salvar = async () => {
    if (!form.title.trim()) return;
    setSalvando(true);
    try {
      if (negocio) {
        await editarNegocio(negocio.id, { ...form, title: form.title.trim() });
        onSalvo({ ...negocio, ...form, title: form.title.trim() } as Negocio);
      } else {
        if (!etapa || !pipelineId) return;
        // Vindo do Inbound o lead e criado (ou reaproveitado) ANTES do negocio: sem isso a
        // pessoa ficaria so como um `linked_user_id` dentro do negocio, e a aba Leads nunca
        // mostraria quem do Inbound avancou.
        const leadDaConta = inbound ? await garantirLeadDaConta(inbound) : null;
        const novo = await criarNegocio({
          ...form,
          title: form.title.trim(),
          pipelineId,
          etapa,
          posicao: criarComPosicao ? criarComPosicao() : 0,
          contactId: leadDaConta?.id ?? form.contactId ?? null,
          linkedUserId: inbound?.id ?? null,
          source: inbound ? 'inbound' : form.contactId ? 'prospeccao' : null,
        });
        onSalvo(novo, leadDaConta);
      }
      onFechar();
    } catch (err: any) {
      message.error(err?.message || 'Não foi possível salvar o negócio.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={aberto}
      title={negocio ? 'Editar negócio' : `Novo negócio${etapa ? ` em ${etapa.name}` : ''}`}
      onCancel={onFechar}
      onOk={salvar}
      confirmLoading={salvando}
      okText='Salvar'
      cancelText='Cancelar'
      okButtonProps={{ disabled: !form.title.trim() }}
      width={560}
    >
      <div className={styles.formNovo}>
        {inbound && (
          <p className={styles.avisoInbound}>
            Vindo do Inbound: <strong>{inbound.email}</strong> entra como lead ligado à conta dela,
            e o negócio nasce apontando para esse lead.
          </p>
        )}
        {/* No Inbound o cliente nao se escolhe: ele E a conta do aviso acima, e o lead
            correspondente e criado ao salvar. Deixar o campo aberto convidaria a apontar o
            negocio para outra pessoa sem querer. */}
        {!inbound && (
          <label>
            Cliente
            <Select
              allowClear
              showSearch
              placeholder='Escolha um lead já cadastrado'
              value={form.contactId || undefined}
              onChange={(v) => escolherLead(v ?? null)}
              optionFilterProp='label'
              options={leads.map((l) => ({ value: l.id, label: l.email ? `${l.name} · ${l.email}` : l.name }))}
              notFoundContent='Nenhum lead cadastrado. Crie na aba Leads.'
            />
          </label>
        )}

        <label>
          Título
          <Input
            value={form.title}
            onChange={(e) => {
              setTituloIntocado(false);
              setForm({ ...form, title: e.target.value });
            }}
            placeholder='Ex.: Proposta para Gravadora X'
          />
        </label>

        <label>
          Valor
          <InputNumber
            value={form.value}
            onChange={(v) => setForm({ ...form, value: Number(v || 0) })}
            min={0}
            style={{ width: '100%' }}
            prefix='R$'
          />
        </label>

        <label>
          Responsável
          <Select
            allowClear
            placeholder='Quem toca este negócio'
            value={form.ownerId || undefined}
            onChange={(v) => setForm({ ...form, ownerId: v ?? null })}
            options={time.map((m) => ({ value: m.user_id, label: m.email }))}
          />
        </label>

        <label>
          Tags
          <Select
            mode='tags'
            placeholder='Ex.: gravadora, indicação, evento'
            value={form.tags || []}
            onChange={(v: string[]) => setForm({ ...form, tags: v })}
            tokenSeparators={[',']}
          />
        </label>

        <label>
          Descrição
          <Input.TextArea
            rows={3}
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder='Contexto da negociação, o que ficou combinado, próximos passos'
          />
        </label>
      </div>
    </Modal>
  );
};

export default FormularioDeNegocio;
