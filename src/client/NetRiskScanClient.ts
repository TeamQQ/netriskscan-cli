import { NetRiskScanApiError, NetRiskScanConfigError, NetRiskScanNetworkError } from "./errors.js";
import { generateRequestId, isValidRequestId, parseQuota, parseRateLimit } from "./headers.js";
import { computeBackoffMs, isRetryableStatus, sleep } from "./retry.js";
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
 * Client for the NetRiskScan Developer API (`/v1/*` only).
 *
 * @example
 * ```ts
 * const client = new NetRiskScanClient({ apiKey: process.env.NETRISKSCAN_API_KEY! });
 * const { data } = await client.checkIp("1.1.1.1");
 * console.log(data.risk.index);
 * ```
 */
export class NetRiskScanClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: NetRiskScanClientOptions) {
    if (!options.apiKey) {
      throw new NetRiskScanConfigError(
        "NetRiskScan API key is required.\n\nSet NETRISKSCAN_API_KEY or use --api-key.",
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async checkIp(ip: string, options: RequestOptions = {}): Promise<ApiResult<IpRiskResponse>> {
    return this.request<IpRiskResponse>(`/v1/ip-risk/${encodeURIComponent(ip)}`, options);
  }

  async getUsage(options: RequestOptions = {}): Promise<ApiResult<UsageResponse>> {
    return this.request<UsageResponse>("/v1/usage", options);
  }

  private async request<T>(path: string, options: RequestOptions): Promise<ApiResult<T>> {
    const requestId =
      options.requestId && isValidRequestId(options.requestId) ? options.requestId : generateRequestId();

    let attempt = 0;

    while (true) {
      const timeoutController = new AbortController();
      const timer = setTimeout(() => timeoutController.abort(), this.timeout);
      const onExternalAbort = (): void => timeoutController.abort();
      options.signal?.addEventListener("abort", onExternalAbort);

      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
            "X-Request-Id": requestId,
          },
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

        if (isRetryableStatus(res.status) && attempt < this.maxRetries) {
          attempt += 1;
          await sleep(computeBackoffMs(attempt, retryAfter));
          continue;
        }

        throw new NetRiskScanApiError(body?.error?.message ?? res.statusText, {
          status: res.status,
          code: body?.error?.code ?? "unknown_error",
          requestId: body?.error?.requestId ?? responseRequestId,
          retryAfter,
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
        throw new NetRiskScanNetworkError(err instanceof Error ? err.message : "Network request failed", {
          cause: err,
          requestId,
        });
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onExternalAbort);
      }
    }
  }
}
