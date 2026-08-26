import React, { useState, useEffect } from "react";
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
  BarChart,
  Bar,
} from "recharts";
import {
  Sparkles,
  Database,
  Users,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Server,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

const SECTOR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export const DashboardModule: React.FC = () => {
  const { tenant, user, aiLatencyMs } = useAuth();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    monthlyRequests: {
      value: tenant?.currentRequests || 4820,
      limit: tenant?.monthlyRequestLimit || 10000,
      percentage: 48,
    },
    storageUsed: {
      valueGb: tenant?.currentStorageGb || 2.4,
      limitGb: tenant?.storageLimitGb || 20,
      percentage: 12,
    },
    activeUsers: {
      count: 4,
      total: 5,
    },
    tokensConsumed: {
      total: 284500,
      formatted: "284.5k",
    },
  });

  const [hourlyData, setHourlyData] = useState([
    { hour: "08:00", requests: 120, tokens: 42000 },
    { hour: "10:00", requests: 380, tokens: 124000 },
    { hour: "12:00", requests: 240, tokens: 86000 },
    { hour: "14:00", requests: 620, tokens: 218000 },
    { hour: "16:00", requests: 890, tokens: 340000 },
    { hour: "18:00", requests: 540, tokens: 195000 },
    { hour: "20:00", requests: 210, tokens: 78000 },
  ]);

  const [sectorData, setSectorData] = useState([
    { name: "Tecnologia & IA", value: 45, color: "#3b82f6" },
    { name: "Financeiro & Contábil", value: 25, color: "#10b981" },
    { name: "Suporte ao Cliente", value: 18, color: "#f59e0b" },
    { name: "Marketing & Growth", value: 12, color: "#ec4899" },
  ]);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard/metrics?tenantId=${tenant?.id || "tenant_omni_01"}`);
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
        if (data.recentLogs) setRecentLogs(data.recentLogs);
      }
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  const quotaPercent = metrics.monthlyRequests.percentage;

  const recentCalls = [
    {
      id: "call_01",
      user: "Helena Beatriz Costa",
      sector: "Tecnologia",
      type: "RAG Document Indexing",
      tokens: "14.2k",
      status: "200 OK",
      latency: "142ms",
      time: "Há 4 min",
    },
    {
      id: "call_02",
      user: "Carlos Eduardo Silva",
      sector: "Financeiro",
      type: "OpenJarvis Chat Prompt",
      tokens: "840",
      status: "200 OK",
      latency: "32ms",
      time: "Há 12 min",
    },
    {
      id: "call_03",
      user: "Mariana Souza Lima",
      sector: "Suporte",
      type: "Knowledge Base Query",
      tokens: "2.1k",
      status: "200 OK",
      latency: "68ms",
      time: "Há 25 min",
    },
    {
      id: "call_04",
      user: "Rodrigo Alencar",
      sector: "Diretoria",
      type: "Executive Summary AI",
      tokens: "5.4k",
      status: "200 OK",
      latency: "89ms",
      time: "Há 45 min",
    },
  ];

  const currentReqs = metrics.monthlyRequests.value;
  const limitReqs = metrics.monthlyRequests.limit;

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Banner with White-label Context */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 text-white border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30 mb-2">
              <Zap className="w-3.5 h-3.5" />
              Tenant Ativo: {tenant?.name ?? "Nexus Enterprise"}
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Olá, {user?.name ?? "Colaborador"}! Visão Geral de Operações de IA
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl">
              Monitoramento em tempo real de requisições do motor OpenJarvis,
              armazenamento de documentos RAG e volumetria por setor corporativo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-right">
              <div className="text-[10px] text-slate-400 font-medium">Plano Atual</div>
              <div className="text-xs font-bold text-white">{tenant?.plan}</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
              <div className="text-[10px] text-emerald-400 font-medium">Latência Média</div>
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
              Total de Requisições IA (Mês)
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {currentReqs.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-400">
              / {limitReqs.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2% em relação ao mês anterior</span>
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
              {tenant?.currentStorageGb || 3.42} GB
            </span>
            <span className="text-xs font-medium text-slate-400">
              / {tenant?.storageLimitGb || 10} GB
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>5 documentos ativos indexados</span>
          </div>
        </div>

        {/* Metric 3: Usuários Ativos */}
        <div
          id="metric-card-users"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Usuários Ativos no Tenant
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              28
            </span>
            <span className="text-xs font-medium text-slate-400">/ 50 assentos</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Users className="w-3.5 h-3.5" />
            <span>5 online agora em 4 departamentos</span>
          </div>
        </div>

        {/* Metric 4: Tokens Consumidos */}
        <div
          id="metric-card-tokens"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tokens Consumidos (Ciclo)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              1.45M
            </span>
            <span className="text-xs font-medium text-slate-400">tokens</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Média de 320 tokens / query</span>
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
            {quotaPercent >= 80 && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Cota próxima do limite ({quotaPercent}%)
              </span>
            )}
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Renova em 5 dias
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
            style={{ width: `${quotaPercent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>84.5% da cota mensal utilizada</span>
          <a
            href="#settings"
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1"
          >
            Fazer Upgrade de Pacote de Requisições
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Visual Analytics Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Online Requests Hourly / Daily Area Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Requisições de IA por Horário (Hoje)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumetria de chamadas ao motor OpenJarvis nas últimas 24 horas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Chamadas / hora
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
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
          </div>
        </div>

        {/* Right 1 Col: Sector Usage Distribution Donut Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Distribuição por Setor
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Consumo de tokens e queries por departamento
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
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
          </div>

          {/* Sector Legend */}
          <div className="space-y-1.5 mt-2">
            {sectorData.map((s) => (
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
                  {Math.round((s.value / 8450) * 100)}% ({s.value.toLocaleString()} reqs)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent AI Operations & Gateway Stream */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Atividades Recentes do Gateway OpenJarvis
            </h3>
          </div>
          <span className="text-xs text-slate-400">Stream de chamadas em tempo real</span>
        </div>

        <div className="overflow-x-auto">
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
              {recentCalls.map((call) => (
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
        </div>
      </div>
    </div>
  );
};
