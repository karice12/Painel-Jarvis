import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogOut, ShieldCheck } from "lucide-react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught runtime error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  private handleReturnToLogin = (): void => {
    localStorage.removeItem("omni_jwt_token");
    window.location.href = window.location.origin;
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                {this.props.fallbackTitle || "Ops! Ocorreu uma inconsistência na exibição"}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {this.props.fallbackDescription ||
                  "Os dados da sua sessão ou perfil foram carregados com uma divergência. Seus dados continuam seguros."}
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono text-left max-h-24 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                id="btn-error-boundary-reload"
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar Novamente
              </button>

              <button
                type="button"
                id="btn-error-boundary-login"
                onClick={this.handleReturnToLogin}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                Voltar para o Login
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Sessão protegida por governança LGPD</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
