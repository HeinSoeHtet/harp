import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import type { Song } from "../services/libraryServices";

interface EditSongDialogProps {
    song: Song | null;
    isOpen: boolean;
    isSaving: boolean;
    onClose: () => void;
    onSave: (id: string, newTitle: string, newArtist: string) => void;
}

export function EditSongDialog({
    song,
    isOpen,
    isSaving,
    onClose,
    onSave,
}: EditSongDialogProps) {
    const [title, setTitle] = useState(song?.title || "");
    const [artist, setArtist] = useState(song?.artist || "");

    if (!isOpen || !song) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !artist.trim()) return;
        onSave(song.id, title, artist);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    disabled={isSaving}
                    className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold text-white mb-6">Edit Song</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-white/40 mb-1 ml-1 uppercase tracking-wider">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                            placeholder="Song Title"
                            disabled={isSaving}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white/40 mb-1 ml-1 uppercase tracking-wider">
                            Artist
                        </label>
                        <input
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                            placeholder="Artist Name"
                            disabled={isSaving}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !title.trim() || !artist.trim()}
                            className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
