import { useState, useRef, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Music2,
  ChevronDown,
  ListMusic,
  Sparkles,
  Loader2,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Song } from "../services/libraryServices";
import { parseLRC, type LyricLine } from "../utils/lrcParser";
import { LyricServices } from "../services/lyricServices";
import { LibraryServices } from "../services/libraryServices";
import { useToast } from "../context/ToastContext";
import { useDrive } from "../context/DriveContext";

interface FullPlayerProps {
  currentSong: Song;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isShuffle: boolean;
  isRepeat: "none" | "all" | "one";
  volume: number;
  onVolumeChange: (vol: number) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onClose: () => void;
}

// Custom Hook
function useBlobUrl(blob: Blob | undefined | null) {
  const url = useMemo(() => {
    if (!blob) return undefined;
    try {
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("Failed to create object URL for blob", e);
      return undefined;
    }
  }, [blob]);

  useEffect(() => {
    // Cleanup function to revoke the URL when it changes or unmounts
    return () => {
      if (url) {
        // Delay to prevent ERR_FILE_NOT_FOUND during re-renders/prop updates
        setTimeout(() => URL.revokeObjectURL(url), 200);
      }
    };
  }, [url]);

  return url;
}

export function FullPlayer({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  isShuffle,
  isRepeat,
  volume,
  onVolumeChange,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onClose,
}: FullPlayerProps) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);

  const activeLyricRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  const toast = useToast();
  const { driveToken } = useDrive();

  // Close volume when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setIsVolumeOpen(false);
      }
    };

    if (isVolumeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVolumeOpen]);


  // Memoize the blob to prevent unnecessary URL creation/revocation if the blob reference changes but content is same
  const stableImageBlob = useMemo(() => {
    return currentSong.imageBlob;
  }, [currentSong.imageBlob]);

  // Use custom hook for blob URL management
  const coverUrl = useBlobUrl(stableImageBlob);

  // Reset error when URL changes
  useEffect(() => {
    setHasImageError(false);
  }, [coverUrl]);

  // Also reset error when switching views
  useEffect(() => {
    if (!showLyrics) {
      setHasImageError(false);
    }
  }, [showLyrics]);

  // Load Lyrics Logic
  useEffect(() => {
    const loadLyrics = async () => {
      if (currentSong.lyricBlob) {
        try {
          const text = await currentSong.lyricBlob.text();
          const parsed = parseLRC(text);
          setLyrics(parsed);
        } catch (e) {
          console.error("Failed to parse lyrics", e);
          setLyrics([]);
        }
      } else if (currentSong.lyrics) {
        setLyrics(currentSong.lyrics);
      } else {
        setLyrics([]);
      }
    };
    loadLyrics();
  }, [currentSong]);

  const handleSearchOnline = async () => {
    if (isSearching || isGenerating) return;
    setIsSearching(true);
    try {
      const results = await LyricServices.searchLyricsOnline(
        currentSong.title,
        currentSong.artist,
        duration || 0
      );

      if (results && results.length > 0) {
        setLyrics(results);
        if (driveToken) {
          await LibraryServices.saveGeneratedLyrics(driveToken, currentSong, results, true);
        }
        toast.success("Lyrics found!");
      } else {
        toast.error("No lyrics found online.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateAI = async (model: string) => {
    if (isGenerating || isSearching) return;
    setShowAIDialog(false);

    if (duration > 300) {
      toast.error("AI generation limited to 5-minute songs.");
      return;
    }

    setIsGenerating(true);
    try {
      let audioBlob = currentSong.audioBlob;

      if (!audioBlob && driveToken) {
        const hydrated = await LibraryServices.fetchSongMedia(driveToken, currentSong, true);
        audioBlob = hydrated.audioBlob;
      }

      if (!audioBlob) throw new Error("Audio not available.");

      const generated = await LyricServices.generateLyricsAI(audioBlob, model, duration);
      setLyrics(generated);

      if (driveToken) {
        await LibraryServices.saveGeneratedLyrics(driveToken, currentSong, generated, true);
      }
      toast.success("AI Generation complete!");
    } catch (e) {
      console.error(e);
      toast.error("AI Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Derive active lyric index
  const activeLyricIndex = useMemo(() => {
    if (!showLyrics || lyrics.length === 0) return -1;

    // 1. Find the index where the line's time range fits the current playback
    const index = lyrics.findIndex((line, i) => {
      return (
        currentTime >= line.time &&
        (i === lyrics.length - 1 || currentTime < lyrics[i + 1].time)
      );
    });

    if (index === -1) return -1;

    // 2. If same timestamps exist, always highlight the FIRST one in the group
    const targetTime = lyrics[index].time;
    return lyrics.findIndex(line => line.time === targetTime);
  }, [currentTime, showLyrics, lyrics]);

  // Auto-scroll
  useEffect(() => {
    if (showLyrics && activeLyricIndex !== -1 && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLyricIndex, showLyrics]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      onSeek(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Reset error when song changes
  useEffect(() => {
    setHasImageError(false);
  }, [currentSong.id]);

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pt-safe">
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80"
        >
          <ChevronDown className="w-8 h-8" />
        </button>
        <div className="flex items-center gap-2 text-white/60">
          <Music2 className="w-5 h-5" />
          <span className="text-sm font-medium tracking-wider">
            NOW PLAYING
          </span>
        </div>
        {/* Volume Control - Top Right */}
        <div className="relative z-50" ref={volumeRef}>
          <button
            onClick={() => setIsVolumeOpen(!isVolumeOpen)}
            className={`p-2 transition-colors ${isVolumeOpen ? "text-white" : "text-white/60 hover:text-white"
              }`}
          >
            {volume === 0 ? (
              <VolumeX className="w-6 h-6" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
          </button>

          {/* Vertical Slider Popover */}
          <div
            className={`absolute top-full right-0 mt-2 p-3 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl transition-all duration-300 flex flex-col items-center shadow-xl ${isVolumeOpen
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none"
              }`}
          >
            <div className="h-32 w-8 flex items-center justify-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white -rotate-90 hover:bg-white/30 transition-colors"
              />
            </div>
            <div className="text-xs font-medium text-white/50 mt-2">
              {Math.round(volume * 100)}%
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {!showLyrics ? (
          // Standard Player View
          <div className="w-full max-w-md flex flex-col items-center justify-center">
            <div className="relative group w-full aspect-square max-w-[220px] sm:max-w-[350px] mb-4 sm:mb-12">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity animate-pulse-slow transform-gpu" />
              {coverUrl && !hasImageError ? (
                <img
                  key={coverUrl}
                  src={coverUrl}
                  alt="Cover"
                  className="relative w-full h-full object-cover rounded-3xl shadow-2xl"
                  onError={() => setHasImageError(true)}
                />
              ) : (
                <div className="relative w-full h-full bg-white/10 rounded-3xl flex items-center justify-center border border-white/10">
                  <Music2 className="w-16 h-16 sm:w-24 sm:h-24 text-white/20" />
                </div>
              )}
            </div>
            <div className="text-center w-full mb-2 sm:mb-8">
              <h1 className="text-white text-xl sm:text-3xl font-bold mb-0.5 sm:mb-2 truncate">
                {currentSong.title}
              </h1>
              <p className="text-white/60 text-base sm:text-xl truncate">
                {currentSong.artist}
              </p>
            </div>
          </div>
        ) : (
          // Lyrics View
          <div
            className="w-full h-full absolute inset-0 pt-20 pb-48 px-6 overflow-y-auto scrollbar-hide text-center"
            style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)" }}
          >
            {lyrics.length > 0 ? (
              <div className="space-y-8 max-w-2xl mx-auto">
                <div className="h-[20vh]" />
                {lyrics.map((line, index) => {
                  const isActive = index === activeLyricIndex;
                  return (
                    <div
                      key={index}
                      ref={isActive ? activeLyricRef : null}
                      className={`transition-all duration-500 cursor-pointer ${isActive
                        ? "text-white text-2xl font-bold scale-105"
                        : "text-white/30 text-lg hover:text-white/50"
                        }`}
                      onClick={() => onSeek(line.time)}
                    >
                      {line.text}
                    </div>
                  );
                })}

                {/* REGENERATE SECTION */}
                <div className="flex flex-col items-center gap-4 pt-12 pb-4">
                  <p className="text-white/20 text-xs font-bold uppercase tracking-widest">Wrong lyrics?</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSearchOnline();
                      }}
                      disabled={isSearching || isGenerating}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all text-xs uppercase tracking-widest font-medium border border-white/5 disabled:opacity-50"
                    >
                      {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      <span>{isSearching ? "Searching..." : "Search Online"}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAIDialog(true);
                      }}
                      disabled={isSearching || isGenerating}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all text-xs uppercase tracking-widest font-medium border border-white/5 disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      <span>{isGenerating ? "Transcribing..." : "Generate with AI"}</span>
                    </button>
                  </div>
                </div>

                <div className="h-[40vh]" />
              </div>
            ) : (
              // No Lyrics State
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <ListMusic className="w-16 h-16 mb-4 opacity-50" />
                <p className="mb-8 font-medium">No lyrics available</p>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button
                    onClick={handleSearchOnline}
                    disabled={isSearching || isGenerating}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-white font-bold transition-all disabled:opacity-50 group"
                  >
                    {isSearching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    )}
                    <span>{isSearching ? "Searching..." : "Search Online"}</span>
                  </button>


                  <p className="mt-4 text-xs text-white/20 max-w-[200px] leading-relaxed text-center mx-auto">
                    Search looks up synced lyrics from open databases. (Highly recommended)
                  </p>

                  <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-white/5"></div>
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">or</span>
                    <div className="h-px flex-1 bg-white/5"></div>
                  </div>

                  <button
                    onClick={() => setShowAIDialog(true)}
                    disabled={isSearching || isGenerating}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl text-white font-bold shadow-lg shadow-purple-900/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    )}
                    <span>{isGenerating ? "Transcribing..." : "Generate with AI"}</span>
                  </button>
                </div>

                <p className="mt-8 text-xs text-white/20 max-w-[200px] leading-relaxed text-center">
                  AI transcribes the audio directly. (Recommended for new songs)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls Container (Fixed Bottom) */}
      <div className="w-full bg-gradient-to-t from-black/40 via-black/20 to-transparent p-6 pb-8 z-10">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {/* Lyrics Toggle */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              className={`p-3 rounded-full transition-all ${showLyrics
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                }`}
            >
              <ListMusic className="w-6 h-6" />
            </button>
          </div>

          {/* Progress */}
          <div>
            <div
              ref={progressRef}
              className="h-2 bg-white/10 rounded-full cursor-pointer group"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-white rounded-full relative"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs font-medium text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={onToggleShuffle}
              className={`p-2 ${isShuffle ? "text-purple-400" : "text-white/40 hover:text-white"
                }`}
            >
              <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={onPrevious}
              className="p-2 text-white hover:text-purple-400 transition-colors"
              title="Previous"
            >
              <SkipBack className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
              ) : (
                <Play className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current ml-1" />
              )}
            </button>

            <button
              onClick={onNext}
              className="p-2 text-white hover:text-purple-400 transition-colors"
              title="Next"
            >
              <SkipForward className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>

            <button
              onClick={onToggleRepeat}
              className={`p-2 transition-colors ${isRepeat !== "none" ? "text-purple-400" : "text-white/40 hover:text-white"
                }`}
            >
              {isRepeat === "one" ? (
                <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {showAIDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" />

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                AI Generation
              </h3>
              <button onClick={() => setShowAIDialog(false)} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Choose an AI model to transcribe this song. Different models vary in speed and accuracy.
            </p>

            <div className="space-y-3">
              {[
                { id: "gpt-4o-transcribe", name: "GPT 4o Transcribe", desc: "Most accurate for songs", icon: "🎙️" },
                { id: "gemini", name: "Gemini 2.5 Flash", desc: "Best for complex audio", icon: "✨" }
              ].map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleGenerateAI(model.id)}
                  className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all group text-left"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{model.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm">{model.name}</div>
                    <div className="text-white/40 text-xs truncate">{model.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAIDialog(false)}
              className="w-full mt-6 py-3 text-white/40 hover:text-white text-sm font-medium transition-colors"
            >
              Wait, nevermind
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
