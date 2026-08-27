import React, { useState } from "react";
import { KeyRound, Shield, CheckCircle2, AlertCircle, Copy, Check, X, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { User } from "../../types";

interface AdminResetPasswordModalProps {
  member: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({
  member,
  isOpen,
  onClose,
}) => {
  const { resetMemberPassword } = useAuth();
  const [customPassword, setCustomPassword] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !member) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setTemporaryPassword(null);
    setCopied(false);

    if (!autoGenerate && (!customPassword || customPassword.length < 6)) {
      setErrorMessage("A senha personalizada deve ter pelo menos 6 caracteres.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetMemberPassword(
        member.id,
        autoGenerate ? undefined : customPassword
      );

      if (res.success) {
        setSuccessMessage(res.message || `Senha do colaborador ${member.name} redefinida com sucesso!`);
        if (res.temporaryPassword) {
          setTemporaryPassword(res.temporaryPassword);
        }
      } else {
        setErrorMessage(res.error || "Não foi possível redefinir a senha do colaborador.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado ao redefinir a senha.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="max-w-md w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Redefinir Senha do Colaborador
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {member.name} ({member.email})
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
          Ao redefinir a senha, uma nova senha provisória será gerada e o colaborador será solicitado a definir uma senha definitiva assim que fizer login.
        </div>

        <form onSubmit={handleReset} className="space-y-3.5">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="radio"
                name="resetType"
                checked={autoGenerate}
                onChange={() => setAutoGenerate(true)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span>Gerar senha provisória aleatória segura</span>
            </label>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="radio"
                name="resetType"
                checked={!autoGenerate}
                onChange={() => setAutoGenerate(false)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span>Definir senha provisória manual</span>
            </label>
          </div>

          {!autoGenerate && (
            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nova Senha Provisória
              </label>
              <input
                type="text"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="Ex: Temp@2026!pass"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMessage}</span>
              </div>
              {temporaryPassword && (
                <div className="mt-2 p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-slate-400">Senha Provisória do Colaborador:</div>
                    <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 select-all">
                      {temporaryPassword}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copiada!" : "Copiar"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Fechar
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Confirmar Reset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
