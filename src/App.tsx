import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import { Loader2, CheckCircle2 } from "lucide-react";
import { get as getBytes, set as setBytes, del as delBytes } from "idb-keyval";

// Services & Types
import { LibraryServices, type Song } from "./services/libraryServices";
import { DriveApiServices } from "./services/driveApiServices";

// Pages & Components
import { ConnectPage } from "./pages/ConnectPage";
import { AddToPlaylistDialog } from "./components/AddToPlaylistDialog";
import { LibraryPage } from "./pages/LibraryPage";
import { PlaylistPage } from "./pages/PlaylistPage";
import { SideNav } from "./layouts/SideNav";
import { PlayerBar } from "./components/PlayerBar";
import { FullPlayer } from "./components/FullPlayer";
import { EditSongDialog } from "./components/EditSongDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";

// --- Custom Hooks ---
function useBlobUrl(blob: Blob | undefined | null) {
  const url = useMemo(() => {
    if (!blob) return undefined;
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  return url;
}

// Imports updated to include useToast
import { useToast, ToastProvider } from "./context/ToastContext";

const AppContent = () => {
  const toast = useToast();
  // robust initialization to prevent flickering
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem("harp_user_cache");
      return cached && cached !== "undefined" && cached !== "null" ? JSON.parse(cached) : null;
    } catch { return null; }
  });

  const [driveToken, setDriveToken] = useState<string | null>(() => {
    return localStorage.getItem("harp_drive_token");
  });

  // Loading checks: strictly check if we *failed* to restore session.
  // If we restored both user & token, we are NOT loading.
  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    const token = localStorage.getItem("harp_drive_token");
    let u = null;
    try {
      const cached = localStorage.getItem("harp_user_cache");
      if (cached && cached !== "undefined" && cached !== "null") {
        u = JSON.parse(cached);
      }
    } catch { }
    // If we have both, we are ready. Otherwise, wait for Firebase/Quiet Auth.
    return !(token && u);
  });

  const [songs, setSongs] = useState<Song[]>([]);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string>("latest");
  const [currentSongIndex, setCurrentSongIndex] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"none" | "all" | "one">("none");
  const [volume, setVolume] = useState(0.7);


  // New State for Full Screen Player & Player Visibility
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "completed">("idle");
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);

  // Edit Song State
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);

  // Refresh trigger for playlists
  const [playlistUpdateTrigger, setPlaylistUpdateTrigger] = useState(0);

  const handlePlaylistUpdate = () => {
    setPlaylistUpdateTrigger(prev => prev + 1);
  };

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentSong = playbackQueue[currentSongIndex];
  const audioUrl = useBlobUrl(currentSong?.audioBlob);

  const loadLibrary = async () => {
    try {
      const localSongs = await LibraryServices.getLocalSongs();
      const sorted = localSongs.sort((a, b) => b.addedAt - a.addedAt);
      setSongs(sorted);
      if (playbackQueue.length === 0) {
        setPlaybackQueue(sorted);
      }
    } catch (e) {
      console.error("Failed to load library:", e);
    }
  };

  useEffect(() => {
    const handleAuthChange = async (currentUser: User | null) => {
      if (currentUser) {
        setUser(currentUser);
        localStorage.setItem("harp_user_cache", JSON.stringify(currentUser));

        let activeToken = localStorage.getItem("harp_drive_token");

        // 1. If no local token, try to fetch it quietly via Cloud Function
        if (!activeToken) {
          console.log("No token in storage. Attempting quiet fetch...");
          try {
            const getDriveTokenFn = httpsCallable(functions, 'getDriveToken');
            const result = await getDriveTokenFn();
            activeToken = (result.data as { accessToken: string }).accessToken;
            if (activeToken) {
              localStorage.setItem("harp_drive_token", activeToken);
              setDriveToken(activeToken);
            }
          } catch (e) {
            console.log("No existing Drive connection found or fetch failed.");
          }
        } else {
          setDriveToken(activeToken);
        }

        try {
          const photoBlob = await getBytes("harp_user_photo_blob");
          if (photoBlob) {
            const localUrl = URL.createObjectURL(photoBlob);
            setUser((prev) => (prev ? { ...prev, photoURL: localUrl } : currentUser));
          }
        } catch (e) {
          console.error("Failed to load cached photo/session", e);
        }

        loadLibrary();

        // Background Sync
        if (activeToken) {
          LibraryServices.syncFromDrive(activeToken)
            .then(() => {
              console.log("Background sync completed");
              loadLibrary();
            })
            .catch((e) => {
              console.log("Background sync skipped", e);
            });
        }
      } else {
        // Fallback: Try to restore offline session from IDB
        try {
          const session = await getBytes("harp_user_session");
          if (session) {
            console.log("Restored offline session");
            setUser(session as User); // Cast to User type
          } else {
            setUser(null);
          }
        } catch (e) {
          console.error("Failed to restore offline session", e);
          setUser(null);
        }
      }
      setIsAuthLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, handleAuthChange);
    return () => unsubscribe();
  }, []);

  // Handle Session Expiry (401 from Drive API)
  useEffect(() => {
    const handleSessionExpiry = () => {
      console.warn("Session expired. showing refresh prompt.");
      setIsSessionExpired(true);
    };

    window.addEventListener("harp-session-expired", handleSessionExpiry);
    return () => window.removeEventListener("harp-session-expired", handleSessionExpiry);
  }, []);

  const handleRefreshSession = async () => {
    try {
      // 1. Try Quiet Refresh first
      const getDriveTokenFn = httpsCallable(functions, 'getDriveToken');
      const result = await getDriveTokenFn();
      const token = (result.data as { accessToken: string }).accessToken;

      if (token) {
        setDriveToken(token);
        localStorage.setItem("harp_drive_token", token);
        setIsSessionExpired(false);
        toast.success("Session revalidated!");
        return;
      }

      // 2. If quiet fail, we need to show the ConnectPage or re-auth
      // But since the Modal is showing, we can trigger a re-auth popup here
      // However, the best way is to send them back to ConnectPage
      setIsSessionExpired(false);
      localStorage.removeItem("harp_drive_token");
      setDriveToken(null);

    } catch (e) {
      console.error("Failed to refresh session", e);
      setIsSessionExpired(false);
      localStorage.removeItem("harp_drive_token");
      setDriveToken(null);
      toast.error("Session expired. Please reconnect Drive.");
    }
  };

  const playSong = async (index: number, queue?: Song[], queueId?: string) => {
    let targetQueue = queue || playbackQueue;
    if (queue) {
      setPlaybackQueue(queue);
    }
    if (queueId) {
      setActiveQueueId(queueId);
    }

    const targetSong = targetQueue[index];
    if (!targetSong) return;

    if (!targetSong.audioBlob && driveToken) {
      setIsBuffering(true);
      try {
        const hydrated = await LibraryServices.fetchSongMedia(driveToken, targetSong, true);
        const newQueue = [...targetQueue];
        newQueue[index] = hydrated;
        setPlaybackQueue(newQueue);

        // Update main library list as well
        const updatedSongs = [...songs];
        const songIdx = updatedSongs.findIndex(s => s.id === targetSong.id);
        if (songIdx !== -1) updatedSongs[songIdx] = hydrated;
        setSongs(updatedSongs);

        targetQueue = newQueue;
      } catch (e) {
        console.error("Failed to hydrate song", e);
        setIsBuffering(false);
        return;
      } finally {
        setIsBuffering(false);
      }
    }

    setCurrentSongIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
    setShowPlayer(true);
  };

  const handleNext = (isManual = true) => {
    if (playbackQueue.length === 0) return;

    if (!isManual && repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    let nextIndex = 0;
    if (isShuffle && playbackQueue.length > 1) {
      let newIndex = currentSongIndex;
      while (newIndex === currentSongIndex) {
        newIndex = Math.floor(Math.random() * playbackQueue.length);
      }
      nextIndex = newIndex;
    } else {
      nextIndex = (currentSongIndex + 1);
      if (nextIndex >= playbackQueue.length) {
        if (repeatMode === "all" || isManual) {
          nextIndex = 0;
        } else {
          // End of library and no repeat all
          setIsPlaying(false);
          return;
        }
      }
    }

    // In "Repeat All" or "Shuffle" mode with only 1 song, 
    // if it's an auto-advance (not manual), we should handle the "don't play same song" request.
    // However, usually players just replay the song. 
    // Given the user request, if songs.length is 1 and it's auto-advance, let's stop logic.
    if (!isManual && playbackQueue.length === 1 && (isShuffle || repeatMode === "all")) {
      // If user specifically doesn't want the same song, we stop.
      // But typically this only applies to shuffle randomness.
      // I will stick to the shuffle variety fix above.
    }

    playSong(nextIndex);
  };

  const handlePrevious = () => {
    if (playbackQueue.length === 0) return;

    if (currentTime > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      return;
    }

    let prevIndex = 0;
    if (isShuffle && playbackQueue.length > 1) {
      let newIndex = currentSongIndex;
      while (newIndex === currentSongIndex) {
        newIndex = Math.floor(Math.random() * playbackQueue.length);
      }
      prevIndex = newIndex;
    } else {
      prevIndex = currentSongIndex - 1;
      if (prevIndex < 0) {
        prevIndex = playbackQueue.length - 1;
      }
    }
    playSong(prevIndex);
  };

  const handleToggleShuffle = () => {
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    if (nextShuffle) {
      setRepeatMode("none");
    }
  };

  const handleToggleRepeat = () => {
    let nextMode: "none" | "all" | "one" = "none";
    if (repeatMode === "none") nextMode = "all";
    else if (repeatMode === "all") nextMode = "one";
    else nextMode = "none";

    setRepeatMode(nextMode);
    if (nextMode !== "none") {
      setIsShuffle(false);
    }
  };

  // Playback Timer
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    if (audioRef.current && currentSong && currentSong.duration === 0) {
      const duration = audioRef.current.duration;
      const updatedSong = { ...currentSong, duration };
      const updatedSongs = [...songs];
      updatedSongs[currentSongIndex] = updatedSong;
      setSongs(updatedSongs);

      // Persist duration to local storage so it displays correctly next time
      LibraryServices.saveSongLocal(updatedSong).catch(e => console.error("Failed to persist duration", e));
    }
  };

  const handleLoginSuccess = async (token: string, user: User) => {
    setDriveToken(token);
    setUser(user);
    localStorage.setItem("harp_drive_token", token);
    // Cache FULL user session (idb-keyval)
    await setBytes("harp_user_session", user.toJSON());

    // Cache photo as blob
    if (user.photoURL) {
      try {
        const response = await fetch(user.photoURL);
        const blob = await response.blob();
        await setBytes("harp_user_photo_blob", blob);

        // Use local blob URL immediately
        const localUrl = URL.createObjectURL(blob);
        setUser((prev) => prev ? { ...prev, photoURL: localUrl } : user);
      } catch (e) {
        console.error("Failed to cache user photo", e);
      }
    }

    loadLibrary();

    // Trigger explicit sync on login
    LibraryServices.syncFromDrive(token)
      .then(() => {
        console.log("Login sync completed");
        loadLibrary();
      })
      .catch((e) => {
        console.error("Login sync failed", e);
      });
  };

  const handleLogout = async () => {
    // 1. Clear Local Storage immediately
    localStorage.removeItem("harp_drive_token");
    localStorage.removeItem("harp_user_cache");

    // Clear IDB async (don't await strictly if not needed for UI, but fast enough)
    delBytes("harp_user_session");
    delBytes("harp_user_photo_blob");

    // 2. Clear React State (Updates UI to Login Screen immediately)
    setDriveToken(null);
    setUser(null);
    setIsPlaying(false);
    setSongs([]);
    setShowPlayer(false);

    // 3. Perform Network Cleanup in Background
    if (driveToken) {
      DriveApiServices.revokeToken(driveToken).catch(e => console.error("Token revoke failed:", e));
    }

    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase signout failed:", e);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Centralized Effect handles DOM interaction based on state + url
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && audioUrl) {
      audioRef.current.play().catch((e) => {
        console.log("Playback error or autoplay blocked:", e);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, audioUrl]);

  // Volume Effect
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };




  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };


  const handleClosePlayer = () => {
    setIsPlaying(false);
    setShowPlayer(false);
    setIsPlayerExpanded(false);
  };

  const handleCollapsePlayer = () => {
    setIsPlayerExpanded(false);
  };

  // ... (skip lines) ...


  const handleManualSync = async () => {
    if (driveToken) {
      console.log("Starting manual sync...");
      setSyncStatus("syncing");
      try {
        await LibraryServices.syncFromDrive(driveToken, true);
        console.log("Manual sync completed.");
        // Reload to show updates
        loadLibrary();
        setSyncStatus("completed");
        toast.success("Library synced successfully!");
        setTimeout(() => setSyncStatus("idle"), 2000); // Show success for 2s
      } catch (e) {
        console.error("Manual sync failed", e);
        setSyncStatus("idle");
        toast.error("Sync failed. Check your connection.");
      }
    }
  };

  const confirmDeleteSong = async () => {
    if (!songToDelete) return;
    const songId = songToDelete.id;
    setIsDeleting(true);

    try {
      await LibraryServices.deleteSong(driveToken, songId);

      // If deleted song content was playing, stop it
      const songIndex = songs.findIndex(s => s.id === songId);
      if (songIndex === currentSongIndex) {
        setIsPlaying(false);
        setShowPlayer(false);
      } else if (songIndex < currentSongIndex) {
        // Shift index down
        setCurrentSongIndex(prev => prev - 1);
      }

      await loadLibrary();
      setSongToDelete(null);
      toast.success("Song deleted successfully.");
    } catch (e) {
      console.error("Delete failed", e);
      toast.error("Failed to delete song.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async (id: string, newTitle: string, newArtist: string) => {
    setIsSavingEdit(true);
    try {
      await LibraryServices.updateSongMetadata(driveToken, id, {
        title: newTitle,
        artist: newArtist,
      }, true);
      await loadLibrary();
      setEditingSong(null);
      toast.success("Song updated successfully!");
    } catch (e) {
      console.error("Update failed", e);
      toast.error("Failed to update song.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-slate-900 relative">
      <div className="absolute inset-0 bg-[url('/background-img.webp')] bg-cover bg-center opacity-20 pointer-events-none" />

      {/* Sync Overlay */}
      {syncStatus !== "idle" && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 transition-all duration-300">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center shadow-2xl max-w-sm w-full">
            {syncStatus === "syncing" ? (
              <>
                <div className="w-20 h-20 relative mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                  <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-purple-400 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Syncing...</h2>
                <p className="text-white/50 text-center">
                  Updating your library from Google Drive
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Sync Complete</h2>
                <p className="text-white/50 text-center">
                  Your library is up to date
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Session Expired Modal */}
      {/* Session Expired Modal */}
      {isSessionExpired && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-yellow-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">

            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500" />

            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 ring-1 ring-yellow-500/40">
                <Loader2 className="w-7 h-7 text-yellow-400" />
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Session Expired</h2>
              <p className="text-white/60 text-sm mb-6 leading-relaxed">
                Your secure connection to Google Drive has timed out. Please refresh to continue listening.
              </p>

              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handleRefreshSession}
                  className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 rounded-xl text-white font-bold shadow-lg shadow-orange-900/20 transition-all transform active:scale-95"
                >
                  Refresh Session
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white text-sm font-medium transition-colors"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={!!songToDelete}
        title="Delete Song?"
        message={`Are you sure you want to delete "${songToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={confirmDeleteSong}
        onCancel={() => setSongToDelete(null)}
      />

      {/* Edit Song Dialog */}
      <EditSongDialog
        song={editingSong}
        isOpen={!!editingSong}
        isSaving={isSavingEdit}
        onClose={() => setEditingSong(null)}
        onSave={handleSaveEdit}
      />

      {isBuffering && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 p-4 rounded-xl flex items-center gap-3 border border-purple-500/20 shadow-xl">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            <span className="text-white font-medium">Downloading Song...</span>
          </div>
        </div>
      )}

      <div className="flex h-screen overflow-hidden relative z-10">
        {user && driveToken && (
          <SideNav user={user} onDisconnect={handleLogout} onSync={handleManualSync} />
        )}

        <main className="flex-1 flex flex-col relative min-w-0">
          <div className={`flex-1 overflow-y-auto transition-[transform,opacity] duration-300 ${user && driveToken ? 'p-4 pb-32' : ''} ${isPlayerExpanded ? 'scale-95 opacity-50 pointer-events-none' : ''}`}>
            <Routes>
              <Route path="/connect" element={
                user && driveToken ? <Navigate to="/library" replace /> : <ConnectPage onConnect={handleLoginSuccess} currentUser={user} />
              } />
              <Route path="/library" element={
                !user || !driveToken ? <Navigate to="/connect" replace /> : (
                  <LibraryPage
                    accessToken={driveToken}
                    onSongAdded={(newSong) => setSongs([newSong, ...songs])}
                    onRequestDelete={setSongToDelete}
                    onEditSong={setEditingSong}
                    onAddToPlaylist={setSongToAddToPlaylist}
                    onSelectSong={(idx: number, q?: Song[], qId?: string) => { playSong(idx, q, qId) }}
                    currentSongId={currentSong?.id}
                    isPlaying={isPlaying}
                  />
                )
              } />
              <Route path="/playlist" element={
                !user || !driveToken ? <Navigate to="/connect" replace /> : (
                  <PlaylistPage
                    accessToken={driveToken}
                    songs={songs}
                    currentSongId={currentSong?.id}
                    activePlaylistId={activeQueueId}
                    onSelectSong={(idx: number, q?: Song[], qId?: string) => { playSong(idx, q, qId) }}
                    isPlaying={isPlaying}
                    onRequestDelete={setSongToDelete}
                    onEditSong={setEditingSong}
                    onAddToPlaylist={setSongToAddToPlaylist}
                    refreshTrigger={playlistUpdateTrigger}
                  />
                )
              } />
              <Route path="/" element={<Navigate to="/library" replace />} />
              <Route path="*" element={<Navigate to="/library" replace />} />
            </Routes>
          </div>

          {user && driveToken && (
            <>
              {/* Player Bar (Always Visible unless expanded) */}
              <div className={`absolute bottom-0 left-0 right-0 z-40 transition-transform duration-500 ${showPlayer && !isPlayerExpanded ? 'translate-y-0' : 'translate-y-full'}`}>
                <PlayerBar
                  currentSong={currentSong || null}
                  isPlaying={isPlaying}
                  onTogglePlay={togglePlay}
                  onNext={() => handleNext(true)}
                  onPrevious={handlePrevious}
                  onExpand={() => setIsPlayerExpanded(true)}
                  currentTime={currentTime}
                  isShuffle={isShuffle}
                  isRepeat={repeatMode}
                  onToggleShuffle={handleToggleShuffle}
                  onToggleRepeat={handleToggleRepeat}
                  onSeek={handleSeek}
                  onClose={handleClosePlayer}
                />
              </div>

              {/* Full Screen Player Overlay */}
              <div className={`fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl transition-[transform,opacity] duration-500 flex flex-col ${isPlayerExpanded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
                {showPlayer && (
                  <FullPlayer
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlay}
                    onNext={() => handleNext(true)}
                    onPrevious={handlePrevious}
                    onSeek={handleSeek}
                    currentTime={currentTime}
                    duration={audioRef.current?.duration || currentSong?.duration || 0}
                    isShuffle={isShuffle}
                    isRepeat={repeatMode}
                    onClose={handleCollapsePlayer}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    onToggleShuffle={handleToggleShuffle}
                    onToggleRepeat={handleToggleRepeat}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => handleNext(false)}
        onLoadedMetadata={handleLoadedMetadata}
        onError={(e) => {
          console.error("Audio playback error", e);
          setIsPlaying(false);
        }}
        crossOrigin="anonymous"
      />
      <AddToPlaylistDialog
        song={songToAddToPlaylist}
        isOpen={!!songToAddToPlaylist}
        onClose={() => setSongToAddToPlaylist(null)}
        accessToken={driveToken}
        onPlaylistUpdated={handlePlaylistUpdate}
      />
    </div >
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="antialiased text-slate-900 min-h-screen bg-slate-950">
          <AppContent />
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

