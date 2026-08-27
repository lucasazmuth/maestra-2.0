import { FC, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Button, Checkbox, Input, Popconfirm, Table, Tag, message } from 'antd';
import { FiUserPlus } from 'react-icons/fi';

import { supabase } from '@maestra/core/lib/supabase';
import type { ModuloAdmin } from '@maestra/core/hooks/useAdminRole';

// Quem do time da Maestra alcança cada módulo do admin.
//
// O papel sozinho não escala: suporte precisa de Usuários e Avaliações, vendas precisa do CRM, e
// cada combinação viraria um papel novo. Aqui o papel diz o NÍVEL e a concessão por módulo diz
// O QUE a pessoa alcança.
//
// Esta tela é só de admin pleno, e isso é deliberado: se quem tem um módulo pudesse conceder
// módulos, a tela de acessos seria o caminho mais curto para virar admin. Quem barra é a policy
// de escrita em `admin_module_access`, não este componente.

const MODULOS: { chave: ModuloAdmin; rotulo: string }[] = [
  { chave: 'dashboard', rotulo: 'Dashboard' },
  { chave: 'artistas', rotulo: 'Perfis de artistas' },
  { chave: 'knowledge-base', rotulo: 'Base de Conhecimento' },
  { chave: 'cupons', rotulo: 'Cupons' },
  { chave: 'pass-access', rotulo: 'Pass Access' },
  { chave: 'usuarios', rotulo: 'Usuários' },
  { chave: 'vendas', rotulo: 'CRM de vendas' },
  { chave: 'avaliacoes', rotulo: 'Avaliações' },
  { chave: 'push', rotulo: 'Enviar push' },
];

interface Pessoa {
  user_id: string;
  email: string;
  role: string;
  modules: ModuloAdmin[];
  created_at: string;
}

const ehAdminPleno = (papel: string) => papel === 'admin' || papel === 'super_admin';

export const Acessos: FC = () => {
  const [equipe, setEquipe] = useState<Pessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [emailNovo, setEmailNovo] = useState('');
  const [convidando, setConvidando] = useState(false);
  // Ids em gravação, para desabilitar só a linha mexida e não a tabela inteira.
  const [salvando, setSalvando] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase.rpc('equipe_do_admin');
    if (error) setErro(error.message);
    else setEquipe((data || []) as Pessoa[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const marcarSalvando = (id: string, ligado: boolean) =>
    setSalvando((atual) => {
      const proximo = new Set(atual);
      if (ligado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });

  const alternar = async (pessoa: Pessoa, modulo: ModuloAdmin, conceder: boolean) => {
    marcarSalvando(pessoa.user_id, true);
    // Otimista: a marcação responde na hora e volta atrás se o banco recusar. Uma grade de
    // caixas que só responde depois da ida ao servidor leva a gente a clicar duas vezes.
    const antes = equipe;
    setEquipe((atual) =>
      atual.map((p) =>
        p.user_id === pessoa.user_id
          ? {
              ...p,
              modules: conceder
                ? [...p.modules, modulo].sort()
                : p.modules.filter((m) => m !== modulo),
            }
          : p
      )
    );

    const { error } = conceder
      ? await supabase.from('admin_module_access').insert({ user_id: pessoa.user_id, module: modulo })
      : await supabase
          .from('admin_module_access')
          .delete()
          .eq('user_id', pessoa.user_id)
          .eq('module', modulo);

    if (error) {
      setEquipe(antes);
      message.error(error.message || 'Não foi possível alterar o acesso.');
    }
    marcarSalvando(pessoa.user_id, false);
  };

  const convidar = async () => {
    const alvo = emailNovo.trim();
    if (!alvo) return;
    setConvidando(true);
    try {
      const { data, error } = await supabase.rpc('achar_conta_por_email', { alvo });
      if (error) throw error;
      const conta = (data as { user_id: string; email: string }[] | null)?.[0];
      if (!conta) {
        // A pessoa precisa ter conta na Maestra antes: convidar para o admin não cria usuário.
        message.warning('Nenhuma conta com este e-mail. Peça para a pessoa se cadastrar primeiro.');
        return;
      }
      if (equipe.some((p) => p.user_id === conta.user_id)) {
        message.info('Esta pessoa já está no time.');
        return;
      }
      // Por funcao, e nao insert direto: `platform_admins` so tem policy de SELECT, e abrir
      // escrita ali seria abrir "quem pode virar admin". A regra fica no banco, num lugar so.
      const { error: erroInsert } = await supabase.rpc('adicionar_ao_time_do_admin', {
        alvo: conta.user_id,
      });
      if (erroInsert) throw erroInsert;
      setEmailNovo('');
      await carregar();
      message.success('Pessoa adicionada. Agora marque os módulos que ela alcança.');
    } catch (err: any) {
      message.error(err?.message || 'Não foi possível adicionar a pessoa.');
    } finally {
      setConvidando(false);
    }
  };

  const remover = async (pessoa: Pessoa) => {
    // A funcao recusa tirar a si mesmo e o ultimo admin pleno — sem isso da para ficar sem
    // ninguem que possa conceder acesso, e o painel fica sem dono.
    const { error } = await supabase.rpc('remover_do_time_do_admin', { alvo: pessoa.user_id });
    if (error) return message.error(error.message || 'Não foi possível remover.');
    setEquipe((atual) => atual.filter((p) => p.user_id !== pessoa.user_id));
    return undefined;
  };

  if (erro) return <p style={{ padding: 24, color: '#b32d45' }}>{erro}</p>;

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <h1 style={titulo}>Acessos</h1>
      <p style={legenda}>
        Quem do time alcança cada módulo do admin. Admin pleno vê tudo e não depende destas
        marcações; para os demais, vale só o que estiver marcado.
      </p>

      <div style={barra}>
        <Input
          placeholder='E-mail de quem já tem conta na Maestra'
          value={emailNovo}
          onChange={(e) => setEmailNovo(e.target.value)}
          onPressEnter={convidar}
          style={{ maxWidth: 340 }}
        />
        <Button type='primary' icon={<FiUserPlus />} loading={convidando} onClick={convidar}>
          Adicionar ao time
        </Button>
      </div>

      <Table
        rowKey='user_id'
        loading={carregando}
        dataSource={equipe}
        size='middle'
        scroll={{ x: 'max-content' }}
        pagination={false}
        columns={[
          {
            title: 'Pessoa',
            dataIndex: 'email',
            key: 'email',
            fixed: 'left',
            render: (email: string, p: Pessoa) => (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ color: '#2c3f63', fontSize: 13 }}>{email}</strong>
                {ehAdminPleno(p.role) && <Tag color='blue' style={{ width: 'fit-content' }}>Admin pleno</Tag>}
              </span>
            ),
          },
          ...MODULOS.map((m) => ({
            title: m.rotulo,
            key: m.chave,
            align: 'center' as const,
            width: 96,
            render: (_: unknown, p: Pessoa) => (
              <Checkbox
                // Admin pleno alcança tudo por definição: deixar a caixa clicável sugeriria que
                // desmarcar tira o acesso, e não tira.
                disabled={ehAdminPleno(p.role) || salvando.has(p.user_id)}
                checked={ehAdminPleno(p.role) || p.modules.includes(m.chave)}
                onChange={(e) => alternar(p, m.chave, e.target.checked)}
                aria-label={`${m.rotulo} para ${p.email}`}
              />
            ),
          })),
          {
            title: '',
            key: 'acoes',
            width: 110,
            render: (_: unknown, p: Pessoa) =>
              ehAdminPleno(p.role) ? (
                <span style={{ color: '#9fb0c8', fontSize: 12 }}>—</span>
              ) : (
                <Popconfirm
                  title='Tirar do time?'
                  description='A pessoa perde o acesso ao admin inteiro.'
                  okText='Tirar'
                  cancelText='Cancelar'
                  onConfirm={() => remover(p)}
                >
                  <Button size='small' danger type='text'>
                    Remover
                  </Button>
                </Popconfirm>
              ),
          },
        ]}
      />
    </div>
  );
};

const titulo: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(24px, 3vw, 28px)',
  color: '#2c3f63',
  margin: '0 0 6px',
};

const legenda: CSSProperties = {
  color: '#7c8da8',
  fontSize: 14,
  lineHeight: 1.5,
  margin: '0 0 20px',
  maxWidth: 760,
};

const barra: CSSProperties = { display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' };

export default Acessos;
