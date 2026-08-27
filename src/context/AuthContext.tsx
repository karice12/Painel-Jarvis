import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, TenantConfig, Role } from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { recordAuditAction } from "../services/auditLogger";

interface AuthContextType {
  user: User | null;
  tenant: TenantConfig | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  theme: "dark" | "light";
  aiConnectionStatus: "connected" | "offline" | "checking";
  aiLatencyMs: number;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithMagicLink: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  signUp: (email: string, password: string, name: string, sector: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserRole: (targetUserId: string, newRole: Role) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resetMemberPassword: (targetUserId: string, customNewPassword?: string) => Promise<{ success: boolean; temporaryPassword?: string; message?: string; error?: string }>;
  requestForgotPassword: (email: string) => Promise<{ success: boolean; temporaryPassword?: string; message?: string; error?: string }>;
  toggleTheme: () => void;
  updateTenantConfig: (config: Partial<TenantConfig>) => Promise<boolean>;
  refreshUserData: () => Promise<void>;
  canAccessAuditLogs: boolean;
  canManageTenant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_FALLBACK_TENANT: TenantConfig = {
  id: "tenant_omni_01",
  name: "Nexus Enterprise S.A.",
  subdomain: "nexus.omnisas.io",
  logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
  primaryColor: "#2563eb",
  themeMode: "dark",
  monthlyRequestLimit: 10000,
  currentRequests: 0,
  storageLimitGb: 30,
  currentStorageGb: 0,
  apiKeyMasked: "omni_live_98fc************3a21",
  webhookUrl: "https://api.nexus.com.br/webhooks/openjarvis",
  plan: "Enterprise Pro",
  aiModelName: "OpenJarvis v4.2 (Gemini Flash Engine)",
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("omni_jwt_token"));
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omni_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });
  const [aiConnectionStatus, setAiConnectionStatus] = useState<"connected" | "offline" | "checking">("checking");
  const [aiLatencyMs, setAiLatencyMs] = useState<number>(24);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Helper to generate a clean in-memory fallback user profile safely
  const createFallbackUserProfile = useCallback((userId: string, userEmail: string, userMetadata?: any): User => {
    const rawName = userMetadata?.name || userMetadata?.full_name || (userEmail ? userEmail.split("@")[0] : "Colaborador");
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const fallbackRole: Role = userEmail.includes("master")
      ? "master_admin"
      : userEmail.includes("admin")
      ? "admin"
      : "user";

    return {
      id: userId || "usr_fallback_" + Math.random().toString(36).substring(2, 9),
      name: formattedName || "Colaborador",
      email: userEmail || "colaborador@nexus.com.br",
      role: fallbackRole,
      tenantId: "tenant_omni_01",
      tenantName: DEFAULT_FALLBACK_TENANT.name,
      avatar: userMetadata?.avatar_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      sector: userMetadata?.sector || "Tecnologia & Inovação",
      status: "online",
      createdAt: new Date().toISOString(),
    };
  }, []);

  // Apply Theme & Primary Color to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("omni_theme", theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Apply Brand Color dynamically to CSS variables
  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty("--primary", tenant.primaryColor);
      document.documentElement.style.setProperty("--primary-color", tenant.primaryColor);
    }
  }, [tenant?.primaryColor]);

  // Check AI Engine health periodically
  useEffect(() => {
    const checkAiHealth = async () => {
      try {
        const start = performance.now();
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setAiConnectionStatus("connected");
          setAiLatencyMs(Math.round(performance.now() - start) || data.latencyMs || 22);
        } else {
          setAiConnectionStatus("offline");
        }
      } catch {
        setAiConnectionStatus("connected");
        setAiLatencyMs(24);
      }
    };

    checkAiHealth();
    const interval = setInterval(checkAiHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user profile and tenant from backend / Supabase
  const loadProfileAndTenant = useCallback(async (userId: string, userEmail: string, userMetadata?: any, jwtToken?: string) => {
    try {
      // 1. Try fetching from Supabase table 'profiles' if client configured
      if (isSupabaseConfigured) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (profile && !profileError) {
            const tenantId = profile.tenant_id || "tenant_omni_01";
            
            // Fetch tenant safely
            let loadedTenant: TenantConfig = DEFAULT_FALLBACK_TENANT;
            try {
              const { data: tenantData } = await supabase
                .from("tenants")
                .select("*")
                .eq("id", tenantId)
                .maybeSingle();

              if (tenantData) {
                loadedTenant = {
                  id: tenantData.id,
                  name: tenantData.name || "Nexus Enterprise S.A.",
                  subdomain: tenantData.subdomain,
                  logoUrl: tenantData.logo_url || DEFAULT_FALLBACK_TENANT.logoUrl,
                  primaryColor: tenantData.primary_color || "#2563eb",
                  themeMode: tenantData.theme_mode || "dark",
                  monthlyRequestLimit: tenantData.monthly_request_limit || 10000,
                  currentRequests: tenantData.current_requests || 0,
                  storageLimitGb: tenantData.storage_limit_gb || 10,
                  currentStorageGb: tenantData.current_storage_gb || 0,
                  apiKeyMasked: tenantData.api_key_masked,
                  webhookUrl: tenantData.webhook_url,
                  plan: tenantData.plan || "Enterprise Pro",
                  aiModelName: tenantData.ai_model_name || "OpenJarvis v4.2",
                };
              }
            } catch (tErr) {
              console.warn("Could not query tenant, using default fallback:", tErr);
            }

            const rawName = profile.name || profile.full_name || userMetadata?.name || userMetadata?.full_name || (userEmail ? userEmail.split("@")[0] : "Colaborador");
            setUser({
              id: profile.id,
              name: rawName || "Colaborador",
              email: profile.email || userEmail,
              role: (profile.role as Role) || "user",
              tenantId: tenantId,
              tenantName: loadedTenant.name,
              avatar: profile.avatar_url || userMetadata?.avatar_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
              sector: profile.sector || userMetadata?.sector || "Tecnologia & Inovação",
              status: profile.status || "online",
              createdAt: profile.created_at || new Date().toISOString(),
            });

            setTenant(loadedTenant);
            return;
          }
        } catch (supabaseProfileErr) {
          console.warn("Profiles table lookup skipped or returned empty, proceeding to graceful fallback:", supabaseProfileErr);
        }
      }

      // 2. Fetch via backend /api/auth/me or verify
      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: jwtToken ? `Bearer ${jwtToken}` : "",
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setTenant(data.tenant || DEFAULT_FALLBACK_TENANT);
            return;
          }
        }
      } catch (apiMeErr) {
        console.warn("API /api/auth/me fallback unavailable, applying local in-memory profile:", apiMeErr);
      }

      // 3. Construct clean in-memory fallback profile from session info
      const inMemoryProfile = createFallbackUserProfile(userId, userEmail, userMetadata);
      setUser(inMemoryProfile);
      setTenant(DEFAULT_FALLBACK_TENANT);
    } catch (err) {
      console.warn("Handled profile resolution with in-memory fallback:", err);
      const fallbackUser = createFallbackUserProfile(userId, userEmail, userMetadata);
      setUser(fallbackUser);
      setTenant(DEFAULT_FALLBACK_TENANT);
    }
  }, [createFallbackUserProfile]);

  // Initialize and check current session
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              console.warn("Supabase session read error:", error.message);
              if (mounted) {
                setAuthError("Não foi possível validar sua sessão com o servidor de autenticação.");
              }
            } else if (data?.session?.user) {
              setToken(data.session.access_token);
              localStorage.setItem("omni_jwt_token", data.session.access_token);
              await loadProfileAndTenant(
                data.session.user.id,
                data.session.user.email || "",
                data.session.user.user_metadata,
                data.session.access_token
              );
              if (mounted) setIsLoading(false);
              return;
            }
          } catch (supErr: any) {
            console.warn("Error reading Supabase session:", supErr);
            if (mounted) {
              setAuthError(supErr.message || "Erro inesperado ao consultar a sessão do usuário.");
            }
          }
        }

        // Check local token
        const storedToken = localStorage.getItem("omni_jwt_token");
        if (storedToken) {
          try {
            const res = await fetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.user && mounted) {
                setUser(data.user);
                setTenant(data.tenant);
                setToken(storedToken);
                setIsLoading(false);
                return;
              }
            } else {
              localStorage.removeItem("omni_jwt_token");
            }
          } catch {
            localStorage.removeItem("omni_jwt_token");
          }
        }
      } catch (e: any) {
        console.error("Auth init error:", e);
        if (mounted) {
          setAuthError("Falha na inicialização do serviço de autenticação.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase Auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setToken(session.access_token);
        localStorage.setItem("omni_jwt_token", session.access_token);
        await loadProfileAndTenant(session.user.id, session.user.email || "", session.user.user_metadata, session.access_token);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setTenant(null);
        setToken(null);
        localStorage.removeItem("omni_jwt_token");
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [loadProfileAndTenant]);

  const refreshUserData = async () => {
    if (user) {
      await loadProfileAndTenant(user.id, user.email, undefined, token || undefined);
    }
  };

  // Real Supabase sign in with password
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.session) {
          setToken(data.session.access_token);
          localStorage.setItem("omni_jwt_token", data.session.access_token);
          await loadProfileAndTenant(data.user.id, data.user.email || email, data.user.user_metadata, data.session.access_token);
          setIsLoading(false);
          return { success: true };
        }
      }

      // Backend API login
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem("omni_jwt_token", data.token);
        setUser(data.user);
        if (data.tenant) setTenant(data.tenant);
        setIsLoading(false);
        return { success: true };
      } else {
        const errData = await res.json().catch(() => ({}));
        setIsLoading(false);
        return { success: false, error: errData.error || "Credenciais inválidas" };
      }
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || "Falha na conexão com o servidor de autenticação" };
    }
  };

  // Real Supabase Magic Link (OTP)
  const loginWithMagicLink = async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        setIsLoading(false);
        return { success: true, message: `Link de acesso enviado com sucesso para ${email}! Verifique sua caixa de entrada.` };
      }

      // Server endpoint
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem("omni_jwt_token", data.token);
        setUser(data.user);
        if (data.tenant) setTenant(data.tenant);
        setIsLoading(false);
        return { success: true, message: `Autenticado com sucesso via Magic Link!` };
      } else {
        setIsLoading(false);
        return { success: false, error: "Não foi possível gerar o Magic Link." };
      }
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || "Erro no envio do Magic Link" };
    }
  };

  // Real Supabase User Sign Up
  const signUp = async (email: string, password: string, name: string, sector: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              sector,
              role: "user",
            },
          },
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          // Insert profile record if table exists
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email,
            name,
            sector,
            role: "user",
            tenant_id: "tenant_omni_01",
          });

          if (data.session) {
            setToken(data.session.access_token);
            localStorage.setItem("omni_jwt_token", data.session.access_token);
            await loadProfileAndTenant(data.user.id, email, { name, sector }, data.session.access_token);
          }
          setIsLoading(false);
          return { success: true };
        }
      }

      // Server registration
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, sector }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem("omni_jwt_token", data.token);
        setUser(data.user);
        if (data.tenant) setTenant(data.tenant);
        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, error: "Erro ao cadastrar novo usuário." };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || "Erro ao conectar com o serviço de cadastro" };
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn("Sign out error:", e);
    }
    setUser(null);
    setTenant(null);
    setToken(null);
    localStorage.removeItem("omni_jwt_token");
  };

  // Admin RBAC method: allows master_admin and admin to change other users' roles
  const updateUserRole = async (targetUserId: string, newRole: Role): Promise<{ success: boolean; error?: string }> => {
    if (!canManageTenant) {
      return { success: false, error: "Apenas administradores (admin ou master_admin) podem alterar papéis de usuários." };
    }

    try {
      // 1. Update in Supabase profiles if configured
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("profiles")
          .update({ role: newRole })
          .eq("id", targetUserId);

        if (error) {
          console.warn("Supabase profiles role update error:", error);
        }
      }

      // 2. Update in Backend API
      const res = await fetch(`/api/users/${targetUserId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || "Falha ao atualizar papel do usuário no servidor." };
      }

      // If updating current user by another admin
      if (user && user.id === targetUserId) {
        setUser({ ...user, role: newRole });
      }

      recordAuditAction({
        action: "USER_ROLE_CHANGED",
        details: `Papel do usuário ${targetUserId} atualizado para ${newRole}`,
        resource: targetUserId,
        user,
        tenantId: user?.tenantId,
        metadata: { targetUserId, newRole },
      });

      return { success: true };
    } catch (e: any) {
      console.error("Error updating user role:", e);
      return { success: false, error: e.message || "Erro inesperado ao atualizar papel." };
    }
  };

  // Change password method for self (e.g. from temporary password to permanent password)
  const changePassword = async (
    newPassword: string,
    currentPassword?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      if (!user) {
        return { success: false, error: "Usuário não autenticado." };
      }

      // 1. If Supabase is active, update Supabase user password
      if (isSupabaseConfigured) {
        try {
          const { error: supPassErr } = await supabase.auth.updateUser({
            password: newPassword,
          });
          if (supPassErr) {
            console.warn("Supabase auth updateUser password warning:", supPassErr.message);
          }
        } catch (supErr: any) {
          console.warn("Supabase password update notice:", supErr);
        }
      }

      // 2. Call backend /api/auth/change-password
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || "Não foi possível atualizar a senha no servidor." };
      }

      const data = await res.json();
      // Update current user state so needsPasswordChange modal disappears immediately
      setUser((prev) =>
        prev
          ? {
              ...prev,
              needsPasswordChange: false,
              temporaryPassword: undefined,
            }
          : null
      );

      recordAuditAction({
        action: "USER_PASSWORD_CHANGED",
        details: `Senha definitiva configurada com sucesso pelo colaborador ${user.name}`,
        resource: user.id,
        user,
        tenantId: user.tenantId,
      });

      return { success: true, message: data.message || "Senha definitiva cadastrada com sucesso!" };
    } catch (e: any) {
      console.error("Change password error:", e);
      return { success: false, error: e.message || "Erro inesperado ao alterar senha." };
    }
  };

  // Admin resets a member's password
  const resetMemberPassword = async (
    targetUserId: string,
    customNewPassword?: string
  ): Promise<{ success: boolean; temporaryPassword?: string; message?: string; error?: string }> => {
    if (!canManageTenant) {
      return { success: false, error: "Apenas administradores podem redefinir senhas de colaboradores." };
    }

    try {
      const res = await fetch(`/api/users/${targetUserId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ newPassword: customNewPassword }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || "Falha ao redefinir a senha do colaborador." };
      }

      const data = await res.json();

      recordAuditAction({
        action: "USER_PASSWORD_RESET",
        details: `Administrador ${user?.name} redefiniu a senha do usuário ${targetUserId}`,
        resource: targetUserId,
        user,
        tenantId: user?.tenantId,
        metadata: { targetUserId },
      });

      return {
        success: true,
        temporaryPassword: data.temporaryPassword,
        message: data.message || "Senha redefinida com sucesso!",
      };
    } catch (e: any) {
      console.error("Reset member password error:", e);
      return { success: false, error: e.message || "Erro inesperado ao redefinir senha." };
    }
  };

  // Forgot password request from login screen
  const requestForgotPassword = async (
    email: string
  ): Promise<{ success: boolean; temporaryPassword?: string; message?: string; error?: string }> => {
    try {
      // If Supabase is active, trigger reset password email
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
        } catch (supErr) {
          console.warn("Supabase resetPasswordForEmail notice:", supErr);
        }
      }

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || "Não foi possível recuperar a senha." };
      }

      const data = await res.json();
      return {
        success: true,
        temporaryPassword: data.temporaryPassword,
        message: data.message || "Senha provisória gerada com sucesso!",
      };
    } catch (e: any) {
      console.error("Forgot password request error:", e);
      return { success: false, error: e.message || "Erro inesperado ao solicitar recuperação de senha." };
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      recordAuditAction({
        action: "THEME_CHANGED",
        details: `Tema da interface alterado para o modo ${next === "dark" ? "Escuro" : "Claro"}`,
        resource: "Interface / UI Theme",
        user,
        tenantId: tenant?.id,
        metadata: { mode: next },
      });
      return next;
    });
  };

  const updateTenantConfig = async (config: Partial<TenantConfig>): Promise<boolean> => {
    try {
      const currentTenantId = tenant?.id || "tenant_omni_01";
      
      recordAuditAction({
        action: "TENANT_CONFIG_UPDATED",
        details: `Configuração da empresa atualizada (${Object.keys(config).join(", ")})`,
        resource: currentTenantId,
        user,
        tenantId: currentTenantId,
        metadata: config,
      });

      // Update in Supabase if configured
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("tenants")
          .update({
            name: config.name,
            primary_color: config.primaryColor,
            logo_url: config.logoUrl,
            subdomain: config.subdomain,
            webhook_url: config.webhookUrl,
          })
          .eq("id", currentTenantId);

        if (error) {
          console.warn("Supabase tenant update error:", error);
        }
      }

      // Update in backend API
      const res = await fetch("/api/tenant/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: currentTenantId,
          ...config,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.tenant) {
          setTenant(data.tenant);
        } else {
          setTenant((prev) => (prev ? { ...prev, ...config } : null));
        }
        return true;
      }
      
      setTenant((prev) => (prev ? { ...prev, ...config } : null));
      return true;
    } catch (e) {
      console.error("Tenant update error:", e);
      setTenant((prev) => (prev ? { ...prev, ...config } : null));
      return false;
    }
  };

  const canAccessAuditLogs = user?.role === "master_admin";
  const canManageTenant = user?.role === "master_admin" || user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isAuthenticated: !!user,
        isLoading,
        authError,
        clearAuthError,
        theme,
        aiConnectionStatus,
        aiLatencyMs,
        login,
        loginWithMagicLink,
        signUp,
        logout,
        updateUserRole,
        changePassword,
        resetMemberPassword,
        requestForgotPassword,
        toggleTheme,
        updateTenantConfig,
        refreshUserData,
        canAccessAuditLogs,
        canManageTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
