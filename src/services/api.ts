import { OpenJarvisMessage, RagCitation, WebSearchQuotaInfo, WebSearchSource } from "../types";

/**
 * OmniJarvis AI & Web Search (ProJarvis) Service Layer
 * 
 * Regras de Negócio & Cotas:
 * - Pool global de Pesquisa Web: 3.000 requisições / mês.
 * - Cota individual calculada dinamicamente: 3.000 / membros_ativos / 30 dias.
 * - Motor Principal: Ollama Local (com RAG de documentos, sem limites de busca web).
 * - Módulo ProJarvis: Pesquisa Web em tempo real gerenciada de forma segura e transparente via backend/proxy.
 * - Zero exposição de API Keys no front-end.
 * - Fallback inteligente offline caso o backend ou serviço local esteja temporariamente indisponível.
 */

export const GLOBAL_MONTHLY_WEB_SEARCH_POOL = 3000;

export interface SendChatMessageParams {
  message: string;
  history?: OpenJarvisMessage[];
  useKnowledgeBase?: boolean;
  isWebSearchEnabled?: boolean;
  userSector?: string;
  userRole?: string;
  userName?: string;
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  token?: string;
  systemInstruction?: string;
  onWebSearchQuotaExceeded?: (quotaInfo: WebSearchQuotaInfo) => void;
}

export interface ChatServiceResponse {
  text: string;
  ragSources?: RagCitation[];
  ragConsulted?: boolean;
  webSearchUsed?: boolean;
  webSearchSources?: WebSearchSource[];
  webSearchQuotaExceeded?: boolean;
  suggestedEvent?: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    category?: string;
    sector?: string;
    participants?: string[];
    description: string;
  } | null;
  dispatchedNotification?: {
    recipientName: string;
    recipientEmail: string;
    message: string;
    channelName?: string;
  } | null;
  tokensUsed?: number;
  engineUsed?: 'ollama_local' | 'projarvis_web' | 'gemini_flash' | string;
  timestamp?: string;
}

/**
 * Calcula dinamicamente a cota diária e mensal de busca web por usuário
 * com base no pool global de 3.000 requisições/mês e membros ativos do workspace.
 */
export function calculateDynamicWebSearchQuota(
  activeUsersCount: number = 5,
  currentUsed: number = 0
): WebSearchQuotaInfo {
  const safeUserCount = Math.max(1, activeUsersCount);
  // Cota diária estimada: (3.000 / total_usuários) / 30 dias
  const dailyCalculatedLimit = Math.max(2, Math.floor(GLOBAL_MONTHLY_WEB_SEARCH_POOL / safeUserCount / 30));
  const remaining = Math.max(0, dailyCalculatedLimit - currentUsed);

  return {
    webSearchLimit: dailyCalculatedLimit,
    webSearchUsed: currentUsed,
    remaining,
    activeUsersCount: safeUserCount,
    monthlyPoolTotal: GLOBAL_MONTHLY_WEB_SEARCH_POOL,
    allowed: currentUsed < dailyCalculatedLimit,
    message: currentUsed >= dailyCalculatedLimit
      ? `Você atingiu sua cota individual diária de Pesquisa Web (${dailyCalculatedLimit} buscas). Seu limite é recalculado com base nos ${safeUserCount} membros do workspace.`
      : `Cota de Pesquisa Web: ${currentUsed}/${dailyCalculatedLimit} buscas hoje.`,
  };
}

/**
 * Consulta a cota atual de busca web do usuário no backend/proxy
 */
export async function getWebSearchQuota(
  userId: string = "usr_master_01",
  tenantId: string = "tenant_omni_01",
  token?: string
): Promise<WebSearchQuotaInfo> {
  try {
    const res = await fetch(
      `/api/ai/web-search/quota?userId=${encodeURIComponent(userId)}&tenantId=${encodeURIComponent(tenantId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      return {
        webSearchLimit: Number(data.webSearchLimit ?? 20),
        webSearchUsed: Number(data.webSearchUsed ?? 0),
        remaining: Number(data.remaining ?? (data.webSearchLimit - data.webSearchUsed)),
        activeUsersCount: Number(data.activeUsersCount ?? 5),
        monthlyPoolTotal: Number(data.monthlyPoolTotal ?? GLOBAL_MONTHLY_WEB_SEARCH_POOL),
        allowed: Boolean(data.allowed !== false),
        date: data.date,
        message: data.message,
      };
    }
  } catch (err) {
    console.warn("[ProJarvis Web Search] Erro de rede ao buscar status de cota, usando cálculo local:", err);
  }

  // Fallback offline com cálculo padrão
  return calculateDynamicWebSearchQuota(5, 0);
}

/**
 * Consulta status geral de requisições de IA (Ollama / Gemini)
 */
export async function getAiUsageStatus(
  userId: string = "usr_master_01",
  tenantId: string = "tenant_omni_01",
  token?: string
): Promise<{ current_usage: number; daily_limit: number; active_users_count: number; allowed: boolean }> {
  try {
    const res = await fetch(
      `/api/ai/usage-status?userId=${encodeURIComponent(userId)}&tenantId=${encodeURIComponent(tenantId)}`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      return {
        current_usage: Number(data.current_usage ?? 0),
        daily_limit: Number(data.daily_limit ?? 20),
        active_users_count: Number(data.active_users_count ?? 4),
        allowed: Boolean(data.allowed !== false),
      };
    }
  } catch (err) {
    console.warn("Falha ao consultar cota geral de IA:", err);
  }

  return {
    current_usage: 0,
    daily_limit: 25,
    active_users_count: 5,
    allowed: true,
  };
}

/**
 * Despacha a mensagem do chat para a API com gerenciamento de cota de Pesquisa Web
 * e chamadas reais aos serviços locais (Ollama e SearXNG).
 */
export async function sendChatMessage(params: SendChatMessageParams): Promise<ChatServiceResponse> {
  const {
    message,
    history = [],
    useKnowledgeBase = true,
    isWebSearchEnabled = false,
    userSector = "Geral",
    userRole = "user",
    userName = "Colaborador",
    userId = "usr_master_01",
    userEmail = "usuario@nexus.com.br",
    tenantId = "tenant_omni_01",
    token,
    systemInstruction,
    onWebSearchQuotaExceeded,
  } = params;

  let effectiveWebSearch = isWebSearchEnabled;
  let webSearchExceeded = false;

  // 1. Verificação prévia de cota se a Pesquisa Web estiver ativada
  if (isWebSearchEnabled) {
    const quotaInfo = await getWebSearchQuota(userId, tenantId, token);
    if (!quotaInfo.allowed) {
      effectiveWebSearch = false;
      webSearchExceeded = true;
      if (onWebSearchQuotaExceeded) {
        onWebSearchQuotaExceeded(quotaInfo);
      }
    }
  }

  // 2. Disparo da requisição para o endpoint local / proxy
  const apiUrl = `${import.meta.env.VITE_JARVIS_API_URL || ""}/api/ai/chat`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      history: history.slice(-6).map((h) => ({
        sender: h.sender,
        text: h.text,
      })),
      useKnowledgeBase,
      isWebSearchEnabled: effectiveWebSearch,
      userSector,
      userRole,
      userName,
      tenantId,
      userId,
      userEmail,
      systemInstruction,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return {
      text: data.text || "Resposta processada pelo OmniJarvis.",
      ragSources: data.ragSources || [],
      ragConsulted: Boolean(data.ragConsulted),
      webSearchUsed: Boolean(data.webSearchUsed),
      webSearchSources: data.webSearchSources || [],
      webSearchQuotaExceeded: webSearchExceeded || Boolean(data.webSearchQuotaExceeded),
      suggestedEvent: data.suggestedEvent || null,
      dispatchedNotification: data.dispatchedNotification || null,
      tokensUsed: data.tokensUsed || 120,
      engineUsed: data.engineUsed || "ollama_local",
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } else {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg =
      errorData.error ||
      errorData.details ||
      `Erro no servidor HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }
}
