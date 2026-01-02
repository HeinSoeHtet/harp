// ... (Imports remain the same)
import {
  Music,
  User,
  Disc3,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { useState, useEffect } from "react";
import { LibraryServices, type Song } from "../services/libraryServices";
import { MetadataServices } from "../services/metadataServices";
import { SongContextMenu } from "../components/SongContextMenu";

// ... (Helper & Hook remain the same)
const generateId = () => crypto.randomUUID();


interface LibraryPageProps {
  accessToken: string | null;
  onSongAdded?: (song: Song) => void;
  onRequestDelete: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  onSelectSong: (index: number, queue?: Song[], queueId?: string) => void;
  currentSongId?: string;
  isPlaying?: boolean;
}

export function LibraryPage({
  accessToken,
  onSongAdded,
  onRequestDelete,
  onEditSong,
  onAddToPlaylist,
  onSelectSong,
  currentSongId,
  isPlaying: isGlobalPlaying
}: LibraryPageProps) {
  const [activeTab, setActiveTab] = useState<"artists" | "albums">("artists");
  const [selectedEntity, setSelectedEntity] = useState<{ type: "artist" | "album"; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; song: Song } | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false); // New state for restore UI

  useEffect(() => {
    loadLibrary();
  }, [accessToken]); // Re-run if token becomes available

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const localSongs = await LibraryServices.getLocalSongs();

      /* Auto-restore removed: Sync happens only on login or manual trigger */

      setSongs(localSongs.sort((a, b) => b.addedAt - a.addedAt));
    } catch (e) {
      console.error("Failed to load library", e);
    } finally {
      setIsLoading(false);
      setIsRestoring(false);
    }
  };

  const handleSongAdded = (newSong: Song) => {
    setSongs((prev) => [newSong, ...prev]);
    if (onSongAdded) onSongAdded(newSong);
  };

  const handleCloseMenu = () => setContextMenu(null);

  const uniqueArtists = Array.from(new Set(songs.map((s) => s.artist)));
  const uniqueAlbums = Array.from(new Set(songs.map((s) => s.album)));

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto px-4 py-8 relative">
      {/* Header and Buttons remain the same */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("artists")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${activeTab === "artists"
              ? "bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-lg"
              : "bg-white/5 text-white/60 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:text-white/80"
              }`}
          >
            <User className="w-5 h-5" />
            <span>Artists</span>
          </button>
          <button
            onClick={() => setActiveTab("albums")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${activeTab === "albums"
              ? "bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-lg"
              : "bg-white/5 text-white/60 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:text-white/80"
              }`}
          >
            <Disc3 className="w-5 h-5" />
            <span>Albums</span>
          </button>
        </div>
        <button
          onClick={() => setShowUploadDialog(true)}
          className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-md rounded-xl border border-white/30 hover:bg-white/30 hover:scale-105 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5 text-white" />
          <span className="text-white hidden sm:inline">Add Song</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 pb-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl h-full flex flex-col relative overflow-hidden">

          {selectedEntity ? (
            /* DETAIL VIEW */
            <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
              <div className="flex items-center gap-3 p-6 pb-4 flex-shrink-0">
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <div>
                  <h2 className="text-white text-2xl font-bold truncate max-w-[200px] sm:max-w-md">
                    {selectedEntity.name}
                  </h2>
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    {selectedEntity.type === "artist" ? <User className="w-3 h-3" /> : <Disc3 className="w-3 h-3" />}
                    <span className="capitalize">{selectedEntity.type}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 sm:px-6 pb-6 pt-2 scrollbar-hide">
                <div className="space-y-1">
                  {songs
                    .filter(s => selectedEntity.type === "artist" ? s.artist === selectedEntity.name : s.album === selectedEntity.name)
                    .map((song, index, filteredArr) => (
                      <div
                        key={song.id}
                        onClick={() => onSelectSong(index, filteredArr, `${selectedEntity.type}:${selectedEntity.name}`)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, song });
                        }}
                        className={`group flex items-center gap-4 p-3 rounded-xl transition-colors cursor-default select-none border ${song.id === currentSongId
                          ? "bg-white/20 border-white/30"
                          : "hover:bg-white/5 border-transparent hover:border-white/5 shadow-sm"
                          }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/20">
                          {song.id === currentSongId && isGlobalPlaying ? (
                            <div className="flex gap-0.5">
                              <div className="w-0.5 h-3 bg-purple-400 animate-pulse" />
                              <div className="w-0.5 h-4 bg-purple-400 animate-pulse delay-75" />
                              <div className="w-0.5 h-2 bg-purple-400 animate-pulse delay-150" />
                            </div>
                          ) : (
                            <Music className="w-5 h-5 text-white/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${song.id === currentSongId ? "text-purple-400" : "text-white"}`}>{song.title}</div>
                          <div className="text-white/40 text-sm truncate">{song.artist}</div>
                        </div>
                        <div className="text-white/30 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          {Math.floor(song.duration / 60)}:{Math.floor(song.duration % 60).toString().padStart(2, "0")}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          ) : (
            /* MAIN GRID VIEW */
            <>
              {/* Header Tab Info */}
              <div className="flex items-center gap-3 p-6 pb-4 flex-shrink-0">
                {activeTab === "artists" ? (
                  <>
                    <User className="w-6 h-6 text-white" />
                    <h2 className="text-white text-2xl">Artists</h2>
                    <span className="ml-auto text-white/50 text-sm">
                      {uniqueArtists.length} artists
                    </span>
                  </>
                ) : (
                  <>
                    <Disc3 className="w-6 h-6 text-white" />
                    <h2 className="text-white text-2xl">Albums</h2>
                    <span className="ml-auto text-white/50 text-sm">
                      {uniqueAlbums.length} albums
                    </span>
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-hide">
                {isLoading || isRestoring ? (
                  <div className="flex flex-col items-center justify-center h-60 text-white/50 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                    <p>
                      {isRestoring
                        ? "Restoring library from Drive..."
                        : "Loading..."}
                    </p>
                  </div>
                ) : songs.length === 0 ? (
                  <div className="text-center py-20 text-white/30">
                    <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Your library is empty. Start by adding a song!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {activeTab === "artists"
                      ? uniqueArtists.filter(Boolean).map((artist) => (
                        <ArtistCard
                          key={`artist-${artist}`}
                          name={artist}
                          songs={songs.filter((s) => s.artist === artist)}
                          onClick={() => setSelectedEntity({ type: "artist", name: artist })}
                        />
                      ))
                      : uniqueAlbums.filter(Boolean).map((album) => (
                        <AlbumCard
                          key={`album-${album}`}
                          title={album}
                          songs={songs.filter((s) => s.album === album)}
                          onClick={() => setSelectedEntity({ type: "album", name: album })}
                        />
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <SongContextMenu
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={handleCloseMenu}
        onEdit={() => contextMenu && onEditSong(contextMenu.song)}
        onDelete={() => contextMenu && onRequestDelete(contextMenu.song)}
        onAddToPlaylist={() => contextMenu && onAddToPlaylist(contextMenu.song)}
      />

      {showUploadDialog && (
        <UploadSongDialog
          onClose={() => setShowUploadDialog(false)}
          driveToken={accessToken}
          onSuccess={handleSongAdded}
        />
      )}
      <style>{`.scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// ... (ArtistCard, AlbumCard, UploadSongDialog remain as they were in previous turn)
// To keep file size manageable I am skipping re-printing them if they haven't changedlogic-wise
// BUT for the full file completeness in the code block, I will include them below.

function ArtistCard({ name, songs, onClick }: { name: string; songs: Song[]; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/5"
    >
      <div className="flex flex-col justify-center h-full">
        <h3 className="text-white truncate font-bold text-lg mb-1">{name}</h3>
        <p className="text-white/50 text-sm">{songs.length} songs</p>
      </div>
    </div>
  );
}

function AlbumCard({ title, songs, onClick }: { title: string; songs: Song[]; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/5"
    >
      <div className="flex flex-col justify-center h-full">
        <h3 className="text-white truncate font-bold text-lg mb-1">{title}</h3>
        <p className="text-white/50 text-sm truncate">{songs[0]?.artist}</p>
      </div>
    </div>
  );
}

function UploadSongDialog({
  onClose,
  driveToken,
  onSuccess,
}: {
  onClose: () => void;
  driveToken: string | null;
  onSuccess: (s: Song) => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    album: "",
    audioFile: null as File | null,
    thumbnail: null as Blob | null,
    duration: 0,
  });
  const [status, setStatus] = useState<
    "idle" | "saving_local" | "syncing" | "done" | "error"
  >("idle");

  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Set the file immediately
      setFormData((prev) => ({ ...prev, audioFile: file }));

      // 2. Extract Metadata
      try {
        const metadata = await MetadataServices.extractMetadata(file);

        // Intelligent defaults: Use extracted if available, else keep existing or empty
        const newTitle = metadata.title || file.name.replace(/\.[^/.]+$/, ""); // fallback to filename
        const newArtist = metadata.artist || "";
        const newAlbum = metadata.album || "";
        const newImage = metadata.picture || null;

        // 3. Auto-Fetch Thumbnail if missing (REMOVED)
        // Last.fm implementation removed. We only use embedded picture.

        setFormData((prev) => ({
          ...prev,
          title: newTitle,
          author: newArtist || prev.author,
          album: newAlbum || prev.album,
          thumbnail: newImage || prev.thumbnail,
          duration: metadata.duration || 0,
        }));

      } catch (err) {
        console.error("Metadata extraction failed", err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.audioFile || status !== "idle") return;

    try {
      setStatus("saving_local");

      const newSong: Song = {
        id: generateId(),
        title: formData.title,
        artist: formData.author.trim() || "Anonymous",
        album: formData.album.trim() || "Unknown",
        duration: formData.duration,
        addedAt: Date.now(),
        audioBlob: formData.audioFile,
        imageBlob: formData.thumbnail,
        lyricBlob: null,
      };

      await LibraryServices.saveSongLocal(newSong);
      onSuccess(newSong);

      if (driveToken) {
        setStatus("syncing");
        await LibraryServices.syncSongToDrive(driveToken, newSong, true);
      }

      setStatus("done");
      setTimeout(onClose, 1000);
    } catch (error) {
      console.error("Upload error", error);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/20 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Upload Song</h2>
        </div>

        {status === "done" ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-white text-lg font-bold">Upload Complete!</h3>
            <p className="text-white/50 text-sm mt-2">
              Saved locally & synced to Drive.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="flex justify-center">
              <label className="w-full bg-white/5 border border-white/10 rounded-lg p-6 cursor-pointer hover:bg-white/10 transition-colors text-center border-dashed">
                <Music className="w-8 h-8 text-white/50 mx-auto mb-3" />
                <span className="text-sm font-medium text-white/70 block truncate mb-1">
                  {formData.audioFile ? formData.audioFile.name : "Select MP3 File"}
                </span>
                <span className="text-xs text-white/30 block">
                  Audio Only (MP3, WAV)
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={handleFileChange}
                  required
                />
              </label>
            </div>

            <input
              placeholder="Title"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
            <input
              placeholder="Artist (Default: Anonymous)"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
              value={formData.author}
              onChange={(e) =>
                setFormData({ ...formData, author: e.target.value })
              }
            />
            <input
              placeholder="Album (Default: Unknown)"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
              value={formData.album}
              onChange={(e) =>
                setFormData({ ...formData, album: e.target.value })
              }
            />

            {status === "error" && (
              <p className="text-red-400 text-sm text-center">
                Something went wrong.
              </p>
            )}
            <button
              type="submit"
              disabled={status !== "idle"}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status !== "idle" && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {status === "idle"
                ? "Save to Library"
                : status === "syncing"
                  ? "Uploading..."
                  : "Processing"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
