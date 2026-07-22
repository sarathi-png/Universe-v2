import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    console.error("[ErrorBoundary] Caught:", error);
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] componentDidCatch:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-2xl font-black text-white">
            !
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Something went off-script
          </h1>
          <p className="max-w-md text-zinc-500">
            {this.state.error?.message || "We hit an unexpected error. Try reloading the experience."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-violet-600 px-6 py-3 font-bold transition hover:bg-violet-500 hover:scale-105 active:scale-95"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
