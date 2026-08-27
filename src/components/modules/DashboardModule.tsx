import React, { useState, useEffect, useTransition } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Database,
  Users,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Info,
  ArrowDownRight,
  Calculator,
  Layers,
  AlertTriangle,
  Headphones,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { getRealDashboardMetrics, DashboardMetricsData } from "../../services/supabaseDb";

const SECTOR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export const DashboardModule: React.FC = () => {
  const { tenant, user } = useAuth();
  const [, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dynamic state initialized to real empty/zero values awaiting Supabase data
  const [metrics, setMetrics] = useState({
    monthlyRequests: {
      value: 0,
      limit: tenant?.monthlyRequestLimit || 10000,
      percentage: 0,
    },
    storageUsed: {
      valueGb: 0,
      limitGb: 30,
      percentage: 0,
      docsCount: 0,
    },
    activeUsers: {
      count: 0,
      total: 0,
    },
    tokensConsumed: {
      total: 0,
      formatted: "0",
    },
  });

  const [hourlyData, setHourlyData] = useState<{ time: string; requests: number; tokens: number }[]>([]);
  const [sectorData, setSectorData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const fetchMetrics = async () => {
    if (!tenant?.id) return;

    try {
      // 1. Attempt Direct Real Supabase query
      const supabaseData: DashboardMetricsData | null = await getRealDashboardMetrics(tenant.id);

      if (supabaseData) {
        startTransition(() => {
          setMetrics({
            monthlyRequests: supabaseData.monthlyRequests,
            storageUsed: {
              ...supabaseData.storageUsed,
              limitGb: 30,
              percentage: Math.min(100, Math.round((supabaseData.storageUsed.valueGb / 30) * 100)),
            },
            activeUsers: supabaseData.activeUsers,
            tokensConsumed: supabaseData.tokensConsumed,
          });

          if (supabaseData.hourlyData && supabaseData.hourlyData.length > 0) {
            setHourlyData(
              supabaseData.hourlyData.map((h) => ({
                time: h.hour,
                requests: h.requests,
                tokens: h.tokens,
              }))
            );
          }

          if (supabaseData.sectorData && supabaseData.sectorData.length > 0) {
            setSectorData(
              supabaseData.sectorData.map((s, idx) => ({
                name: s.name,
                value: s.value,
                color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
              }))
            );
          } else {
            setSectorData([]);
          }

          setRecentActivities(supabaseData.recentActivities || []);
        });
      } else {
        // 2. Fallback to API endpoint if direct Supabase client is offline
        const res = await fetch(`/api/dashboard/metrics?tenantId=${tenant.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.metrics) {
            setMetrics({
              ...data.metrics,
              storageUsed: {
                ...data.metrics.storageUsed,
                limitGb: 30,
                percentage: Math.min(100, Math.round(((data.metrics.storageUsed?.valueGb || 0) / 30) * 100)),
              },
            });
          }
          if (data.requestsByHour) setHourlyData(data.requestsByHour);
          if (data.sectorDistribution) {
            setSectorData(
              data.sectorDistribution.map((s: any, idx: number) => ({
                ...s,
                color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
              }))
            );
          }
          if (data.recentActivities || data.recentLogs) {
            setRecentActivities(data.recentActivities || data.recentLogs);
          }
        }
      }
    } catch (err) {
      console.warn("Could not load real metrics:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);

    // Auto-update dashboard metrics whenever an AI request is made in the system
    const handleRequestCompleted = () => {
      fetchMetrics();
    };
    window.addEventListener("omnijarvis_request_completed", handleRequestCompleted);

    return () => {
      clearInterval(interval);
      window.removeEventListener("omnijarvis_request_completed", handleRequestCompleted);
    };
  }, [tenant?.id]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchMetrics();
  };

  const currentReqs = metrics.monthlyRequests.value;
  const totalTokens = metrics.tokensConsumed.total;
  const totalSectorValue = sectorData.reduce((sum, item) => sum + item.value, 0);
  const isStorageWarning = (metrics.storageUsed?.valueGb || 0) >= 25;

  // Estimativas de Mercado em APIs de Terceiros (OpenAI GPT-4o / Claude 3.5 Sonnet / Gemini Pro)
  // Plataformas de terceiros cobram estritamente em DÓLAR AMERICANO (USD / $)
  // Custo médio de mercado por requisição corporativa com RAG: ~ $0.025 USD por chamada (Prompt + Contexto RAG + Completion)
  // Cotação cambial de referência comercial: 1 USD ≈ R$ 5,80 BRL
  const USD_BRL_RATE = 5.80;
  const COST_PER_REQ_USD = 0.025; // $ 0.025 USD por pedido/requisição
  const COST_PER_REQ_BRL = Number((COST_PER_REQ_USD * USD_BRL_RATE).toFixed(3)); // ~ R$ 0.145 BRL

  // Cada pedido ao Jarvis contabiliza no valor estimado em Dólar e Real
  const estimatedMarketCostUSD = Number((currentReqs * COST_PER_REQ_USD).toFixed(2));
  const estimatedMarketCostBRL = Number((estimatedMarketCostUSD * USD_BRL_RATE).toFixed(2));

  return (
    <div id="dashboard-module-container" className="space-y-6 pb-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Olá, {user?.name || "Colaborador"}
        </h2>

        <button
          id="btn-refresh-dashboard"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs"
          title="Atualizar dados"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-blue-500")} />
          {isRefreshing ? "Atualizando..." : "Sincronizar"}
        </button>
      </div>

      {/* 2 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric 1: Armazenamento RAG (Configurado para 30 GB compartilhado por todos) */}
        <div
          id="metric-card-storage"
          className={cn(
            "p-5 rounded-2xl bg-white dark:bg-slate-900 border shadow-xs transition-all flex flex-col justify-between",
            isStorageWarning
              ? "border-amber-500/60 dark:border-amber-500/60 ring-2 ring-amber-500/20"
              : "border-slate-200 dark:border-slate-800 hover:border-emerald-500/40"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Armazenamento RAG Usado
            </span>
            <div
              className={cn(
                "p-2 rounded-xl",
                isStorageWarning
                  ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {isStorageWarning ? <AlertTriangle className="w-4 h-4" /> : <Database className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold",
                isStorageWarning ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"
              )}
            >
              {loading ? "..." : `${metrics.storageUsed.valueGb} GB`}
            </span>
            <span className="text-xs font-medium text-slate-400">
              / 30 GB
            </span>
          </div>

          <div className="mt-3">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isStorageWarning
                    ? "bg-gradient-to-r from-amber-500 to-rose-500"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                )}
                style={{ width: `${Math.min(100, Math.max(1, (metrics.storageUsed.valueGb / 30) * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{metrics.storageUsed.docsCount} documento(s) indexado(s)</span>
              <span
                className={cn(
                  "font-semibold",
                  isStorageWarning ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {((metrics.storageUsed.valueGb / 30) * 100).toFixed(1)}% ocupado
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-400 flex items-center justify-between">
              <span>* Compartilhado por todos os usuários</span>
              {isStorageWarning && (
                <span className="text-amber-500 font-bold">Contatar Suporte</span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Usuários Ativos */}
        <div
          id="metric-card-users"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Membros do Workspace
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? "..." : metrics.activeUsers.total}
            </span>
            <span className="text-xs font-medium text-slate-400">membros cadastrados</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{metrics.activeUsers.count} conectado(s) agora</span>
            </div>
            <span className="text-slate-400">Isolamento Supabase RLS</span>
          </div>
        </div>
      </div>

      {/* Shared Storage 25GB Critical Alert Banner */}
      {isStorageWarning && (
        <div
          id="shared-storage-warning-banner"
          className="p-5 rounded-3xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/40 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Aviso: Armazenamento RAG Usado em {metrics.storageUsed.valueGb} GB de 30 GB
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                  Limite de 25GB Atingido
                </span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-3xl leading-relaxed">
                <strong>Atenção:</strong> Este armazenamento é <strong>usado por todos os usuários do sistema</strong>. O volume atingiu ou superou 25 GB da cota de 30 GB. Por favor, <strong>entre em contato com o suporte técnico</strong> para expansão de capacidade e evitar o bloqueio na indexação de novos arquivos e bases de conhecimento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            <a
              id="btn-contact-support-storage"
              href="mailto:suporte@omnisas.io?subject=Solicita%C3%A7%C3%A3o%20de%20Aumento%20de%20Armazenamento%20RAG%20(30GB)&body=Ol%C3%A1%20Suporte%2C%20nosso%20armazenamento%20RAG%20compartilhado%20atingiu%20o%20limite%20de%2025GB.%20Gostar%C3%ADamos%20de%20solicitar%20aumento%20de%20cota."
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Headphones className="w-4 h-4" />
              <span>Entrar em Contato com o Suporte</span>
            </a>
          </div>
        </div>
      )}

      {/* Demonstrativo de Custo & Economia em Relação a APIs de Terceiros */}
      <div
        id="third-party-cost-demonstrative-card"
        className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 text-white shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Demonstrativo de Custos: APIs Comerciais de Terceiros vs. OmniJarvis</span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold">
                  Cobrança Externa em Dólar (USD $)
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Cada pedido enviado ao Jarvis é contabilizado automaticamente. Abaixo está a estimativa de economia real caso essas mesmas requisições fossem processadas em provedores comerciais pagos por chamada/token (ex: OpenAI GPT-4o, Claude 3.5 Sonnet, Gemini Pro).
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{currentReqs} {currentReqs === 1 ? "pedido contabilizado" : "pedidos contabilizados"}</span>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {/* Box 1: Custo Estimado em Terceiros (em USD e BRL) */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                Custo Estimado em APIs de Terceiros
              </span>
              <div className="text-xl font-bold text-amber-400 font-mono flex items-baseline gap-1">
                <span>$ {estimatedMarketCostUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-amber-300/80 font-normal">USD</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <span className="text-[11px] text-slate-300 font-medium block">
                ≈ R$ {estimatedMarketCostBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRL
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Base: $0.025 USD (~R$ {COST_PER_REQ_BRL.toFixed(2)}) / pedido
              </span>
            </div>
          </div>

          {/* Box 2: Preço Médio por Requisição Externa */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1">
                Valor Médio em APIs Comerciais
              </span>
              <div className="text-xl font-bold text-slate-200 font-mono flex items-baseline gap-1">
                <span>$ 0.025</span>
                <span className="text-xs text-slate-400 font-normal">USD / req</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <span className="text-[11px] text-slate-300 font-medium block">
                ≈ R$ {COST_PER_REQ_BRL.toFixed(2)} por consulta RAG
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Cobrado em USD por token nos EUA
              </span>
            </div>
          </div>

          {/* Box 3: Custo com OmniJarvis Interno */}
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-medium text-emerald-300 block mb-1">
                Custo na sua Organização
              </span>
              <div className="text-xl font-bold text-emerald-400 font-mono flex items-baseline gap-1">
                <span>$ 0.00</span>
                <span className="text-xs text-emerald-300/80 font-normal">USD (R$ 0,00)</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-emerald-500/20">
              <span className="text-[11px] text-emerald-300 font-medium block">
                100% Gratuito & Ilimitado
              </span>
              <span className="text-[10px] text-emerald-400/70 block mt-0.5">
                Sem taxas em dólar, IOF ou variação cambial
              </span>
            </div>
          </div>

          {/* Box 4: Economia Líquida Total */}
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-medium text-blue-300 block mb-1">
                Economia Real Acumulada
              </span>
              <div className="text-xl font-bold text-blue-400 font-mono flex items-baseline gap-1">
                <ArrowDownRight className="w-4 h-4 text-emerald-400 shrink-0 self-center" />
                <span>$ {estimatedMarketCostUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-blue-300/80 font-normal">USD</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-blue-500/20">
              <span className="text-[11px] text-blue-200 font-medium block">
                ≈ R$ {estimatedMarketCostBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRL
              </span>
              <span className="text-[10px] text-blue-300/80 block mt-0.5">
                Economizado em {currentReqs} pedido(s)
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Note */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Como funciona a economia:</strong> Plataformas comerciais estrangeiras faturam em <strong>Dólar Americano ($ USD)</strong> cobrando por milhão de tokens de entrada e saída. Cada consulta ao Jarvis com busca documental (RAG) consumiria cerca de $0.025 USD (~R$ 0,14 BRL + IOF). Com o OmniJarvis operando com motor local e híbrido, sua organização economiza a cada mensagem enviada.
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
            Câmbio Ref: 1 USD = R$ 5,80
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Online Requests Hourly / Daily Area Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Fluxo de Operações por Horário
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumetria de chamadas registradas no banco de dados
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Chamadas registradas
              </span>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {hourlyData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                <Info className="w-6 h-6 text-slate-400 opacity-60" />
                <span className="text-xs">Aguardando primeiras requisições para desenhar o gráfico temporal.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReqs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "12px",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    name="Requisições"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorReqs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right 1 Col: Sector Usage Distribution Donut Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Distribuição por Setor
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Alocação de colaboradores e documentos por departamento
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {sectorData.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhum setor cadastrado ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "12px",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sector Legend */}
          <div className="space-y-1.5 mt-2">
            {sectorData.length === 0 ? (
              <div className="text-xs text-slate-400 italic">Cadastre colaboradores no Supabase para visualizar a divisão setorial.</div>
            ) : (
              sectorData.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {s.name}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono">
                    {totalSectorValue > 0 ? Math.round((s.value / totalSectorValue) * 100) : 0}% ({s.value})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent AI Operations & Gateway Stream */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Atividades Recentes do Gateway de IA
            </h3>
          </div>
          <span className="text-xs text-slate-400">Stream de trilha de auditoria e chamadas</span>
        </div>

        <div className="overflow-x-auto">
          {recentActivities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Nenhuma atividade recente registrada nesta empresa. As interações do Chat e RAG aparecerão aqui automaticamente.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Colaborador</th>
                  <th className="py-2.5 px-3">Setor</th>
                  <th className="py-2.5 px-3">Tipo de Operação</th>
                  <th className="py-2.5 px-3">Tokens</th>
                  <th className="py-2.5 px-3">Latência</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Momento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recentActivities.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-300"
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {call.user}
                    </td>
                    <td className="py-2.5 px-3">{call.sector}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                      {call.type}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{call.tokens}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                      {call.latency}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-semibold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        {call.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{call.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
