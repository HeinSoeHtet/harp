import { RefreshCw, Music2, Upload, Download, Loader2, Plus, Sparkles, CheckCircle2, Video } from "lucide-react";
import { useState, useRef } from "react";
import { LibraryServices, type Song } from "../services/libraryServices";
import { MetadataServices } from "../services/metadataServices";
import { useToast } from "../context/ToastContext";
import { useDrive } from "../context/DriveContext";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export function ConverterPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [isFFmpegLoading, setIsFFmpegLoading] = useState(false);

    const ffmpegRef = useRef(new FFmpeg());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();
    const { driveToken } = useDrive();

    const loadFFmpeg = async () => {
        const ffmpeg = ffmpegRef.current;
        if (ffmpeg.loaded) return;

        setIsFFmpegLoading(true);
        try {
            const baseURL = "/ffmpeg"; // Use relative path matching LyricServices
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
            });
            console.log("✅ FFmpeg loaded in Single-Threaded mode");
        } catch (error) {
            console.error("FFmpeg Load Error:", error);
            toast.error("Failed to load converter engine.");
        } finally {
            setIsFFmpegLoading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.toLowerCase().endsWith(".mp3") && selectedFile.type === "audio/mpeg") {
                toast.error("File is already an MP3!");
                return;
            }
            setFile(selectedFile);
            setConvertedBlob(null);
            setIsDone(false);
            setProgress(0);

            // Extract metadata if possible (might fail for some video types but we try)
            try {
                const meta = await MetadataServices.extractMetadata(selectedFile);
                setMetadata(meta);
            } catch (e) {
                console.warn("Metadata extraction skipped for this file type");
            }
        }
    };

    const convertToMp3 = async () => {
        if (!file) return;

        await loadFFmpeg();
        const ffmpeg = ffmpegRef.current;
        if (!ffmpeg.loaded) return;

        setIsConverting(true);
        setProgress(0);

        try {
            ffmpeg.on("progress", ({ progress }) => {
                setProgress(Math.round(progress * 100));
            });

            const inputFileName = "input_" + file.name;
            const outputFileName = "output.mp3";

            await ffmpeg.writeFile(inputFileName, await fetchFile(file));

            // FFmpeg command to convert to MP3
            // -i input -vn (ignore video) -acodec libmp3lame -ab 128k output.mp3
            await ffmpeg.exec([
                "-i", inputFileName,
                "-vn",
                "-acodec", "libmp3lame",
                "-ab", "128k",
                "-ar", "44100",
                outputFileName
            ]);

            const data = await ffmpeg.readFile(outputFileName);
            const blob = new Blob([data as any], { type: "audio/mpeg" });

            setConvertedBlob(blob);
            setIsDone(true);
            toast.success("Conversion complete!");

            // Cleanup
            await ffmpeg.deleteFile(inputFileName);
            await ffmpeg.deleteFile(outputFileName);

        } catch (error) {
            console.error(error);
            toast.error("Conversion failed. Try a different file.");
        } finally {
            setIsConverting(false);
        }
    };

    const handleAddToLibrary = async () => {
        if (!convertedBlob || !file) return;
        setIsAddingToLibrary(true);

        try {
            const songId = crypto.randomUUID();
            const fileName = file.name.replace(/\.[^/.]+$/, "") + ".mp3";
            const audioFile = new File([convertedBlob], fileName, { type: "audio/mpeg" });

            const newSong: Song = {
                id: songId,
                title: metadata?.title || file.name.replace(/\.[^/.]+$/, ""),
                artist: metadata?.artist || "Anonymous",
                album: metadata?.album || "Unknown",
                duration: metadata?.duration || 0,
                addedAt: Date.now(),
                audioBlob: audioFile,
                imageBlob: metadata?.picture || null,
            };

            await LibraryServices.saveSongLocal(newSong);

            if (driveToken) {
                toast.success("Saved to local. Syncing to Drive...");
                await LibraryServices.syncSongToDrive(driveToken, newSong, true);
                toast.success("Synced to Google Drive!");
            } else {
                toast.success("Added to library locally.");
            }

            setIsDone(false);
            setFile(null);
            setConvertedBlob(null);
        } catch (error) {
            console.error(error);
            toast.error("Failed to add to library.");
        } finally {
            setIsAddingToLibrary(false);
        }
    };

    const handleDownload = () => {
        if (!convertedBlob || !file) return;
        const url = URL.createObjectURL(convertedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name.replace(/\.[^/.]+$/, "") + ".mp3";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const isVideo = file?.type.startsWith("video/");

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto px-4 py-8 relative">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                        <RefreshCw className={`w-7 h-7 text-purple-400 ${isConverting ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                        <h1 className="text-white text-3xl font-bold tracking-tight">Audio Converter</h1>
                        <p className="text-white/40 text-sm">Convert Video or Audio to MP3</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {/* Info Card */}
                <div className="bg-white/5 rounded-3xl p-8 border border-white/10 flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-white font-bold text-xl">Powered by FFmpeg</h3>
                    </div>
                    <p className="text-white/50 text-sm leading-relaxed">
                        Harp's converter uses professional-grade FFmpeg technology right in your browser. Extract audio from videos or convert between different audio formats instantly.
                    </p>
                    <div className="flex flex-col gap-3 mt-4">
                        <div className="flex items-center gap-3 text-xs text-white/40 bg-white/[0.03] p-3 rounded-xl border border-white/5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Supports MP4, MOV, WAV, OGG, & more</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40 bg-white/[0.03] p-3 rounded-xl border border-white/5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>High Quality 128kbps MP3 Output</span>
                        </div>
                    </div>
                </div>

                {/* Drop Zone / Status Zone */}
                <div className={`
                    bg-white/10 backdrop-blur-md rounded-3xl p-8 border-2 border-dashed transition-all duration-300
                    ${file ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/10 hover:border-white/20'}
                    flex flex-col items-center justify-center min-h-[350px] text-center
                `}>
                    {!file ? (
                        <>
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Upload className="w-10 h-10 text-white/20" />
                            </div>
                            <h3 className="text-white text-lg font-bold mb-2">Ready to convert?</h3>
                            <p className="text-white/40 text-sm mb-8 max-w-[200px]">
                                Drag and drop video or audio files here
                            </p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="audio/*,video/*"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-8 py-4 bg-white text-black rounded-2xl font-bold flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                            >
                                <Plus className="w-5 h-5" />
                                Select File
                            </button>
                        </>
                    ) : (
                        <div className="w-full flex flex-col items-center">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                {isVideo ? <Video className="w-8 h-8 text-blue-400" /> : <Music2 className="w-8 h-8 text-purple-400" />}
                            </div>
                            <h3 className="text-white font-bold truncate max-w-[200px] mb-1">{file.name}</h3>
                            <p className="text-white/40 text-xs mb-8 uppercase tracking-widest font-bold">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB • {isVideo ? "Video" : "Audio"}
                            </p>

                            {!isConverting && !isDone && (
                                <div className="flex flex-col gap-3 w-full max-w-[200px]">
                                    <button
                                        onClick={convertToMp3}
                                        disabled={isFFmpegLoading}
                                        className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-purple-500 transition-colors disabled:opacity-50"
                                    >
                                        {isFFmpegLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                        {isFFmpegLoading ? "Loading Engine..." : "Convert Now"}
                                    </button>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="w-full py-3 text-white/40 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

                            {isConverting && (
                                <div className="w-full max-w-[240px]">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Processing...</span>
                                        <span className="text-purple-400 font-bold">{progress}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="mt-4 text-[10px] text-white/20 uppercase font-bold tracking-[0.2em]">FFmpeg is extracting audio</p>
                                </div>
                            )}

                            {isDone && (
                                <div className="flex flex-col gap-4 w-full max-w-[240px] animate-in zoom-in duration-300">
                                    <div className="w-full p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 mb-4">
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                        <span className="text-green-400 font-bold text-sm">Convert Success!</span>
                                    </div>

                                    <button
                                        onClick={handleAddToLibrary}
                                        disabled={isAddingToLibrary}
                                        className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                    >
                                        {isAddingToLibrary ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Plus className="w-5 h-5" />
                                        )}
                                        Add to Library
                                    </button>

                                    <button
                                        onClick={handleDownload}
                                        className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download MP3
                                    </button>

                                    <button
                                        onClick={() => {
                                            setFile(null);
                                            setIsDone(false);
                                            setConvertedBlob(null);
                                        }}
                                        className="mt-2 text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                                    >
                                        Convert another file
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Conversions or Help Text */}
            <div className="mt-auto pt-12 border-t border-white/5 text-center">
                <p className="text-white/20 text-xs font-medium max-w-lg mx-auto leading-relaxed uppercase tracking-widest">
                    FFmpeg processing happens entirely in your browser. Video files may take longer to process depending on their size and resolution.
                </p>
            </div>
        </div>
    );
}
