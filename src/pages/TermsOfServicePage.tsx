import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export function TermsOfServicePage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 selection:bg-purple-500/30">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-12 group"
                >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    Back
                </button>

                <h1 className="text-4xl font-black mb-8">Terms of Service</h1>

                <div className="space-y-8 text-white/70 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                        <p>
                            By accessing and using Harp, you agree to be bound by these Terms of Service.
                            Harp provides a web interface for interacting with your Google Drive music library.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">2. User Responsibility</h2>
                        <p>
                            You are solely responsible for the content you store in your Google Drive and access through Harp.
                            You must ensure that your use of the service complies with all applicable copyright laws and
                            Google's own Terms of Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">3. No Warranty</h2>
                        <p>
                            Harp is provided "as is" without any warranties of any kind. We do not guarantee that
                            the service will be uninterrupted or error-free. We are not responsible for any data loss
                            that may occur in your Google Drive.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">4. Limitations of Liability</h2>
                        <p>
                            In no event shall Harp be liable for any damages arising out of the use or inability to
                            use the service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4">5. Modifications</h2>
                        <p>
                            We reserve the right to modify these terms at any time. Your continued use of the service
                            after changes constitutes acceptance of the new terms.
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
