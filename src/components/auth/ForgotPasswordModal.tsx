import React, { useState } from "react";
import { KeyRound, Mail, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = "",
}) => {
  const { requestForgotPassword } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setTemporaryPassword(null);

    if (!email || !email.trim()) {
      setErrorMessage("Por favor, informe seu e-mail corporativo.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestForgotPassword(email.trim());
      if (res.success) {
        setSuccessMessage(res.message || "Instruções de recuperação e senha provisória geradas com sucesso!");
        if (res.temporaryPassword) {
          setTemporaryPassword(res.temporaryPassword);
        }
      } else {
        setErrorMessage(res.error || "Não foi possível recuperar a senha.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado ao redefinir a senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl space-y-5 text-white relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight text-white">
              Recuperação de Senha
            </h3>
            <p className="text-xs text-slate-400">
              Redefina o acesso ao seu workspace corporativo
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Informe o e-mail cadastrado na organização. Uma senha provisória de acesso único será emitida e você deverá cadastrar uma nova senha pessoal ao entrar.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com.br"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Feedback & Generated Temp Pass */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
              {temporaryPassword && (
                <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-emerald-500/30 text-center space-y-1">
                  <div className="text-[11px] text-slate-400">Sua nova senha provisória de acesso:</div>
                  <div className="font-mono text-sm font-bold text-emerald-400 select-all tracking-wider">
                    {temporaryPassword}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Copie a senha acima para fazer login e cadastrar sua senha definitiva.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              Voltar ao Login
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Redefinir Senha</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>Segurança Corporativa • Reset Auditado</span>
        </div>
      </div>
    </div>
  );
};
