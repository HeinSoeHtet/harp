# Local Music Storage & Processing

Harp is designed to work efficiently with local files, using modern browser APIs to provide a desktop-like experience.

## 1. Storage Backend: IndexedDB

Harp uses **IndexedDB** instead of `localStorage` because:
1. It supports large binary blobs (audio files).
2. It is asynchronous, preventing UI thread blocking.
3. Storage limits are much higher (usually GBs depending on the browser).

We use `idb-keyval` for a simplified Promise-based API.

### Storage Keys:
- `songs`: An array of song objects including their binary data.
- `playlists`: User-created playlist configurations.
- `settings`: App-wide configuration (theme, volume, etc.).

## 2. Metadata Extraction

When a song is added to the library:
1. The binary blob is passed to `music-metadata-browser`.
2. Tags like Title, Artist, Album, and Year are extracted.
3. Embedded cover art is extracted as a `Uint8Array` and converted to a `Blob URL` for display.

## 3. Playback Pipeline

1. The song is retrieved from IndexedDB as a `Blob` or `Uint8Array`.
2. A `URL.createObjectURL(blob)` is generated.
3. The URL is passed to the HTML5 `<audio>` element for playback.
4. To save memory, Object URLs are revoked when the song is no longer needed or the application is closed.

## 4. Audio Conversion (FFmpeg.wasm)

For incompatible formats, Harp uses FFmpeg compiled to WebAssembly.

- **Working Directory:** FFmpeg uses a virtual filesystem (MEMFS) in the browser memory.
- **Workflow:**
  ```
  File -> FFmpeg FS -> Process -> Output Blob -> Download/Save
  ```
- **Performance:** Since this runs in a Web Worker, it doesn't block the UI, but it is CPU-intensive.
