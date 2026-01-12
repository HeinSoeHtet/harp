# Cloud Functions API Documentation

Harp uses Firebase Cloud Functions (v2) to handle sensitive operations and AI integrations.

## 1. Google Drive Integration

### `saveDriveToken`
Exchanges an authorization code for tokens and saves the refresh token securely.

- **Parameters:**
  - `code`: (string) The Google OAuth2 authorization code.
- **Returns:**
  - `success`: (boolean)
  - `accessToken`: (string) A temporary access token.
- **Security:** `enforceAppCheck: true`

### `getDriveToken`
Retrieves a fresh access token using the stored refresh token.

- **Parameters:** None
- **Returns:**
  - `accessToken`: (string) A fresh access token.
- **Security:** `enforceAppCheck: true`

## 2. AI Services

### `transcribeSong`
Transcribes lyrics from an audio file.

- **Parameters:**
  - `audioBase64`: (string) Base64 encoded audio data.
  - `mimeType`: (string) Mime type of the audio (e.g., `audio/mp3`).
  - `model`: (`"gpt-4o-transcribe"` | `"gemini"`) The AI model to use.
  - `duration`: (number) Audio duration in seconds.
- **Constraints:**
  - Max duration: 300 seconds (5 minutes).
  - Max payload: 8MB.
  - Rate Limit: 10 calls per user per day.
- **Returns:**
  - Array of objects: `[{ time: 0, text: "Lyric line..." }]`
- **Security:** `enforceAppCheck: true`

## 3. Data Structures

### Firestore Collections

- **`user_secrets/{uid}`**:
  - `drive_refresh_token`: (string) Encrypted/Securely stored refresh token.
  - `updatedAt`: (timestamp)

- **`user_usage/{uid}`**:
  - `transcribe_count`: (number) Count of transcriptions today.
  - `lastCalledAt`: (timestamp) Last time transcription was used.
