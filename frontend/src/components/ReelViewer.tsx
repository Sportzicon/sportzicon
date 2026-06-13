import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Flag, Eye, ChevronUp, ChevronDown, Volume2, VolumeX, Play, Pause, Bookmark } from "lucide-react";
import type { Reel } from "../types";

interface ReelViewerProps {
  reels: Reel[];
  initialIndex: number;
  onClose: () => void;
  onLike: (id: string) => void;
  onAddToFavorites: (id: string) => void;
  onFlag: (id: string) => void;
  onCommentClick: (id: string) => void;
  likedReels: Set<string>;
  favoriteReels: Set<string>;
}

export function ReelViewer({
  reels,
  initialIndex,
  onClose,
  onLike,
  onAddToFavorites,
  onFlag,
  onCommentClick,
  likedReels,
  favoriteReels
}: ReelViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  const currentReel = reels[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowUp") goToPrevious();
      if (e.key === "ArrowDown") goToNext();
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // Bind keyboard handlers once on mount; handlers read latest state via setState callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    isPlaying ? video.play() : video.pause();
  }, [isPlaying]);

  const goToNext = () => {
    setCurrentIndex((i) => (i + 1 < reels.length ? i + 1 : i));
    setProgress(0);
  };

  const goToPrevious = () => {
    setCurrentIndex((i) => (i - 1 >= 0 ? i - 1 : i));
    setProgress(0);
  };

  const handleDoubleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onLike(currentReel.id);
    }
    lastTapRef.current = now;
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleVideoEnded = () => {
    goToNext();
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
    >
      {/* Main Video Container */}
      <div className="relative h-full w-full max-h-screen max-w-lg">
        {/* Video Player */}
        <div
          className="relative h-full bg-black overflow-hidden"
          onMouseEnter={() => setIsHoveringControls(true)}
          onMouseLeave={() => setIsHoveringControls(false)}
        >
          <video
            ref={videoRef}
            src={currentReel.video_url}
            poster={currentReel.thumbnail_url}
            className="h-full w-full object-cover cursor-pointer"
            onClick={() => setIsPlaying(!isPlaying)}
            onDoubleClick={handleDoubleClick}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
            muted={isMuted}
          />

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-brand-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Top Controls */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent">
            <div className="text-white text-xs font-medium">
              {currentIndex + 1} / {reels.length}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/10 p-2 rounded transition"
            >
              ✕
            </button>
          </div>

          {/* Center Play/Pause Icon */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Play className="h-16 w-16 text-white/60" fill="white" />
            </div>
          )}

          {/* Bottom Controls */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent transition-opacity ${
              isHoveringControls ? "opacity-100" : "opacity-0 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="text-white hover:bg-white/10 p-2 rounded transition"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="white" />}
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-white hover:bg-white/10 p-2 rounded transition"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
              <span className="text-white text-xs font-medium">
                {Math.floor((videoRef.current?.currentTime || 0) / 60)}:
                {String(Math.floor((videoRef.current?.currentTime || 0) % 60)).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Actions */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 pr-4">
          {/* Like */}
          <button
            onClick={() => onLike(currentReel.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-full transition ${
              likedReels.has(currentReel.id) ? "bg-brand-500/20 text-brand-500" : "text-white/70 hover:text-white"
            }`}
          >
            <Heart
              className="h-5 w-5"
              fill={likedReels.has(currentReel.id) ? "currentColor" : "none"}
            />
            <span className="text-xs font-medium">{currentReel.like_count}</span>
          </button>

          {/* Comment */}
          <button
            onClick={() => onCommentClick(currentReel.id)}
            className="flex flex-col items-center gap-1 p-3 rounded-full text-white/70 hover:text-white transition"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-xs font-medium">{currentReel.comment_count}</span>
          </button>

          {/* Favorites */}
          <button
            onClick={() => onAddToFavorites(currentReel.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-full transition ${
              favoriteReels.has(currentReel.id) ? "bg-yellow-500/20 text-yellow-500" : "text-white/70 hover:text-white"
            }`}
          >
            <Bookmark
              className="h-5 w-5"
              fill={favoriteReels.has(currentReel.id) ? "currentColor" : "none"}
            />
            <span className="text-xs">Save</span>
          </button>

          {/* Flag */}
          <button
            onClick={() => onFlag(currentReel.id)}
            className="flex flex-col items-center gap-1 p-3 rounded-full text-white/70 hover:text-white transition"
          >
            <Flag className="h-5 w-5" />
            <span className="text-xs">Report</span>
          </button>

          {/* View Count */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-full text-white/70">
            <Eye className="h-5 w-5" />
            <span className="text-xs font-medium">{currentReel.view_count}</span>
          </div>
        </div>

        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={goToPrevious}
            className="absolute top-4 left-4 text-white/70 hover:text-white p-2 transition"
          >
            <ChevronUp className="h-6 w-6" />
          </button>
        )}
        {currentIndex < reels.length - 1 && (
          <button
            onClick={goToNext}
            className="absolute bottom-20 left-4 text-white/70 hover:text-white p-2 transition"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
        )}

        {/* Bottom Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="text-white space-y-2 max-w-xs">
            <div className="font-semibold text-sm">{currentReel.author_name}</div>
            {currentReel.caption && (
              <p className="text-sm text-white/90 line-clamp-2">{currentReel.caption}</p>
            )}
            {currentReel.sport && (
              <span className="inline-block text-xs bg-white/20 px-2 py-1 rounded">
                {currentReel.sport}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs text-center">
        <div>Space to play/pause · ↑↓ to navigate · ESC to exit</div>
      </div>
    </div>
  );
}
