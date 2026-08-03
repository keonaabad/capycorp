const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_LENGTH = 500;

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface TavilySearchResponse {
  results?: { title?: unknown; url?: unknown; content?: unknown }[];
}

function requireTavilyApiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error(
      "TAVILY_API_KEY is not set. Add it to .env — see console.tavily.com.",
    );
  }
  return key;
}

/**
 * A real web search via Tavily, capped/truncated so a broad query doesn't
 * blow up token usage across a multi-turn tool loop. A successful call
 * with no results is `[]`, not an error — only the request itself failing
 * (network, auth, timeout, non-2xx) throws.
 */
export async function webSearch(query: string): Promise<WebSearchResult[]> {
  const apiKey = requireTavilyApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: MAX_RESULTS,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Web search timed out.");
    }
    throw new Error("Web search request failed — could not reach Tavily.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Tavily rate limit exceeded.");
    }
    throw new Error(`Web search failed with status ${response.status}.`);
  }

  const body = (await response.json()) as TavilySearchResponse;
  const results = Array.isArray(body.results) ? body.results : [];

  return results.slice(0, MAX_RESULTS).map((result) => ({
    title: typeof result.title === "string" ? result.title : "",
    url: typeof result.url === "string" ? result.url : "",
    snippet:
      typeof result.content === "string"
        ? result.content.slice(0, MAX_SNIPPET_LENGTH)
        : "",
  }));
}
