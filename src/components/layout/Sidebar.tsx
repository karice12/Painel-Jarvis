import React from "react";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  BookOpen,
  Calendar,
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  Building2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

export type NavTab =
  | "dashboard"
  | "ai_chat"
  | "internal_chat"
  | "knowledge_base"
  | "agenda"
  | "audit_logs"
  | "settings";

interface SidebarProps {
  currentTab?: NavTab;
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onTabChange?: (tab: NavTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { tenant, user, canAccessAuditLogs } = useAuth();
  const selectedTab = activeTab || currentTab || "dashboard";
  const handleSelectTab = (tab: NavTab) => {
    if (onSelectTab) onSelectTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const navItems = [
    {
      id: "dashboard" as NavTab,
      label: "Dashboard",
      sublabel: "Métricas & Consumo",
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: "ai_chat" as NavTab,
      label: "Chat OpenJarvis",
      sublabel: "Assistente IA + RAG",
      icon: Bot,
      badge: "IA v4.2",
      badgeColor: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    },
    {
      id: "internal_chat" as NavTab,
      label: "Chat Interno",
      sublabel: "Comunicação Setorial",
      icon: MessageSquare,
      badge: "3",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    },
    {
      id: "knowledge_base" as NavTab,
      label: "Base de Conhecimento",
      sublabel: "Documentos & RAG",
      icon: BookOpen,
      badge: "5 Docs",
      badgeColor: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    },
    {
      id: "agenda" as NavTab,
      label: "Agenda & Tarefas",
      sublabel: "Eventos & Calendário",
      icon: Calendar,
      badge: undefined,
    },
    {
      id: "audit_logs" as NavTab,
      label: "Logs de Auditoria",
      sublabel: "Trilha de Segurança",
      icon: ShieldAlert,
      restricted: !canAccessAuditLogs,
      badge: canAccessAuditLogs ? "Master" : "Restrito",
      badgeColor: canAccessAuditLogs
        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
        : "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    },
    {
      id: "settings" as NavTab,
      label: "Configurações",
      sublabel: "White-Label & API",
      icon: Settings,
      badge: undefined,
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className={cn(
        "relative flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 transition-all duration-300 z-30 select-none",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand / Tenant White-Label Header */}
      <div className="h-18 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          {tenant?.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt="Logo"
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-blue-500/20 shadow-xs flex-shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs flex-shrink-0"
              style={{ backgroundColor: tenant?.primaryColor || "#2563eb" }}
            >
              <Building2 className="w-5 h-5" />
            </div>
          )}

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                  {tenant?.name || "OmniSaaS Hub"}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {tenant?.plan || "Enterprise Pro"}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          id="btn-collapse-sidebar"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isCollapsed ? "Expandir Sidebar" : "Recolher Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Navegação Principal
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;
          const isRestricted = item.restricted;

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => handleSelectTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative group",
                isActive
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200",
                isRestricted && "opacity-60"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                  style={{ backgroundColor: tenant?.primaryColor || "#2563eb" }}
                />
              )}

              <div
                className={cn(
                  "p-2 rounded-lg transition-colors flex-shrink-0",
                  isActive
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-none truncate">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-1">
                      {item.sublabel}
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap",
                        item.badgeColor || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}

                  {isRestricted && (
                    <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Quota / API Limit Tracker Mini-Card */}
      {!isCollapsed && (
        <div className="p-3 mx-3 mb-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              Uso da API de IA
            </span>
            <span className="text-[11px] text-slate-400">
              {tenant ? Math.round((tenant.currentRequests / tenant.monthlyRequestLimit) * 100) : 84}%
            </span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{
                width: `${tenant ? (tenant.currentRequests / tenant.monthlyRequestLimit) * 100 : 84.5}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{tenant?.currentRequests.toLocaleString()} reqs</span>
            <span>Limite: {tenant?.monthlyRequestLimit.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Current User Profile Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <img
            src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
            alt={user?.name ?? "Usuário"}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user?.name ?? "Usuário"}
            </div>
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {user?.sector ?? "Tecnologia & Inovação"}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
