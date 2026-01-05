import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

export function PWAInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other');

    useEffect(() => {
        // Check if already in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes('android-app://');

        if (isStandalone) return;

        // Platform detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIos = /iphone|ipad|ipod/.test(userAgent);
        const isAndroid = /android/.test(userAgent);

        if (isIos) setPlatform('ios');
        else if (isAndroid) setPlatform('android');

        // Android/Chrome install prompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS, we show it once per session if not standalone
        if (isIos && !sessionStorage.getItem('pwa_ios_prompt_shown')) {
            setShowPrompt(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };

    const closePrompt = () => {
        setShowPrompt(false);
        if (platform === 'ios') {
            sessionStorage.setItem('pwa_ios_prompt_shown', 'true');
        }
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-[150] animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                {/* Glow effect */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

                <button
                    onClick={closePrompt}
                    className="absolute top-3 right-3 p-1 text-white/40 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0 shadow-lg">
                        <img src="/logo.webp" alt="Harp" className="w-8 h-8 object-contain" />
                    </div>

                    <div className="flex-1 pt-0.5">
                        <h3 className="text-white font-bold text-lg leading-tight">Install Harp App</h3>
                        <p className="text-white/50 text-xs mt-1 leading-relaxed">
                            {platform === 'ios'
                                ? "Get the full experience on your iPhone."
                                : "Add Harp to your home screen for the best experience."}
                        </p>
                    </div>
                </div>

                <div className="mt-5">
                    {platform === 'ios' ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-white/70 text-sm bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-blue-400">
                                    <Share className="w-4 h-4" />
                                </div>
                                <span>Tap the <strong>Share</strong> button below</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/70 text-sm bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-purple-400">
                                    <PlusSquare className="w-4 h-4" />
                                </div>
                                <span>Select <strong>'Add to Home Screen'</strong></span>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleInstallClick}
                            className="w-full py-3.5 bg-white text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                        >
                            <Download className="w-5 h-5" />
                            Install Now
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
