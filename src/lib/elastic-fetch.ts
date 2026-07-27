import https from "node:https";

export interface ElasticFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface ElasticFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

/**
 * fetch() for Kibana/Elastic calls that honors a per-connection verifySsl
 * flag. Self-hosted ECK deployments serve Kibana with a self-signed cert by
 * default, so the global fetch() (which always validates strictly) fails
 * with SELF_SIGNED_CERT_IN_CHAIN unless the admin explicitly opts out.
 */
export async function elasticFetch(
  url: string,
  options: ElasticFetchOptions,
  verifySsl: boolean
): Promise<ElasticFetchResponse> {
  const timeoutMs = options.timeoutMs ?? 15000;

  if (verifySsl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
      return { ok: res.ok, status: res.status, json: () => res.json(), text: () => res.text() };
    } finally {
      clearTimeout(timeout);
    }
  }

  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: options.method || "GET",
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf-8");
          const status = res.statusCode || 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(bodyText),
            text: async () => bodyText,
          });
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
