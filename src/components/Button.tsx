import { forwardRef } from "react";
import { cn } from "../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  as?: "button" | "a";
  href?: string;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-violet-500",
  secondary:
    "glass text-white font-medium hover:bg-white/10",
  ghost:
    "text-white/60 hover:text-white hover:bg-white/10",
  danger:
    "bg-red-600 text-white font-bold hover:bg-red-500",
  icon:
    "rounded-full text-white/60 hover:text-white hover:bg-white/10",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-7 py-3 text-sm rounded-xl gap-2",
};

const iconSizeStyles: Record<Size, string> = {
  sm: "h-8 w-8 rounded-full",
  md: "h-9 w-9 rounded-full",
  lg: "h-10 w-10 rounded-full",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    const isIcon = variant === "icon";
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-[transform,background] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          isIcon ? iconSizeStyles[size] : sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
