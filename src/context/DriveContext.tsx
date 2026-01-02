import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { get as getBytes, set as setBytes, del as delBytes } from "idb-keyval";
import { DriveApiServices } from "../services/driveApiServices";

interface DriveContextType {
    user: User | null;
    driveToken: string | null;
    isAuthLoading: boolean;
    login: (token: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useDrive() {
    const context = useContext(DriveContext);
    if (!context) {
        throw new Error("useDrive must be used within a DriveProvider");
    }
    return context;
}

export function DriveProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const cached = localStorage.getItem("harp_user_cache");
            return cached && cached !== "undefined" && cached !== "null" ? JSON.parse(cached) : null;
        } catch { return null; }
    });

    const [driveToken, setDriveToken] = useState<string | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    // Helper to sync user photo
    const cacheUserPhoto = async (currentUser: User) => {
        if (currentUser.photoURL) {
            try {
                const response = await fetch(currentUser.photoURL);
                const blob = await response.blob();
                await setBytes("harp_user_photo_blob", blob);
                const localUrl = URL.createObjectURL(blob);
                setUser((prev) => prev ? { ...prev, photoURL: localUrl } : currentUser);
            } catch (e) {
                console.error("Failed to cache user photo", e);
            }
        }
    };

    const login = async (token: string, newUser: User) => {
        setDriveToken(token);
        setUser(newUser);
        localStorage.setItem("harp_user_cache", JSON.stringify(newUser));
        await setBytes("harp_user_session", newUser.toJSON());
        await cacheUserPhoto(newUser);
    };

    const logout = async () => {
        setDriveToken(null);
        setUser(null);
        localStorage.removeItem("harp_user_cache");
        await delBytes("harp_user_session");
        await delBytes("harp_user_photo_blob");

        // Revoke token if possible
        if (driveToken) {
            DriveApiServices.revokeToken(driveToken).catch(() => { });
        }

        try {
            await signOut(auth);
        } catch (e) {
            console.error("Signout failed", e);
        }
    };

    const refreshSession = useCallback(async () => {
        try {
            const getDriveTokenFn = httpsCallable<{ accessToken: string }>(functions, 'getDriveToken');
            const result = await getDriveTokenFn();
            const token = (result.data as any).accessToken;
            if (token) {
                setDriveToken(token);
                return;
            }
            throw new Error("No token returned");
        } catch (e) {
            console.error("Quiet refresh failed", e);
            // Don't auto-logout here, let the UI handle the error state if needed
            // or the interceptor will eventually fail
        }
    }, []);

    useEffect(() => {
        const handleAuthChange = async (currentUser: User | null) => {
            // 1. User Logged In
            if (currentUser) {
                setUser(currentUser);
                localStorage.setItem("harp_user_cache", JSON.stringify(currentUser));

                // Restore photo blob
                try {
                    const photoBlob = await getBytes("harp_user_photo_blob");
                    if (photoBlob) {
                        const localUrl = URL.createObjectURL(photoBlob);
                        setUser((prev) => (prev ? { ...prev, photoURL: localUrl } : currentUser));
                    }
                } catch {
                    // Ignore photo restore failure
                }

                // 2. Fetch Token Quietly
                if (!driveToken) {
                    await refreshSession();
                }
            } else {
                // 3. User Logged Out / Validating Offline Session
                try {
                    const session = await getBytes("harp_user_session");
                    if (session) {
                        setUser(session as User);
                    } else {
                        setUser(null);
                    }
                } catch {
                    setUser(null);
                }
            }
            setIsAuthLoading(false);
        };

        const unsubscribe = onAuthStateChanged(auth, handleAuthChange);
        return () => unsubscribe();
    }, [driveToken, refreshSession]);

    // Listen for Token Refreshes from Service Layer
    useEffect(() => {
        const handleTokenRefreshed = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            if (customEvent.detail) {
                console.log("DriveContext: Token refreshed via service interceptor");
                setDriveToken(customEvent.detail);
            }
        };

        window.addEventListener("harp-token-refreshed", handleTokenRefreshed);
        return () => window.removeEventListener("harp-token-refreshed", handleTokenRefreshed);
    }, []);

    return (
        <DriveContext.Provider value={{ user, driveToken, isAuthLoading, login, logout, refreshSession }}>
            {children}
        </DriveContext.Provider>
    );
}
