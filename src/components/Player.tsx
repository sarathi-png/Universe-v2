import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer, type SubtitleTrack } from "../hooks/usePlayer";
import { spring, smooth } from "../styles/animationPresets";

let embedNavBlocker: ((e: Event) => void) | null = null;
let embedBlockerCount = 0;
function enableEmbedBlocker() {
  embedBlockerCount++;
  if (embedBlockerCount > 1 || embedNavBlocker) return;
  embedNavBlocker = (e: Event) => {
    e.preventDefault();
    const msg = (e as any).target?.outerHTML || "";
    if (msg.includes("window.open") || msg.includes("location") || msg.includes("href")) return;
    if (e.type === "beforeunload") {
      window.location.hash = "blocked-redirect";
    }
  };
  window.addEventListener("beforeunload", embedNavBlocker);
}
function disableEmbedBlocker() {
  if (embedBlockerCount > 0) embedBlockerCount--;
  if (embedBlockerCount > 0 || !embedNavBlocker) return;
  window.removeEventListener("beforeunload", embedNavBlocker);
  embedNavBlocker = null;
}

interface PlayerProps {
  src: string;
  poster?: string;
  title?: string;
  subtitles?: SubtitleTrack[];
  isEmbed?: boolean;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  onEmbedLoad?: () => void;
  onError?: (message?: string) => void;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Player({
  src, poster, title, subtitles: externalSubtitles, isEmbed,
  onProgress, onEmbedLoad, onError, onPrevEpisode, onNextEpisode, hasPrev, hasNext,
}: PlayerProps) {
  const {
    videoRef, containerRef, playerState, loadSource,
    togglePlay, seek, setVolume, toggleMute,
    setAudioTrack, setSubtitleTrack, setPlaybackSpeed,
    skipIntro, toggleFullscreen,
  } = usePlayer();

  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seekDragging = useRef(false);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const prevProgress = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onProgressRef = useRef(onProgress);
  const seekDragMoved = useRef(false);
  const lastSeekX = useRef(0);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (playerState.playing) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [playerState.playing]);

  const hideControls = useCallback(() => {
    if (playerState.playing) {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [playerState.playing]);

  useEffect(() => {
    const cleanup = loadSource(src, externalSubtitles);
    if (isEmbed) {
      enableEmbedBlocker();
    } else {
      disableEmbedBlocker();
    }
    return () => {
      cleanup?.();
      disableEmbedBlocker();
    };
  }, [src, loadSource, isEmbed, externalSubtitles]);

  useEffect(() => {
    if (onProgressRef.current && playerState.currentTime > 0) {
      const p = Math.floor(playerState.progress);
      if (p !== prevProgress.current && p % 5 < 1) {
        prevProgress.current = p;
        onProgressRef.current(playerState.progress, playerState.currentTime, playerState.duration);
      }
    }
  }, [playerState.progress, playerState.currentTime, playerState.duration]);

  useEffect(() => {
    if (!playerState.playing && !seekDragging.current) {
      setControlsVisible(true);
      clearTimeout(hideTimer.current);
    }
  }, [playerState.playing]);

  const handleSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = seekBarRef.current;
    if (!bar || !videoRef.current) return;
    if (seekDragMoved.current) {
      seekDragMoved.current = false;
      return;
    }
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * playerState.duration);
  }, [playerState.duration, seek]);

  const handleSeekDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekDragging.current) return;
    const bar = seekBarRef.current;
    if (!bar || !videoRef.current) return;
    if (Math.abs(e.clientX - lastSeekX.current) > 2) {
      seekDragMoved.current = true;
    }
    lastSeekX.current = e.clientX;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * playerState.duration);
  }, [playerState.duration, seek]);

  const handleSeekTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const bar = seekBarRef.current;
    if (!bar || !videoRef.current) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    seek(ratio * playerState.duration);
  }, [playerState.duration, seek]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const video = videoRef.current;
    if (!video) return;
    if (!containerRef.current?.contains(document.activeElement)) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "f":
        e.preventDefault();
        toggleFullscreen();
        break;
      case "m":
        e.preventDefault();
        toggleMute();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seek(video.currentTime - 10);
        break;
      case "ArrowRight":
        e.preventDefault();
        seek(video.currentTime + 10);
        break;
      case "ArrowUp":
        e.preventDefault();
        setVolume(video.volume + 0.1);
        break;
      case "ArrowDown":
        e.preventDefault();
        setVolume(video.volume - 0.1);
        break;
      case "0": case "1": case "2": case "3": case "4":
      case "5": case "6": case "7": case "8": case "9":
        e.preventDefault();
        if (video.duration) {
          seek(video.duration * (parseInt(e.key) / 10));
        }
        break;
    }
  }, [togglePlay, toggleFullscreen, toggleMute, seek, setVolume, videoRef]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const onMouseUp = () => {
      seekDragging.current = false;
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, []);

  const isBuffering = !isEmbed && playerState.buffering;
  const isPaused = !isEmbed && !playerState.playing && !playerState.buffering;

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Video player"
      className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-player ring-1 ring-white/10 shadow-[0_0_50px_rgba(139,92,246,0.12)]"
      onMouseMove={showControls}
      onMouseLeave={hideControls}
    >
      {/* Ambient glow behind video */}
      <div className="pointer-events-none absolute -inset-20 z-0 opacity-30 transition-opacity duration-700">
        <div className="h-full w-full rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      {isEmbed ? (
        <iframe
          ref={iframeRef}
          src={src}
          className="relative z-[1] h-full w-full"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          onLoad={() => {
            try {
              const hash = iframeRef.current?.contentWindow?.location?.hash;
              if (hash && hash.includes("blocked")) {
                onError?.();
              } else {
                onEmbedLoad?.();
              }
            } catch {
              // Cross-origin — cannot access, which means the embed loaded successfully
              onEmbedLoad?.();
            }
          }}
        />
      ) : (
      <video
        ref={videoRef}
        className="relative z-[1] h-full w-full cursor-pointer"
        poster={poster}
        playsInline
        onClick={togglePlay}
        onError={(e) => onError?.((e.target as HTMLVideoElement)?.error?.message || "Playback error")}
      />
      )}

      {/* Buffering overlay */}
      <AnimatePresence>
        {isBuffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <div className="relative flex h-16 w-16 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-violet-500/30"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-violet-400 ml-1 relative z-10">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center"
            onClick={togglePlay}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              transition={spring}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-600/80 backdrop-blur-sm hover:scale-110"
            >
              <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-1.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {!isEmbed && controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={smooth}
            className="absolute inset-x-0 bottom-0 z-20"
          >
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

            {title && (
              <div className="absolute bottom-16 left-4 right-4">
                <p className="text-sm font-semibold text-white drop-shadow-lg truncate">{title}</p>
              </div>
            )}

            <div className="relative px-3 pb-2 pt-8">
              {/* Seek Bar */}
              <div
                ref={seekBarRef}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(playerState.progress)}
                aria-valuetext={`${formatTime(playerState.currentTime)} of ${formatTime(playerState.duration)}`}
                tabIndex={0}
                className="group/seek mb-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                onMouseDown={(e) => { seekDragging.current = true; seekDragMoved.current = false; lastSeekX.current = e.clientX; }}
                onMouseUp={() => { seekDragging.current = false; }}
                onMouseLeave={() => { seekDragging.current = false; }}
                onMouseMove={handleSeekDrag}
                onClick={handleSeekClick}
                onTouchStart={handleSeekTouch}
                onTouchMove={handleSeekTouch}
                onTouchEnd={() => { seekDragging.current = false; }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    const step = e.key === "ArrowRight" ? 5 : -5;
                    const next = Math.max(0, Math.min(100, playerState.progress + step));
                    if (playerState.duration) seek((next / 100) * playerState.duration);
                  }
                }}
              >
                <div className="relative h-1.5 rounded-full bg-white/20 transition-all duration-200 group-hover/seek:h-2">
                  <motion.div
                    className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    style={{ width: `${playerState.progress}%` }}
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                  <div
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-violet-400 shadow-lg opacity-0 transition-opacity duration-200 group-hover/seek:opacity-100 shadow-violet-400/50"
                    style={{ left: `${playerState.progress}%`, marginLeft: "-7px" }}
                  />
                </div>
              </div>

              {/* Controls Row */}
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {onPrevEpisode && (
                    <button
                      onClick={onPrevEpisode}
                      disabled={!hasPrev}
                      className="rounded-lg p-1 sm:p-1.5 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Previous episode"
                    >
                      <svg aria-hidden="true" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                      </svg>
                    </button>
                  )}

                  <motion.button
                    onClick={togglePlay}
                    whileTap={{ scale: 0.9 }}
                    className="rounded-lg p-1 sm:p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    title={playerState.playing ? "Pause (Space)" : "Play (Space)"}
                  >
                    {playerState.playing ? (
                      <svg aria-hidden="true" width="18" height="18" className="sm:w-[20px] sm:h-[20px]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" width="18" height="18" className="sm:w-[20px] sm:h-[20px]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </motion.button>

                  {onNextEpisode && (
                    <button
                      onClick={onNextEpisode}
                      disabled={!hasNext}
                      className="rounded-lg p-1 sm:p-1.5 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Next episode"
                    >
                      <svg aria-hidden="true" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 18 14.5 12 6 6zM16 6v12h2V6z" />
                      </svg>
                    </button>
                  )}

                  <div className="flex items-center gap-0.5 sm:gap-1 ml-0.5 sm:ml-1 group/vol">
                    <button
                      onClick={toggleMute}
                      className="rounded-lg p-1 sm:p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                      title={playerState.muted ? "Unmute (M)" : "Mute (M)"}
                    >
                      {playerState.muted || playerState.volume === 0 ? (
                        <svg aria-hidden="true" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5 6 9H2v6h4l5 4z" />
                          <path d="m23 9-6 6M17 9l6 6" />
                        </svg>
                      ) : playerState.volume < 0.5 ? (
                        <svg aria-hidden="true" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5 6 9H2v6h4l5 4z" />
                          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                        </svg>
                      ) : (
                        <svg aria-hidden="true" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5 6 9H2v6h4l5 4z" />
                          <path d="M19 5a10 10 0 0 1 0 14M15.5 8.5a5 5 0 0 1 0 7" />
                        </svg>
                      )}
                    </button>
                    <div className="hidden group-hover/vol:flex items-center max-sm:hidden">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={playerState.muted ? 0 : playerState.volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-16 sm:w-20 h-1 accent-violet-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-white/70 min-w-0 shrink-0">
                  <span>{formatTime(playerState.currentTime)}</span>
                  <span className="text-white/40">/</span>
                  <span>{formatTime(playerState.duration)}</span>
                </div>

                <div className="flex-1 min-w-0" />

                <div className="flex items-center gap-0 sm:gap-0.5">
                  {playerState.audioTracks.length > 1 && (
                    <div className="sm:block">
                      <DropdownMenu
                        label="AUDIO"
                        icon={
                          <svg aria-hidden="true" width="14" height="14" className="sm:w-[16px] sm:h-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                        }
                        items={playerState.audioTracks.map((t, i) => ({
                          label: t.name,
                          active: i === playerState.activeAudioTrack,
                          onClick: () => setAudioTrack(i),
                        }))}
                      />
                    </div>
                  )}

                  {playerState.subtitleTracks.length > 0 && (
                    <div className="sm:block">
                      <DropdownMenu
                        label="CC"
                        icon={
                          <svg aria-hidden="true" width="14" height="14" className="sm:w-[16px] sm:h-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="6" width="20" height="12" rx="2" />
                            <path d="M9 10.5a2 2 0 0 1 1.5-.5 2 2 0 0 1 1.5.5M9 13.5a2 2 0 0 0 1.5.5 2 2 0 0 0 1.5-.5M14 10.5a2 2 0 0 1 1.5-.5 2 2 0 0 1 1.5.5M14 13.5a2 2 0 0 0 1.5.5 2 2 0 0 0 1.5-.5" />
                          </svg>
                        }
                        items={[
                          { label: "Off", active: playerState.activeSubtitleTrack === -1, onClick: () => setSubtitleTrack(-1) },
                          ...playerState.subtitleTracks.map((t, i) => ({
                            label: t.label,
                            active: i === playerState.activeSubtitleTrack,
                            onClick: () => setSubtitleTrack(i),
                          })),
                        ]}
                      />
                    </div>
                  )}

                  <div>
                    <DropdownMenu
                      label="SPEED"
                      icon={
                        <svg aria-hidden="true" width="14" height="14" className="sm:w-[16px] sm:h-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                      }
                      items={[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => ({
                        label: `${speed}x`,
                        active: speed === playerState.playbackSpeed,
                        onClick: () => setPlaybackSpeed(speed),
                      }))}
                    />
                  </div>

                  <motion.button
                    onClick={() => skipIntro()}
                    whileTap={{ scale: 0.9 }}
                    className="rounded-lg p-1 sm:p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors hidden sm:block"
                    title="Skip intro"
                  >
                    <svg aria-hidden="true" width="14" height="14" className="sm:w-[16px] sm:h-[16px]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 18 14.5 12 6 6zM16 6v12h2V6z" />
                    </svg>
                  </motion.button>

                  <motion.button
                    onClick={toggleFullscreen}
                    whileTap={{ scale: 0.9 }}
                    className="rounded-lg p-1 sm:p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    title={playerState.isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                  >
                    {playerState.isFullscreen ? (
                      <svg aria-hidden="true" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                      </svg>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownMenu({
  label, icon, items,
}: {
  label: string;
  icon: React.ReactNode;
  items: { label: string; active: boolean; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
        className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors text-[10px] font-semibold tracking-wider"
        title={label}
      >
        {icon}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 min-w-[120px] overflow-hidden rounded-lg bg-zinc-900/95 backdrop-blur-lg border border-white/10 shadow-xl"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase border-b border-white/5">
            {label}
          </div>
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={() => { item.onClick(); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                item.active
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              {item.active && (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              <span className={item.active ? "" : "ml-5"}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
