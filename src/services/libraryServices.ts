import { set, values, get, del, clear } from "idb-keyval";
import { DriveApiServices } from "./driveApiServices";
import { parseLRC } from "../utils/lrcParser";

// --- Local Data Types (App State) ---
export interface Song {
  id: string; // UUID
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  addedAt: number;

  // Local Data (Blobs stored in IndexedDB)
  audioBlob?: Blob;
  imageBlob?: Blob | null;
  lyricBlob?: Blob | null; // Store raw SRT blob

  // Parsed Lyrics (for UI)
  lyrics?: { time: number; text: string }[];

  // Cloud References
  driveId?: string;
  driveImageId?: string;
  driveLyricId?: string;
}

// --- Remote Data Types (JSON Storage) ---
interface RemoteSongMetadata {
  id: string;
  driveId: string;
  driveImageId?: string;
  driveLyricId?: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  addedAt: number;
  mimeType?: string;
  lyrics?: { time: number; text: string }[];
}

interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
}

interface LibraryMeta {
  version: number;
  lastUpdated: number;
  appId: string;
}

export interface LibraryExport {
  meta: LibraryMeta;
  songs: Record<string, RemoteSongMetadata>;
  playlists: Record<string, Playlist>;
}

const FAVORITES_PLAYLIST_ID = "favorites";

const DEFAULT_LIBRARY: LibraryExport = {
  meta: {
    version: 1,
    lastUpdated: Date.now(),
    appId: "harp-music-v1",
  },
  songs: {},
  playlists: {},
};

// Helper: Convert JSON Lyrics to LRC String
function lyricsToLRC(lyrics: { time: number | string; text: string }[]): string {
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return "[00:00.00]";
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `[${minutes.toString().padStart(2, "0")}:${secs.padStart(5, "0")}]`;
  };

  return lyrics
    .map((line) => {
      const t = typeof line.time === "number" ? line.time : parseFloat(line.time as string) || 0;
      return `${formatTime(t)} ${line.text}`;
    })
    .join("\n");
}

export const LibraryServices = {
  // 1. SAVE LOCAL
  async saveSongLocal(song: Song) {
    await set(song.id, song);
    console.log(`Song ${song.title} saved locally to IDB`);
  },

  // 2. GET LOCAL SONGS
  async getLocalSongs(): Promise<Song[]> {
    const allItems = await values();
    return allItems.filter((item: any) =>
      item &&
      typeof item === "object" &&
      "id" in item &&
      "title" in item
      // "audioBlob" in item -> Removed to allow metadata-only songs
    ) as Song[];
  },

  // 3. RESTORE FROM DRIVE (Hash-Based Sync)
  async syncFromDrive(accessToken: string, triggerAuthError = true) {
    console.log("Checking sync status with Drive...");
    const folderId = await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError);

    // 1. Get Remote Metadata
    const remoteMeta = await DriveApiServices.getLibraryMetadata(accessToken, folderId, triggerAuthError);
    if (!remoteMeta) {
      console.log("No library.json found on Drive. Initializing...");
      await DriveApiServices.getRemoteLibraryIndex(accessToken, folderId, DEFAULT_LIBRARY, triggerAuthError);
      return;
    }

    // 2. Check Hash
    const localHash = await get("library_json_hash");
    if (localHash === remoteMeta.md5Checksum) {
      console.log("Library is up to date (Hash Match).");
      return;
    }

    console.log("Hash mismatch. Syncing library...");

    // 3. Fetch Full Remote Library
    const remoteLib = await DriveApiServices.getRemoteLibraryIndex<LibraryExport>(
      accessToken,
      folderId,
      DEFAULT_LIBRARY,
      triggerAuthError
    );

    // 4. Update Local Library Clone & Hash
    await set("library_json_content", JSON.stringify(remoteLib));
    await set("library_json_hash", remoteMeta.md5Checksum);

    // 5. Reconcile Songs (Delete removed, Download missing)
    const localSongs = await values();
    const localSongMap = new Map(localSongs.filter((s: any) => s.id).map((s: any) => [s.id, s]));

    // Filter remote songs to ensure only MP3s enter the system
    const remoteSongs = Object.values(remoteLib.songs).filter(s =>
      s.mimeType === "audio/mpeg" ||
      s.title.toLowerCase().endsWith(".mp3") ||
      (localSongMap.get(s.id)?.audioBlob?.type === "audio/mpeg")
    );
    const remoteIds = new Set(remoteSongs.map(s => s.id));

    // A. Detect Deleted Songs (Local but not Remote)
    for (const [id, song] of localSongMap) {
      if (!remoteIds.has(id)) {
        console.log(`Removing local song: ${song.title} (deleted on Drive)`);
        await del(id);
      }
    }

    // B. Detect Missing Songs (Remote but not Local)
    const missingSongs = remoteSongs.filter((s) => !localSongMap.has(s.id));

    console.log(`Sync complete. ${missingSongs.length} new songs found.`);

    for (const meta of missingSongs) {
      try {
        // LAZY SYNC: Do NOT download blobs here.
        // We only save metadata. Blobs are fetched on-demand (fetchSongMedia).

        const restoredSong: Song = {
          id: meta.id,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          duration: meta.duration,
          addedAt: meta.addedAt,
          audioBlob: undefined, // Will be fetched on play
          imageBlob: null,      // Will be fetched on play
          lyricBlob: null,      // Will be fetched on play
          lyrics: meta.lyrics,
          driveId: meta.driveId,
          driveImageId: meta.driveImageId,
          driveLyricId: meta.driveLyricId,
        };

        await set(restoredSong.id, restoredSong);
        console.log(`Restored metadata for ${restoredSong.title}`);
      } catch (e) {
        console.error(`Failed to restore song ${meta.title}`, e);
      }
    }
  },

  // 6. CLEAR LIBRARY (For Logout)
  async clearLocalLibrary() {
    await clear();
    console.log("Local library cleared.");
  },

  // 4. SAVE GENERATED LYRICS
  async saveGeneratedLyrics(
    accessToken: string,
    song: Song,
    lyrics: { time: number; text: string }[],
    triggerAuthError = true
  ) {
    try {
      // Robust conversion
      const lrcString = lyricsToLRC(lyrics);
      const lrcBlob = new Blob([lrcString], { type: "text/plain" });
      const lrcFile = new File([lrcBlob], `${song.title}.lrc`, {
        type: "text/plain",
      });

      // Update Local IDB
      const updatedSong: Song = {
        ...song,
        lyrics: lyrics, // Keep JSON for fast UI load
        lyricBlob: lrcBlob, // Keep Blob for export/sync
      };
      await set(song.id, updatedSong);


      // Upload to Drive
      const folderId = await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError);

      // Fetch LATEST from IDB to catch any previous regenerations during the same session
      const latestSong = await get(song.id) as Song | undefined;
      const currentLyricDriveId = latestSong?.driveLyricId || song.driveLyricId;

      // --- CLEANUP START ---
      // If a lyric file already exists, trash it before keeping the new one
      if (currentLyricDriveId) {
        console.log(`Deleting old lyric file: ${currentLyricDriveId}`);
        try {
          await DriveApiServices.deleteFile(accessToken, currentLyricDriveId, triggerAuthError);
        } catch (e) {
          console.warn("Failed to delete old lyric file, proceeding with new upload.", e);
        }
      }
      // --- CLEANUP END ---

      const lyricDriveId = await DriveApiServices.uploadAsset(
        accessToken,
        folderId,
        lrcFile,
        triggerAuthError
      );

      updatedSong.driveLyricId = lyricDriveId;
      await set(song.id, updatedSong);

      // Update Remote JSON Index
      const currentLibrary =
        await DriveApiServices.getRemoteLibraryIndex<LibraryExport>(
          accessToken,
          folderId,
          DEFAULT_LIBRARY,
          triggerAuthError
        );

      if (currentLibrary.songs[song.id]) {
        currentLibrary.songs[song.id].driveLyricId = lyricDriveId;
        // Don't save lyrics to JSON, only file reference
        // currentLibrary.songs[song.id].lyrics = lyrics;
        currentLibrary.meta.lastUpdated = Date.now();

        await DriveApiServices.updateRemoteLibraryIndex(
          accessToken,
          folderId,
          currentLibrary,
          triggerAuthError
        );

        // Update Local Sync State
        const newMeta = await DriveApiServices.getLibraryMetadata(accessToken, folderId, triggerAuthError);
        if (newMeta && newMeta.md5Checksum) {
          await set("library_json_hash", newMeta.md5Checksum);
        }
        await set("library_json_content", JSON.stringify(currentLibrary));
      }
      return updatedSong;
    } catch (error) {
      console.error("Failed to save generated lyrics:", error);
      throw error;
    }
  },

  // 5. SYNC TO DRIVE
  async syncSongToDrive(accessToken: string, song: Song, triggerAuthError = true) {
    if (!song.audioBlob) {
      console.error("Cannot sync: Missing audio blob");
      return;
    }

    try {
      console.log("Starting Drive Sync...");
      const folderId = await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError);

      const audioDriveId = await DriveApiServices.uploadAsset(
        accessToken,
        folderId,
        song.audioBlob as File,
        triggerAuthError
      );

      let imageDriveId: string | undefined = undefined;
      if (song.imageBlob) {
        imageDriveId = await DriveApiServices.uploadAsset(
          accessToken,
          folderId,
          song.imageBlob as File,
          triggerAuthError
        );
      }

      let lyricDriveId: string | undefined = undefined;
      if (song.lyricBlob) {
        lyricDriveId = await DriveApiServices.uploadAsset(
          accessToken,
          folderId,
          song.lyricBlob as File,
          triggerAuthError
        );
      }

      const updatedSong: Song = {
        ...song,
        driveId: audioDriveId,
        driveImageId: imageDriveId,
        driveLyricId: lyricDriveId,
      };
      await set(song.id, updatedSong);

      const currentLibrary =
        await DriveApiServices.getRemoteLibraryIndex<LibraryExport>(
          accessToken,
          folderId,
          DEFAULT_LIBRARY,
          triggerAuthError
        );

      const remoteSongEntry: RemoteSongMetadata = {
        id: updatedSong.id,
        driveId: audioDriveId,
        driveImageId: imageDriveId,
        driveLyricId: lyricDriveId,
        title: updatedSong.title,
        artist: updatedSong.artist,
        album: updatedSong.album,
        duration: updatedSong.duration,
        addedAt: updatedSong.addedAt,
        mimeType: (song.audioBlob as File).type || "audio/mpeg",
        // lyrics: updatedSong.lyrics, // Don't save lyrics to JSON
      };

      const newLibrary: LibraryExport = {
        ...currentLibrary,
        meta: { ...currentLibrary.meta, lastUpdated: Date.now() },
        songs: { ...currentLibrary.songs, [updatedSong.id]: remoteSongEntry },
      };

      await DriveApiServices.updateRemoteLibraryIndex(
        accessToken,
        folderId,
        newLibrary,
        triggerAuthError
      );

      // Update Local Sync State
      const newMeta = await DriveApiServices.getLibraryMetadata(accessToken, folderId, triggerAuthError);
      if (newMeta && newMeta.md5Checksum) {
        await set("library_json_hash", newMeta.md5Checksum);
      }
      await set("library_json_content", JSON.stringify(newLibrary));

      return updatedSong;
    } catch (error) {
      console.error("Drive Sync Failed:", error);
      throw error;
    }
  },

  // 7. HYDRATE SONG (On-Demand Media Fetch)
  async fetchSongMedia(accessToken: string, song: Song, triggerAuthError = true): Promise<Song> {
    if (song.audioBlob) return song; // Already hydrated
    if (!song.driveId) throw new Error("Cannot fetch media: Missing Drive ID");

    console.log(`Hydrating song ${song.title}...`);

    const audioBlob = await DriveApiServices.downloadFile(accessToken, song.driveId, triggerAuthError);

    let imageBlob = song.imageBlob;
    if (!imageBlob && song.driveImageId) {
      try {
        imageBlob = await DriveApiServices.downloadFile(accessToken, song.driveImageId, triggerAuthError);
      } catch (e) {
        console.warn("Failed to fetch image", e);
      }
    }

    let lyricBlob = song.lyricBlob;
    let parsedLyrics = song.lyrics;

    if (!lyricBlob && song.driveLyricId) {
      try {
        lyricBlob = await DriveApiServices.downloadFile(accessToken, song.driveLyricId, triggerAuthError);
        // Parse LRC content if we don't have lyrics yet
        if (lyricBlob && !parsedLyrics) {
          const text = await lyricBlob.text();
          parsedLyrics = parseLRC(text);
        }
      } catch (e) {
        console.warn("Failed to fetch lyric", e);
      }
    }

    const hydratedSong: Song = {
      ...song,
      audioBlob,
      imageBlob,
      lyricBlob,
      lyrics: parsedLyrics,
    };

    await set(song.id, hydratedSong);
    console.log(`Hydrated ${song.title} saved to IDB`);
    return hydratedSong;
  },

  // 8. DELETE SONG
  async deleteSong(accessToken: string | null, songId: string, triggerAuthError = true) {
    // 1. Get Song details (for Drive IDs)
    const song = await get(songId) as Song | undefined;
    if (!song) return;

    // 2. Delete Local
    await del(songId);
    console.log(`Deleted local song: ${song.title}`);

    // 3. Delete Remote (if connected)
    if (accessToken) {
      try {
        // Delete Files
        if (song.driveId) await DriveApiServices.deleteFile(accessToken, song.driveId, triggerAuthError);
        if (song.driveImageId) await DriveApiServices.deleteFile(accessToken, song.driveImageId, triggerAuthError);
        if (song.driveLyricId) await DriveApiServices.deleteFile(accessToken, song.driveLyricId, triggerAuthError);

        // Update Index
        const folderId = await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError);
        const currentLibrary = await DriveApiServices.getRemoteLibraryIndex<LibraryExport>(
          accessToken,
          folderId,
          DEFAULT_LIBRARY,
          triggerAuthError
        );

        // Remove from songs
        delete currentLibrary.songs[songId];

        // Remove from playlists
        for (const playlistId in currentLibrary.playlists) {
          const pl = currentLibrary.playlists[playlistId];
          pl.songIds = pl.songIds.filter(id => id !== songId);
        }

        currentLibrary.meta.lastUpdated = Date.now();

        await DriveApiServices.updateRemoteLibraryIndex(
          accessToken,
          folderId,
          currentLibrary,
          triggerAuthError
        );

        // Update Local Sync State
        const newMeta = await DriveApiServices.getLibraryMetadata(accessToken, folderId, triggerAuthError);
        if (newMeta && newMeta.md5Checksum) {
          await set("library_json_hash", newMeta.md5Checksum);
        }
        await set("library_json_content", JSON.stringify(currentLibrary));

      } catch (e) {
        console.error("Failed to delete remote song assets", e);
        // We generally proceed since local is deleted
      }
    }
  },

  // 9. UPDATE SONG METADATA
  async updateSongMetadata(accessToken: string | null, songId: string, updates: { title?: string; artist?: string }, triggerAuthError = true) {
    const song = await get(songId) as Song | undefined;
    if (!song) throw new Error("Song not found locally");

    // 1. Try Remote Update First (if online)
    if (accessToken) {
      try {
        const folderId = await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError);
        const currentLibrary = await DriveApiServices.getRemoteLibraryIndex<LibraryExport>(
          accessToken,
          folderId,
          DEFAULT_LIBRARY,
          triggerAuthError
        );

        if (currentLibrary.songs[songId]) {
          currentLibrary.songs[songId] = {
            ...currentLibrary.songs[songId],
            ...updates,
          };
          currentLibrary.meta.lastUpdated = Date.now();

          await DriveApiServices.updateRemoteLibraryIndex(
            accessToken,
            folderId,
            currentLibrary,
            triggerAuthError
          );

          // Update Local Sync State
          const newMeta = await DriveApiServices.getLibraryMetadata(accessToken, folderId, triggerAuthError);
          if (newMeta && newMeta.md5Checksum) {
            await set("library_json_hash", newMeta.md5Checksum);
          }
          await set("library_json_content", JSON.stringify(currentLibrary));
        }
      } catch (e) {
        console.error("Failed to update remote metadata", e);
        throw e; // Abort local update on error (e.g. Auth Error)
      }
    }

    // 2. Update Local Only if Remote Succeeded (or was skipped)
    const updatedSong = { ...song, ...updates };
    await set(songId, updatedSong);
    console.log(`Updated local metadata for ${updatedSong.title}`);
  },

  // 10. PLAYLIST MANAGEMENT
  async createPlaylist(accessToken: string | null, name: string, triggerAuthError = true) {
    const id = crypto.randomUUID();
    const newPlaylist: Playlist = {
      id,
      name,
      songIds: [],
      createdAt: Date.now(),
    };

    if (accessToken) {
      const folderId = await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError);
      const currentLibrary = await DriveApiServices.getRemoteLibraryIndex<LibraryExport>(
        accessToken,
        folderId,
        DEFAULT_LIBRARY,
        triggerAuthError
      );

      currentLibrary.playlists[id] = newPlaylist;
      currentLibrary.meta.lastUpdated = Date.now();

      await DriveApiServices.updateRemoteLibraryIndex(accessToken, folderId, currentLibrary, triggerAuthError);
      await set("library_json_content", JSON.stringify(currentLibrary));
    } else {
      // Offline mode: Update local structure stored in "library_json_content"
      const currentContent = await get("library_json_content");
      const currentLibrary = currentContent ? JSON.parse(currentContent) : { ...DEFAULT_LIBRARY };
      currentLibrary.playlists[id] = newPlaylist;
      await set("library_json_content", JSON.stringify(currentLibrary));
    }
    return id;
  },

  async addToPlaylist(accessToken: string | null, playlistId: string, songId: string, triggerAuthError = true) {
    const folderId = accessToken ? await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError) : null;
    const currentContent = await (accessToken ? DriveApiServices.getRemoteLibraryIndex<LibraryExport>(accessToken, folderId!, DEFAULT_LIBRARY, triggerAuthError) : get("library_json_content").then(c => c ? JSON.parse(c) : { ...DEFAULT_LIBRARY }));

    const currentLibrary = currentContent as LibraryExport;
    if (currentLibrary.playlists[playlistId]) {
      const p = currentLibrary.playlists[playlistId];
      if (!p.songIds.includes(songId)) {
        p.songIds.push(songId);
        currentLibrary.meta.lastUpdated = Date.now();
        if (accessToken && folderId) {
          await DriveApiServices.updateRemoteLibraryIndex(accessToken, folderId, currentLibrary, triggerAuthError);
        }
        await set("library_json_content", JSON.stringify(currentLibrary));
      }
    }
  },

  async removeFromPlaylist(accessToken: string | null, playlistId: string, songId: string, triggerAuthError = true) {
    const folderId = accessToken ? await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError) : null;
    const currentContent = await (accessToken ? DriveApiServices.getRemoteLibraryIndex<LibraryExport>(accessToken, folderId!, DEFAULT_LIBRARY, triggerAuthError) : get("library_json_content").then(c => c ? JSON.parse(c) : { ...DEFAULT_LIBRARY }));

    const currentLibrary = currentContent as LibraryExport;
    if (currentLibrary.playlists[playlistId]) {
      const p = currentLibrary.playlists[playlistId];
      p.songIds = p.songIds.filter(id => id !== songId);
      currentLibrary.meta.lastUpdated = Date.now();
      if (accessToken && folderId) {
        await DriveApiServices.updateRemoteLibraryIndex(accessToken, folderId, currentLibrary, triggerAuthError);
      }
      await set("library_json_content", JSON.stringify(currentLibrary));
    }
  },

  async getPlaylists(): Promise<Record<string, Playlist>> {
    const currentContent = await get("library_json_content");
    if (!currentContent) {
      // Ensure Favorites exists
      const initial = { ...DEFAULT_LIBRARY };
      if (!initial.playlists[FAVORITES_PLAYLIST_ID]) {
        initial.playlists[FAVORITES_PLAYLIST_ID] = {
          id: FAVORITES_PLAYLIST_ID,
          name: "Favorites",
          songIds: [],
          createdAt: Date.now()
        };
      }
      return initial.playlists;
    }
    const library = JSON.parse(currentContent) as LibraryExport;
    // Always ensure Favorites is present in the returned list
    if (!library.playlists[FAVORITES_PLAYLIST_ID]) {
      library.playlists[FAVORITES_PLAYLIST_ID] = {
        id: FAVORITES_PLAYLIST_ID,
        name: "Favorites",
        songIds: [],
        createdAt: Date.now()
      };
    }
    return library.playlists;
  },

  async deletePlaylist(accessToken: string | null, playlistId: string, triggerAuthError = true) {
    if (playlistId === FAVORITES_PLAYLIST_ID) return; // Prevent deleting Favorites

    const folderId = accessToken ? await DriveApiServices.initLibraryFolder(accessToken, triggerAuthError) : null;
    const currentContent = await (accessToken ? DriveApiServices.getRemoteLibraryIndex<LibraryExport>(accessToken, folderId!, DEFAULT_LIBRARY, triggerAuthError) : get("library_json_content").then(c => c ? JSON.parse(c) : { ...DEFAULT_LIBRARY }));

    const currentLibrary = currentContent as LibraryExport;
    if (currentLibrary.playlists[playlistId]) {
      delete currentLibrary.playlists[playlistId];
      currentLibrary.meta.lastUpdated = Date.now();
      if (accessToken && folderId) {
        await DriveApiServices.updateRemoteLibraryIndex(accessToken, folderId, currentLibrary, triggerAuthError);
      }
      await set("library_json_content", JSON.stringify(currentLibrary));
    }
  }
};
