import type { Transition, Variants } from "framer-motion";

const mql = typeof window !== "undefined"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
const prefersReducedMotion = () => mql?.matches ?? false;

function rm<T extends Transition>(t: T): T {
  return prefersReducedMotion() ? ({ duration: 0 } as T) : t;
}

export const spring = rm({
  type: "spring",
  stiffness: 300,
  damping: 25,
  mass: 0.8,
} as Transition);

export const springHeavy = rm({
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 1.2,
} as Transition);

export const smooth = rm({
  duration: 0.4,
  ease: [0.16, 1, 0.3, 1],
} as Transition);

export const smoothOut = rm({
  duration: 0.3,
  ease: [0.4, 0, 1, 1],
} as Transition);

export const pageEnter: Variants = {
  initial: { opacity: 0, scale: 0.97, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: smooth },
  exit: { opacity: 0, scale: 0.96, filter: "blur(4px)", transition: smoothOut },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: smooth,
  },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.9, transition: smoothOut },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: smooth },
  exit: { opacity: 0, y: -20, transition: smoothOut },
};

export const glitch: Variants = {
  initial: { opacity: 1 },
  animate: {
    x: [0, -2, 3, -1, 0],
    opacity: [1, 0.8, 1, 0.9, 1],
    transition: { duration: 0.3, repeat: 2 },
  },
};

export const revealClip: Variants = {
  initial: { clipPath: "inset(0 100% 0 0)" },
  animate: {
    clipPath: "inset(0 0% 0 0)",
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export const magnetic = (x: number, y: number): Variants => ({
  initial: { x: 0, y: 0 },
  animate: { x, y, transition: spring },
});

export const heroTextStagger: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.3,
    },
  },
};

export const heroChar: Variants = {
  initial: { opacity: 0, y: 40, rotateX: -20 },
  animate: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export const shimmerKeyframes = {
  initial: { backgroundPosition: "200% 0" },
  animate: {
    backgroundPosition: "-200% 0",
    transition: { duration: 1.5, repeat: Infinity, ease: "linear" },
  },
};