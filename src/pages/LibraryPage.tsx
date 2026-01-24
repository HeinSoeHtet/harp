import {
  Music,
  User,
  Disc3,
  Plus,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";
import { type Song } from "../services/libraryServices";
import { SongContextMenu } from "../components/SongContextMenu";
import { UploadSongDialog } from "../components/UploadSongDialog";

// ... (Helper & Hook remain the same)



interface LibraryPageProps {
  accessToken: string | null;
  songs: Song[];
  isLoading: boolean;
  onSongAdded?: (song: Song) => void;
  onRequestDelete: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  onRefresh: () => Promise<void>;
}

export function LibraryPage({
  accessToken,
  songs,
  isLoading,
  onSongAdded,
  onRequestDelete,
  onEditSong,
  onAddToPlaylist,
  onRefresh,
}: LibraryPageProps) {
  const [activeTab, setActiveTab] = useState<"artists" | "albums">("artists");
  const [selectedEntity, setSelectedEntity] = useState<{ type: "artist" | "album"; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; song: Song } | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const handleCloseMenu = () => setContextMenu(null);

  const uniqueArtists = Array.from(new Set(songs.map((s) => s.artist)));
  const uniqueAlbums = Array.from(new Set(songs.map((s) => s.album)));

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto relative">
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

      <div className="flex-1 min-h-0">
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
                    .map((song) => (
                      <div
                        key={song.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, song });
                        }}
                        className="group flex items-center gap-4 p-3 rounded-xl transition-colors cursor-default select-none border hover:bg-white/5 border-transparent hover:border-white/5 shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/20">
                          <Music className="w-5 h-5 text-white/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-white">{song.title}</div>
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
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-60 text-white/50 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                    <p>Loading...</p>
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
          onSuccess={(s) => {
            if (onSongAdded) onSongAdded(s);
            onRefresh().catch(console.error);
          }}
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


