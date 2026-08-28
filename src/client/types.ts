export type RiskBand = "excellent" | "good" | "fair" | "poor" | "high_risk" | "unknown";

export type AssessmentGrade = "complete" | "partial" | "limited" | "insufficient";

/**
 * Response of `GET /v1/ip-risk/{ip}`.
 *
 * `network.type` / `network.connectionType` are intentionally `string | null`
 * rather than closed enums: the server may add new classifications over time.
 */
export interface IpRiskResponse {
  requestId: string;
  risk: {
    index: number | null;
    band: RiskBand | null;
    assessmentGrade: AssessmentGrade;
  };
  network: {
    type: string | null;
    /**
     * What this network is for - `search_crawler`, `public_dns_resolver`, `cdn_edge`, ...
     *
     * Absent (key omitted) unless NetRiskScan holds its own record covering the address, so this must be
     * read defensively: older servers never send it. Deliberately `string` and not a union - the server
     * adds values as official sources are onboarded, and an unknown one must render, not throw.
     */
    profile?: string | null;
    /**
     * The specific service - `Applebot`, `Googlebot`, `Google Public DNS`. Absent unless matched.
     *
     * Display text, not an identifier: it is the registered source's name and can be reworded. Branch on
     * {@link profile} instead. A value here means the address was found in a range list the operator
     * itself publishes - never that its ASN merely looked like a crawler's.
     */
    service?: string | null;
    connectionType: string | null;
    asn: string | null;
    organization: string | null;
  };
  flags: {
    proxy: boolean | null;
    vpn: boolean | null;
    tor: boolean | null;
    datacenter: boolean | null;
    scanner: boolean | null;
    abuse: boolean | null;
  };
  /**
   * Access mode and, for the anonymous trial, how much of today's allowance is left.
   *
   * Optional on purpose: older servers omit it, and an API-key request need not carry the
   * same shape. Read it defensively and never recompute `remaining` from `dailyLimit - used`
   * - the server is the only authority on what the caller may still spend.
   */
  usage?: RequestUsage;
}

/**
 * Per-request usage reported by the server.
 *
 * `mode` is deliberately `string`, not a union: the server may introduce further modes and an
 * unrecognised one must render, not throw. The anonymous trial reports `"anonymous"`.
 */
export interface RequestUsage {
  mode: string;
  dailyLimit?: number;
  used?: number;
  /** Requests still available to this caller. Authoritative - never derive it client-side. */
  remaining?: number;
  /** ISO-8601 instant at which the allowance resets. The anonymous trial resets on the UTC day. */
  resetAt?: string;
}

export type RiskFlagName = keyof IpRiskResponse["flags"];

/** Response of `GET /v1/usage`. */
export interface UsageResponse {
  plan: string;
  period: {
    start: string;
    end: string;
  };
  units: {
    used: number;
    limit: number;
    remaining: number;
  };
  rateLimit: {
    requestsPerMinute: number;
  };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;

    /**
     * Sent with `anonymous_daily_limit_reached`. All optional so an older server, or any other
     * error code, still parses into the same shape.
     */
    dailyLimit?: number;
    used?: number;
    remaining?: number;
    resetAt?: string;
    signupUrl?: string;
  };
}

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
}

export interface QuotaInfo {
  limit?: number;
  used?: number;
  remaining?: number;
}

export interface ResponseMeta {
  requestId: string;
  rateLimit: RateLimitInfo;
  quota: QuotaInfo;
}

export interface ApiResult<T> {
  data: T;
  meta: ResponseMeta;
}

export interface NetRiskScanClientOptions {
  /**
   * Developer API key. Omit it to use the anonymous trial: no `Authorization` header is sent and
   * the server meters the caller by public IP. Required only for account-level endpoints.
   */
  apiKey?: string;
  /** Override the API base URL. Defaults to https://api.netriskscan.com. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 10000. */
  timeout?: number;
  /** Maximum automatic retries for 429/503 responses. Defaults to 3. */
  maxRetries?: number;
}

export interface RequestOptions {
  /** Must match ^req_[A-Za-z0-9_-]{8,56}$, otherwise a new one is generated. */
  requestId?: string;
  signal?: AbortSignal;
}
