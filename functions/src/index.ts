import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";
import { google } from "googleapis";
import { FieldValue } from "firebase-admin/firestore";


admin.initializeApp();

// Set global options (Max instances prevents run-away costs)
setGlobalOptions({ maxInstances: 10 });

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

/**
 * Helper to get the authenticated user, supporting production tokens in the emulator.
 */
async function getAuthenticatedUser(request: CallableRequest<any>) {
    if (request.auth) return request.auth;

    if (isEmulator) {
        const authHeader = request.rawRequest.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const idToken = authHeader.split("Bearer ")[1];
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                return {
                    uid: decodedToken.uid,
                    token: decodedToken as any
                };
            } catch (e: any) {
                console.warn("Manual token verification failed in emulator. Is the project ID correct?", e.message);
            }
        }
    }
    return null;
}

const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const CLIENT_ID = process.env.DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET;
const REDIRECT_URI = "postmessage";

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);


interface GetDriveTokenResponse {
    accessToken: string;
}

interface SaveDriveTokenResponse {
    accessToken: string;
    success: boolean;
}

interface SaveDriveTokenData {
    code: string;
}

export const saveDriveToken = onCall(
    { cors: !isEmulator },
    async (request: CallableRequest<SaveDriveTokenData>): Promise<SaveDriveTokenResponse> => {
        logger.info("saveDriveToken check:", {
            hasAuth: !!request.auth,
            uid: request.auth?.uid,
        });

        const auth = isEmulator ? await getAuthenticatedUser(request) : request.auth;

        if (!auth) {
            logger.warn("Request rejected: Unauthenticated");
            throw new HttpsError("unauthenticated", "User must be logged in.");
        }

        const { code } = request.data;
        if (!code) {
            throw new HttpsError("invalid-argument", "Authorization code is missing.");
        }

        try {
            // 1. Exchange the code. This returns BOTH tokens.
            const { tokens } = await oauth2Client.getToken(code);

            // 2. If we got a Refresh Token (Permanent), save it.
            if (tokens.refresh_token) {
                await admin.firestore()
                    .collection("user_secrets")
                    .doc(auth.uid)
                    .set({
                        drive_refresh_token: tokens.refresh_token,
                        updatedAt: FieldValue.serverTimestamp(),
                    }, { merge: true });
            } else {
                console.warn("No refresh token returned (User might have already authorized).");
            }

            // 3. Verify we actually have an access token to give back
            if (!tokens.access_token) {
                throw new HttpsError("internal", "Google did not return an access token.");
            }

            // 4. Return the access token immediately so the client can start working
            return {
                success: true,
                accessToken: tokens.access_token
            };

        } catch (error) {
            console.error("Token exchange failed:", error);
            throw new HttpsError("internal", "Failed to connect Google Drive.");
        }
    }
);

export const getDriveToken = onCall(
    { cors: !isEmulator },
    async (request: CallableRequest<void>): Promise<GetDriveTokenResponse> => {
        logger.info("getDriveToken check:", {
            hasAuth: !!request.auth,
            uid: request.auth?.uid,
        });

        const auth = isEmulator ? await getAuthenticatedUser(request) : request.auth;

        // 1. Security Check
        if (!auth) {
            logger.warn("Request rejected: Unauthenticated");
            throw new HttpsError("unauthenticated", "User must be logged in.");
        }

        try {
            // 2. Read from root collection 'user_secrets' -> doc(UID)
            const docSnap = await admin.firestore()
                .collection("user_secrets")
                .doc(auth.uid)
                .get();

            if (!docSnap.exists) {
                throw new HttpsError("failed-precondition", "Drive not connected.");
            }

            const data = docSnap.data();
            const refreshToken = data?.drive_refresh_token;

            if (!refreshToken) {
                throw new HttpsError("failed-precondition", "Token missing in record.");
            }

            // 3. Refresh the token
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            // The SDK handles the refresh logic automatically here
            const response = await oauth2Client.getAccessToken();
            const token = response.token;

            if (!token) {
                throw new HttpsError("internal", "Failed to retrieve access token.");
            }

            // 4. Return only the temporary access token
            return { accessToken: token };

        } catch (error: any) {
            console.error("Get Token Error:", error);

            // Auto-cleanup: If token is invalid (revoked), delete it so client knows to re-auth
            if (error.message && error.message.includes("invalid_grant")) {
                await admin.firestore()
                    .collection("user_secrets")
                    .doc(auth.uid)
                    .delete();

                throw new HttpsError("permission-denied", "Connection expired. Please reconnect Drive.");
            }

            throw new HttpsError("internal", "Unable to refresh token.");
        }
    }
);

export const transcribeSong = onCall(
    {
        timeoutSeconds: 300,
        memory: "512MiB",    // Optimized for ~5MB files
        cors: !isEmulator,          // Allow client calls
    },
    async (request) => {
        const auth = isEmulator ? await getAuthenticatedUser(request) : request.auth;
        if (!auth) {
            throw new HttpsError("unauthenticated", "User must be logged in.");
        }

        const { audioBase64, mimeType, model, duration } = (request.data as any);
        if (!audioBase64) {
            throw new HttpsError("invalid-argument", "Missing audio data.");
        }

        // 5-Minute Duration Limit Check
        if (duration && duration > 300) {
            throw new HttpsError("invalid-argument", "Song exceeds 5-minute limit.");
        }

        // 8MB Limit Check (Base64 length * 0.75 approx)
        const estimatedSize = audioBase64.length * 0.75;
        if (estimatedSize > 8 * 1024 * 1024) {
            throw new HttpsError("invalid-argument", "Payload exceeds 8MB limit.");
        }

        // --- Rate Limiting Check (10 calls/user, daily refresh) ---
        const usageRef = admin.firestore().collection("user_usage").doc(auth.uid);

        await admin.firestore().runTransaction(async (transaction) => {
            const usageDoc = await transaction.get(usageRef);
            const data = usageDoc.data();

            let currentCount = data?.transcribe_count || 0;
            const lastCalledAt = data?.lastCalledAt?.toDate() || null;

            const now = new Date();

            // Check if it's a new day (UTC Midnight reset)
            const isNewDay = !lastCalledAt ||
                now.getUTCFullYear() !== lastCalledAt.getUTCFullYear() ||
                now.getUTCMonth() !== lastCalledAt.getUTCMonth() ||
                now.getUTCDate() !== lastCalledAt.getUTCDate();

            if (isNewDay) {
                currentCount = 0;
            }

            if (currentCount >= 10) {
                throw new HttpsError("resource-exhausted", "Daily limit of 10 transcriptions reached. Please try again tomorrow.");
            }

            // Determine the new count value
            const newCount = currentCount + 1;

            // Update usage stats atomically
            transaction.set(usageRef, {
                transcribe_count: newCount,
                lastCalledAt: FieldValue.serverTimestamp()
            }, { merge: true });
        });
        // ---------------------------------------------------------

        const buffer = Buffer.from(audioBase64, "base64");
        let text = "";

        try {
            if (model === "gpt-4o-transcribe") {
                if (!openaiApiKey) throw new Error("OpenAI API Key missing.");

                const openai = new OpenAI({ apiKey: openaiApiKey });

                text = await openai.audio.transcriptions.create({
                    file: await OpenAI.toFile(buffer, "audio.mp3", { type: mimeType || "audio/mp3" }),
                    model: "gpt-4o-transcribe",
                    response_format: "text",
                    prompt: "A clean transcription of song lyrics. No timestamps. No labels. Only the words.",
                });

                text = text.trim();
            }
            else if (model === "gemini") {
                if (!geminiApiKey) throw new Error("Gemini API Key missing.");

                const genAI = new GoogleGenerativeAI(geminiApiKey);
                const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                const result = await geminiModel.generateContent([
                    "A clean transcription of song lyrics. No timestamps. No labels. Only the words.",
                    {
                        inlineData: {
                            mimeType: mimeType || "audio/mp3",
                            data: audioBase64
                        }
                    }
                ]);

                text = result.response.text();
            }
            else {
                throw new HttpsError("invalid-argument", "Unknown model requested.");
            }

            if (!text) {
                return [{ time: 0, text: "No lyrics detected." }];
            }

            // Return as sequential lines split by newlines or sentence boundaries
            const lines = text.split(/[\n\r]|(?<=[.!?])\s+/)
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => ({
                    time: 0,
                    text: line
                }));

            return lines;

        } catch (error: any) {
            logger.error("Transcription Error:", error);
            throw new HttpsError("internal", "Transcription failed: " + error.message);
        }
    }
);


