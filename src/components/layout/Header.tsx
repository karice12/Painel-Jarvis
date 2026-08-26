import React, { useState } from "react";
import {
  Sun,
  Moon,
  Activity,
  Shield,
  LogOut,
  ChevronDown,
  Sparkles,
  Building,
  UserCheck,
  Check,
  Search,
  Lock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { NavTab } from "../../types";
import { cn } from "../../lib/utils";

interface HeaderProps {
  currentTabName?: string;
  activeTab?: NavTab | string;
}

const TAB_TITLES: Record<string, string> = {
  dashboard: "Dashboard de Métricas",
  ai_chat: "Assistente OpenJarvis (IA + RAG)",
  internal_chat: "Comunicação Interna & Equipes",
  knowledge_base: "Base de Conhecimento & Documentos",
  agenda: "Agenda Corporativa & Eventos",
  audit_logs: "Logs de Auditoria & Segurança LGPD",
  settings: "Configurações White-Label & API",
};

export const Header: React.FC<HeaderProps> = ({ currentTabName, activeTab }) => {
  const displayTitle =
    currentTabName || (activeTab && TAB_TITLES[activeTab]) || "Dashboard";
  const {
    user,
    tenant,
    theme,
    toggleTheme,
    logout,
    aiConnectionStatus,
    aiLatencyMs,
    updateTenantConfig,
  } = useAuth();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);

  const tenantsList = [
    {
      id: "tenant_omni_01",
      name: "Nexus Enterprise S.A.",
      subdomain: "nexus.omnisas.io",
      color: "#2563eb",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
    },
    {
      id: "tenant_acme_02",
      name: "Acme Global Tech",
      subdomain: "acme.omnisas.io",
      color: "#059669",
      logoUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?w=120&auto=format&fit=crop&q=80",
    },
  ];

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "master_admin":
        return {
          label: "Master Admin",
          desc: "Acesso Total ao Workspace",
          className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
        };
      case "admin":
        return {
          label: "Administrador",
          desc: "Gestão Corporativa & Equipe",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
        };
      default:
        return {
          label: "Colaborador",
          desc: "Acesso Padrão aos Módulos",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <header
      id="app-header"
      className="h-18 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between"
    >
      {/* Left: Breadcrumbs / Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {tenant?.name || "OmniSaaS"}
          </span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            {displayTitle}
          </h1>
        </div>
      </div>

      {/* Center Search Bar simulation */}
      <div className="hidden lg:flex items-center relative max-w-md w-full mx-6">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          id="global-search-input"
          type="text"
          placeholder="Buscar no OpenJarvis (documentos, chats, eventos)..."
          className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <kbd className="absolute right-3 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
          ⌘K
        </kbd>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Multi-Tenant Switcher */}
        <div className="relative">
          <button
            id="btn-tenant-switcher"
            onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Building className="w-3.5 h-3.5 text-blue-500" />
            <span className="max-w-[130px] truncate">{tenant?.name}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isTenantMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Alternar Empresa (Multi-Tenant)
              </div>
              {tenantsList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    updateTenantConfig({
                      id: t.id,
                      name: t.name,
                      subdomain: t.subdomain,
                      primaryColor: t.color,
                      logoUrl: t.logoUrl,
                    });
                    setIsTenantMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors",
                    tenant?.id === t.id
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <div>
                      <div className="font-medium leading-tight">{t.name}</div>
                      <div className="text-[10px] text-slate-400">{t.subdomain}</div>
                    </div>
                  </div>
                  {tenant?.id === t.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live AI Engine Connection Status */}
        <div
          id="ai-connection-indicator"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium"
          title={`Status da IA: ${aiConnectionStatus} (${aiLatencyMs}ms de latência)`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="hidden sm:inline">OpenJarvis AI</span>
          <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-mono">
            {aiLatencyMs}ms
          </span>
        </div>

        {/* Dark / Light Mode Toggle */}
        <button
          id="btn-toggle-theme"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title={`Mudar para modo ${theme === "dark" ? "Claro" : "Escuro"}`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* User Profile & Role Selector Dropdown */}
        <div className="relative">
          <button
            id="btn-user-profile-menu"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <img
              src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
              alt={user?.name ?? "Usuário"}
              className="w-7 h-7 rounded-lg object-cover"
            />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {user?.name ?? "Usuário"}
              </span>
              <span className="text-[10px] text-blue-500 font-medium capitalize">
                {(user?.role ?? "user").replace("_", " ")}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              {/* User details summary */}
              <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-3">
                <img
                  src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                  alt={user?.name ?? "Usuário"}
                  className="w-10 h-10 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                    {user?.name ?? "Usuário"}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {user?.email ?? "usuario@empresa.com"}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {user?.sector ?? "Tecnologia & Inovação"}
                  </div>
                </div>
              </div>

              {/* Verified RBAC Role (Strictly Read-Only from Database / JWT) */}
              <div className="mb-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-blue-500" />
                    Privilégio RBAC
                  </span>
                  <span className="text-[9px] text-emerald-500 font-semibold flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" />
                    Verificado
                  </span>
                </div>

                <div className={cn("px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between", roleInfo.className)}>
                  <div>
                    <div className="font-bold leading-tight">{roleInfo.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{roleInfo.desc}</div>
                  </div>
                  <Check className="w-4 h-4 flex-shrink-0" />
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 px-0.5">
                  🛡️ Papel sincronizado com a tabela <code>profiles</code> no banco de dados.
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

              {/* Logout */}
              <button
                id="btn-logout"
                onClick={() => {
                  logout();
                  setIsProfileOpen(false);
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Encerrar Sessão Segura (Logout)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
