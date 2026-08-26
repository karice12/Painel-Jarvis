import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Search,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Lock,
  Globe,
  User,
  FileCode,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AuditLog } from "../../types";
import { cn, formatDateBR } from "../../lib/utils";

export const AuditLogsModule: React.FC = () => {
  const { user, canAccessAuditLogs } = useAuth();
  const isMasterAdmin = canAccessAuditLogs || user?.role === "master_admin";

  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: "log_01",
      userId: "usr_master_01",
      userName: "Rodrigo Alencar",
      userRole: "master_admin",
      action: "AUTH_LOGIN_SUCCESS",
      resource: "Supabase JWT Gateway",
      ip: "189.120.45.12",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      timestamp: "2026-08-26T10:14:22Z",
      status: "success",
      metadata: { method: "magic_link", role: "master_admin" },
    },
    {
      id: "log_02",
      userId: "usr_admin_01",
      userName: "Helena Beatriz Costa",
      userRole: "admin",
      action: "RAG_DOC_INDEX",
      resource: "Politica_Seguranca_Informacao_2026.pdf",
      ip: "177.85.210.99",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      timestamp: "2026-08-26T09:45:10Z",
      status: "success",
      metadata: { tokens: 14200, latencyMs: 120 },
    },
    {
      id: "log_03",
      userId: "usr_user_01",
      userName: "Carlos Eduardo Silva",
      userRole: "user",
      action: "GEMINI_CHAT_PROMPT",
      resource: "OpenJarvis /api/gemini/chat",
      ip: "201.33.104.55",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
      timestamp: "2026-08-26T09:20:00Z",
      status: "success",
      metadata: { ragUsed: true, tokens: 840 },
    },
    {
      id: "log_04",
      userId: "usr_anon_99",
      userName: "Desconhecido",
      userRole: "user",
      action: "UNAUTHORIZED_ACCESS_ATTEMPT",
      resource: "/api/audit-logs",
      ip: "45.142.122.18",
      userAgent: "Python-urllib/3.9",
      timestamp: "2026-08-26T08:12:44Z",
      status: "failed",
      metadata: { reason: "Invalid JWT signature" },
    },
    {
      id: "log_05",
      userId: "usr_user_02",
      userName: "Mariana Souza Lima",
      userRole: "user",
      action: "DOCUMENT_VIEW_RAG",
      resource: "Playbook_Atendimento_SLA_Suporte.pdf",
      ip: "189.44.11.200",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)",
      timestamp: "2026-08-26T07:50:12Z",
      status: "success",
      metadata: { sector: "Suporte ao Cliente & CS" },
    },
    {
      id: "log_06",
      userId: "usr_admin_01",
      userName: "Helena Beatriz Costa",
      userRole: "admin",
      action: "CONFIG_UPDATE_WHITELABEL",
      resource: "Tenant Configuration",
      ip: "177.85.210.99",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      timestamp: "2026-08-25T18:22:00Z",
      status: "success",
      metadata: { primaryColor: "#2563eb", brandName: "Nexus Enterprise" },
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  // RBAC Access Guard: If not master_admin, show restricted access screen
  if (!isMasterAdmin) {
    return (
      <div className="h-[calc(100vh-10rem)] flex flex-col items-center justify-center p-8 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Acesso Restrito: Nível Master Admin Requerido
        </h3>
        <p className="text-xs text-slate-400 max-w-md mt-2">
          A trilha de auditoria e logs de compliance LGPD são restritos aos
          administradores com privilégios <code>master_admin</code>. Seu cargo
          atual é <strong>{user?.role ?? "user"}</strong>.
        </p>
        <div className="mt-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 flex items-center justify-center gap-2 max-w-md">
          <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>Para solicitar acesso a este módulo, contate o <strong>Master Admin</strong> da sua organização.</span>
        </div>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ip.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    return matchesSearch && matchesStatus && matchesAction;
  });

  const exportAsJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(logs, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `audit_logs_lgpd_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportAsCSV = () => {
    const headers = "ID,Data ISO,Usuario,Role,Acao,Recurso,IP Origem,Status\n";
    const rows = logs
      .map(
        (l) =>
          `"${l.id}","${l.timestamp}","${l.userName}","${l.userRole}","${l.action}","${l.resource}","${l.ip}","${l.status}"`
      )
      .join("\n");
    const csvString = `data:text/csv;charset=utf-8,${encodeURIComponent(headers + rows)}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvString);
    downloadAnchor.setAttribute("download", `audit_logs_lgpd_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold">
              Logs de Auditoria & Trilha de Compliance LGPD
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
              Master Admin Exclusivo
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Histórico imutável de todas as chamadas de IA, autenticações de
            sessão, uploads de documentos RAG e alterações de privilégios no
            tenant.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-export-logs-json"
            onClick={exportAsJSON}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Exportar JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span>Exportar JSON</span>
          </button>

          <button
            id="btn-export-logs-csv"
            onClick={exportAsCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            title="Exportar CSV para Compliance"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar CSV (LGPD)</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            id="audit-search-input"
            type="text"
            placeholder="Filtrar por usuário, IP, tipo de ação ou recurso..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="w-full sm:w-40 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
        >
          <option value="all">Todos os Status</option>
          <option value="success">Apenas Sucesso</option>
          <option value="failed">Apenas Falhas / Bloqueios</option>
        </select>

        {/* Action Filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
        >
          <option value="all">Todas as Ações</option>
          <option value="AUTH_LOGIN_SUCCESS">Login de Usuário</option>
          <option value="GEMINI_CHAT_PROMPT">Consulta OpenJarvis</option>
          <option value="RAG_DOC_INDEX">Indexação RAG</option>
          <option value="CONFIG_UPDATE_WHITELABEL">Alteração Config</option>
          <option value="UNAUTHORIZED_ACCESS_ATTEMPT">Acesso Não Autorizado</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-sans font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Ação Auditada</th>
                <th className="py-3 px-4">Recurso / Documento</th>
                <th className="py-3 px-4">IP Origem</th>
                <th className="py-3 px-4">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-300"
                  >
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-white">
                      <div>{log.userName}</div>
                      <div className="text-[10px] text-slate-400 font-normal font-mono">
                        {log.userRole}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-purple-600 dark:text-purple-400 font-bold text-[11px]">
                      {log.action}
                    </td>

                    <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-300 truncate max-w-xs">
                      {log.resource}
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {log.ip}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          SUCCESS (200)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-semibold">
                          <XCircle className="w-3 h-3" />
                          BLOCKED (403)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
