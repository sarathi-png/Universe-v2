import { useRef } from "react";
import { motion } from "framer-motion";
import type { MediaItem } from "../api/tmdb";
import MediaCard from "./MediaCard";
import { ChevronLeft, ChevronRight } from "./icons";

interface Props {
  title: string;
  items?: MediaItem[];
  loading?: boolean;
  numbered?: boolean;
  accent?: string;
}

export default function Row({ title, items, loading, numbered, accent }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 700, behavior: "smooth" });
  };

  return (
    <section className="group/row relative my-6 md:my-8 overflow-hidden">
      <div className="mb-3 flex items-center gap-3 px-3 sm:px-4 md:px-10">
        {accent && (
          <span
            className="h-5 w-1.5 rounded-full"
            style={{ background: accent }}
          />
        )}
        <h2 className="text-base font-bold tracking-tight md:text-xl" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
      </div>

      <div className="relative">
        {/* Gradient fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-10 bg-gradient-to-r from-nova-950 to-transparent opacity-0 transition-opacity group-hover/row:opacity-100 md:w-16 md:block" />
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-10 bg-gradient-to-l from-nova-950 to-transparent opacity-0 transition-opacity group-hover/row:opacity-100 md:w-16 md:block" />

        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-0 z-30 hidden h-full w-10 items-center justify-center bg-gradient-to-r from-black/80 to-transparent opacity-0 transition-opacity group-hover/row:opacity-100 md:w-12 md:flex"
        >
          <ChevronLeft width={28} height={28} />
        </button>
        <div
          ref={ref}
          className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth px-3 pb-6 pt-2 sm:px-4 md:gap-3 md:px-10 md:pb-8"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] w-[120px] shrink-0 rounded-xl shimmer sm:w-[140px] md:w-[168px]"
                  style={{ scrollSnapAlign: "start" }}
                />
              ))
            : items?.map((item, i) => (
                <motion.div
                  key={`${item.id}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "100px" }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.3) }}
                  className="w-[120px] shrink-0 sm:w-[140px] md:w-[168px]"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <MediaCard
                    item={item}
                    index={i}
                    rank={numbered ? i + 1 : undefined}
                  />
                </motion.div>
              ))}
        </div>
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-0 z-30 hidden h-full w-10 items-center justify-center bg-gradient-to-l from-black/80 to-transparent opacity-0 transition-opacity group-hover/row:opacity-100 md:w-12 md:flex"
        >
          <ChevronRight width={28} height={28} />
        </button>
      </div>
    </section>
  );
}
