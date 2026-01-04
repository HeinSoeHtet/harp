import { useNavigate, Link } from "react-router-dom";
import { HardDrive, Sparkles, Shield, ChevronRight, Play } from "lucide-react";

export function HomePage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen relative overflow-x-hidden selection:bg-purple-500/30">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            {/* Navigation Backdrop */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 overflow-hidden">
                            <img src="/logo.webp" alt="Harp Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-white text-xl font-bold tracking-tight">harp</span>
                    </div>
                    <button
                        onClick={() => navigate("/connect")}
                        className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-all border border-white/10"
                    >
                        Launch Player
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-40 pb-20 px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Sparkles className="w-3 h-3" />
                        <span>AI-Powered Lyric Transcription</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-8 tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        Your Music. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                            Your Cloud.
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-white/50 text-lg md:text-xl mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
                        Harp transforms your Google Drive into a high-quality music streaming service.
                        No subscriptions. No limits. Just your personal library, anywhere.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-300">
                        <button
                            onClick={() => navigate("/connect")}
                            className="group relative px-8 py-4 bg-white text-black rounded-2xl font-bold text-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                        >
                            Get Started
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-lg transition-all border border-white/10 flex items-center gap-2"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            Watch Demo
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard
                        icon={<HardDrive className="w-6 h-6 text-blue-400" />}
                        title="Drive Integration"
                        description="Securely sync and stream your music files directly from Google Drive with zero server storage."
                    />
                    <FeatureCard
                        icon={<Sparkles className="w-6 h-6 text-purple-400" />}
                        title="AI Lyrics"
                        description="Generate beautifully synchronized lyrics for any song using advanced AI transcription models."
                    />
                    <FeatureCard
                        icon={<Shield className="w-6 h-6 text-pink-400" />}
                        title="Privacy First"
                        description="Your music and metadata stay between you and Google. We don't store your audio files."
                    />
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 pt-20 pb-10 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 overflow-hidden grayscale opacity-50">
                                <img src="/logo.webp" alt="Harp Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-white/40 text-sm font-bold tracking-tight">harp</span>
                        </div>
                        <div className="flex gap-8">
                            <Link to="/privacy" className="text-white/40 hover:text-white transition-colors text-sm">Privacy Policy</Link>
                            <Link to="/terms" className="text-white/40 hover:text-white transition-colors text-sm">Terms of Service</Link>
                        </div>
                        <p className="text-white/20 text-xs">
                            &copy; {new Date().getFullYear()} Harp Music. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-white/40 leading-relaxed text-sm">
                {description}
            </p>
        </div>
    );
}
