/**
 * Hand-picked demo videos, by exact exercise name (as in exercises.ts) → YouTube video ID.
 * The ID is the part after "v=" in a YouTube link, e.g. youtube.com/watch?v=ABC123 → "ABC123".
 * Exercises without an entry link to a YouTube search for form videos instead.
 */
export const VIDEOS: Partial<Record<string, string>> = {
  // "Back Squat": "VIDEO_ID",
};

export function videoSearchUrl(exercise: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise} exercise proper form`)}`;
}

export function videoEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
}

export function videoWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}
