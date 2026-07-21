import { useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";

interface ParallaxOptions {
  offset?: number;
  container?: React.RefObject<HTMLElement>;
}

export function useParallax({
  offset = 0.5,
  container,
}: ParallaxOptions = {}): MotionValue<number> {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
    container,
  });

  return useTransform(scrollYProgress, [0, 1], [offset * 100, -offset * 100]);
}

export function useScrollOffset(amount: number): MotionValue<number> {
  const { scrollY } = useScroll();
  return useTransform(scrollY, [0, 500], [0, amount]);
}