import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export function PrivacyPolicyPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 selection:bg-purple-500/30">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-12group"
                >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    Back
                </button>

                <h1 className="text-4xl font-black mb-8">Privacy Policy</h1>

                <div className="space-y-8 text-white/70 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">1. Overview</h2>
                        <p>
                            Harp is designed as a client-side music player that interacts with your Google Drive.
                            We prioritize your privacy and aim to be transparent about how data is handled.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">2. Data Storage</h2>
                        <p>
                            <strong>Music Files:</strong> Harp does not store your music files on its servers. Audio is streamed directly
                            from your Google Drive to your browser.
                        </p>
                        <p className="mt-4">
                            <strong>Local Cache:</strong> To improve performance, Harp uses browser-based storage (IndexedDB) to
                            cache song metadata, playlist information, and small thumbnails. This data remains on your device.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">3. Google Drive Permissions</h2>
                        <p>
                            Harp requests "drive.file" scope, which allows us to view and manage files that you explicitly
                            open with or create via this application. We use this to index your music library and save generated
                            lyrics or playlist updates back to your Drive.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">4. Third-Party Services</h2>
                        <p>
                            We may use third-party APIs (like OpenAI or Google Gemini) for AI-powered lyric transcription.
                            Only the audio data is sent to these services for processing; no personal identifyable information
                            is shared.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">5. Contact</h2>
                        <p>
                            If you have questions about this policy, please contact us at support@harp-music.app.
                        </p>
                    </section>
                </div>

                <div className="mt-20 pt-8 border-t border-white/5 text-center text-white/20 text-xs">
                    Last updated: January 2, 2026
                </div>
            </div>
        </div>
    );
}
