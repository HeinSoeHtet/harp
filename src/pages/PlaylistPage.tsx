import { Music, Play } from "lucide-react";
import { LibraryServices, type Song } from "../services/libraryServices";
import { useEffect, useMemo, useRef, useState } from "react";
import { SongContextMenu } from "../components/SongContextMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PlaylistContextMenu } from "../components/PlaylistContextMenu";

interface PlaylistPageProps {
  accessToken: string | null;
  songs: Song[];
  playlists: any[];
  currentSongId?: string;
  activePlaylistId: string;
  onSelectSong: (index: number, queue?: Song[], queueId?: string) => void;
  isPlaying: boolean;
  onRequestDelete: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  onRefresh: () => Promise<void>;
}

export function PlaylistPage({
  accessToken,
  songs,
  playlists,
  currentSongId,
  activePlaylistId,
  onSelectSong,
  isPlaying,
  onRequestDelete,
  onEditSong,
  onAddToPlaylist,
  onRefresh,
}: PlaylistPageProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; song: Song } | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(activePlaylistId || "latest");
  const [playlistToDelete, setPlaylistToDelete] = useState<any | null>(null);
  const [isDeletingPlaylist, setIsDeletingPlaylist] = useState(false);
  const [playlistMenu, setPlaylistMenu] = useState<{ x: number; y: number; playlist: any } | null>(null);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (activePlaylistId) {
      setSelectedPlaylistId(activePlaylistId);
    }
  }, [activePlaylistId]);

  const filteredSongs = useMemo(() => {
    if (selectedPlaylistId === "latest") {
      return [...songs].sort((a, b) => b.addedAt - a.addedAt);
    }
    const targetPlaylist = playlists.find(p => p.id === selectedPlaylistId);
    if (!targetPlaylist) return [];

    // Map song IDs to actual Song objects from the library, in reverse order
    return [...targetPlaylist.songIds]
      .reverse()
      .map((id: string) => songs.find(s => s.id === id))
      .filter(Boolean) as Song[];
  }, [songs, playlists, selectedPlaylistId]);

  const handleCloseMenu = () => setContextMenu(null);
  const handleClosePlaylistMenu = () => setPlaylistMenu(null);

  const handleOpenPlaylistMenu = (e: React.MouseEvent, playlist: any) => {
    if (playlist.id === "favorites") return;
    e.preventDefault();
    e.stopPropagation();
    setPlaylistMenu({ x: e.clientX, y: e.clientY, playlist });
  };

  const handleDeletePlaylist = async (playlist: any) => {
    setPlaylistToDelete(playlist);
  };

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    setIsDeletingPlaylist(true);
    try {
      await LibraryServices.deletePlaylist(accessToken, playlistToDelete.id);
      await onRefresh();
      if (selectedPlaylistId === playlistToDelete.id) {
        setSelectedPlaylistId("latest");
      }
      setPlaylistToDelete(null);
    } catch (err) {
      console.error("Failed to delete playlist", err);
    } finally {
      setIsDeletingPlaylist(false);
    }
  };

  return (
    <div className="h-full max-w-7xl mx-auto w-full">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl h-full flex flex-col relative overflow-hidden">
        <div className="p-6 pb-2 flex-shrink-0 space-y-4">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-white" />
            <h2 className="text-white text-2xl font-bold">Playlist</h2>
            <span className="ml-auto text-white/40 text-sm font-normal">
              {filteredSongs.length} songs
            </span>
          </div>

          {/* Pill Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
            <button
              onClick={() => setSelectedPlaylistId("latest")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${selectedPlaylistId === "latest"
                ? "bg-white text-slate-900 shadow-lg"
                : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
            >
              Latest
            </button>

            {playlists.map(pl => (
              <PlaylistPill
                key={pl.id}
                playlist={pl}
                isSelected={selectedPlaylistId === pl.id}
                onSelect={() => setSelectedPlaylistId(pl.id)}
                onContextMenu={(e: any) => handleOpenPlaylistMenu(e, pl)}
                onLongPress={(e: any) => {
                  if (pl.id === "favorites") return;
                  const touch = e.touches[0];
                  setPlaylistMenu({ x: touch.clientX, y: touch.clientY, playlist: pl });
                }}
              />
            ))}

          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-hide">
          {filteredSongs.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <p>This playlist is empty.</p>
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {filteredSongs.map((song, index) => {
                // Use the index within the context of the currently filtered view
                const isActive = selectedPlaylistId === activePlaylistId && song.id === currentSongId;

                const originalIndex = songs.findIndex(s => s.id === song.id);
                return (
                  <PlaylistItem
                    key={`${song.id}-${index}`}
                    song={song}
                    index={originalIndex}
                    isActive={isActive}
                    isPlaying={isPlaying}
                    onSelect={() => onSelectSong(index, filteredSongs, selectedPlaylistId)}
                    formatDuration={formatDuration}
                    onContextMenu={(e: any, song: any) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, song });
                    }}
                    onLongPress={(e: any, song: any) => {
                      const touch = e.touches[0];
                      setContextMenu({ x: touch.clientX, y: touch.clientY, song });
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        <SongContextMenu
          position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
          onClose={handleCloseMenu}
          onEdit={() => contextMenu && onEditSong(contextMenu.song)}
          onDelete={() => contextMenu && onRequestDelete(contextMenu.song)}
          onAddToPlaylist={() => contextMenu && onAddToPlaylist(contextMenu.song)}
        />

        <PlaylistContextMenu
          position={playlistMenu ? { x: playlistMenu.x, y: playlistMenu.y } : null}
          onClose={handleClosePlaylistMenu}
          onDelete={() => handleDeletePlaylist(playlistMenu?.playlist)}
        />

        <ConfirmDialog
          isOpen={!!playlistToDelete}
          title="Delete Playlist?"
          message={`Are you sure you want to delete "${playlistToDelete?.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          isDanger={true}
          isLoading={isDeletingPlaylist}
          onConfirm={confirmDeletePlaylist}
          onCancel={() => setPlaylistToDelete(null)}
        />

        <style>{`
        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      </div>
    </div>
  );
}

function PlaylistPill({
  playlist,
  isSelected,
  onSelect,
  onContextMenu,
  onLongPress
}: any) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const startTouch = (e: React.TouchEvent) => {
    e.persist();
    longPressTimer.current = setTimeout(() => {
      onLongPress(e);
    }, 800);
  };

  const cancelTouch = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <button
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onTouchStart={startTouch}
      onTouchEnd={cancelTouch}
      onTouchMove={cancelTouch}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${isSelected
        ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20"
        : "bg-white/5 text-white/60 hover:bg-white/10"
        }`}
    >
      {playlist.name}
    </button>
  );
}

// Sub-component to handle individual Blob URL memory management
function PlaylistItem({
  song,
  isActive,
  isPlaying,
  onSelect,
  formatDuration,
  onContextMenu,
  onLongPress
}: any) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const startTouch = (e: React.TouchEvent) => {
    e.persist(); // Persist event for async
    longPressTimer.current = setTimeout(() => {
      onLongPress(e, song);
    }, 800); // 800ms long press
  };

  const cancelTouch = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const imageUrl = useMemo(() => {
    return song.imageBlob ? URL.createObjectURL(song.imageBlob) : null;
  }, [song.imageBlob]);

  return (
    <div
      onClick={onSelect}
      onContextMenu={(e) => onContextMenu(e, song)}
      onTouchStart={startTouch}
      onTouchEnd={cancelTouch}
      onTouchMove={cancelTouch}
      className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all transform-gpu [backface-visibility:hidden] [transform:translateZ(0)] border select-none ${isActive
        ? "bg-white/20 border-white/30"
        : "hover:bg-white/10 border-transparent"
        }`}
    >
      <div className="relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={song.title}
            className="w-12 h-12 rounded-lg object-cover bg-black/20"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
            <Music className="w-6 h-6 text-white/20" />
          </div>
        )}

        {isActive && isPlaying && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <div className="flex gap-0.5">
              <div
                className="w-1 bg-white rounded-full animate-pulse"
                style={{ height: "12px", animationDelay: "0ms" }}
              />
              <div
                className="w-1 bg-white rounded-full animate-pulse"
                style={{ height: "16px", animationDelay: "150ms" }}
              />
              <div
                className="w-1 bg-white rounded-full animate-pulse"
                style={{ height: "10px", animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={`truncate font-medium ${isActive ? "text-white" : "text-white/90"
            }`}
        >
          {song.title}
        </div>
        <div className="text-white/60 text-sm truncate">{song.artist}</div>
      </div>

      <div className="text-white/50 text-sm font-medium">
        {formatDuration(song.duration)}
      </div>

      {isActive && !isPlaying && <Play className="w-4 h-4 text-white/80" />}
    </div>
  );
}
