import {
  ListMusic,
  Library,
  LogOut,
  Menu,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { type User } from "firebase/auth";
import { useNavigate, useLocation } from "react-router-dom";

interface SideNavProps {
  onDisconnect: () => void;
  onSync: () => Promise<void>;
  user: User | null;
}

export function SideNav({ onDisconnect, onSync, user }: SideNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: "playlist", label: "Playlist", icon: ListMusic, path: "/playlist" },
    { id: "library", label: "Library", icon: Library, path: "/library" },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleSyncClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await onSync();
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/5 backdrop-blur-xl z-30 flex items-center px-4 border-b border-white/5">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-lg rounded-full border border-white/20 text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-4">
          <div className="w-8 h-8">
            <img src="/logo.webp" alt="Harp Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-white font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Harp</h1>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Side Navigation */}
      <div
        className={`
          fixed md:static top-0 left-0 h-full w-64 bg-slate-900/50 backdrop-blur-xl z-40 
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
          }
        `}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo Area (Desktop) */}
          <div className="hidden md:flex items-center gap-3 mb-8 text-white">
            <div className="w-9 h-9">
              <img src="/logo.webp" alt="Harp Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Harp</span>
          </div>

          {/* User Profile */}
          <div className="mb-8 pb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden border border-white/20">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="User"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-sm font-medium truncate">
                  {user?.displayName || "User"}
                </h3>
                <p className="text-white/50 text-xs truncate">
                  {user?.email || "No email"}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              // Check if path matches current location
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.path)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium
                    ${isActive
                      ? "bg-white/10 text-white shadow-lg border border-white/5"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                    }
                  `}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? "text-purple-400" : ""}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>


          {/* Action Buttons */}
          <div className="mt-auto space-y-2">
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all duration-200 text-sm font-medium ${isSyncing ? "opacity-50 cursor-not-allowed" : ""
                }`}
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Sync with Drive</span>
            </button>

            <button
              onClick={onDisconnect}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 text-sm font-medium mt-auto"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
