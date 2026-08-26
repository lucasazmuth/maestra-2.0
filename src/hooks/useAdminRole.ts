import { useEffect, useState } from 'react';

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

export interface AcessoAdmin {
  carregando: boolean;
  papel: PapelAdmin | null;
  /** Admin pleno: vê o admin inteiro. */
  ehAdminPleno: boolean;
  /** Opera o CRM de vendas: admin pleno ou vendedor. */
  operaCrmDeVendas: boolean;
}

export const useAdminRole = (): AcessoAdmin => {
  const user = useAppSelector((s) => s.auth.user);
  const [papel, setPapel] = useState<PapelAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!user) {
      setPapel(null);
      setCarregando(false);
      return;
    }

    let ativo = true;
    setCarregando(true);
    supabase
      .from('platform_admins')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        // Troca de usuário no meio da consulta não pode aplicar o resultado do anterior.
        if (!ativo) return;
        setPapel((data?.role as PapelAdmin) ?? null);
        setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [user]);

  return {
    carregando,
    papel,
    // Lista explícita: papel novo que ninguém mapeou não vira admin pleno por omissão.
    ehAdminPleno: papel === 'admin' || papel === 'super_admin',
    operaCrmDeVendas: papel === 'admin' || papel === 'super_admin' || papel === 'sales',
  };
};

export default useAdminRole;
