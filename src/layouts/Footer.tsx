import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5 bg-nova-950 px-4 pt-4 pb-16 md:px-8 md:py-8 before:absolute before:inset-x-0 before:-top-px before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-500/30 before:to-transparent">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-white font-display">
            NOVA<span className="text-violet-400">STREAM</span>
          </span>
          <span className="text-[11px] text-zinc-500">&copy; {new Date().getFullYear()}</span>
        </div>
        <nav className="flex items-center gap-4 text-xs text-zinc-500">
          <Link to="/dmca" className="transition hover:text-zinc-300 hover:text-violet-400">
            DMCA
          </Link>
          <Link to="/privacy" className="transition hover:text-zinc-300 hover:text-violet-400">
            Privacy
          </Link>
          <Link to="/terms" className="transition hover:text-zinc-300 hover:text-violet-400">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
