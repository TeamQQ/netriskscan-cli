export type RiskBand = "excellent" | "good" | "fair" | "poor" | "high_risk" | "unknown";

export type AssessmentGrade = "complete" | "partial" | "limited" | "insufficient";

/**
 * Server classification of an address already flagged `proxy: true` - a documented, closed set of
 * the subtypes the server currently emits. Unlike `network.type`/`profile`, this is kept as a real
 * union rather than `string` because the CLI's own formatter needs to switch on it; that formatter
 * still renders an unrecognised raw value verbatim instead of throwing, since a runtime response is
 * never actually guaranteed to match this compile-time type.
 */
export type ProxyType =
  | "residential_proxy"
  | "isp_proxy"
  | "mobile_proxy"
  | "datacenter_proxy"
  | "unknown_proxy";

/**
 * Network-level geolocation of the address, as `GET /v1/ip-risk/{ip}` reports it.
 *
 * This is where the *network* is registered/routed - never the device's GPS position, and never
 * the end user's precise physical location. A city can be the operator's aggregation point rather
 * than the subscriber's town.
 *
 * Every field is nullable and independently so: an address can resolve to a country with no region
 * and no city. The CLI shows only what the server actually sent - a missing field is dropped, never
 * back-filled from the code, translated, re-cased, or guessed from a neighbouring field.
 *
 * Only the fields the public API documents live here. Latitude/longitude, postal code, continent
 * and accuracy radius are deliberately absent: they are not part of the `/v1` contract.
 */
export interface IpLocation {
  /** ISO 3166-1 alpha-2, e.g. `"US"`. */
  countryCode: string | null;
  /** Server-owned display name, e.g. `"United States"`. Shown verbatim. */
  country: string | null;
  /** ISO 3166-2 subdivision code without the country prefix, e.g. `"CA"`. */
  regionCode: string | null;
  /** Server-owned display name, e.g. `"California"`. Shown verbatim. */
  region: string | null;
  city: string | null;
  /** IANA time zone id, e.g. `"America/Los_Angeles"`. */
  timeZone: string | null;
}

/**
 * One server-generated explanation for the assessment.
 *
 * Reasons are *server-owned output*: the CLI renders them and never derives, infers, filters,
 * re-orders or invents one from `flags`/`network`. `flags.tor === true` in particular does not
 * imply `TOR_EXIT_NODE` - only the server can say which it is.
 *
 * Not every reason is negative. `VERIFIED_SEARCH_CRAWLER`, `PUBLIC_INFRASTRUCTURE` and
 * `RESIDENTIAL_NETWORK` explain why an address scores *well*. A reason is an explanation of the
 * assessment, never proof of malicious activity.
 *
 * All three fields are deliberately `string`, not closed unions. The vocabulary is additive: the
 * server can introduce a new code, category or severity at any time, and a CLI already installed
 * in the wild must render the unfamiliar value rather than throw, drop it, or relabel it
 * "Unknown". Known codes at the time of writing - `RESIDENTIAL_PROXY_DETECTED`, `ISP_PROXY_DETECTED`,
 * `MOBILE_PROXY_DETECTED`, `DATACENTER_PROXY_DETECTED`, `PROXY_DETECTED`, `VPN_DETECTED`,
 * `TOR_RELAY`, `TOR_EXIT_NODE`, `KNOWN_SCANNER`, `ABUSE_ACTIVITY`, `BLACKLIST_MATCH`, `BOTNET_C2`,
 * `COMPROMISED_HOST`, `VERIFIED_SEARCH_CRAWLER`, `PUBLIC_INFRASTRUCTURE`, `RESIDENTIAL_NETWORK`,
 * `CONFLICTING_EVIDENCE`, `INSUFFICIENT_EVIDENCE` - are documentation, not an exhaustive contract.
 */
export interface RiskReason {
  /** Stable machine identifier, e.g. `"RESIDENTIAL_PROXY_DETECTED"`. */
  code: string;
  /** Grouping, e.g. `"anonymity"`, `"identity"`, `"network"`, `"threat"`. */
  category: string;
  /** e.g. `"critical"`, `"high"`, `"medium"`, `"low"`, `"info"`. */
  severity: string;
}

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
    /**
     * Why the server assessed the address this way. Absent (key omitted) on a server that predates
     * the field, and legitimately `[]` on a newer one that had nothing to explain - both mean
     * "print no reasons", never "the CLI should work some out".
     *
     * Purely explanatory: {@link index}, {@link band} and {@link assessmentGrade} are already the
     * server's verdict and are never recomputed from this list.
     */
    reasons?: RiskReason[];
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
    /**
     * Subtype of an address already flagged `proxy: true`. `null` when not applicable or not
     * determined. Absent (key omitted) on a server that predates this field - read defensively,
     * the same way {@link IpRiskResponse.network}'s `profile`/`service` already are.
     */
    proxyType?: ProxyType | null;

    vpn: boolean | null;
    tor: boolean | null;
    datacenter: boolean | null;
    scanner: boolean | null;
    abuse: boolean | null;

    /**
     * Whether the server has verified this address as a known search engine crawler. Absent on a
     * server that predates this field - read defensively.
     */
    searchCrawler?: boolean | null;
    /**
     * Canonical crawler display name, e.g. `"Googlebot"`, `"Bingbot"`, `"Applebot"` - server-owned
     * and shown verbatim, never reformatted. Deliberately `string`, not a closed union: the server
     * adds crawlers as new sources are onboarded, and an unrecognised one must still render, not
     * throw. Absent on a server that predates this field - read defensively.
     */
    searchCrawlerName?: string | null;
  };
  /**
   * Network-level geolocation. Absent (key omitted) on a server that predates the field, and
   * `null` when the address could not be located at all - read defensively, exactly as
   * {@link IpRiskResponse.network}'s `profile`/`service` already are.
   */
  location?: IpLocation | null;
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
