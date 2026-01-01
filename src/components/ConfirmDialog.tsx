import { AlertTriangle, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDanger = false,
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`bg-slate-900 border ${isDanger ? 'border-red-500/30' : 'border-white/10'} rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden`}>
                {isDanger && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />}

                <div className={`flex items-center gap-3 ${isDanger ? 'text-red-500' : 'text-purple-400'} mb-4`}>
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                </div>
                <p className="text-white/70 mb-6 text-sm leading-relaxed">{message}</p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium transition-colors text-sm"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-2.5 ${isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'} rounded-xl text-white font-bold transition-colors flex items-center justify-center gap-2 text-sm shadow-lg`}
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
