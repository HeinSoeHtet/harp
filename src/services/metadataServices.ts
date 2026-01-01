import * as mm from "music-metadata-browser";
import { Buffer } from "buffer";

// Polyfill Buffer for the browser environment if needed by the library or utils
if (typeof window !== 'undefined' && !window.Buffer) {
    (window as any).Buffer = Buffer;
}

interface ExtractedMetadata {
    title?: string;
    artist?: string;
    album?: string;
    picture?: Blob;
    duration?: number;
}

export const MetadataServices = {
    /**
     * Extracts metadata (Id3 tags) from an audio blob.
     */
    async extractMetadata(audioBlob: Blob): Promise<ExtractedMetadata> {
        try {
            const metadata = await mm.parseBlob(audioBlob);
            const { common, format } = metadata;

            let pictureBlob: Blob | undefined = undefined;
            if (common.picture && common.picture.length > 0) {
                const pic = common.picture[0];
                pictureBlob = new Blob([new Uint8Array(pic.data)], { type: pic.format });
            }

            return {
                title: common.title,
                artist: common.artist,
                album: common.album,
                picture: pictureBlob,
                duration: format.duration,
            };
        } catch (error) {
            console.warn("Failed to extract metadata from file:", error);
            return {};
        }
    },
};
