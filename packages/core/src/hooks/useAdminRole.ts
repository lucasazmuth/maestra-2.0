import { useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import { useAppSelector } from '../store/store';

// Papel de quem entrou na área de admin.
//
// `useIsPlatformAdmin` responde "tem algum acesso ao admin?", e continua certo para o time de
// vendas: vendedor ESTÁ em platform_admins. Este hook responde a pergunta seguinte, que é a que
// separa as telas — se a pessoa é admin pleno ou só opera o CRM.
//
// Diferente do outro hook, aqui a flag do JWT não serve de atalho: ela diz que existe acesso,
// não QUAL. Aceitá-la como "admin pleno" abriria Usuários, Cupons e Push para um vendedor.
//
// Serve só para MOSTRAR ou ESCONDER interface. Quem protege os dados é a RLS — as tabelas
// `sales_*` liberam por `can_use_sales_crm()`, e o resto do admin nem isso.

export type PapelAdmin = 'admin' | 'super_admin' | 'sales';

/** Módulos do admin. O mesmo conjunto do CHECK em `admin_module_access.module`. */
export type ModuloAdmin =
  | 'dashboard'
  | 'artistas'
  | 'knowledge-base'
  | 'cupons'
  | 'pass-access'
  | 'usuarios'
  | 'vendas'
  | 'avaliacoes'
  | 'push';

export interface AcessoAdmin {
  carregando: boolean;
  papel: PapelAdmin | null;
  /** Admin pleno: vê o admin inteiro, incluindo a tela de Acessos. */
  ehAdminPleno: boolean;
  /** Módulos que a pessoa alcança. Admin pleno recebe todos. */
  modulos: ModuloAdmin[];
  podeAcessar: (modulo: ModuloAdmin) => boolean;
  /** Atalho de leitura: o CRM de vendas é o módulo `vendas`. */
  operaCrmDeVendas: boolean;
}

export const useAdminRole = (): AcessoAdmin => {
  const user = useAppSelector((s) => s.auth.user);
  const [papel, setPapel] = useState<PapelAdmin | null>(null);
  const [modulos, setModulos] = useState<ModuloAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const idAtendido = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      idAtendido.current = null;
      setPapel(null);
      setModulos([]);
      setCarregando(false);
      return;
    }

    let ativo = true;
    // Mesma regra do consentimento: reverificar a MESMA pessoa não volta para `carregando`,
    // porque o `RequireFullAdmin` troca a tela por um spinner enquanto isso. Ver o comentário
    // do `setSession` em `store/slices/auth`.
    if (idAtendido.current !== user.id) setCarregando(true);

    // As duas informações vêm juntas porque a tela precisa das duas para decidir o que mostrar:
    // o papel diz se é admin pleno, e os módulos dizem o que a pessoa alcança. Carregar em
    // sequência faria o menu piscar com metade dos itens.
    Promise.all([
      supabase.from('platform_admins').select('role').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('meus_modulos_admin'),
    ]).then(([resPapel, resModulos]) => {
      // Troca de usuário no meio da consulta não pode aplicar o resultado do anterior.
      if (!ativo) return;
      setPapel((resPapel.data?.role as PapelAdmin) ?? null);
      setModulos(((resModulos.data as string[] | null) || []) as ModuloAdmin[]);
      idAtendido.current = user.id;
      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [user]);

  // Lista explícita: papel novo que ninguém mapeou não vira admin pleno por omissão.
  const ehAdminPleno = papel === 'admin' || papel === 'super_admin';

  return {
    carregando,
    papel,
    ehAdminPleno,
    modulos,
    podeAcessar: (modulo: ModuloAdmin) => ehAdminPleno || modulos.includes(modulo),
    operaCrmDeVendas: ehAdminPleno || modulos.includes('vendas'),
  };
};

export default useAdminRole;
