import type { KnownErrorCode } from "../client/errors.js";

export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArgument: 2,
  AuthError: 3,
  ApiError: 4,
  RateLimitOrQuota: 5,
  CiPolicyFailed: 6,
  AssessmentUnavailable: 7,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export function exitCodeForApiErrorCode(code: string): ExitCodeValue {
  switch (code as KnownErrorCode) {
    case "invalid_api_key":
    case "api_key_disabled":
    case "scope_not_allowed":
      return ExitCode.AuthError;
    case "rate_limit_exceeded":
    case "quota_exceeded":
      return ExitCode.RateLimitOrQuota;
    default:
      return ExitCode.ApiError;
  }
}
