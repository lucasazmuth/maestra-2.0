import { FC, useEffect, useState, type CSSProperties } from 'react';
import { Alert, Button, Input, Select, Tag, message } from 'antd';
import { FiBell, FiSend } from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import { readEdgeFunctionError } from '../../lib/edgeError';

interface AdminUser { id: string; name: string; email: string; confirmed: boolean; }

const AdminPush: FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('/notifications');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.functions.invoke('admin-users', { body: { action: 'list' } }).then(({ data, error }) => {
      if (!alive) return;
      if (error) message.error('Não foi possível carregar os usuários.');
      setUsers((data?.users as AdminUser[]) || []);
      setLoadingUsers(false);
    });
    return () => { alive = false; };
  }, []);

  const send = async () => {
    if (!target || !title.trim() || !body.trim() || sending) return;
    if (target === 'all' && !window.confirm(`Enviar esta mensagem para ${users.length} usuários confirmados?`)) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('admin-send-push', {
      body: { userId: target, title, message: body, link },
    });
    setSending(false);
    if (error) { message.error(await readEdgeFunctionError(error, 'Não foi possível enviar.')); return; }
    if (data?.error) { message.error(data.error); return; }
    message.success(`Notificação enviada para ${data.sent} usuário(s).`);
    setTitle('');
    setBody('');
  };

  const userOptions = [
    { value: 'all', label: <span>Todos os usuários confirmados <Tag color="purple">{users.length}</Tag></span> },
    ...users.map((user) => ({ value: user.id, label: `${user.name || 'Sem nome'} · ${user.email}` })),
  ];

  return (
    <div style={styles.page}>
      <div style={styles.heading}>
        <div>
          <h1 style={styles.title}>Enviar push</h1>
          <p style={styles.sub}>Envie uma notificação personalizada para um usuário ou para toda a base.</p>
        </div>
        <FiBell size={30} color="#9A4FD1" />
      </div>

      <Alert
        type="info"
        showIcon
        message="O envio também aparece na central de notificações. O push do dispositivo só chega para quem autorizou as notificações no navegador."
        style={{ marginBottom: 18 }}
      />

      <section style={styles.panel}>
        <label style={styles.label}>Destinatário</label>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Selecione um destinatário"
          value={target || undefined}
          onChange={setTarget}
          options={userOptions}
          loading={loadingUsers}
          style={styles.field}
        />

        <label style={styles.label}>Título <span style={styles.counter}>{title.length}/120</span></label>
        <Input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Nova tarefa para você" style={styles.field} />

        <label style={styles.label}>Mensagem <span style={styles.counter}>{body.length}/500</span></label>
        <Input.TextArea maxLength={500} rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva a mensagem que será exibida no app e no push…" style={styles.field} />

        <label style={styles.label}>Link interno <span style={styles.hint}>opcional</span></label>
        <Input maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} placeholder="/notifications" style={styles.field} />

        <div style={styles.footer}>
          <span style={styles.hint}>O link deve começar com <code>/</code>.</span>
          <Button type="primary" icon={<FiSend />} onClick={send} loading={sending} disabled={!target || !title.trim() || !body.trim()}>
            Enviar notificação
          </Button>
        </div>
      </section>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  page: { padding: 24, maxWidth: 760 },
  heading: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 28px)', color: '#fff', margin: '0 0 6px' },
  sub: { color: '#9a9aa5', fontSize: 14, lineHeight: 1.5, margin: 0 },
  panel: { background: '#1c1c1e', border: '1px solid #2a2a2a', borderRadius: 12, padding: 20 },
  label: { display: 'block', color: '#e6e6ea', fontSize: 13, fontWeight: 700, margin: '0 0 7px' },
  field: { width: '100%', marginBottom: 18 },
  counter: { float: 'right', color: '#6f6f78', fontWeight: 400 },
  hint: { color: '#8a8a8a', fontWeight: 400 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 2 },
};

export default AdminPush;
