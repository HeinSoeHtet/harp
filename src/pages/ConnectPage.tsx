import { useNavigate } from "react-router-dom";
import { Loader2, HardDrive, LogIn, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

interface ConnectPageProps {
  onConnect: (accessToken: string, user: any) => void;
  currentUser: any;
}

// Declare google global for GIS
declare global {
  interface Window {
    google: any;
  }
}

const CLIENT_ID = import.meta.env.VITE_DRIVE_CLIENT_ID;

export function ConnectPage({ onConnect, currentUser }: ConnectPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(result.authentication.idToken);
        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError("Login failed. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectDrive = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError("");

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await GoogleAuth.signIn();
        const authCode = result.serverAuthCode;

        if (authCode) {
          const saveTokenFn = httpsCallable<{ code: string }, { success: boolean, accessToken: string }>(functions, 'saveDriveToken');
          const exchangeResult = await saveTokenFn({ code: authCode });

          if (exchangeResult.data.success && exchangeResult.data.accessToken) {
            onConnect(exchangeResult.data.accessToken, currentUser);
          } else {
            setError("Failed to generate drive session.");
          }
        } else {
          setError("Failed to get authorization code.");
        }
        setIsLoading(false);
      } else {
        // 1. Get Auth Code via GIS
        const client = window.google.accounts.oauth2.initCodeClient({
          client_id: CLIENT_ID,
          scope: "https://www.googleapis.com/auth/drive.file",
          ux_mode: "popup",
          callback: async (response: any) => {
            if (response.code) {
              try {
                // 2. Exchange code via Cloud Function
                const saveTokenFn = httpsCallable<{ code: string }, { success: boolean, accessToken: string }>(functions, 'saveDriveToken');

                const result = await saveTokenFn({ code: response.code });

                if (result.data.success && result.data.accessToken) {
                  onConnect(result.data.accessToken, currentUser);
                } else {
                  setError("Failed to generate drive session.");
                }
              } catch (e: any) {
                console.error("Code exchange failed", e);
                setError(e.message || "Failed to connect Drive.");
              } finally {
                setIsLoading(false);
              }
            } else {
              setError("Authorization failed.");
              setIsLoading(false);
            }
          },
        });

        client.requestCode();
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setError("Could not initialize Google connection.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="md:backdrop-blur-xl md:bg-white/5 md:rounded-3xl md:p-12 md:shadow-2xl md:border md:border-white/10 max-w-sm w-full text-center relative z-10">
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 overflow-hidden">
            <img src="/logo.webp" alt="Harp Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        <h1 className="text-white text-2xl font-bold mb-3">Welcome to Harp</h1>
        <p className="text-white/50 mb-8 text-sm leading-relaxed">
          Stream your personal music library directly from Google Drive.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
            <p className="text-red-300 text-xs">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Step 1: Firebase Auth */}
          <div className="relative group">
            <button
              onClick={handleLogin}
              disabled={isLoading || !!currentUser}
              className={`
                w-full py-4 px-6 rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center gap-3 font-medium text-sm
                ${currentUser
                  ? "bg-green-500/20 text-green-400 border border-green-500/30 cursor-default"
                  : isLoading
                    ? "bg-white/5 text-white/50 cursor-wait"
                    : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                }
              `}
            >
              {currentUser ? <CheckCircle2 className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
              <span>{currentUser ? `Logged in as ${currentUser.displayName?.split(' ')[0]}` : "1. Login with Google"}</span>
            </button>
          </div>

          {/* Step 2: Drive Connection */}
          <button
            onClick={handleConnectDrive}
            disabled={isLoading || !currentUser}
            className={`
              w-full py-4 px-6 rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center gap-3 font-medium text-sm transform
              ${!currentUser
                ? "bg-white/5 text-white/20 cursor-not-allowed grayscale"
                : isLoading
                  ? "bg-white/5 text-white/50 cursor-wait"
                  : "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-0.5 active:scale-95"
              }
            `}
          >
            {isLoading && currentUser ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <HardDrive className="w-5 h-5" />
            )}
            <span>{isLoading && currentUser ? "Connecting..." : "2. Connect Google Drive"}</span>
          </button>
        </div>

        <p className="text-white/20 text-[10px] mt-8 leading-relaxed">
          Harp needs specific permissions to read/write music files. <br />
          Your login data is never shared with third parties.
        </p>

        <div className="flex justify-center gap-6 mt-6 border-t border-white/5 pt-6">
          <button
            onClick={() => navigate("/privacy")}
            className="text-white/30 hover:text-white/60 text-[10px] font-medium uppercase tracking-wider transition-colors"
          >
            Privacy
          </button>
          <button
            onClick={() => navigate("/terms")}
            className="text-white/30 hover:text-white/60 text-[10px] font-medium uppercase tracking-wider transition-colors"
          >
            Terms
          </button>
        </div>
      </div>
    </div>
  );
}
