import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Maximize2,
  ChevronUp,
  X,
} from "lucide-react";
import type { Song } from "../services/libraryServices";
import { useMemo } from "react";

interface PlayerBarProps {
  currentSong?: Song;
  isPlaying: boolean;
  currentTime: number;
  isShuffle: boolean;
  isRepeat: "none" | "all" | "one";
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onExpand: () => void;
  onClose: () => void;
}

export function PlayerBar({
  currentSong,
  isPlaying,
  currentTime,
  isShuffle,
  isRepeat,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onExpand,
  onClose,
}: PlayerBarProps) {
  const coverUrl = useMemo(() => {
    if (currentSong?.imageBlob) {
      return URL.createObjectURL(currentSong.imageBlob);
    }
    return null;
  }, [currentSong]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const duration = currentSong?.duration || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="relative h-auto min-h-24 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 flex items-center px-4 md:px-12 w-full z-40 cursor-pointer md:cursor-default py-4 md:py-0 overflow-hidden"
      onClick={(e) => {
        if (
          window.innerWidth < 768 &&
          !(e.target as HTMLElement).closest("button") &&
          !(e.target as HTMLElement).closest("input")
        ) {
          onExpand();
        }
      }}
    >
      {/* Mobile Progress Bar at Top Edge */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 md:hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 relative shadow-[0_0_10px_rgba(168,85,247,0.5)]"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={!currentSong}
        />
      </div>

      {/* Song Info */}
      <div
        className="flex items-center gap-3 flex-1 md:flex-none md:w-[30%] min-w-0 group"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
      >
        <div className="relative shrink-0">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-slate-800 overflow-hidden relative">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Art"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/10">
                <Music className="text-white/20" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
            <ChevronUp className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-white text-sm md:text-base font-medium truncate max-w-[150px] md:max-w-[200px]">
            {currentSong?.title || "No Song Selected"}
          </h4>
          <p className="text-white/40 text-xs md:text-sm truncate max-w-[150px] md:max-w-[200px]">
            {currentSong?.artist || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Desktop Controls (Hidden on mobile) */}
      <div
        className="hidden md:flex flex-1 flex flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-6">
          <button
            onClick={onToggleShuffle}
            className={`transition-colors ${isShuffle ? "text-purple-400" : "text-white/40 hover:text-white"
              }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={onPrevious}
            className="text-white/70 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10 disabled:opacity-50"
            disabled={!currentSong}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
          <button
            onClick={onNext}
            className="text-white/70 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button
            onClick={onToggleRepeat}
            className={`transition-colors relative ${isRepeat !== "none" ? "text-purple-400" : "text-white/40 hover:text-white"
              }`}
          >
            {isRepeat === "one" ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="w-full max-w-md flex items-center gap-3 text-xs font-medium text-white/30">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full bg-white rounded-full group-hover:bg-purple-400 transition-colors"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              disabled={!currentSong}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Extras: Play (Mobile), Expand & Close */}
      <div
        className="flex justify-end gap-1 md:gap-3 items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onTogglePlay}
          className="md:hidden p-3 text-white disabled:opacity-50"
          disabled={!currentSong}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current" />
          )}
        </button>
        <button
          onClick={onExpand}
          className="text-white/40 hover:text-white p-2 md:p-2 rounded-full transition-colors"
          title="Expand"
        >
          <Maximize2 className="w-5 h-5 md:w-5 md:h-5" />
        </button>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-red-400 p-2 md:p-2 rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5 md:w-5 md:h-5" />
        </button>
      </div>
    </div>
  );
}
