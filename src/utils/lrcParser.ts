export interface LyricLine {
  time: number; // Start time in seconds
  text: string;
}

// Remvoed parseSRT

// Helper: [mm:ss.xx] -> seconds
function parseLRCTime(timeString: string): number {
  if (!timeString) return 0;
  // Remove brackets
  const clean = timeString.replace("[", "").replace("]", "");
  const parts = clean.split(":");

  if (parts.length >= 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

export function parseLRC(lrcContent: string): LyricLine[] {
  const lines = lrcContent.trim().split("\n");
  const lyrics: LyricLine[] = [];
  const timeRegex = /\[\d{2}:\d{2}\.\d{2,3}\]/g;

  for (const line of lines) {
    const matches = line.match(timeRegex);
    if (!matches) continue;

    const text = line.replace(timeRegex, "").trim();

    // LRC lines can have multiple timestamps for the same text
    // e.g. [01:00.00][02:00.00] Chorus
    for (const timeStr of matches) {
      lyrics.push({
        time: parseLRCTime(timeStr),
        text
      });
    }
  }

  // Sort by time in case of multiple timestamps
  return lyrics.sort((a, b) => a.time - b.time);
}
