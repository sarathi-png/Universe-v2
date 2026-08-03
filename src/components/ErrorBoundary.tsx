import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, "\nStack:", info.componentStack);
    this.setState({ componentStack: info.componentStack ?? "" });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xl font-black text-white">
            !
          </div>
          <h1 className="text-2xl font-black tracking-tight font-display">
            Something went off-script
          </h1>
          <p className="max-w-md text-red-400 text-sm font-mono">
            {this.state.error?.message || "Unknown error"}
          </p>
          {this.state.componentStack && (
            <pre className="mt-2 max-w-2xl overflow-auto rounded-lg bg-black/40 p-4 text-left text-xs text-zinc-400 font-mono">
              {this.state.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-violet-600 px-6 py-3 font-bold transition-[transform,background] hover:bg-violet-500 hover:scale-105 active:scale-95"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
