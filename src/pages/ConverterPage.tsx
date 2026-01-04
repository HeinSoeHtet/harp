import { RefreshCw, Music2, Upload, Download, Loader2, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { useState, useRef } from "react";
import { LibraryServices, type Song } from "../services/libraryServices";
import { MetadataServices } from "../services/metadataServices";
import { useToast } from "../context/ToastContext";
import { useDrive } from "../context/DriveContext";
import { Mp3Encoder } from "lamejs";

export function ConverterPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);
    const [isDone, setIsDone] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();
    const { driveToken } = useDrive();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.toLowerCase().endsWith(".mp3")) {
                toast.error("File is already an MP3!");
                return;
            }
            setFile(selectedFile);
            setConvertedBlob(null);
            setIsDone(false);
            setProgress(0);

            // Extract metadata
            const meta = await MetadataServices.extractMetadata(selectedFile);
            setMetadata(meta);
        }
    };

    const convertToMp3 = async () => {
        if (!file) return;

        setIsConverting(true);
        setProgress(0);

        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const channels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const kbps = 128; // Standard bitrate
            const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps);

            const left = audioBuffer.getChannelData(0);
            const right = channels > 1 ? audioBuffer.getChannelData(1) : null;

            // Convert Float32 to Int16
            const sampleBlockSize = 1152;
            const mp3Data: any[] = [];

            const totalSamples = left.length;
            let processedSamples = 0;

            for (let i = 0; i < totalSamples; i += sampleBlockSize) {
                const leftChunk = new Int16Array(Math.min(sampleBlockSize, totalSamples - i));
                const rightChunk = channels > 1 ? new Int16Array(Math.min(sampleBlockSize, totalSamples - i)) : null;

                for (let j = 0; j < leftChunk.length; j++) {
                    leftChunk[j] = left[i + j] < 0 ? left[i + j] * 0x8000 : left[i + j] * 0x7FFF;
                    if (right && rightChunk) {
                        rightChunk[j] = right[i + j] < 0 ? right[i + j] * 0x8000 : right[i + j] * 0x7FFF;
                    }
                }

                const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk || undefined);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Int8Array(mp3buf));
                }

                processedSamples += leftChunk.length;
                setProgress(Math.round((processedSamples / totalSamples) * 100));

                // yield to UI thread
                if (i % (sampleBlockSize * 10) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            const flush = mp3encoder.flush();
            if (flush.length > 0) {
                mp3Data.push(new Int8Array(flush));
            }

            const blob = new Blob(mp3Data, { type: "audio/mpeg" });
            setConvertedBlob(blob);
            setIsDone(true);
            toast.success("Conversion complete!");
        } catch (error) {
            console.error(error);
            toast.error("Conversion failed. Check file format.");
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

    return (
        <div className="h-full flex flex-col max-w-4xl mx-auto px-4 py-8 relative">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                        <RefreshCw className={`w-7 h-7 text-purple-400 ${isConverting ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                        <h1 className="text-white text-3xl font-bold tracking-tight">Audio Converter</h1>
                        <p className="text-white/40 text-sm">Convert to MP3 directly in your browser</p>
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
                        <h3 className="text-white font-bold text-xl">Private & Secure</h3>
                    </div>
                    <p className="text-white/50 text-sm leading-relaxed">
                        Harp's converter works entirely on your device. We never upload your audio files to our servers. Your privacy is our priority.
                    </p>
                    <div className="flex flex-col gap-3 mt-4">
                        <div className="flex items-center gap-3 text-xs text-white/40 bg-white/[0.03] p-3 rounded-xl border border-white/5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Supports WAV, OGG, M4A & more</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40 bg-white/[0.03] p-3 rounded-xl border border-white/5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Encodes to 128kbps Standard MP3</span>
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
                                Drag and drop or click below to choose a file
                            </p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="audio/*"
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
                                <Music2 className="w-8 h-8 text-purple-400" />
                            </div>
                            <h3 className="text-white font-bold truncate max-w-[200px] mb-1">{file.name}</h3>
                            <p className="text-white/40 text-xs mb-8 uppercase tracking-widest font-bold">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>

                            {!isConverting && !isDone && (
                                <div className="flex flex-col gap-3 w-full max-w-[200px]">
                                    <button
                                        onClick={convertToMp3}
                                        className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-purple-500 transition-colors"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                        Convert Now
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
                                        <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Converting...</span>
                                        <span className="text-purple-400 font-bold">{progress}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="mt-4 text-[10px] text-white/20 uppercase font-bold tracking-[0.2em]">Encoding PCM to MP3</p>
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
                    Your hardware does the heavy lifting. Encoding speed depends on your CPU and the length of the audio.
                </p>
            </div>
        </div>
    );
}
