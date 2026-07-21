import { motion } from "framer-motion";
import { IMG } from "../api/tmdb";

interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
}

export default function CastRow({ cast }: { cast: CastMember[] }) {
  if (!cast.length) return null;

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
      {cast.map((person, i) => (
        <motion.div
          key={person.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.3 }}
          className="w-20 shrink-0 text-center"
        >
          <div className="mx-auto mb-1.5 h-16 w-16 overflow-hidden rounded-full ring-1 ring-white/10 transition-all hover:ring-violet-500/50 hover:scale-110">
            {person.profile_path ? (
              <img
                src={IMG.profile(person.profile_path)}
                alt={person.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm text-zinc-500">
                {person.name.charAt(0)}
              </div>
            )}
          </div>
          <p className="truncate text-[11px] font-medium text-white/80">{person.name}</p>
          {person.character && (
            <p className="truncate text-[10px] text-zinc-500">{person.character}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
