import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  KeyRound,
  CheckCircle2,
  Cpu,
  Database,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

export const AuthScreen: React.FC = () => {
  const { login, loginWithMagicLink, isLoading } = useAuth();

  const [authMode, setAuthMode] = useState<"password" | "magic_link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    if (authMode === "magic_link") {
      const res = await loginWithMagicLink(email);
      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: res.message || `Link de acesso enviado com sucesso para ${email}! Verifique sua caixa de entrada.`,
        });
      } else {
        setFeedbackMessage({
          type: "error",
          text: res.error || "Não foi possível enviar o Magic Link.",
        });
      }
    } else {
      const res = await login(email, password);
      if (!res.success) {
        setFeedbackMessage({
          type: "error",
          text: res.error || "Credenciais inválidas. Verifique seu e-mail e senha corporativos.",
        });
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white">
      {/* Left Column: Visual branding & Enterprise security proof */}
      <div className="lg:w-1/2 p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 border-b lg:border-b-0 lg:border-r border-slate-800">
        {/* Subtle background glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              OmniJarvis SaaS
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                Enterprise v4.2
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Plataforma Corporativa com Supabase & IA RAG
            </div>
          </div>
        </div>

        {/* Middle Feature Highlights */}
        <div className="my-8 lg:my-0 space-y-5 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Sessão Supabase Auth & Zero-Trust
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Inteligência artificial corporativa conectada ao seu ecossistema.
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-lg">
              Acesso restrito e seguro com autenticação nativa Supabase, buscas semânticas em documentos corporativos com citação de fontes em tempo real, canais de comunicação com WebSockets e governança LGPD.
            </p>
          </div>

          {/* Value props */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1.5" />
              <div className="text-xs font-semibold text-white">
                Controle RBAC & Supabase Auth
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Master Admin, Admin e Colaborador com isolamento estrito por tenant.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs">
              <Database className="w-4 h-4 text-blue-400 mb-1.5" />
              <div className="text-xs font-semibold text-white">
                Bucket Storage & RAG Real
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Envio para o bucket <code className="text-indigo-300">tenant-documents</code> com vetorização imediata.
              </div>
            </div>
          </div>
        </div>

        {/* Security Footer notice */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sessão Supabase JWT & TLS 1.3</span>
          </div>
          <span>ISO 27001 & LGPD Ready</span>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="lg:w-1/2 p-8 lg:p-14 flex items-center justify-center bg-slate-950">
        <div className="w-full max-w-md space-y-5">
          {/* Header */}
          <div className="space-y-1 text-center lg:text-left">
            <h3 className="text-xl font-bold text-white tracking-tight">
              {authMode === "magic_link"
                ? "Acesso via Magic Link"
                : "Acessar Workspace Corporativo"}
            </h3>
            <p className="text-xs text-slate-400">
              {authMode === "magic_link"
                ? "Informe seu e-mail corporativo para receber um token de acesso rápido sem senha."
                : "Entre com suas credenciais corporativas autorizadas."}
            </p>
          </div>

          {/* Mode Switch Tabs (Only Password and Magic Link) */}
          <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              id="tab-auth-password"
              onClick={() => {
                setAuthMode("password");
                setFeedbackMessage(null);
              }}
              className={cn(
                "py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-xs",
                authMode === "password"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <KeyRound className="w-3.5 h-3.5" />
              E-mail e Senha
            </button>

            <button
              type="button"
              id="tab-auth-magiclink"
              onClick={() => {
                setAuthMode("magic_link");
                setFeedbackMessage(null);
              }}
              className={cn(
                "py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-xs",
                authMode === "magic_link"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Mail className="w-3.5 h-3.5" />
              Magic Link
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@suaempresa.com"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {authMode === "password" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Senha de Acesso
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-forgot-password-link"
                      onClick={() => setIsForgotPassOpen(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Esqueceu a senha?
                    </button>
                    <span className="text-slate-600 text-[10px]">•</span>
                    <button
                      type="button"
                      onClick={() => setAuthMode("magic_link")}
                      className="text-[11px] text-slate-400 hover:text-slate-300 hover:underline"
                    >
                      Magic Link
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="auth-password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha de colaborador"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Feedback Alerts */}
            {feedbackMessage && (
              <div
                className={cn(
                  "p-2.5 rounded-lg border text-xs flex items-start gap-2",
                  feedbackMessage.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                )}
              >
                {feedbackMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 text-[11px] leading-relaxed">
                  {feedbackMessage.text}
                </div>
              </div>
            )}

            <button
              id="btn-submit-auth"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {authMode === "magic_link"
                      ? "Enviar Magic Link"
                      : "Entrar no Workspace"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Compliance notice footer */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Acesso restrito a colaboradores autorizados. Caso não possua conta, solicite ao Administrador do seu Tenant.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Conformidade LGPD (Lei nº 13.709/2018) • Sessão Stateless JWT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPassOpen}
        onClose={() => setIsForgotPassOpen(false)}
        initialEmail={email}
      />
    </div>
  );
};
