import { Music, X, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { LibraryServices, type Song } from "../services/libraryServices";
import { MetadataServices } from "../services/metadataServices";
import { useToast } from "../context/ToastContext";

interface UploadSongDialogProps {
    onClose: () => void;
    driveToken: string | null;
    onSuccess: (s: Song) => void;
    initialFile?: File | null;
}

export function UploadSongDialog({
    onClose,
    driveToken,
    onSuccess,
    initialFile = null,
}: UploadSongDialogProps) {
    const toast = useToast();
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

    useEffect(() => {
        if (initialFile) {
            handleFileProcessing(initialFile);
        }
    }, [initialFile]);

    const handleFileProcessing = async (file: File) => {
        if (file.type !== "audio/mpeg" && !file.name.toLowerCase().endsWith(".mp3")) {
            toast.error("Only MP3 files are supported.");
            return;
        }
        // 1. Set the file immediately
        setFormData((prev) => ({ ...prev, audioFile: file }));

        // 2. Extract Metadata
        try {
            const metadata = await MetadataServices.extractMetadata(file);

            // Intelligent defaults: Use extracted if available, else keep existing or empty
            const newTitle = metadata.title || file.name.replace(/\.[^/.]+$/, "");
            const newArtist = metadata.artist || "";
            const newAlbum = metadata.album || "";
            const newImage = metadata.picture || null;

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
    };

    const handleFileChange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileProcessing(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.audioFile || status !== "idle") return;

        try {
            setStatus("saving_local");

            const newSong: Song = {
                id: crypto.randomUUID(),
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4">
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
                                    Audio Only (MP3)
                                </span>
                                <input
                                    type="file"
                                    accept=".mp3,audio/mpeg"
                                    hidden
                                    onChange={handleFileChange}
                                    required={!formData.audioFile}
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
