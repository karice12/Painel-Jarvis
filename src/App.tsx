import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthScreen } from "./components/auth/AuthScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DashboardModule } from "./components/modules/DashboardModule";
import { AiChatModule } from "./components/modules/AiChatModule";
import { InternalChatModule } from "./components/modules/InternalChatModule";
import { KnowledgeBaseModule } from "./components/modules/KnowledgeBaseModule";
import { AgendaModule } from "./components/modules/AgendaModule";
import { AuditLogsModule } from "./components/modules/AuditLogsModule";
import { SettingsModule } from "./components/modules/SettingsModule";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NavTab } from "./types";
import { AlertCircle, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { ForceChangePasswordModal } from "./components/auth/ForceChangePasswordModal";

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isLoading, authError, clearAuthError, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // If error occurred during session reading from Supabase
  if (authError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-white font-sans">
        <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Sessão Expirada ou Inconsistente
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {authError}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              id="btn-retry-auth"
              onClick={() => {
                clearAuthError();
                window.location.reload();
              }}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>

            <button
              type="button"
              id="btn-return-to-login"
              onClick={async () => {
                clearAuthError();
                await logout();
              }}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              Voltar para o Login
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Sessão Stateless Segura • LGPD Compliance</span>
          </div>
        </div>
      </div>
    );
  }

  // If initial auth is validating token
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-sm font-semibold tracking-tight text-slate-300">
          Autenticando sessão stateless...
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Validando token JWT e permissões RBAC
        </div>
      </div>
    );
  }

  // If not authenticated, display login screen
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Render active module safely wrapped
  const renderActiveModule = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardModule />;
      case "ai_chat":
        return <AiChatModule onAddEventToAgenda={() => setActiveTab("agenda")} />;
      case "internal_chat":
        return <InternalChatModule />;
      case "knowledge_base":
        return <KnowledgeBaseModule />;
      case "agenda":
        return <AgendaModule />;
      case "audit_logs":
        return <AuditLogsModule />;
      case "settings":
        return <SettingsModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      {/* Retractable White-label Sidebar */}
      <Sidebar
        activeTab={activeTab}
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        onTabChange={setActiveTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header with profile selector, dark/light theme toggle, AI API status */}
        <Header activeTab={activeTab} />

        {/* Dynamic Module Canvas */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary
              fallbackTitle="Erro de exibição no módulo"
              fallbackDescription="Ocorreu uma falha ao renderizar este módulo específico. Seus dados continuam preservados."
            >
              {renderActiveModule()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Force Change Password Modal for First Access */}
      <ForceChangePasswordModal />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
