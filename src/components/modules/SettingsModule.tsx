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
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  FolderPlus,
  Layers,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Bot,
  Zap,
  Scale,
  Calculator,
  ShoppingBag,
  Brain,
  FileCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { TenantConfig, Role, User } from "../../types";
import { cn } from "../../lib/utils";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { AdminResetPasswordModal } from "./AdminResetPasswordModal";

const DEFAULT_SECTORS = [
  "Diretoria & Tecnologia",
  "Tecnologia & Inovação",
  "Financeiro & Controladoria",
  "Comercial & Vendas",
  "Jurídico & Compliance",
  "Recursos Humanos",
  "Marketing & Growth",
  "Operações & Suporte",
];

export const SettingsModule: React.FC = () => {
  const { tenant, updateTenantConfig, canManageTenant, updateUserRole, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"whitelabel" | "ai_params" | "members">("whitelabel");

  // White label state
  const [brandName, setBrandName] = useState(tenant?.name || "Workspace Corporativo");
  const [primaryColor, setPrimaryColor] = useState(tenant?.primaryColor || "#2563eb");
  const [secondaryColor, setSecondaryColor] = useState(tenant?.secondaryColor || "#0f172a");
  const [logoUrl, setLogoUrl] = useState(
    tenant?.logoUrl || tenant?.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80"
  );
  const [customDomain, setCustomDomain] = useState(tenant?.customDomain || tenant?.subdomain || "app.omnisas.io");

  // Keep local state in sync if tenant changes
  useEffect(() => {
    if (tenant) {
      if (tenant.name) setBrandName(tenant.name);
      if (tenant.primaryColor) setPrimaryColor(tenant.primaryColor);
      if (tenant.secondaryColor) setSecondaryColor(tenant.secondaryColor);
      if (tenant.logoUrl || tenant.logo) setLogoUrl(tenant.logoUrl || tenant.logo || "");
      if (tenant.customDomain || tenant.subdomain) setCustomDomain(tenant.customDomain || tenant.subdomain || "");
    }
  }, [tenant]);

  // AI Parameters state
  const [mainProfile, setMainProfile] = useState<string>(() => {
    if (tenant?.aiSettings?.mainProfile) return tenant.aiSettings.mainProfile;
    try {
      const saved = localStorage.getItem("omni_ai_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mainProfile) return parsed.mainProfile;
      }
    } catch {}
    return "Geral";
  });

  const [temperature, setTemperature] = useState<number>(() => {
    if (typeof tenant?.aiSettings?.temperature === "number") return tenant.aiSettings.temperature;
    try {
      const saved = localStorage.getItem("omni_ai_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.temperature === "number") return parsed.temperature;
      }
    } catch {}
    return 0.3;
  });

  const handleProfileChange = (newProfile: string) => {
    setMainProfile(newProfile);
    if (newProfile === "Jurídico & Compliance") {
      setTemperature(0.1);
    } else if (newProfile === "Contabilidade & Finanças") {
      setTemperature(0.1);
    } else if (newProfile === "Varejo & Atendimento") {
      setTemperature(0.5);
    } else if (newProfile === "Geral") {
      setTemperature(0.3);
    }
  };

  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(() => {
    if (typeof tenant?.aiSettings?.maxOutputTokens === "number") return tenant.aiSettings.maxOutputTokens;
    try {
      const saved = localStorage.getItem("omni_ai_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.maxOutputTokens === "number") return parsed.maxOutputTokens;
      }
    } catch {}
    return 2048;
  });

  const [enableRagAutoSearch, setEnableRagAutoSearch] = useState<boolean>(() => {
    if (typeof tenant?.aiSettings?.enableRagAutoSearch === "boolean") return tenant.aiSettings.enableRagAutoSearch;
    try {
      const saved = localStorage.getItem("omni_ai_params");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.enableRagAutoSearch === "boolean") return parsed.enableRagAutoSearch;
      }
    } catch {}
    return true;
  });

  const [isAiSaving, setIsAiSaving] = useState(false);
  const [isAiSaved, setIsAiSaved] = useState(false);

  // Sectors Management state
  const [availableSectors, setAvailableSectors] = useState<string[]>(() => {
    if (tenant?.sectors && tenant.sectors.length > 0) return tenant.sectors;
    return DEFAULT_SECTORS;
  });
  const [isCreatingSector, setIsCreatingSector] = useState(false);
  const [newSectorInput, setNewSectorInput] = useState("");
  const [isSectorSaving, setIsSectorSaving] = useState(false);

  // Fetch Sectors from backend
  const fetchSectors = async () => {
    try {
      const res = await fetch(`/api/tenant/sectors?tenantId=${tenant?.id || "tenant_omni_01"}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sectors) && data.sectors.length > 0) {
          setAvailableSectors(data.sectors);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSectors();
  }, [tenant?.id]);

  // Members Management state
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Notification state
  const [inviteStatus, setInviteStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
    temporaryPassword?: string;
  } | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [memberToResetPassword, setMemberToResetPassword] = useState<User | null>(null);

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
  const [inviteSector, setInviteSector] = useState(availableSectors[0] || "Tecnologia & Inovação");
  const [inviteCustomPassword, setInviteCustomPassword] = useState("");
  const [autoGenPassword, setAutoGenPassword] = useState(true);
  const [showInvitePass, setShowInvitePass] = useState(false);
  const [copiedTempPass, setCopiedTempPass] = useState(false);
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
    { name: "Slate Corporate", primary: "#475569", secondary: "#0f172a" },
  ];

  // Preset Logo Options
  const logoPresets = [
    { label: "Gradiente Geométrico", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80" },
    { label: "Design Minimalista", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80" },
    { label: "Corporate Blue", url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=150&auto=format&fit=crop&q=80" },
  ];

  const handleSaveWhitelabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updatedConfig: Partial<TenantConfig> = {
      name: brandName,
      primaryColor,
      secondaryColor,
      logo: logoUrl,
      logoUrl: logoUrl,
      customDomain,
      subdomain: customDomain,
    };

    try {
      await updateTenantConfig(updatedConfig);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAiParams = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiSaving(true);

    const aiSettings = {
      mainProfile,
      temperature,
      maxOutputTokens,
      enableRagAutoSearch,
    };

    try {
      // 1. Save in backend
      await fetch("/api/tenant/ai-params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant?.id || "tenant_omni_01",
          mainProfile,
          temperature,
          maxOutputTokens,
          enableRagAutoSearch,
          adminUserName: currentUser?.name,
        }),
      });

      // 2. Save in AuthContext and localStorage
      await updateTenantConfig({ aiSettings });
      try {
        localStorage.setItem("omni_ai_params", JSON.stringify(aiSettings));
      } catch {}

      setIsAiSaved(true);
      setTimeout(() => setIsAiSaved(false), 3000);
    } catch (e: any) {
      console.warn("AI Params save local fallback:", e);
      try {
        localStorage.setItem("omni_ai_params", JSON.stringify(aiSettings));
      } catch {}
      await updateTenantConfig({ aiSettings });
      setIsAiSaved(true);
      setTimeout(() => setIsAiSaved(false), 3000);
    } finally {
      setIsAiSaving(false);
    }
  };

  const handleCreateNewSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectorInput || !newSectorInput.trim()) return;

    const sectorName = newSectorInput.trim();
    if (availableSectors.some((s) => s.toLowerCase() === sectorName.toLowerCase())) {
      setInviteSector(availableSectors.find((s) => s.toLowerCase() === sectorName.toLowerCase()) || sectorName);
      setIsCreatingSector(false);
      setNewSectorInput("");
      return;
    }

    setIsSectorSaving(true);
    try {
      const res = await fetch("/api/tenant/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant?.id || "tenant_omni_01",
          sectorName,
          adminUserName: currentUser?.name,
        }),
      });

      let updatedList = [...availableSectors, sectorName];
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sectors)) {
          updatedList = data.sectors;
        }
      }

      setAvailableSectors(updatedList);
      setInviteSector(sectorName);
      await updateTenantConfig({ sectors: updatedList });

      setInviteStatus({
        type: "success",
        message: `Novo setor "${sectorName}" criado e selecionado com sucesso!`,
      });
      setTimeout(() => {
        setInviteStatus((curr) => (curr?.type === "success" && curr.message.includes(sectorName) ? null : curr));
      }, 4000);

      setIsCreatingSector(false);
      setNewSectorInput("");
    } catch (e: any) {
      const updatedList = [...availableSectors, sectorName];
      setAvailableSectors(updatedList);
      setInviteSector(sectorName);
      await updateTenantConfig({ sectors: updatedList });
      setIsCreatingSector(false);
      setNewSectorInput("");
    } finally {
      setIsSectorSaving(false);
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
          tenantName: tenant?.name || "Workspace Corporativo",
          status: "online",
          password: autoGenPassword ? undefined : inviteCustomPassword,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setMembers((prev) => [...prev.filter((m) => m.email.toLowerCase() !== trimmedEmail), data.user]);
        }
        
        const tempPass = data.temporaryPassword || data.user?.temporaryPassword;

        setInviteStatus({
          type: "success",
          message: `Colaborador ${trimmedName} convidado com sucesso para o setor ${inviteSector}! Foi gerada uma senha provisória de acesso. No primeiro login, o colaborador definirá sua senha definitiva.`,
          temporaryPassword: tempPass,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao cadastrar membro no backend.");
      }

      setInviteName("");
      setInviteEmail("");
      setInviteCustomPassword("");
      setAutoGenPassword(true);
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
            Personalize a identidade visual do SaaS, configure os parâmetros de IA do OpenJarvis e gerencie setores e colaboradores da sua organização.
          </p>
        </div>

        {isSaved && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Identidade Visual salva com sucesso!</span>
          </div>
        )}

        {isAiSaved && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Parâmetros de IA salvos com sucesso!</span>
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
              ? "bg-blue-600 text-white shadow-xs font-bold"
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
              ? "bg-blue-600 text-white shadow-xs font-bold"
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
              ? "bg-blue-600 text-white shadow-xs font-bold"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Membros & Setores</span>
        </button>
      </div>

      {/* Content: White-label Tab */}
      {activeTab === "whitelabel" && (
        <form onSubmit={handleSaveWhitelabel} className="space-y-6">
          {/* Live Preview Card */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pré-visualização em Tempo Real da Marca
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {customDomain || "app.suaempresa.com.br"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="w-11 h-11 rounded-xl object-cover ring-2 ring-blue-500/20 shadow-xs flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow-xs flex-shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {brandName || "Nome da Sua Empresa"}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Plano Enterprise Pro
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-[10px] text-emerald-500 font-medium">Ativo</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  Botão com Cor Primária
                </button>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: secondaryColor }}
                  title="Cor Secundária"
                >
                  2ª
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-500" />
              Personalização Visual da Empresa
            </h3>

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Paletas Rápidas Pré-definidas
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setSecondaryColor(preset.secondary);
                    }}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer",
                      primaryColor.toLowerCase() === preset.primary.toLowerCase()
                        ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome da Marca / Tenant
                </label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Ex: Grupo Nexus S.A."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Domínio Customizado / Subdomínio
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="app.suaempresa.com.br"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cor Primária da Marca
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border-0 cursor-pointer p-0.5 bg-transparent"
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
                  Cor Secundária / Destaque
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border-0 cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>URL do Logotipo da Empresa</span>
                  <span className="text-[11px] text-slate-400 font-normal">Aceita PNG, JPG ou SVG direto</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://suaempresa.com.br/logo.png"
                    className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                As alterações de logotipo e cores são aplicadas imediatamente na barra lateral e em todo o workspace.
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? "Salvando..." : "Salvar Configurações de White-Label"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Content: AI Params Tab */}
      {activeTab === "ai_params" && (
        <form onSubmit={handleSaveAiParams} className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  Parâmetros do Motor OpenJarvis
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ajuste o comportamento do modelo Gemini Flash para balancear precisão factual em documentos e criatividade.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>Motor Gemini Flash 2.5</span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Perfil de Atuação Principal Selection */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {mainProfile === "Jurídico & Compliance" ? (
                        <Scale className="w-4 h-4 text-indigo-500" />
                      ) : mainProfile === "Contabilidade & Finanças" ? (
                        <Calculator className="w-4 h-4 text-emerald-500" />
                      ) : mainProfile === "Varejo & Atendimento" ? (
                        <ShoppingBag className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Brain className="w-4 h-4 text-blue-500" />
                      )}
                      Perfil de Atuação Principal
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Define a persona operacional, o formato das respostas e as regras de compliance e citações aplicadas pelo assistente.
                    </p>
                  </div>

                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1",
                      mainProfile === "Jurídico & Compliance"
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                        : mainProfile === "Contabilidade & Finanças"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : mainProfile === "Varejo & Atendimento"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                    )}
                  >
                    <FileCheck className="w-3 h-3" />
                    {mainProfile === "Jurídico & Compliance"
                      ? "Parecer Jurídico Obrigatório (Temp 0.1)"
                      : mainProfile === "Contabilidade & Finanças"
                      ? "Normas RFB / CPC & Tributos (Temp 0.1)"
                      : mainProfile === "Varejo & Atendimento"
                      ? "Catálogo & CDC / Atendimento (Temp 0.5)"
                      : "Corporativo Geral (Temp 0.3)"}
                  </span>
                </div>

                <select
                  value={mainProfile}
                  onChange={(e) => handleProfileChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Jurídico & Compliance">Jurídico & Compliance</option>
                  <option value="Contabilidade & Finanças">Contabilidade & Finanças</option>
                  <option value="Varejo & Atendimento">Varejo & Atendimento</option>
                  <option value="Geral">Geral</option>
                </select>

                {/* Profile Active Directives Details Card */}
                <div
                  className={cn(
                    "p-3 rounded-lg border text-xs leading-relaxed transition-all",
                    mainProfile === "Jurídico & Compliance"
                      ? "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40 text-indigo-900 dark:text-indigo-200"
                      : mainProfile === "Contabilidade & Finanças"
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200"
                      : mainProfile === "Varejo & Atendimento"
                      ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200"
                      : "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200"
                  )}
                >
                  {mainProfile === "Jurídico & Compliance" && (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Diretrizes Ativas: Jurídico & Compliance (Temperatura: 0.1)
                      </div>
                      <p className="text-[11px] opacity-90">
                        • <strong>Tom Consultivo de Advogado Parceiro:</strong> Resposta direta e pragmática sem formato de petição formal, citando leis e artigos (CC, CPC, CLT, LGPD, CDC) com naturalidade.
                      </p>
                      <p className="text-[11px] opacity-90">
                        • <strong>Limpeza de Texto:</strong> Sem URLs no corpo da mensagem — fontes e links são exibidos no painel interativo.
                      </p>
                    </div>
                  )}

                  {mainProfile === "Contabilidade & Finanças" && (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Diretrizes Ativas: Contabilidade & Finanças (Temperatura: 0.1)
                      </div>
                      <p className="text-[11px] opacity-90">
                        • <strong>Consultor Tributário Sênior:</strong> Explicações simples e claras, impacto financeiro prático e cruzamento com normas da RFB e CPC/IFRS.
                      </p>
                      <p className="text-[11px] opacity-90">
                        • <strong>Tabelas Numéricas:</strong> Uso de tabelas pontuais para alíquotas (PIS, COFINS, IRPJ, CSLL) e cálculos fiscais.
                      </p>
                    </div>
                  )}

                  {mainProfile === "Varejo & Atendimento" && (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Diretrizes Ativas: Varejo & Atendimento (Temperatura: 0.5)
                      </div>
                      <p className="text-[11px] opacity-90">
                        • <strong>Tom Caloroso & Resolutivo:</strong> Foco em fechar negócios, encantamento do cliente e soluções ágeis para dúvidas do catálogo.
                      </p>
                      <p className="text-[11px] opacity-90">
                        • <strong>Aplicação Acolhedora do CDC:</strong> Políticas de troca, devolução e garantia aplicadas com clareza e sem atrito.
                      </p>
                    </div>
                  )}

                  {mainProfile === "Geral" && (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Diretrizes Ativas: Perfil Geral & Multissetorial (Temperatura: 0.3)
                      </div>
                      <p className="text-[11px] opacity-90">
                        • <strong>Executivo Direto ao Ponto:</strong> Resolução de problemas ágil, dinâmica e sem rodeios para demandas corporativas e operacionais.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Temperatura / Criatividade ({temperature})
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Valores baixos (0.1 - 0.3) garantem respostas estritamente fiéis aos documentos corporativos e políticas da empresa.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-1 rounded-lg border",
                      temperature <= 0.3
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : temperature <= 0.7
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    )}
                  >
                    {temperature <= 0.3
                      ? "Modo RAG Preciso (Recomendado Corporativo)"
                      : temperature <= 0.7
                      ? "Modo Balanceado"
                      : "Modo Altamente Criativo"}
                  </span>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0.0 (Factual RAG)</span>
                    <span>0.3 (Recomendado)</span>
                    <span>0.7 (Misto)</span>
                    <span>1.0 (Criativo)</span>
                  </div>
                </div>
              </div>

              {/* Tokens Limit */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Máximo de Tokens de Saída por Resposta
                </label>
                <p className="text-[11px] text-slate-400">
                  Controla o tamanho máximo das respostas geradas pelo assistente em relatórios e consultas.
                </p>
                <select
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1024}>1.024 tokens (~750 palavras - Respostas curtas e objetivas)</option>
                  <option value={2048}>2.048 tokens (~1.500 palavras - Padrão corporativo balanceado)</option>
                  <option value={4096}>4.096 tokens (~3.000 palavras - Relatórios aprofundados e análises completas)</option>
                  <option value={8192}>8.192 tokens (~6.000 palavras - Documentos extensos)</option>
                </select>
              </div>

              {/* RAG Auto-search */}
              <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableRagAutoSearch}
                  onChange={(e) => setEnableRagAutoSearch(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Busca Semântica RAG Automática por Padrão
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    O OpenJarvis sempre consultará os documentos corporativos do setor do usuário antes de formular respostas, garantindo embasamento nos procedimentos internos.
                  </div>
                </div>
              </label>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Os parâmetros são salvos nas preferências do tenant e aplicados a todas as requisições de IA.
              </div>
              <button
                type="submit"
                disabled={isAiSaving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isAiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isAiSaving ? "Salvando Parâmetros..." : "Salvar Parâmetros do Motor"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Content: Members & Sectors Tab */}
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
              <div className="flex items-start gap-2.5">
                {inviteStatus.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : inviteStatus.type === "error" ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p>{inviteStatus.message}</p>
                  {inviteStatus.temporaryPassword && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Senha Provisória de Acesso:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {inviteStatus.temporaryPassword}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteStatus.temporaryPassword || "");
                          setCopiedTempPass(true);
                          setTimeout(() => setCopiedTempPass(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                      >
                        {copiedTempPass ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedTempPass ? "Copiada!" : "Copiar"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInviteStatus(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 1. Invite Form Box with Dynamic Sector Creation */}
          {canManageTenant ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Convidar Novo Colaborador para o Tenant
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cadastre novos membros associando-os aos setores da empresa ou crie um novo setor na hora.
                  </p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Painel de Administrador
                </span>
              </div>

              {/* Create Sector Inline Modal / Panel */}
              {isCreatingSector && (
                <form
                  onSubmit={handleCreateNewSector}
                  className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                      <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Criar Novo Setor Corporativo</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingSector(false);
                        setNewSectorInput("");
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="Ex: Logística & Frota, Auditoria Interna, Qualidade..."
                      value={newSectorInput}
                      onChange={(e) => setNewSectorInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={isSectorSaving || !newSectorInput.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isSectorSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Salvar & Selecionar</span>
                    </button>
                  </div>
                </form>
              )}

              <form onSubmit={handleInviteMember} className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
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

                  {/* Sector Selection with Option to Add New */}
                  <div className="sm:col-span-3 flex gap-1.5">
                    <select
                      value={inviteSector}
                      onChange={(e) => {
                        if (e.target.value === "__CREATE_NEW_SECTOR__") {
                          setIsCreatingSector(true);
                        } else {
                          setInviteSector(e.target.value);
                        }
                      }}
                      disabled={isInviting}
                      className="flex-1 px-3 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 truncate"
                    >
                      {availableSectors.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                      <option value="__CREATE_NEW_SECTOR__" className="font-bold text-blue-600">
                        + Criar Novo Setor...
                      </option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsCreatingSector(!isCreatingSector)}
                      title="Criar novo setor para a empresa"
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex-shrink-0 cursor-pointer"
                    >
                      <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </button>
                  </div>

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
                </div>

                {/* Password Generation Mode Selector */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                      <input
                        type="radio"
                        name="invitePassMode"
                        checked={autoGenPassword}
                        onChange={() => setAutoGenPassword(true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Gerar Senha Provisória Automática</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                      <input
                        type="radio"
                        name="invitePassMode"
                        checked={!autoGenPassword}
                        onChange={() => setAutoGenPassword(false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Definir Senha Inicial Manual</span>
                    </label>
                  </div>

                  {!autoGenPassword && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type={showInvitePass ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          value={inviteCustomPassword}
                          onChange={(e) => setInviteCustomPassword(e.target.value)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 pr-8 text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowInvitePass(!showInvitePass)}
                          className="absolute right-2 top-2 text-slate-400"
                        >
                          {showInvitePass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isInviting || (!autoGenPassword && inviteCustomPassword.length < 6)}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer self-end sm:self-auto"
                  >
                    {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    <span>{isInviting ? "Cadastrando..." : "Cadastrar & Enviar Acesso"}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>Apenas administradores podem convidar e gerenciar colaboradores deste workspace.</span>
            </div>
          )}

          {/* 2. Sectors Badges Manager */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Setores Corporativos Cadastrados ({availableSectors.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingSector(true)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Setor</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {availableSectors.map((sector) => (
                <div
                  key={sector}
                  className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>{sector}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Members List Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Colaboradores do Workspace ({members.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gerencie permissões RBAC, setores e credenciais da equipe corporativa.
                </p>
              </div>

              {loadingMembers && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span>Atualizando lista...</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                    <th className="pb-3 px-4">Colaborador</th>
                    <th className="pb-3 px-4">Papel (RBAC)</th>
                    <th className="pb-3 px-4">Setor</th>
                    <th className="pb-3 px-4">Membro Desde</th>
                    <th className="pb-3 px-4 text-right">Ações</th>
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
                        <div className="flex items-center justify-end gap-1">
                          {canManageTenant && m.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => setMemberToResetPassword(m)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
                              title="Redefinir / Gerar Nova Senha Provisória para este Colaborador"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canManageTenant && m.role !== "master_admin" && m.id !== currentUser?.id ? (
                            <button
                              type="button"
                              disabled={deletingMemberId === m.id}
                              onClick={() => handleRemoveMember(m.id, m.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40 cursor-pointer"
                              title="Desativar / Revogar Acesso deste Colaborador"
                            >
                              {deletingMemberId === m.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            !canManageTenant && <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      <AdminResetPasswordModal
        member={memberToResetPassword}
        isOpen={!!memberToResetPassword}
        onClose={() => setMemberToResetPassword(null)}
      />
    </div>
  );
};
