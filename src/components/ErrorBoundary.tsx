import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary ha capturado un error no controlado:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center p-6 text-center text-white">
          <div className="rounded-2xl border border-rose-500/30 bg-[#12080c] p-6 sm:p-8 max-w-lg shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-black text-rose-100">
              {this.props.fallbackTitle ?? "Ocurrió un error al cargar la pantalla"}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-white/60">
              {this.props.fallbackMessage ?? "No te preocupes, la pantalla se recuperará al reintentar."}
            </p>
            {this.state.error && (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-black/50 p-2 text-left font-mono text-[11px] text-rose-300/80 border border-white/10">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 px-5 py-2.5 text-xs font-black text-white shadow-lg hover:scale-105 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/15 transition"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
