export const KNOWN_ERROR_CODES = [
  "invalid_ip",
  "invalid_request",
  "unsupported_parameter",
  "invalid_api_key",
  "api_key_disabled",
  "scope_not_allowed",
  "not_found",
  "feature_not_available",
  "rate_limit_exceeded",
  "quota_exceeded",
  "temporarily_unavailable",
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

export class NetRiskScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetRiskScanError";
  }
}

/** Thrown for client-side configuration problems, e.g. a missing API key. */
export class NetRiskScanConfigError extends NetRiskScanError {
  constructor(message: string) {
    super(message);
    this.name = "NetRiskScanConfigError";
  }
}

export interface NetRiskScanApiErrorOptions {
  status: number;
  code: string;
  requestId?: string;
  retryAfter?: number;
}

/** Thrown when the Developer API responds with a non-2xx status. */
export class NetRiskScanApiError extends NetRiskScanError {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(message: string, options: NetRiskScanApiErrorOptions) {
    super(message);
    this.name = "NetRiskScanApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
  }
}

export interface NetRiskScanNetworkErrorOptions {
  cause?: unknown;
  requestId?: string;
}

/** Thrown for transport-level failures: timeouts, DNS errors, connection resets, etc. */
export class NetRiskScanNetworkError extends NetRiskScanError {
  override readonly cause?: unknown;
  readonly requestId?: string;

  constructor(message: string, options: NetRiskScanNetworkErrorOptions = {}) {
    super(message);
    this.name = "NetRiskScanNetworkError";
    this.cause = options.cause;
    this.requestId = options.requestId;
  }
}
