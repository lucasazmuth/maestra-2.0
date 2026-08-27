export type ModuleName =
  | 'dashboard'
  | 'action-plan'
  | 'catalog'
  | 'agenda'
  | 'team'
  | 'crm'
  | 'marketing'
  | 'releases'
  | 'unknown';

export interface ActiveModuleContext {
  module: ModuleName;
  artistId: string | null;
  artistName: string | null;
  rawPath: string;
}

/**
 * Mapeamento de segmentos de rota para nomes de módulo.
 * Pattern: /artists/:id/:segment
 */
export const ROUTE_TO_MODULE: Record<string, ModuleName> = {
  'action-plan': 'action-plan',
  'catalog': 'catalog',
  'agenda': 'agenda',
  'team': 'team',
  'crm': 'crm',
  'marketing': 'marketing',
  'releases': 'releases',
  'commercial': 'crm',
  'wizard': 'dashboard',
  'nyta': 'dashboard',
};

/**
 * Resolve o módulo ativo a partir do pathname.
 * Pattern esperado: /artists/:id ou /artists/:id/:segment
 *
 * - Sem segmento → 'dashboard'
 * - Segmento conhecido → módulo correspondente
 * - Segmento desconhecido → 'unknown' com rawPath
 */
export function resolveModuleFromPath(pathname: string): {
  module: ModuleName;
  artistId: string | null;
  rawPath: string;
} {
  const match = pathname.match(/\/artists\/([^/]+)(?:\/([^/]+))?/);

  if (!match) {
    return { module: 'unknown', artistId: null, rawPath: pathname };
  }

  const [, artistId, segment] = match;

  if (!segment) {
    return { module: 'dashboard', artistId, rawPath: pathname };
  }

  const module = ROUTE_TO_MODULE[segment] ?? 'unknown';
  return { module, artistId, rawPath: pathname };
}
