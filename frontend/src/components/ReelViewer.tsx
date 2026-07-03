import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, ChevronUp, ChevronDown, Volume2, VolumeX, Play, Pause, X, Share2 } from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";
import { CommentSection } from "./CommentSection";
import type { Reel } from "../types";

interface ReelViewerProps {
  reels: Reel[];
  initialIndex: number;
  onClose: () => void;
}

export function ReelViewer({
  reels,
  initialIndex,
  onClose,
}: ReelViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentReel = reels[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowUp") goToPrevious();
      if (e.key === "ArrowDown") goToNext();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setProgress(0);
    video.currentTime = 0;
    if (isPlaying) video.play().catch(() => setIsPlaying(false));
  }, [currentIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.play().catch(() => setIsPlaying(false));
    else video.pause();
  }, [isPlaying]);

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1 < reels.length ? i + 1 : i));
    setIsPlaying(true);
  }, [reels.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((i) => (i - 1 >= 0 ? i - 1 : i));
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);

  const handleCommentClick = useCallback(() => {
    setCommentOpen(true);
  }, []);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/reels`;
    const displayTitle = currentReel.title ?? currentReel.caption;
    const shareData = {
      title: displayTitle ?? "Check out this reel on Sportivox",
      text: currentReel.description
        ? `${currentReel.description} — ${currentReel.author?.full_name ?? ""} on Sportivox`
        : `${currentReel.author?.full_name ?? ""} posted a reel on Sportivox`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      }
    } catch {
      // user cancelled
    }
  }, [currentReel]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
    >
      <div className="relative h-full w-full max-w-lg mx-auto">
        {/* Video */}
        <video
          ref={videoRef}
          src={currentReel.video_url}
          poster={currentReel.thumbnail_url ?? undefined}
          className="h-full w-full object-contain cursor-pointer"
          muted={isMuted}
          loop
          playsInline
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current && videoRef.current.duration) {
              setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
            }
          }}
          onEnded={goToNext}
        />

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div className="h-full bg-brand-500 transition-none" style={{ width: `${progress}%` }} />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

        {/* Paused indicator */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Play className="h-20 w-20 text-white/60" fill="white" />
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-safe-area-inset-top p-4 bg-gradient-to-b from-black/40 to-transparent">
          <span className="text-white/60 text-sm font-medium">{currentIndex + 1} / {reels.length}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" fill="white" />}
            </button>
            <button
              onClick={onClose}
              className="text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Right action bar */}
        <div className="absolute right-3 bottom-28 flex flex-col gap-5 items-center">
          {/* Comment */}
          <button
            onClick={handleCommentClick}
            className="flex flex-col items-center gap-1 h-14 w-14 justify-center min-h-[56px]"
          >
            <MessageCircle className="h-7 w-7 text-white drop-shadow" />
            <span className="text-white text-xs font-medium drop-shadow">{currentReel.comment_count}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 h-14 w-14 justify-center min-h-[56px]"
            aria-label="Share reel"
          >
            <Share2 className="h-7 w-7 text-white drop-shadow" />
            <span className="text-white text-xs drop-shadow">Share</span>
          </button>
        </div>

        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 -translate-y-1/2 left-3 text-white/70 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition"
          >
            <ChevronUp className="h-7 w-7" />
          </button>
        )}
        {currentIndex < reels.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute top-2/3 left-3 text-white/70 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition"
          >
            <ChevronDown className="h-7 w-7" />
          </button>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-6 left-4 right-20">
          <p className="text-white font-semibold text-sm drop-shadow">
            {currentReel.author?.full_name ?? (currentReel as any).author_name ?? "Unknown"}
          </p>
          {(currentReel.title ?? currentReel.caption) && (
            <p className="text-white/90 text-sm mt-1 line-clamp-2 drop-shadow">
              {currentReel.title ?? currentReel.caption}
            </p>
          )}
          {currentReel.sport && (
            <span className="inline-block mt-1.5 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
              {currentReel.sport}
            </span>
          )}
        </div>

        {/* Keyboard hint — desktop only */}
        <div className="hidden lg:block absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs text-center whitespace-nowrap">
          Space play/pause · ↑↓ navigate · ESC close
        </div>

        {/* Share toast */}
        {shareToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full pointer-events-none z-10">
            Link copied!
          </div>
        )}
      </div>

      {/* Comments MobileDrawer */}
      <MobileDrawer
        isOpen={commentOpen}
        onClose={() => setCommentOpen(false)}
        title={`Comments on "${currentReel.title ?? currentReel.caption ?? "Reel"}"`}
      >
        <CommentSection
          parentType="reel"
          parentId={currentReel.id}
          commentCount={currentReel.comment_count}
          inDrawer
        />
      </MobileDrawer>
    </div>
  );
}
