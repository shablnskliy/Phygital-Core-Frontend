export type HeroImageKind = "photo" | "artwork";

const SAMPLE_SIZE = 40;
const TRANSPARENT_SHARE = 0.02;

/** Reads only the loaded raster; inaccessible external pixels keep the caller's safe fallback. */
export function detectHeroImageKind(
  image: HTMLImageElement,
  fallback: HeroImageKind,
): HeroImageKind {
  if (typeof document === "undefined" || image.naturalWidth <= 0 || image.naturalHeight <= 0)
    return fallback;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return fallback;

    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const pixelCount = pixels.length / 4;
    if (!pixelCount) return fallback;

    const threshold = Math.ceil(pixelCount * TRANSPARENT_SHARE);
    let transparent = 0;
    for (let alpha = 3; alpha < pixels.length; alpha += 4) {
      // Ignore near-opaque antialiasing; a cutout needs a meaningful transparent area.
      if (pixels[alpha] < 250 && ++transparent >= threshold) return "artwork";
    }
    return "photo";
  } catch {
    // A valid cross-origin image can render while its canvas pixels remain unreadable.
    return fallback;
  }
}
