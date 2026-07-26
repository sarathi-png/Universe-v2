import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Search, Bookmark, Sparkle } from "../components/icons";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);
  const { scrollY } = useScroll();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = lastScroll.current;
    lastScroll.current = latest;
    if (prev < latest && latest > 150) {
      setHidden(true);
    } else if (latest < prev) {
      setHidden(false);
    }
  });

  const links = [
    { to: "/", label: "Home" },
    { to: "/browse/movie", label: "Movies" },
    { to: "/browse/tv", label: "TV Shows" },
    { to: "/browse/tamil-dubbed", label: "Tamil Dubbed" },
    { to: "/explore", label: "Explore" },
    { to: "/watchlist", label: "My List" },
  ];

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: hidden ? -80 : 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-[60] transition-[background,backdrop-filter] duration-500 ${
        scrolled ? "glass-strong" : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className={`mx-auto flex items-center gap-2 sm:gap-6 px-3 sm:px-4 md:px-10 transition-[height] duration-300 ${scrolled ? "h-14" : "h-16"}`}>
        <Link to="/" className="group flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 neon-border transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
            >
              <Sparkle width={18} height={18} className="sm:w-[20px] sm:h-[20px] text-white" />
            </motion.div>
          </div>
          <span className="hidden text-lg sm:text-xl font-black tracking-tight text-glow sm:block" style={{ fontFamily: "var(--font-display)" }}>
            NOVA<span className="text-violet-400">STREAM</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = loc.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-full px-3 xl:px-4 py-1.5 text-xs xl:text-sm font-medium transition whitespace-nowrap ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => navigate("/search")}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Search"
          >
            <Search width={18} height={18} className="sm:w-[20px] sm:h-[20px]" />
          </button>
          <Link
            to="/watchlist"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Watchlist"
          >
            <Bookmark width={18} height={18} className="sm:w-[20px] sm:h-[20px]" />
          </Link>
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500 text-xs sm:text-sm font-bold text-black">
            N
          </div>
        </div>
      </div>
    </motion.header>
  );
}
