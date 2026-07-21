import { useState, useCallback } from "react";
import { cn } from "../utils/cn";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
}

export default function LazyImage({
  src,
  className,
  fallbackText,
  alt,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const onLoad = useCallback(() => setLoaded(true), []);
  const onError = useCallback(() => setError(true), []);

  if (!src || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-zinc-600",
          className
        )}
      >
        <span className="px-2 text-center text-xs font-medium line-clamp-3">
          {fallbackText || alt || "No image"}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("group relative overflow-hidden", className)}>
      {!loaded && <div className="absolute inset-0 shimmer" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={onLoad}
        onError={onError}
        className={cn(
          "h-full w-full object-cover transition-all duration-[800ms] ease-out",
          loaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-[1.03] blur-[2px]"
        )}
        {...rest}
      />
    </div>
  );
}
