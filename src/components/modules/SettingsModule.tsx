import React, { useState, useEffect } from "react";
import {
  Building2,
  Palette,
  Sliders,
  Users,
  Shield,
  Save,
  Check,
  Sparkles,
  Plus,
  Mail,
  Trash2,
  Lock,
  Loader2,
  UserCheck,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { TenantConfig, Role } from "../../types";
import { cn } from "../../lib/utils";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

export const SettingsModule: React.FC = () => {
  const { tenant, updateTenantConfig, canManageTenant, updateUserRole, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"whitelabel" | "ai_params" | "members">("whitelabel");

  // White label state
  const [brandName, setBrandName] = useState(tenant?.name || "Nexus Enterprise");
  const [primaryColor, setPrimaryColor] = useState(tenant?.primaryColor || "#2563eb");
  const [secondaryColor, setSecondaryColor] = useState(tenant?.secondaryColor || "#0f172a");
  const [logoUrl, setLogoUrl] = useState(
    tenant?.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80"
  );
  const [customDomain, setCustomDomain] = useState(tenant?.customDomain || "app.nexus.com.br");

  // AI Parameters state
  const [temperature, setTemperature] = useState(0.3);
  const [maxOutputTokens, setMaxOutputTokens] = useState(2048);
  const [enableRagAutoSearch, setEnableRagAutoSearch] = useState(true);

  // Members Management state
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Notification state
  const [inviteStatus, setInviteStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await fetch(`/api/users?tenantId=${tenant?.id || "tenant_omni_01"}`);
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setMembers(data.users);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [tenant?.id]);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("user");
  const [inviteSector, setInviteSector] = useState("Tecnologia & Inovação");
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Preset Corporate Color Themes
  const colorPresets = [
    { name: "Nexus Blue", primary: "#2563eb", secondary: "#0f172a" },
    { name: "Emerald Prime", primary: "#059669", secondary: "#064e3b" },
    { name: "Purple Titan", primary: "#7c3aed", secondary: "#2e1065" },
    { name: "Amber Capital", primary: "#d97706", secondary: "#451a03" },
    { name: "Crimson Forge", primary: "#dc2626", secondary: "#450a0a" },
    { name: "Cyan Tech", primary: "#0891b2", secondary: "#083344" },
  ];

  const handleSaveWhitelabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updatedConfig = {
      name: brandName,
      primaryColor,
      secondaryColor,
      logo: logoUrl,
      customDomain,
    };

    try {
      await fetch("/api/tenant/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant?.id || "tenant_omni_01",
          config: updatedConfig,
        }),
      });

      updateTenantConfig(updatedConfig);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      updateTenantConfig(updatedConfig);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTenant) {
      setInviteStatus({
        type: "error",
        message: "Acesso negado: apenas Administradores ou Master Admins podem convidar novos membros.",
      });
      return;
    }

    const trimmedEmail = inviteEmail.trim().toLowerCase();
    const trimmedName = inviteName.trim() || trimmedEmail.split("@")[0].replace(".", " ");

    if (!trimmedEmail) {
      setInviteStatus({
        type: "error",
        message: "Por favor, informe um endereço de e-mail corporativo válido.",
      });
      return;
    }

    // Check if email already exists in members list
    const existing = members.find((m) => m.email.toLowerCase() === trimmedEmail);
    if (existing) {
      setInviteStatus({
        type: "error",
        message: `O e-mail '${trimmedEmail}' já está cadastrado na organização como ${existing.role.toUpperCase()}.`,
      });
      return;
    }

    setIsInviting(true);
    setInviteStatus(null);

    try {
      // 1. Supabase RPC validation (if Supabase is active)
      if (isSupabaseConfigured) {
        try {
          const { error: rpcError } = await supabase.rpc("invite_team_member", {
            p_email: trimmedEmail,
            p_full_name: trimmedName,
            p_role: inviteRole,
            p_department: inviteSector,
          });
          if (rpcError) {
            console.warn("Supabase RPC invite_team_member notice/fallback:", rpcError.message);
          }
        } catch (rpcErr: any) {
          console.warn("Supabase RPC invoke caught:", rpcErr?.message);
        }

        // 2. Dispatch OTP / Magic Link or Auth Invite via Supabase Auth
        try {
          await supabase.auth.signInWithOtp({
            email: trimmedEmail,
            options: {
              data: {
                full_name: trimmedName,
                name: trimmedName,
                role: inviteRole,
                department: inviteSector,
                tenant_id: tenant?.id || "tenant_omni_01",
              },
              emailRedirectTo: window.location.origin,
            },
          });
        } catch (authErr: any) {
          console.warn("Supabase auth.signInWithOtp invite notice:", authErr?.message);
        }
      }

      // 3. Persist and synchronize member in backend database store
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          role: inviteRole,
          sector: inviteSector,
          tenantId: tenant?.id || "tenant_omni_01",
          tenantName: tenant?.name || "Nexus Enterprise",
          status: "online",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setMembers((prev) => [...prev.filter((m) => m.email.toLowerCase() !== trimmedEmail), data.user]);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao cadastrar membro no backend.");
      }

      setInviteStatus({
        type: "success",
        message: `Convite enviado com sucesso para ${trimmedEmail}! O colaborador foi adicionado ao tenant com o cargo ${inviteRole.toUpperCase()}.`,
      });
      setInviteName("");
      setInviteEmail("");
      
      // Auto-clear notification after 6 seconds
      setTimeout(() => {
        setInviteStatus((curr) => (curr?.type === "success" ? null : curr));
      }, 6000);
    } catch (err: any) {
      setInviteStatus({
        type: "error",
        message: err.message || "Erro ao enviar convite para o colaborador. Verifique sua conexão.",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (id: string, memberName: string) => {
    if (!canManageTenant) {
      alert("Apenas administradores podem remover ou desativar colaboradores.");
      return;
    }

    if (id === currentUser?.id) {
      alert("Você não pode remover ou desativar sua própria conta de administrador.");
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja revogar o acesso e desativar o colaborador "${memberName}" deste tenant?\n\nEle não terá mais acesso às ferramentas corporativas e chats.`
    );

    if (!confirmed) return;

    setDeletingMemberId(id);

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        setInviteStatus({
          type: "info",
          message: `O acesso do colaborador "${memberName}" foi revogado e seu status foi desativado.`,
        });
        setTimeout(() => {
          setInviteStatus((curr) => (curr?.type === "info" ? null : curr));
        }, 5000);
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao remover colaborador.");
      }
    } catch (e: any) {
      alert("Falha ao comunicar com o servidor: " + (e?.message || "erro desconhecido"));
    } finally {
      setDeletingMemberId(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    if (!canManageTenant) return;
    try {
      const res = await updateUserRole(memberId, newRole);
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        setInviteStatus({
          type: "success",
          message: `Privilégio do colaborador atualizado para ${newRole.toUpperCase()} com sucesso.`,
        });
        setTimeout(() => {
          setInviteStatus((curr) => (curr?.type === "success" ? null : curr));
        }, 4000);
      } else {
        alert(res.error || "Erro ao atualizar papel do colaborador.");
      }
    } catch (e: any) {
      alert("Erro ao alterar papel: " + (e?.message || "falha na comunicação"));
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Configurações da Empresa & White-Label
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Personalize a identidade visual do SaaS, configure os parâmetros de IA do OpenJarvis e gerencie membros da sua organização.
          </p>
        </div>

        {isSaved && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>Configurações atualizadas!</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          id="tab-settings-whitelabel"
          onClick={() => setActiveTab("whitelabel")}
          className={cn(
            "px-4 py-2 rounded-xl transition-all flex items-center gap-2",
            activeTab === "whitelabel"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <Palette className="w-4 h-4" />
          <span>Identidade Visual & White-Label</span>
        </button>

        <button
          id="tab-settings-aiparams"
          onClick={() => setActiveTab("ai_params")}
          className={cn(
            "px-4 py-2 rounded-xl transition-all flex items-center gap-2",
            activeTab === "ai_params"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <Sliders className="w-4 h-4" />
          <span>Parâmetros do OpenJarvis</span>
        </button>

        <button
          id="tab-settings-members"
          onClick={() => setActiveTab("members")}
          className={cn(
            "px-4 py-2 rounded-xl transition-all flex items-center gap-2",
            activeTab === "members"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Membros & RBAC</span>
        </button>
      </div>

      {/* Content: White-label Tab */}
      {activeTab === "whitelabel" && (
        <form onSubmit={handleSaveWhitelabel} className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Personalização Visual da Empresa
            </h3>

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Paletas Rápidas Pré-definidas
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setSecondaryColor(preset.secondary);
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      primaryColor === preset.primary
                        ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: preset.secondary }}
                      />
                    </div>
                    <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome da Marca / Tenant
                </label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Domínio Customizado
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="app.suaempresa.com.br"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cor Primária (Hexadecimal)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border-0 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  URL do Logotipo da Empresa
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Configurações de White-Label</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Content: AI Params Tab */}
      {activeTab === "ai_params" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Parâmetros do Motor OpenJarvis
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ajuste o comportamento do modelo Gemini Flash para balancear
                precisão factual em documentos e criatividade.
              </p>
            </div>

            <div className="space-y-4">
              {/* Temperature Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Temperatura / Criatividade ({temperature})
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {temperature <= 0.3 ? "Modo RAG Preciso (Recomendado para Corporativo)" : "Modo Criativo"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Tokens Limit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Máximo de Tokens de Saída por Resposta
                </label>
                <select
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value={1024}>1.024 tokens (Respostas curtas e objetivas)</option>
                  <option value={2048}>2.048 tokens (Padrão balanceado)</option>
                  <option value={4096}>4.096 tokens (Relatórios aprofundados e análises)</option>
                </select>
              </div>

              {/* RAG Auto-search */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableRagAutoSearch}
                  onChange={(e) => setEnableRagAutoSearch(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Busca Semântica RAG Automática por Padrão
                  </div>
                  <div className="text-[11px] text-slate-400">
                    O OpenJarvis sempre buscará nos documentos do setor antes de responder ao colaborador.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Content: Members & RBAC Tab */}
      {activeTab === "members" && (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          {inviteStatus && (
            <div
              className={cn(
                "p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs font-medium transition-all animate-in fade-in duration-200",
                inviteStatus.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : inviteStatus.type === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
              )}
            >
              <div className="flex items-center gap-2.5">
                {inviteStatus.type === "success" ? (
                  <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : inviteStatus.type === "error" ? (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                ) : (
                  <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <span>{inviteStatus.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setInviteStatus(null)}
                className="opacity-70 hover:opacity-100 transition-opacity p-0.5"
                title="Fechar alerta"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. RESTRIÇÃO DE INTERFACE (RBAC): Invite Box Exclusiva para Master Admin e Admin */}
          {canManageTenant ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Convidar Novo Colaborador para o Tenant
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Dispara o convite seguro via Supabase Auth / Magic Link e adiciona o perfil do colaborador às permissões da empresa.
                  </p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Painel de Administrador
                </span>
              </div>

              <form onSubmit={handleInviteMember} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <input
                  type="text"
                  placeholder="Nome Completo (opcional)"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  disabled={isInviting}
                  className="sm:col-span-3 px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />

                <input
                  type="email"
                  required
                  placeholder="colaborador@empresa.com.br"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isInviting}
                  className="sm:col-span-4 px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />

                <select
                  value={inviteSector}
                  onChange={(e) => setInviteSector(e.target.value)}
                  disabled={isInviting}
                  className="sm:col-span-2 px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="Tecnologia & Inovação">Tecnologia</option>
                  <option value="Financeiro & Controladoria">Financeiro</option>
                  <option value="Comercial & Vendas">Comercial</option>
                  <option value="Jurídico & Compliance">Jurídico</option>
                  <option value="Recursos Humanos">RH</option>
                  <option value="Marketing & Growth">Marketing</option>
                  <option value="Operações & Suporte">Operações</option>
                </select>

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  disabled={isInviting}
                  className="sm:col-span-2 px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="user">Colaborador (User)</option>
                  <option value="admin">Administrador (Admin)</option>
                  {currentUser?.role === "master_admin" && (
                    <option value="master_admin">Master Admin</option>
                  )}
                </select>

                <button
                  type="submit"
                  disabled={isInviting}
                  className="sm:col-span-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isInviting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Enviar</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O envio de convites e o gerenciamento de papéis são restritos a usuários com permissão de <strong>Administrador</strong> ou <strong>Master Admin</strong>.
              </p>
            </div>
          )}

          {/* Members Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
                  Colaboradores do Tenant ({members.length})
                </h4>
              </div>
              {loadingMembers && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  <span>Sincronizando...</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Nome & E-mail</th>
                    <th className="py-3 px-4">Cargo / Função (RBAC)</th>
                    <th className="py-3 px-4">Setor</th>
                    <th className="py-3 px-4">Data de Ingresso</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{m.name}</span>
                          {m.id === currentUser?.id && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                              Você
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        {/* Apenas Admins podem alterar papéis na tabela e não podem alterar a si mesmos */}
                        {canManageTenant && m.id !== currentUser?.id ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-semibold border focus:outline-none transition-all cursor-pointer",
                              m.role === "master_admin"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                : m.role === "admin"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                            )}
                            title="Alterar papel deste colaborador no tenant"
                          >
                            <option value="user">Colaborador (User)</option>
                            <option value="admin">Admin Corporativo</option>
                            {currentUser?.role === "master_admin" && (
                              <option value="master_admin">Master Admin</option>
                            )}
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1",
                              m.role === "master_admin"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                : m.role === "admin"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                            )}
                          >
                            <Shield className="w-2.5 h-2.5" />
                            {m.role === "master_admin"
                              ? "Master Admin"
                              : m.role === "admin"
                              ? "Admin"
                              : "Colaborador"}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {m.sector || "Geral"}
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {m.joinedAt || m.createdAt ? new Date(m.joinedAt || m.createdAt).toLocaleDateString("pt-BR") : "Recente"}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {canManageTenant && m.role !== "master_admin" && m.id !== currentUser?.id ? (
                          <button
                            type="button"
                            disabled={deletingMemberId === m.id}
                            onClick={() => handleRemoveMember(m.id, m.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40"
                            title="Desativar / Revogar Acesso deste Colaborador"
                          >
                            {deletingMemberId === m.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
