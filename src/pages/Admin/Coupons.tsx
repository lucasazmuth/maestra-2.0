import { FC, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Input, InputNumber, Select, Switch, DatePicker, Button, Popconfirm, message } from 'antd';
import { FiTag, FiPlus } from 'react-icons/fi';
import dayjs, { Dayjs } from 'dayjs';

import { supabase } from '../../lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type AppliesTo = 'one_time' | 'subscription' | 'both';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  applies_to: AppliesTo;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  max_uses: number | null;
  uses_count: number;
}

const APPLIES_LABEL: Record<AppliesTo, string> = {
  one_time: 'Pagamento único',
  subscription: 'Assinatura',
  both: 'Ambos',
};

const fmtDate = (iso: string | null) => (iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : '—');

// Um cupom está "vigente agora" (início ≤ agora ≤ fim, e ativo)?
const isLive = (c: Coupon) => {
  const now = Date.now();
  if (!c.is_active) return false;
  if (c.starts_at && now < new Date(c.starts_at).getTime()) return false;
  if (c.ends_at && now > new Date(c.ends_at).getTime()) return false;
  return true;
};

const emptyForm = {
  code: '',
  description: '',
  discountPercent: 10 as number | null,
  appliesTo: 'both' as AppliesTo,
  startsAt: dayjs() as Dayjs | null,
  endsAt: null as Dayjs | null,
  maxUses: null as number | null,
  isActive: true,
};

const AdminCoupons: FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('discount_coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) message.error('Não foi possível carregar os cupons.');
    setCoupons((data as Coupon[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const startEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description || '',
      discountPercent: Number(c.discount_percent),
      appliesTo: c.applies_to,
      startsAt: c.starts_at ? dayjs(c.starts_at) : dayjs(),
      endsAt: c.ends_at ? dayjs(c.ends_at) : null,
      maxUses: c.max_uses,
      isActive: c.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code) return message.warning('Informe o código do cupom.');
    if (!form.discountPercent || form.discountPercent <= 0 || form.discountPercent > 100)
      return message.warning('A porcentagem deve estar entre 1 e 100.');
    if (!form.startsAt) return message.warning('Informe a data de início.');
    if (form.endsAt && form.endsAt.isBefore(form.startsAt))
      return message.warning('A data de fim deve ser depois do início.');

    const payload = {
      code,
      description: form.description.trim() || null,
      discount_percent: form.discountPercent,
      applies_to: form.appliesTo,
      starts_at: form.startsAt.toISOString(),
      ends_at: form.endsAt ? form.endsAt.toISOString() : null,
      max_uses: form.maxUses ?? null,
      is_active: form.isActive,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const q = editingId
        ? supabase.from('discount_coupons').update(payload).eq('id', editingId)
        : supabase.from('discount_coupons').insert(payload);
      const { error } = await q;
      if (error) {
        message.error(error.message.includes('duplicate') ? 'Já existe um cupom com esse código.' : 'Erro ao salvar o cupom.');
        return;
      }
      message.success(editingId ? 'Cupom atualizado.' : 'Cupom criado.');
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    const { error } = await supabase
      .from('discount_coupons')
      .update({ is_active: !c.is_active, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    if (error) return message.error('Erro ao atualizar.');
    await load();
  };

  const remove = async (c: Coupon) => {
    const { error } = await supabase.from('discount_coupons').delete().eq('id', c.id);
    if (error) return message.error('Erro ao excluir.');
    message.success('Cupom excluído.');
    await load();
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Cupons de desconto</h1>
      <p style={styles.sub}>Cupons por porcentagem para o pagamento único do planejamento e a assinatura Maestra PRO. Aplicados no checkout sobre o valor total.</p>

      {/* Formulário criar / editar */}
      <div style={styles.card}>
        <div style={styles.cardHead}>
          <FiTag /> <strong>{editingId ? 'Editar cupom' : 'Novo cupom'}</strong>
        </div>
        <div style={styles.formGrid}>
          <Field label="Código">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EX.: PROMO10" maxLength={30} />
          </Field>
          <Field label="Desconto (%)">
            <InputNumber min={1} max={100} value={form.discountPercent} onChange={(v) => setForm({ ...form, discountPercent: v })} style={{ width: '100%' }} />
          </Field>
          <Field label="Formato">
            <Select
              value={form.appliesTo}
              onChange={(v) => setForm({ ...form, appliesTo: v })}
              style={{ width: '100%' }}
              options={[
                { value: 'both', label: 'Ambos' },
                { value: 'one_time', label: 'Pagamento único' },
                { value: 'subscription', label: 'Assinatura' },
              ]}
            />
          </Field>
          <Field label="Início">
            <DatePicker showTime value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Field>
          <Field label="Fim (opcional)">
            <DatePicker showTime value={form.endsAt} onChange={(v) => setForm({ ...form, endsAt: v })} format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Sem expiração" />
          </Field>
          <Field label="Limite de usos (opcional)">
            <InputNumber min={1} value={form.maxUses} onChange={(v) => setForm({ ...form, maxUses: v })} placeholder="Ilimitado" style={{ width: '100%' }} />
          </Field>
          <Field label="Descrição (opcional)">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Uso interno" maxLength={120} />
          </Field>
          <Field label="Ativo">
            <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Button type="primary" loading={saving} onClick={save} icon={<FiPlus />}>
            {editingId ? 'Salvar alterações' : 'Criar cupom'}
          </Button>
          {editingId && <Button onClick={resetForm}>Cancelar</Button>}
        </div>
      </div>

      {/* Lista */}
      <div style={styles.card}>
        <div style={styles.cardHead}><strong>Cupons cadastrados</strong></div>
        {loading ? (
          <div style={styles.empty}>Carregando…</div>
        ) : coupons.length === 0 ? (
          <div style={styles.empty}>Nenhum cupom ainda.</div>
        ) : (
          coupons.map((c) => (
            <div key={c.id} style={styles.row}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={styles.code}>{c.code}</span>
                  <span style={styles.badge}>{Number(c.discount_percent)}%</span>
                  <span style={styles.badgeMuted}>{APPLIES_LABEL[c.applies_to]}</span>
                  {isLive(c)
                    ? <span style={{ ...styles.badge, background: 'rgba(46,196,122,0.15)', color: '#47d18e' }}>Vigente</span>
                    : <span style={{ ...styles.badge, background: 'rgba(255,255,255,0.06)', color: '#9a9aa5' }}>{c.is_active ? 'Fora do período' : 'Inativo'}</span>}
                </div>
                <div style={styles.meta}>
                  {fmtDate(c.starts_at)} → {fmtDate(c.ends_at)} · usos: {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''}
                  {c.description ? ` · ${c.description}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Button size="small" onClick={() => startEdit(c)}>Editar</Button>
                <Button size="small" onClick={() => toggleActive(c)}>{c.is_active ? 'Desativar' : 'Ativar'}</Button>
                <Popconfirm title="Excluir este cupom?" okText="Excluir" cancelText="Voltar" okButtonProps={{ danger: true }} onConfirm={() => remove(c)}>
                  <Button size="small" danger>Excluir</Button>
                </Popconfirm>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const Field: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ color: '#9a9aa5', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</label>
    {children}
  </div>
);

const styles: Record<string, CSSProperties> = {
  page: { padding: 24, maxWidth: 1000 },
  title: { fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: '0 0 6px' },
  sub: { color: '#9a9aa5', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px', maxWidth: 640 },
  card: { background: '#181818', borderRadius: 12, padding: 20, marginBottom: 18 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 16, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  empty: { color: '#6f6f78', padding: '20px 0', textAlign: 'center' },
  row: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid #262626' },
  code: { fontWeight: 800, color: '#fff', fontSize: 15, letterSpacing: '0.02em' },
  badge: { display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: 'rgba(175,40,150,0.16)', color: '#e07fce' },
  badgeMuted: { display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#cfcfd4' },
  meta: { color: '#8a8a8a', fontSize: 12.5, marginTop: 5 },
};

export default AdminCoupons;
