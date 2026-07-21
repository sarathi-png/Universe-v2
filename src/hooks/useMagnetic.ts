import { useMotionValue, useSpring, type MotionValue } from "framer-motion";
import { useCallback, useRef } from "react";

interface MagneticReturn {
  x: MotionValue<number>;
  y: MotionValue<number>;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  ref: React.RefObject<HTMLDivElement | null>;
}

export function useMagnetic(strength = 0.3): MagneticReturn {
  const ref = useRef<HTMLDivElement | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const x = useSpring(mouseX, { stiffness: 150, damping: 15 });
  const y = useSpring(mouseY, { stiffness: 150, damping: 15 });

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      mouseX.set(dx);
      mouseY.set(dy);
    },
    [strength, mouseX, mouseY]
  );

  const onMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return { x, y, onMouseMove, onMouseLeave, ref };
}