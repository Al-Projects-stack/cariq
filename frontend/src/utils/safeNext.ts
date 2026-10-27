/**
 * Post-login redirect target from ?next=. Only same-site paths are allowed,
 * so a crafted link can't bounce a freshly signed-in user to another site.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw;
}
