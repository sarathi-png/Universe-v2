import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Film, Tv, Compass, Bookmark } from "../components/icons";

export default function MobileNav() {
  const loc = useLocation();
  const items = [
    { to: "/", label: "Home", Icon: Home },
    { to: "/browse/movie", label: "Movies", Icon: Film },
    { to: "/browse/tv", label: "TV", Icon: Tv },
    { to: "/browse/tamil-dubbed", label: "Tamil", Icon: Film },
    { to: "/explore", label: "Explore", Icon: Compass },
    { to: "/watchlist", label: "List", Icon: Bookmark },
  ];
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-[60] glass-strong md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ to, label, Icon }) => {
          const active = loc.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={`relative flex flex-col items-center gap-1 rounded-lg min-w-[44px] min-h-[44px] justify-center px-2 py-1.5 text-[10px] font-medium transition-colors ${
                active ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobileNav"
                  className="absolute -top-2 h-0.5 w-6 rounded-full bg-violet-500"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon width={22} height={22} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
