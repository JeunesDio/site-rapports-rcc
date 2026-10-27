export const BASE_URL = import.meta.env.BASE_URL;

export function publicAsset(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, '')}`;
}

export function reportPdfUrl(path: string): string {
  return path.startsWith('http://') || path.startsWith('https://') ? path : publicAsset(path);
}
