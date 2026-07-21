const cache = new Map<string, string>();

export async function extractDominantColor(
  imageUrl: string
): Promise<string> {
  if (cache.has(imageUrl)) return cache.get(imageUrl)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(defaultFallback(imageUrl));

      const w = 64;
      const h = 64;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      const hex = `rgb(${r},${g},${b})`;
      cache.set(imageUrl, hex);
      resolve(hex);
    };

    img.onerror = () => {
      resolve(defaultFallback(imageUrl));
    };
  });
}

function defaultFallback(_url: string): string {
  return "rgba(139, 92, 246, 0.15)";
}

export function getDominantFromCache(url: string): string | null {
  return cache.get(url) ?? null;
}