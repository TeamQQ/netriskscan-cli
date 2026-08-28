import { NetRiskScanApiError, NetRiskScanConfigError, NetRiskScanNetworkError } from "./errors.js";
import { generateRequestId, isValidRequestId, parseQuota, parseRateLimit } from "./headers.js";
import { computeBackoffMs, isRetryableFailure, sleep } from "./retry.js";
import type { AnonymousLimitInfo } from "./errors.js";
import type {
  ApiErrorBody,
  ApiResult,
  IpRiskResponse,
  NetRiskScanClientOptions,
  RequestOptions,
  UsageResponse,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.netriskscan.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function safeJson(res: Response): Promise<ApiErrorBody | undefined> {
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return undefined;
  }
}

/**
 * Lifts the anonymous-trial fields off an error body, once, here. HTTP bodies are parsed in the
 * client layer only - the output layer receives a typed error, never JSON.
 */
function parseAnonymousLimitInfo(body: ApiErrorBody | undefined): AnonymousLimitInfo | undefined {
  const error = body?.error;
  if (!error) return undefined;
  const { dailyLimit, used, remaining, resetAt, signupUrl } = error;
  if (
    dailyLimit === undefined &&
    used === undefined &&
    remaining === undefined &&
    resetAt === undefined &&
    signupUrl === undefined
  ) {
    return undefined;
  }
  return { dailyLimit, used, remaining, resetAt, signupUrl };
}

/**
 * Client for the NetRiskScan Developer API (`/v1/*` only).
 *
 * Works with no configuration at all: without an API key it sends no `Authorization` header and
 * the server serves the request from the anonymous daily trial, metered by public IP.
 *
 * @example Anonymous - no account, no key
 * ```ts
 * const client = new NetRiskScanClient();
 * const { data } = await client.checkIp("1.1.1.1");
 * console.log(data.risk.index);
 * console.log(data.usage?.remaining);
 * ```
 *
 * @example Pass `apiKey` to use Developer Account quota instead of the anonymous trial
 * ```ts
 * const client = new NetRiskScanClient({ apiKey: process.env.NETRISKSCAN_API_KEY });
 * ```
 */
export class NetRiskScanClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: NetRiskScanClientOptions = {}) {
    // An absent key is a supported mode, not a misconfiguration: it selects the anonymous trial.
    this.apiKey = options.apiKey || undefined;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async checkIp(ip: string, options: RequestOptions = {}): Promise<ApiResult<IpRiskResponse>> {
    return this.request<IpRiskResponse>(`/v1/ip-risk/${encodeURIComponent(ip)}`, options);
  }

  /**
   * Account plan, billing period and quota. Unlike {@link checkIp} this is account data, so it
   * has no anonymous equivalent and requires an API key.
   */
  async getUsage(options: RequestOptions = {}): Promise<ApiResult<UsageResponse>> {
    if (!this.apiKey) {
      throw new NetRiskScanConfigError("An API key is required to query account usage.");
    }
    return this.request<UsageResponse>("/v1/usage", options);
  }

  private async request<T>(path: string, options: RequestOptions): Promise<ApiResult<T>> {
    const requestId =
      options.requestId && isValidRequestId(options.requestId)
        ? options.requestId
        : generateRequestId();

    let attempt = 0;

    while (true) {
      const timeoutController = new AbortController();
      const timer = setTimeout(() => timeoutController.abort(), this.timeout);
      const onExternalAbort = (): void => timeoutController.abort();
      options.signal?.addEventListener("abort", onExternalAbort);

      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
          "X-Request-Id": requestId,
        };
        // Only ever sent when a key actually exists. A `Bearer undefined` would read as a bad key
        // and earn a 401 instead of falling through to the anonymous trial.
        if (this.apiKey) {
          headers.Authorization = `Bearer ${this.apiKey}`;
        }

        const res = await fetch(`${this.baseUrl}${path}`, {
          method: "GET",
          headers,
          signal: timeoutController.signal,
        });

        const rateLimit = parseRateLimit(res.headers);
        const quota = parseQuota(res.headers);
        const responseRequestId = res.headers.get("x-request-id") ?? requestId;

        if (res.ok) {
          const data = (await res.json()) as T;
          return { data, meta: { requestId: responseRequestId, rateLimit, quota } };
        }

        const body = await safeJson(res);
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfter = retryAfterHeader !== null ? Number(retryAfterHeader) : undefined;

        if (isRetryableFailure(res.status, body?.error?.code) && attempt < this.maxRetries) {
          attempt += 1;
          await sleep(computeBackoffMs(attempt, retryAfter));
          continue;
        }

        throw new NetRiskScanApiError(body?.error?.message ?? res.statusText, {
          status: res.status,
          code: body?.error?.code ?? "unknown_error",
          requestId: body?.error?.requestId ?? responseRequestId,
          retryAfter,
          anonymousUsage: parseAnonymousLimitInfo(body),
        });
      } catch (err) {
        if (err instanceof NetRiskScanApiError) {
          throw err;
        }
        if (isAbortError(err)) {
          if (options.signal?.aborted) {
            throw err;
          }
          throw new NetRiskScanNetworkError(`Request timed out after ${this.timeout}ms`, {
            cause: err,
            requestId,
          });
        }
        throw new NetRiskScanNetworkError(
          err instanceof Error ? err.message : "Network request failed",
          {
            cause: err,
            requestId,
          },
        );
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onExternalAbort);
      }
    }
  }
}
