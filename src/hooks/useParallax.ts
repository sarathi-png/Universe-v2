import { useScroll, useTransform, type MotionValue } from "framer-motion";

export function useScrollOffset(amount: number): MotionValue<number> {
  const { scrollY } = useScroll();
  return useTransform(scrollY, [0, 500], [0, amount]);
}