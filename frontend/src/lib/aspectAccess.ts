export const ASPECT_ACCESS_TOKEN_KEY = "aspectAccessToken";

export function getAspectAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ASPECT_ACCESS_TOKEN_KEY);
}

export function setAspectAccessToken(token: string): void {
  localStorage.setItem(ASPECT_ACCESS_TOKEN_KEY, token);
  window.dispatchEvent(new Event("aspect-access-changed"));
}

export function clearAspectAccessToken(): void {
  localStorage.removeItem(ASPECT_ACCESS_TOKEN_KEY);
  window.dispatchEvent(new Event("aspect-access-changed"));
}

export async function verifyAspectAccessToken(apiUrl: string, token: string): Promise<boolean> {
  const base = apiUrl.replace(/\/?$/, "");
  const response = await fetch(`${base}/payments/aspect/status?token=${encodeURIComponent(token)}`);
  if (!response.ok) return false;
  const data = (await response.json()) as { unlocked?: boolean };
  return Boolean(data.unlocked);
}
