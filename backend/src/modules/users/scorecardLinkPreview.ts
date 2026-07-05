const ALLOWED_SCORECARD_HOSTS = ["cricheroes.in", "cricclubs.com", "espncricinfo.com", "cricbuzz.com"];

const MAX_REDIRECTS = 2;
const MAX_BODY_BYTES = 200_000;
const FETCH_TIMEOUT_MS = 5000;

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_SCORECARD_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

async function readCappedBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let out = "";
  let received = 0;
  while (received < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return out;
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(re) ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
  return match?.[1] ?? null;
}

export interface ScorecardPreview {
  source: string;
  title: string | null;
  image: string | null;
}

export async function fetchScorecardPreview(rawUrl: string): Promise<ScorecardPreview> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { source: rawUrl, title: null, image: null };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { source: url.hostname, title: null, image: null };
  }

  const fallback: ScorecardPreview = { source: url.hostname.replace(/^www\./, ""), title: null, image: null };
  if (!isAllowedHost(url.hostname)) return fallback;

  let currentUrl = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(currentUrl.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) return fallback;
        const nextUrl = new URL(location, currentUrl);
        if (!isAllowedHost(nextUrl.hostname)) return fallback;
        currentUrl = nextUrl;
        continue;
      }

      if (!res.ok) return fallback;

      const html = await readCappedBody(res);
      const title = extractMeta(html, "og:title");
      const image = extractMeta(html, "og:image");
      return { source: fallback.source, title, image };
    }
    return fallback;
  } catch {
    return fallback;
  }
}
