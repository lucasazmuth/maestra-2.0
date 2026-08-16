import { FC, ReactNode, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Input, InputNumber, Button, Popconfirm, message, Empty } from 'antd';
import { FiKey, FiPlus, FiCopy, FiSlash } from 'react-icons/fi';
import dayjs from 'dayjs';

import { supabase } from '../../lib/supabase';
import { Spinner } from '../../components/spinner/spinner';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Pass {
  id: string;
  code: string;
  note: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  redeemed_at: string | null;
  redeemed_by: string | null;
  redeemed_artist_id: string | null;
  redeemedArtistName: string | null;
  redeemedByEmail: string | null;
}

interface Summary { total: number; redeemed: number; available: number }

const fmtDate = (iso: string | null) => (iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : '—');

type Status = { label: string; style: CSSProperties };

// Ordem importa: resgatado é definitivo; revogado vence expirado.
const statusOf = (p: Pass): Status => {
  if (p.redeemed_at) return { label: 'Resgatado', style: styles.badgeUsed };
  if (!p.is_active) return { label: 'Revogado', style: styles.badgeMuted };
  if (p.expires_at && dayjs(p.expires_at).isBefore(dayjs())) return { label: 'Expirado', style: styles.badgeMuted };
  return { label: 'Disponível', style: styles.badgeOk };
};

const emptyForm = { quantity: 1 as number | null, note: '', expiresInDays: 90 as number | null };

const AdminAccessPasses: FC = () => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // Códigos do último lote: é a única vez que aparecem juntos pra copiar de uma vez.
  const [lastBatch, setLastBatch] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-access-passes', { body: { action: 'list' } });
    if (error) message.error('Não foi possível carregar os códigos.');
    setPasses((data?.passes as Pass[]) || []);
    setSummary((data?.summary as Summary) || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    const quantity = Number(form.quantity) || 0;
    if (quantity < 1) return message.warning('Informe quantos códigos gerar.');

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-access-passes', {
        body: {
          action: 'generate',
          quantity,
          note: form.note.trim() || undefined,
          expiresInDays: form.expiresInDays ?? null,
        },
      });
      if (error || !data?.passes) return message.error('Erro ao gerar os códigos.');

      const codes = (data.passes as Pass[]).map((p) => p.code);
      setLastBatch(codes);
      message.success(`${codes.length} código(s) gerado(s).`);
      setForm(emptyForm);
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (p: Pass) => {
    const { data, error } = await supabase.functions.invoke('admin-access-passes', {
      body: { action: 'revoke', id: p.id },
    });
    if (error || !data?.ok) return message.error('Não foi possível revogar.');
    message.success('Código revogado.');
    await load();
  };

  const copy = async (text: string, label = 'Código copiado.') => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(label);
    } catch {
      message.error('Não foi possível copiar.');
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Pass Access</h1>
      <p style={styles.sub}>
        Códigos de uso único que liberam o planejamento estratégico sem passar pelo pagamento. Use para
        presentear um aluno — assim a cobrança não sai no CPF de outra pessoa. Cada código vale um perfil.
      </p>

      {summary && (
        <div style={styles.stats}>
          <Stat label="Disponíveis" value={summary.available} accent />
          <Stat label="Resgatados" value={summary.redeemed} />
          <Stat label="Total" value={summary.total} />
        </div>
      )}

      {/* Geração */}
      <div style={styles.card}>
        <div style={styles.cardHead}><FiKey /> <strong>Gerar códigos</strong></div>
        <div style={styles.formGrid}>
          <Field label="Quantidade">
            <InputNumber min={1} max={100} value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} style={{ width: '100%' }} />
          </Field>
          <Field label="Validade (dias)">
            <InputNumber min={1} value={form.expiresInDays} onChange={(v) => setForm({ ...form, expiresInDays: v })} placeholder="Sem expiração" style={{ width: '100%' }} />
          </Field>
          <Field label="Anotação (opcional)">
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex.: Turma 2026.1" maxLength={120} />
          </Field>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button type="primary" loading={generating} onClick={generate} icon={<FiPlus />}>Gerar</Button>
        </div>

        {lastBatch.length > 0 && (
          <div style={styles.batch}>
            <div style={styles.batchHead}>
              <strong>Último lote ({lastBatch.length})</strong>
              <Button size="small" icon={<FiCopy />} onClick={() => copy(lastBatch.join('\n'), 'Lote copiado.')}>
                Copiar todos
              </Button>
            </div>
            <div style={styles.batchCodes}>
              {lastBatch.map((c) => <code key={c} style={styles.batchCode}>{c}</code>)}
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={styles.card}>
        <div style={styles.cardHead}><strong>Códigos</strong></div>
        {loading ? (
          <Spinner loading section>{null as any}</Spinner>
        ) : passes.length === 0 ? (
          <Empty description="Nenhum código gerado ainda." />
        ) : (
          passes.map((p) => {
            const status = statusOf(p);
            const canRevoke = !p.redeemed_at && p.is_active;
            return (
              <div key={p.id} style={styles.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.codeLine}>
                    <span style={styles.code}>{p.code}</span>
                    <span style={status.style}>{status.label}</span>
                  </div>
                  <div style={styles.meta}>
                    {p.note && <>{p.note} · </>}
                    Criado {fmtDate(p.created_at)}
                    {p.expires_at && <> · Expira {fmtDate(p.expires_at)}</>}
                    {p.redeemed_at && (
                      <> · Usado por {p.redeemedByEmail || '—'}
                        {p.redeemedArtistName && <> em <strong>{p.redeemedArtistName}</strong></>}
                        {' '}({fmtDate(p.redeemed_at)})
                      </>
                    )}
                  </div>
                </div>
                <Button size="small" icon={<FiCopy />} onClick={() => copy(p.code)} />
                {canRevoke && (
                  <Popconfirm title="Revogar este código?" description="Ele deixa de funcionar imediatamente." onConfirm={() => revoke(p)} okText="Revogar" cancelText="Cancelar">
                    <Button size="small" danger icon={<FiSlash />} />
                  </Popconfirm>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <div style={styles.fieldLabel}>{label}</div>
    {children}
  </div>
);

const Stat: FC<{ label: string; value: number; accent?: boolean }> = ({ label, value, accent }) => (
  <div style={styles.stat}>
    <div style={{ ...styles.statValue, ...(accent ? { color: '#2a9a59' } : {}) }}>{value}</div>
    <div style={styles.statLabel}>{label}</div>
  </div>
);

const styles: Record<string, CSSProperties> = {
  page: { padding: 24, maxWidth: 1000 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 28px)', color: '#2c3f63', margin: '0 0 6px' },
  sub: { color: '#7c8da8', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px', maxWidth: 640 },
  stats: { display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
  stat: { background: '#ffffff', borderRadius: 12, padding: '14px 22px', minWidth: 120 },
  statValue: { fontSize: 24, fontWeight: 800, color: '#2c3f63', lineHeight: 1.1 },
  statLabel: { color: '#7c8da8', fontSize: 12.5, marginTop: 3 },
  card: { background: '#ffffff', borderRadius: 12, padding: 20, marginBottom: 18 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, color: '#2c3f63', fontSize: 16, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  fieldLabel: { color: '#b9b9c0', fontSize: 12.5, marginBottom: 6 },
  empty: { color: '#93a4c0', padding: '20px 0', textAlign: 'center' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', borderTop: '1px solid #e8eef8' },
  codeLine: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  code: { fontWeight: 800, color: '#2c3f63', fontSize: 15, letterSpacing: '0.06em', fontFamily: 'monospace' },
  meta: { color: '#7c8da8', fontSize: 12.5, marginTop: 5 },
  badgeOk: { display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: 'rgba(42, 154, 89, 0.12)', color: '#2a9a59' },
  badgeUsed: { display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: 'rgba(154,79,209,0.16)', color: '#e07fce' },
  badgeMuted: { display: 'inline-flex', padding: '2px 9px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#405985' },
  batch: { marginTop: 18, padding: 14, borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' },
  batchHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#2c3f63', marginBottom: 10, gap: 10 },
  batchCodes: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  batchCode: { background: '#f2f6fc', color: '#2a9a59', padding: '5px 10px', borderRadius: 7, fontSize: 13.5, letterSpacing: '0.06em' },
};

export default AdminAccessPasses;
