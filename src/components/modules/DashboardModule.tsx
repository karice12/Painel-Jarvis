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
  Sparkles,
  Database,
  Users,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Server,
  Zap,
  RefreshCw,
  Info,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { getRealDashboardMetrics, DashboardMetricsData } from "../../services/supabaseDb";

const SECTOR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export const DashboardModule: React.FC = () => {
  const { tenant, user, aiLatencyMs } = useAuth();
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
      limitGb: tenant?.storageLimitGb || 10,
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
            storageUsed: supabaseData.storageUsed,
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
          if (data.metrics) setMetrics(data.metrics);
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
    const interval = setInterval(fetchMetrics, 20000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchMetrics();
  };

  const currentReqs = metrics.monthlyRequests.value;
  const limitReqs = metrics.monthlyRequests.limit || 10000;
  const quotaPercent = Math.min(100, Math.round((currentReqs / (limitReqs || 1)) * 100));

  const totalSectorValue = sectorData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div id="dashboard-module-container" className="space-y-6 pb-8">
      {/* Welcome Banner with Real Context */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 text-white border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30 mb-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              Empresa: {tenant?.name || "Nexus Enterprise"}
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Olá, {user?.name || "Colaborador"}! Painel de Operações Supabase & IA
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl">
              Monitoramento em tempo real de chamadas, armazenamento de documentos RAG e volumetria por setor.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              id="btn-refresh-dashboard"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs"
              title="Atualizar dados do Supabase"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-blue-400")} />
              {isRefreshing ? "Atualizando..." : "Sincronizar"}
            </button>

            <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-right">
              <div className="text-[10px] text-slate-400 font-medium">Plano</div>
              <div className="text-xs font-bold text-white">{tenant?.plan || "Enterprise Pro"}</div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
              <div className="text-[10px] text-emerald-400 font-medium">Latência</div>
              <div className="text-xs font-bold text-emerald-300 font-mono">{aiLatencyMs} ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Requisições IA */}
        <div
          id="metric-card-requests"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total de Requisições IA
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? "..." : currentReqs.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-400">
              / {limitReqs.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            <span>{quotaPercent}% da cota consumida</span>
          </div>
        </div>

        {/* Metric 2: Armazenamento RAG */}
        <div
          id="metric-card-storage"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Armazenamento RAG Usado
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? "..." : `${metrics.storageUsed.valueGb} GB`}
            </span>
            <span className="text-xs font-medium text-slate-400">
              / {metrics.storageUsed.limitGb} GB
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{metrics.storageUsed.docsCount} documento(s) indexado(s)</span>
          </div>
        </div>

        {/* Metric 3: Usuários Ativos */}
        <div
          id="metric-card-users"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500/40 transition-all"
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
            <span className="text-xs font-medium text-slate-400">membros registrados</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{metrics.activeUsers.count} conectado(s) agora</span>
          </div>
        </div>

        {/* Metric 4: Tokens Consumidos */}
        <div
          id="metric-card-tokens"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tokens Consumidos
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? "..." : metrics.tokensConsumed.formatted}
            </span>
            <span className="text-xs font-medium text-slate-400">tokens</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{metrics.tokensConsumed.total.toLocaleString()} total no ciclo</span>
          </div>
        </div>
      </div>

      {/* API Quota Consumption Bar */}
      <div
        id="api-quota-bar-card"
        className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Consumo do Limite da API ({currentReqs.toLocaleString()} / {limitReqs.toLocaleString()} requisições)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {quotaPercent >= 80 ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Cota próxima do limite ({quotaPercent}%)
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Dentro dos limites operacionais
              </span>
            )}
            <span className="text-slate-400 flex items-center gap-1 ml-2">
              <Clock className="w-3 h-3" />
              Ciclo Mensal
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              quotaPercent > 80
                ? "bg-gradient-to-r from-amber-500 to-rose-500"
                : "bg-gradient-to-r from-blue-500 to-indigo-600"
            )}
            style={{ width: `${Math.max(1, quotaPercent)}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{quotaPercent}% da cota mensal utilizada</span>
          <span className="text-slate-400">
            {Math.max(0, limitReqs - currentReqs).toLocaleString()} requisições restantes
          </span>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Online Requests Hourly / Daily Area Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Fluxo de Requisições por Horário
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
