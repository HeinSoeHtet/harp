import { functions } from "../firebase"; // Ensure this points to your firebase config
import { httpsCallable } from "firebase/functions";
import { type LyricLine, parseLRC } from "../utils/lrcParser";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const ffmpeg = new FFmpeg();

const loadFFmpeg = async () => {
  // Use OFFLINE files from public/ffmpeg/
  const baseURL = "/ffmpeg";

  if (!ffmpeg.loaded) {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      // Worker disabled as per your setup
    });
    console.log("✅ FFmpeg loaded in Single-Threaded mode");
  }
};

const optimizeAudio = async (inputBlob: Blob): Promise<Blob> => {
  await loadFFmpeg();

  const inputName = "input.file";
  const outputName = "output.mp3";

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));

    await ffmpeg.exec([
      "-i", inputName,
      "-map", "0:a",
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "96k",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    return new Blob([data as any], { type: "audio/mp3" });
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (e) { /* ignore */ }
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};


const fetchFromLrcLib = async (
  title: string,
  artist: string,
  duration: number
): Promise<LyricLine[] | null> => {
  try {
    console.log(`🔎 Searching LRCLIB for: ${title} by ${artist} (${duration}s)`);

    //Use 'search' instead of 'get' to find ALL versions
    const url = new URL("https://lrclib.net/api/search");
    url.searchParams.append("q", `${artist} ${title}`);

    const response = await fetch(url.toString());

    if (!response.ok) {
      // If 404 or server error, we just bail out
      console.warn(`LRCLIB Search error: ${response.status}`);
      return null;
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      console.log("❌ LRCLIB: No results found.");
      return null;
    }

    // Implement "Fuzzy Duration Matching"
    // We look for a version that is within +/- 5 seconds of our file
    const TOLERANCE_SECONDS = 5;

    const bestMatch = results.find((track: any) => {
      if (!track.syncedLyrics) return false; // Ignore non-synced results

      const diff = Math.abs(track.duration - duration);
      return diff <= TOLERANCE_SECONDS;
    });

    if (bestMatch) {
      console.log(`✅ LRCLIB: Match found! (Diff: ${Math.abs(bestMatch.duration - duration).toFixed(1)}s)`);
      return parseLRC(bestMatch.syncedLyrics);
    }

    console.log("⚠️ LRCLIB: Song found, but no version matched the duration.");
    return null;

  } catch (error) {
    console.warn("⚠️ LRCLIB fetch failed, falling back to AI.", error);
    return null;
  }
};

export const LyricServices = {
  /**
   * Method 1: Search Online (LRCLIB)
   */
  async searchLyricsOnline(
    title: string,
    artist: string,
    duration: number
  ): Promise<LyricLine[] | null> {
    return await fetchFromLrcLib(title, artist, duration);
  },

  /**
   * Method 2: Generate with AI (Cloud Function)
   */
  async generateLyricsAI(
    audioBlob: Blob,
    model: string
  ): Promise<LyricLine[]> {
    try {
      console.log(`🚀 Optimizing audio for ${model}...`);
      const processedBlob = await optimizeAudio(audioBlob);
      const base64Audio = await blobToBase64(processedBlob);

      console.log(`📡 Sending to Cloud Function with model: ${model}...`);

      const transcribeFn = httpsCallable(functions, 'transcribeSong');

      const result = await transcribeFn({
        audioBase64: base64Audio,
        mimeType: "audio/mp3",
        model: model
      });

      const lyrics = result.data as LyricLine[];

      console.log(`✅ Received ${lyrics.length} lines.`);
      return lyrics;

    } catch (error) {
      console.error("❌ Transcription Failed:", error);
      throw error;
    }
  },
};