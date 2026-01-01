import { useState, useEffect } from "react";
import { X, Plus, ListMusic, Loader2, Check } from "lucide-react";
import { LibraryServices, type Song } from "../services/libraryServices";

interface AddToPlaylistDialogProps {
    song: Song | null;
    isOpen: boolean;
    onClose: () => void;
    accessToken: string | null;
    onPlaylistUpdated?: () => void;
}

export function AddToPlaylistDialog({ song, isOpen, onClose, accessToken, onPlaylistUpdated }: AddToPlaylistDialogProps) {
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [addingToId, setAddingToId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadPlaylists();
        }
    }, [isOpen]);

    const loadPlaylists = async () => {
        setIsLoading(true);
        try {
            const plData = await LibraryServices.getPlaylists();
            setPlaylists(Object.values(plData));
        } catch (e) {
            console.error("Failed to load playlists", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateAndAdd = async () => {
        if (!newPlaylistName.trim() || !song) return;
        setIsCreating(true);
        try {
            const newId = await LibraryServices.createPlaylist(accessToken, newPlaylistName.trim());
            await LibraryServices.addToPlaylist(accessToken, newId, song.id);
            setNewPlaylistName("");
            if (onPlaylistUpdated) onPlaylistUpdated();
            await loadPlaylists();
        } catch (e) {
            console.error("Failed to create playlist", e);
        } finally {
            setIsCreating(false);
        }
    };

    const handleTogglePlaylist = async (playlistId: string) => {
        if (!song) return;
        setAddingToId(playlistId);
        try {
            const pl = playlists.find(p => p.id === playlistId);
            const isAdded = pl?.songIds.includes(song.id);

            if (isAdded) {
                await LibraryServices.removeFromPlaylist(accessToken, playlistId, song.id);
                // Update local state to reflect removal
                setPlaylists(prev => prev.map(p =>
                    p.id === playlistId
                        ? { ...p, songIds: p.songIds.filter((id: string) => id !== song.id) }
                        : p
                ));
            } else {
                await LibraryServices.addToPlaylist(accessToken, playlistId, song.id);
                // Update local state to reflect addition
                setPlaylists(prev => prev.map(p =>
                    p.id === playlistId
                        ? { ...p, songIds: [...p.songIds, song.id] }
                        : p
                ));
            }
            if (onPlaylistUpdated) onPlaylistUpdated();
        } catch (e) {
            console.error("Failed to toggle playlist", e);
        } finally {
            setAddingToId(null);
        }
    };

    if (!isOpen || !song) return null;

    return (
        <div className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <ListMusic className="w-5 h-5 text-purple-400" />
                        Save to...
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Create New Section */}
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-white/30 uppercase tracking-wider px-1">Create New</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Playlist name..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
                            />
                            <button
                                onClick={handleCreateAndAdd}
                                disabled={!newPlaylistName.trim() || isCreating}
                                className="p-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* List Section */}
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-white/30 uppercase tracking-wider px-1">Your Playlists</p>
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                            </div>
                        ) : playlists.length === 0 ? (
                            <p className="text-sm text-white/30 text-center p-4 italic">No playlists yet.</p>
                        ) : (
                            playlists.map(pl => {
                                const isAdded = pl.songIds.includes(song.id);
                                return (
                                    <button
                                        key={pl.id}
                                        onClick={() => handleTogglePlaylist(pl.id)}
                                        disabled={addingToId !== null}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-left group ${isAdded ? "bg-purple-500/10 text-white" : "hover:bg-white/5 text-white/70 hover:text-white"
                                            }`}
                                    >
                                        <span className="text-sm font-medium">{pl.name}</span>
                                        {addingToId === pl.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                        ) : (
                                            <Check className={`w-4 h-4 text-purple-400 transition-opacity ${isAdded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                }`} />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Song Footer */}
                <div className="bg-white/5 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                        <ListMusic className="w-5 h-5 text-white/20" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{song.title}</p>
                        <p className="text-white/40 text-xs truncate">{song.artist}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
