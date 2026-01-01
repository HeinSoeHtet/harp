import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: {
        success: (message: string) => void;
        error: (message: string) => void;
        info: (message: string) => void;
    };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context.toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000); // Auto remove after 4s
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const toast = {
        success: (msg: string) => addToast(msg, "success"),
        error: (msg: string) => addToast(msg, "error"),
        info: (msg: string) => addToast(msg, "info"),
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl min-w-[300px] max-w-md animate-in slide-in-from-right-full fade-in duration-300
              ${t.type === "error" ? "bg-red-500/90 text-white" : ""}
              ${t.type === "success" ? "bg-green-500/90 text-white" : ""}
              ${t.type === "info" ? "bg-blue-500/90 text-white" : ""}
              backdrop-blur-md border border-white/10
            `}
                    >
                        {t.type === "error" && <AlertCircle className="w-5 h-5 shrink-0" />}
                        {t.type === "success" && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                        {t.type === "info" && <Info className="w-5 h-5 shrink-0" />}

                        <p className="text-sm font-medium flex-1">{t.message}</p>

                        <button
                            onClick={() => removeToast(t.id)}
                            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
