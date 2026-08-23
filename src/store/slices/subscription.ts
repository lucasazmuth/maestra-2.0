import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { supabase } from '../../lib/supabase';
import { readEdgeFunctionError } from '../../lib/edgeError';

// ─── Error Helpers ────────────────────────────────────────────────────────────

/**
 * Categoriza erro de Edge Function e retorna mensagem em português ≤ 200 chars.
 * Satisfaz Requirement 9.1: mensagem descreve categoria de falha.
 */
function categorizeEdgeFunctionError(
  error: { message?: string } | null | undefined,
  fallback: string
): string {
  const msg = error?.message?.toLowerCase() || '';

  let result: string;
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
    result = 'Falha na comunicação com serviço de pagamento. Tempo limite excedido.';
  } else if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to') ||
    msg.includes('connection') ||
    msg.includes('econnrefused')
  ) {
    result = 'Erro de conexão. Verifique sua internet e tente novamente.';
  } else if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('server')) {
    result = 'Erro no servidor de pagamento. Tente novamente em alguns instantes.';
  } else if (msg && msg.length <= 200) {
    // Use the original message if it's short enough (may come from Edge Function in Portuguese)
    result = error!.message!;
  } else if (msg) {
    // Original message is too long — truncate it
    result = error!.message!;
  } else {
    result = fallback;
  }

  // Enforce 200 character limit
  return result.length > 200 ? result.slice(0, 197) + '...' : result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PixData {
  qrCode: string | null;
  copyPaste: string | null;
  expiresAt: string | null;
}

export type BillingCycle = 'MONTHLY' | 'YEARLY';

// Configuração de preços do plano, lida do Supabase (asaas_plan_config). Editável sem deploy.
export interface PlanConfig {
  name: string;
  monthlyValue: number;
  annualValue: number | null;
  annualEnabled: boolean;
  // Valor do pagamento único (desbloqueio de perfil). Mesma config, editável sem deploy.
  profileUnlockValue: number | null;
  // Pix Automático (débito recorrente) ligado no checkout. Desligado por padrão: o fluxo por
  // cobrança (QR por ciclo) continua sendo o caminho, e segue existindo como fallback mesmo
  // depois — nem todo banco do pagador suporta Pix Automático.
  pixAutomaticEnabled: boolean;
}

export interface SubscriptionState {
  status: 'active' | 'overdue' | 'cancelled' | 'pending' | 'none';
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  nextDueDate: string | null;
  value: number | null;
  gracePeriodEndsAt: string | null;
  // Assinatura ativa COM a cobranca do ciclo novo em aberto. A assinatura PIX da Asaas e
  // recorrencia de COBRANCA, nao de debito: a cada ciclo nasce um QR a pagar. Sem este sinal
  // a tela mostrava "Ativa" e nao avisava nada.
  pendingRenewal: boolean;
  plan: PlanConfig | null;
  loading: boolean;
  error: string | null;
  pixData: PixData | null;
  // false até a primeira resposta do servidor. `status: 'none'` só é confiável
  // depois disso — antes é apenas o default do Redux (evita banner falso).
  initialized: boolean;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: SubscriptionState = {
  status: 'none',
  asaasCustomerId: null,
  asaasSubscriptionId: null,
  nextDueDate: null,
  value: null,
  gracePeriodEndsAt: null,
  pendingRenewal: false,
  plan: null,
  loading: false,
  error: null,
  pixData: null,
  initialized: false,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

/**
 * Consulta o status atual da assinatura do usuário.
 * Chama a Edge Function `asaas-subscription-status`.
 */
export const fetchSubscriptionStatus = createAsyncThunk(
  'subscription/fetchStatus',
  async (_, { rejectWithValue }) => {
    const { data, error } = await supabase.functions.invoke('asaas-subscription-status');

    if (error) {
      return rejectWithValue(
        categorizeEdgeFunctionError(error, 'Erro ao consultar status da assinatura')
      );
    }

    return data as {
      status: SubscriptionState['status'];
      asaasCustomerId: string | null;
      asaasSubscriptionId: string | null;
      nextDueDate: string | null;
      value: number | null;
      gracePeriodEndsAt: string | null;
      pendingRenewal?: boolean;
    };
  }
);

/**
 * Carrega a configuração de preços do plano ativo (asaas_plan_config) direto do Supabase.
 * RLS: policy "Anyone can read plan config" permite leitura por authenticated/anon.
 * Mantém os preços exibidos em sincronia com o que a edge cobra (editável sem deploy).
 */
export const fetchPlanConfig = createAsyncThunk(
  'subscription/fetchPlanConfig',
  async (_, { rejectWithValue }) => {
    const { data, error } = await supabase
      .from('asaas_plan_config')
      .select('name, monthly_value, annual_value, annual_enabled, profile_unlock_value, pix_automatic_enabled')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return rejectWithValue('Erro ao carregar a configuração do plano');
    }

    return {
      name: (data.name as string) ?? 'Maestra PRO',
      monthlyValue: Number(data.monthly_value),
      annualValue: data.annual_value != null ? Number(data.annual_value) : null,
      annualEnabled: !!data.annual_enabled,
      profileUnlockValue: data.profile_unlock_value != null ? Number(data.profile_unlock_value) : null,
      pixAutomaticEnabled: !!data.pix_automatic_enabled,
    } as PlanConfig;
  }
);

/**
 * Cria um cliente no Asaas com os dados fornecidos.
 * Chama a Edge Function `asaas-create-customer`.
 */
export const createAsaasCustomer = createAsyncThunk(
  'subscription/createCustomer',
  async (
    // `mobilePhone` é opcional e só entra quando o usuário preencheu: habilita a régua de
    // SMS/WhatsApp da Asaas, que sem ele fica restrita ao e-mail.
    payload: { name: string; email: string; cpfCnpj: string; mobilePhone?: string },
    { rejectWithValue }
  ) => {
    const { data, error } = await supabase.functions.invoke('asaas-create-customer', {
      body: payload,
    });

    if (error) {
      return rejectWithValue(
        await readEdgeFunctionError(error, 'Erro ao criar cliente no Asaas')
      );
    }

    return data as { customerId: string };
  }
);

/**
 * Cria uma assinatura recorrente no Asaas.
 * Suporta PIX e Cartão de Crédito.
 * Chama a Edge Function `asaas-create-subscription`.
 */
export const createSubscription = createAsyncThunk(
  'subscription/createSubscription',
  async (payload: {
    customerId: string;
    billingType?: 'PIX' | 'CREDIT_CARD';
    cycle?: BillingCycle;
    couponCode?: string;
    creditCard?: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    };
    creditCardHolderInfo?: {
      name: string;
      email?: string;
      cpfCnpj: string;
      postalCode: string;
      addressNumber?: string;
      address?: string;
      province?: string;
      city?: string;
      uf?: string;
      phone: string;
    };
  }, { rejectWithValue }) => {
    const { data, error } = await supabase.functions.invoke('asaas-create-subscription', {
      body: payload,
    });

    if (error) {
      return rejectWithValue(
        await readEdgeFunctionError(error, 'Erro ao criar assinatura')
      );
    }

    return data as {
      subscriptionId?: string;
      status?: string;
      pixData?: {
        qrCode: string | null;
        copyPaste: string | null;
        expiresAt: string | null;
      } | null;
      // Trava anti-duplicidade da edge: já existe assinatura → não criou outra.
      resume?: boolean;
      alreadyActive?: boolean;
    };
  }
);

/**
 * Retoma um pagamento PIX pendente: busca no Asaas o QR da cobrança em aberto da assinatura
 * existente (sem criar uma nova). Usado ao voltar pra /pagamento depois de fechar a tela.
 * Chama a Edge Function `asaas-resume-payment`.
 */
export const resumePayment = createAsyncThunk(
  'subscription/resumePayment',
  async (_, { rejectWithValue }) => {
    const { data, error } = await supabase.functions.invoke('asaas-resume-payment', { body: {} });

    if (error) {
      return rejectWithValue(
        categorizeEdgeFunctionError(error, 'Erro ao retomar o pagamento')
      );
    }

    return data as {
      status: SubscriptionState['status'];
      // 'CREDIT_CARD' quando a assinatura pendente é de cartão (em análise, sem QR).
      billingType?: string | null;
      // true quando a cobrança em aberto é de RENOVAÇÃO (a assinatura já teve ciclo pago).
      // Sem isto a tela não distingue "assinatura em dia" de "assinatura ativa com o ciclo
      // novo em aberto", e mostra sucesso para quem ainda precisa pagar.
      pendingRenewal?: boolean;
      // true quando o QR devolvido é de uma AUTORIZAÇÃO de Pix Automático, não de uma cobrança
      // avulsa. A tela precisa saber: pagar este QR autoriza débitos futuros, e dizer isso é
      // obrigação nossa, não detalhe de implementação.
      pixAutomatic?: boolean;
      // true quando este é um assinante ANTIGO sendo migrado nesta renovação.
      migrating?: boolean;
      dueDate?: string | null;
      pixData?: PixData | null;
      value?: number | null;
      cycle?: string | null;
    };
  }
);

/**
 * Cria uma autorização de Pix Automático (débito recorrente).
 * Chama a Edge Function `asaas-create-pix-authorization`.
 *
 * A resposta traz `pixData` com os MESMOS campos do fluxo por cobrança — a tela de pagamento não
 * precisa de forma nova. A diferença é o significado: pagar este QR não quita só um ciclo, ele
 * autoriza os débitos seguintes (Jornada 3).
 */
export const createPixAuthorization = createAsyncThunk(
  'subscription/createPixAuthorization',
  async (
    payload: { customerId: string; cycle?: BillingCycle; couponCode?: string },
    { rejectWithValue }
  ) => {
    const { data, error } = await supabase.functions.invoke('asaas-create-pix-authorization', {
      body: payload,
    });

    if (error) {
      return rejectWithValue(
        await readEdgeFunctionError(error, 'Erro ao criar a autorização de pagamento')
      );
    }

    return data as {
      authorizationId?: string;
      authorizationStatus?: string;
      status?: string;
      pixData?: PixData | null;
      value?: number | null;
      cycle?: string | null;
      alreadyActive?: boolean;
      resume?: boolean;
    };
  }
);

/**
 * Cancela a assinatura do usuário no Asaas.
 * Chama a Edge Function `asaas-cancel-subscription`.
 */
export const cancelSubscription = createAsyncThunk(
  'subscription/cancelSubscription',
  async (_, { rejectWithValue }) => {
    const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription', {
      body: {},
    });

    if (error) {
      return rejectWithValue(
        categorizeEdgeFunctionError(error, 'Erro ao cancelar assinatura')
      );
    }

    return data as { success: boolean };
  }
);

/**
 * Polling do status de pagamento.
 * Verifica a cada 5 segundos por até 10 minutos se o pagamento foi confirmado.
 * Resolve quando status === 'active' ou rejeita por timeout.
 *
 * Resiliência a erros de rede:
 * - 1 erro: skip iteração, continua no próximo intervalo sem resetar timer
 * - 3 erros consecutivos: rejeita com mensagem de conectividade
 * - Qualquer resposta bem-sucedida reseta o contador de erros
 */
export const pollPaymentStatus = createAsyncThunk(
  'subscription/pollPaymentStatus',
  async (_, { rejectWithValue }) => {
    const POLL_INTERVAL_MS = 5000;
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
    const MAX_CONSECUTIVE_ERRORS = 3;

    const startTime = Date.now();
    let consecutiveErrors = 0;

    while (Date.now() - startTime < TIMEOUT_MS) {
      const { data, error } = await supabase.functions.invoke(
        'asaas-subscription-status'
      );

      if (error) {
        consecutiveErrors++;

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          return rejectWithValue(
            'Conexão perdida. Verifique sua internet e tente novamente.'
          );
        }

        // Skip iteração, continua no próximo intervalo sem resetar timer
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        continue;
      }

      // Resposta bem-sucedida: reseta contador de erros consecutivos
      consecutiveErrors = 0;

      // `active` sozinho NÃO significa pago. Numa RENOVAÇÃO a assinatura continua ativa enquanto
      // a cobrança do ciclo novo está em aberto — o poll resolvia na primeira volta, a tela
      // declarava "pagamento confirmado" e mandava pro sucesso sem ninguém ter pago nada.
      // Só encerra quando a renovação em aberto também sumiu (webhook/cron limparam o vínculo).
      if (data?.status === 'active' && !data?.pendingRenewal) {
        return data as {
          status: SubscriptionState['status'];
          asaasCustomerId: string | null;
          asaasSubscriptionId: string | null;
          nextDueDate: string | null;
          value: number | null;
          gracePeriodEndsAt: string | null;
          pendingRenewal?: boolean;
        };
      }

      // Aguarda 5 segundos antes do próximo polling
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    return rejectWithValue(
      'O pagamento não foi confirmado no tempo limite. Verifique novamente mais tarde.'
    );
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    resetSubscription() {
      return initialState;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchSubscriptionStatus
    builder
      .addCase(fetchSubscriptionStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSubscriptionStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.status = action.payload.status;
        state.asaasCustomerId = action.payload.asaasCustomerId;
        state.asaasSubscriptionId = action.payload.asaasSubscriptionId;
        state.nextDueDate = action.payload.nextDueDate;
        state.value = action.payload.value;
        state.gracePeriodEndsAt = action.payload.gracePeriodEndsAt;
        state.pendingRenewal = !!action.payload.pendingRenewal;
      })
      .addCase(fetchSubscriptionStatus.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = (action.payload as string) || 'Erro ao consultar assinatura';
      });

    // fetchPlanConfig
    builder
      .addCase(fetchPlanConfig.fulfilled, (state, action) => {
        state.plan = action.payload;
      });

    // resumePayment
    builder
      .addCase(resumePayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resumePayment.fulfilled, (state, action) => {
        state.loading = false;
        state.status = action.payload.status;
        if (action.payload.value != null) state.value = action.payload.value;
        state.pixData = action.payload.pixData ?? null;
      })
      .addCase(resumePayment.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Erro ao retomar o pagamento';
      });

    // createAsaasCustomer
    builder
      .addCase(createAsaasCustomer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAsaasCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.asaasCustomerId = action.payload.customerId;
      })
      .addCase(createAsaasCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Erro ao criar cliente';
      });

    // createSubscription
    builder
      .addCase(createSubscription.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // Pix Automático: o QR da autorização entra no mesmo `pixData` do fluxo por cobrança, para
      // a tela de pagamento não precisar de um caminho paralelo.
      .addCase(createPixAuthorization.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPixAuthorization.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Erro ao criar a autorização de pagamento';
      })
      .addCase(createPixAuthorization.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.alreadyActive) {
          state.status = 'active';
          state.pixData = null;
          return;
        }
        if (action.payload.resume) return;
        state.status = 'pending';
        state.pixData = action.payload.pixData ?? null;
        if (action.payload.value != null) state.value = action.payload.value;
      })
      .addCase(createSubscription.fulfilled, (state, action) => {
        state.loading = false;

        // Trava anti-duplicidade (edge): já existe assinatura.
        if (action.payload.alreadyActive) {
          state.status = 'active';
          state.pixData = null;
          return;
        }
        if (action.payload.resume) {
          // Mantém o status atual (pending); a página navega pra /pagamento (retomar).
          return;
        }

        state.asaasSubscriptionId = action.payload.subscriptionId ?? state.asaasSubscriptionId;

        // Credit card → active immediately
        if (action.payload.status === 'active') {
          state.status = 'active';
          state.pixData = null;
          return;
        }

        // PIX flow — guard against null/absent qrCode
        const responsePixData = action.payload.pixData;
        if (!responsePixData?.qrCode) {
          state.error =
            'Não foi possível gerar o QR Code PIX. Tente novamente.';
          state.pixData = null;
          return;
        }

        // PIX flow — happy path
        state.status = 'pending';
        state.pixData = {
          qrCode: responsePixData.qrCode,
          copyPaste: responsePixData.copyPaste,
          expiresAt: responsePixData.expiresAt,
        };
      })
      .addCase(createSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Erro ao criar assinatura';
      });

    // cancelSubscription
    builder
      .addCase(cancelSubscription.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelSubscription.fulfilled, (state) => {
        state.loading = false;
        state.status = 'cancelled';
        state.pixData = null;
      })
      .addCase(cancelSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Erro ao cancelar assinatura';
      });

    // pollPaymentStatus
    builder
      .addCase(pollPaymentStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(pollPaymentStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.status = action.payload.status;
        state.asaasCustomerId = action.payload.asaasCustomerId;
        state.asaasSubscriptionId = action.payload.asaasSubscriptionId;
        state.nextDueDate = action.payload.nextDueDate;
        state.value = action.payload.value;
        state.gracePeriodEndsAt = action.payload.gracePeriodEndsAt;
        state.pendingRenewal = !!action.payload.pendingRenewal;
        state.pixData = null;
      })
      .addCase(pollPaymentStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Timeout na verificação do pagamento';
      });
  },
});

export const { resetSubscription, clearError } = subscriptionSlice.actions;

export { categorizeEdgeFunctionError };

export default subscriptionSlice.reducer;
