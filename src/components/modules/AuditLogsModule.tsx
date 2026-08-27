import React, { useState, useEffect, useCallback } from "react";
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
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AuditLog } from "../../types";
import { cn, formatDateBR } from "../../lib/utils";
import { getAuditLogsFromDb } from "../../services/supabaseDb";

export const AuditLogsModule: React.FC = () => {
  const { user, canAccessAuditLogs } = useAuth();
  const isMasterAdmin = canAccessAuditLogs || user?.role === "master_admin";

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    const tenantId = user?.tenantId || "tenant_omni_01";

    try {
      const dbLogs = await getAuditLogsFromDb(tenantId);
      if (dbLogs && dbLogs.length > 0) {
        setLogs(dbLogs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    if (isMasterAdmin) {
      loadLogs();
    }
  }, [isMasterAdmin, loadLogs]);

  // Real-time listener for live audit events dispatched on the client
  useEffect(() => {
    const handleNewLog = (event: any) => {
      const newLog = event.detail;
      if (newLog) {
        setLogs((prev) => {
          // Avoid duplicate by ID
          if (prev.some((l) => l.id === newLog.id)) return prev;
          return [newLog, ...prev];
        });
      }
    };

    window.addEventListener("omnijarvis_audit_log_created", handleNewLog);
    return () => {
      window.removeEventListener("omnijarvis_audit_log_created", handleNewLog);
    };
  }, []);

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
      (log.userName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.action || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.resource || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.ip || "").includes(searchQuery);

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

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));

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
            Histórico imutável e rastreabilidade em tempo real de todas as chamadas de IA, autenticações de
            sessão, uploads de documentos RAG, interações de chat e alterações de privilégios no
            tenant.
          </p>
        </div>

        {/* Export and Refresh Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-audit-logs"
            onClick={loadLogs}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Atualizar Logs em Tempo Real"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", isLoading && "animate-spin text-purple-400")} />
            <span>{isLoading ? "Carregando..." : "Atualizar"}</span>
          </button>

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
          <option value="failed">Apenas Bloqueados</option>
        </select>

        {/* Action Filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full sm:w-56 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
        >
          <option value="all">Todas as Ações ({uniqueActions.length})</option>
          {uniqueActions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-sans font-semibold">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Ação Auditada</th>
                <th className="py-3 px-4">Detalhes / Recurso</th>
                <th className="py-3 px-4">IP Origem</th>
                <th className="py-3 px-4">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    Nenhum registro de auditoria encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let formattedDate = log.timestamp;
                  try {
                    formattedDate = new Date(log.timestamp).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                  } catch {
                    formattedDate = log.timestamp;
                  }

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                        {formattedDate}
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

                      <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-300 truncate max-w-sm" title={log.details || log.resource}>
                        {log.details || log.resource}
                      </td>

                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {log.ip}
                      </td>

                      <td className="py-3 px-4 font-sans whitespace-nowrap">
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Detalhes do Registro de Auditoria
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">ID:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Timestamp:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Usuário:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedLog.userName} ({selectedLog.userRole})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">IP Origem:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{selectedLog.ip}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Ação Executada:</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 px-2 py-1 rounded-md inline-block">
                  {selectedLog.action}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Detalhes & Contexto:</span>
                <p className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-sans leading-relaxed">
                  {selectedLog.details || selectedLog.resource}
                </p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Metadados Técnicos:</span>
                  <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
