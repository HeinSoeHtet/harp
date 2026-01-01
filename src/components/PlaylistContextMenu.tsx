import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface PlaylistContextMenuProps {
    position: { x: number; y: number } | null;
    onClose: () => void;
    onDelete: () => void;
}

export function PlaylistContextMenu({ position, onClose, onDelete }: PlaylistContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleScroll = () => onClose();

        window.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);

        return () => {
            window.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [onClose]);

    if (!position) return null;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
            style={{
                top: position.y,
                left: Math.min(position.x, window.innerWidth - 200),
            }}
        >
            <button
                onClick={() => {
                    onDelete();
                    onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
                <Trash2 className="w-4 h-4" />
                <span>Delete Playlist</span>
            </button>
        </div>,
        document.body
    );
}
