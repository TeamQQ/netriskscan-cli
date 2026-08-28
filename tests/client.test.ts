import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NetRiskScanClient } from "../src/client/NetRiskScanClient.js";
import {
  NetRiskScanApiError,
  NetRiskScanConfigError,
  NetRiskScanNetworkError,
} from "../src/client/errors.js";
import { mockResponse } from "./helpers.js";

function successBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requestId: "req_abc",
    risk: { index: 72, band: "good", assessmentGrade: "complete" },
    network: {
      type: "residential",
      connectionType: "isp",
      asn: "AS4134",
      organization: "China Telecom",
    },
    flags: {
      proxy: false,
      vpn: false,
      tor: false,
      datacenter: false,
      scanner: false,
      abuse: false,
    },
    ...overrides,
  };
}

describe("NetRiskScanClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("constructs with no options at all, selecting the anonymous trial", () => {
    expect(() => new NetRiskScanClient()).not.toThrow();
    expect(() => new NetRiskScanClient({ apiKey: "" })).not.toThrow();
  });

  /**
   * The header must be absent, not empty and not `Bearer undefined`: the server reads any
   * Authorization header as a key attempt and answers 401 instead of serving the anonymous trial.
   */
  it("sends no Authorization header when no API key is configured", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(mockResponse(200, successBody()));
    const client = new NetRiskScanClient();
    await client.checkIp("8.8.8.8");

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.netriskscan.com/v1/ip-risk/8.8.8.8");
    expect(Object.keys(init.headers)).not.toContain("Authorization");
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.stringify(init.headers)).not.toContain("Bearer");
    expect(init.headers.Accept).toBe("application/json");
    expect(init.headers["X-Request-Id"]).toMatch(/^req_/);
  });

  it("exposes the server-reported anonymous allowance verbatim", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(
        200,
        successBody({
          usage: {
            mode: "anonymous",
            dailyLimit: 30,
            used: 7,
            remaining: 23,
            resetAt: "2026-08-29T00:00:00Z",
          },
        }),
      ),
    );

    const { data } = await new NetRiskScanClient().checkIp("8.8.8.8");

    expect(data.usage?.mode).toBe("anonymous");
    expect(data.usage?.remaining).toBe(23);
    expect(data.usage?.dailyLimit).toBe(30);
    expect(data.usage?.resetAt).toBe("2026-08-29T00:00:00Z");
  });

  it("tolerates a response from a server that does not report usage at all", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, successBody()));
    const { data } = await new NetRiskScanClient().checkIp("8.8.8.8");
    expect(data.usage).toBeUndefined();
  });

  /** Account data has no anonymous form, so this must fail before touching the network. */
  it("rejects getUsage without an API key and never calls fetch", async () => {
    const fetchMock = vi.mocked(fetch);
    const client = new NetRiskScanClient();

    await expect(client.getUsage()).rejects.toBeInstanceOf(NetRiskScanConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * The regression this whole feature hinges on. A spent daily allowance cannot come back before
   * the UTC reset, so retrying is three guaranteed-identical failures - exactly one request.
   */
  it("never retries 429 anonymous_daily_limit_reached", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      mockResponse(
        429,
        {
          error: {
            code: "anonymous_daily_limit_reached",
            message: "Anonymous daily limit reached.",
            dailyLimit: 30,
            used: 30,
            remaining: 0,
            resetAt: "2026-08-29T00:00:00Z",
            signupUrl: "https://www.netriskscan.com/developers",
          },
        },
        { "retry-after": "0" },
      ),
    );

    const client = new NetRiskScanClient({ maxRetries: 3 });
    const err = await client.checkIp("8.8.8.8").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NetRiskScanApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** The output layer must never have to reach into an HTTP body; the client lifts it out here. */
  it("carries the anonymous allowance on the thrown error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(429, {
        error: {
          code: "anonymous_daily_limit_reached",
          message: "Anonymous daily limit reached.",
          dailyLimit: 30,
          used: 30,
          remaining: 0,
          resetAt: "2026-08-29T00:00:00Z",
          signupUrl: "https://www.netriskscan.com/developers",
        },
      }),
    );

    const err = (await new NetRiskScanClient()
      .checkIp("8.8.8.8")
      .catch((e: unknown) => e)) as NetRiskScanApiError;

    expect(err.code).toBe("anonymous_daily_limit_reached");
    expect(err.anonymousUsage).toEqual({
      dailyLimit: 30,
      used: 30,
      remaining: 0,
      resetAt: "2026-08-29T00:00:00Z",
      signupUrl: "https://www.netriskscan.com/developers",
    });
  });

  it("leaves anonymousUsage undefined for an ordinary error body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(400, { error: { code: "invalid_ip", message: "bad", requestId: "req_1" } }),
    );

    const err = (await new NetRiskScanClient()
      .checkIp("bad")
      .catch((e: unknown) => e)) as NetRiskScanApiError;

    expect(err.anonymousUsage).toBeUndefined();
  });

  it("returns data and meta on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(200, successBody(), {
        "x-ratelimit-limit": "120",
        "x-ratelimit-remaining": "118",
        "x-ratelimit-reset": "1700000000",
        "x-quota-limit": "50000",
        "x-quota-used": "12450",
        "x-quota-remaining": "37550",
        "x-request-id": "req_abc",
      }),
    );

    const client = new NetRiskScanClient({ apiKey: "nrs_live_test" });
    const { data, meta } = await client.checkIp("1.1.1.1");

    expect(data.risk.index).toBe(72);
    expect(meta.rateLimit).toEqual({ limit: 120, remaining: 118, reset: 1700000000 });
    expect(meta.quota).toEqual({ limit: 50000, used: 12450, remaining: 37550 });
    expect(meta.requestId).toBe("req_abc");
  });

  it("never appends a query string", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(mockResponse(200, successBody()));
    const client = new NetRiskScanClient({ apiKey: "k" });
    await client.checkIp("1.1.1.1");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.netriskscan.com/v1/ip-risk/1.1.1.1");
    expect(url).not.toContain("?");
  });

  it("sends Authorization and X-Request-Id headers", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(mockResponse(200, successBody({ requestId: "req_x" })));
    const client = new NetRiskScanClient({ apiKey: "nrs_live_test" });
    await client.checkIp("10.0.0.1", { requestId: "req_myjob_12345678" });

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers.Authorization).toBe("Bearer nrs_live_test");
    expect(init.headers["X-Request-Id"]).toBe("req_myjob_12345678");
  });

  it("preserves index=0 and index=null instead of treating them as falsy", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      mockResponse(
        200,
        successBody({ risk: { index: 0, band: "high_risk", assessmentGrade: "complete" } }),
      ),
    );
    const client = new NetRiskScanClient({ apiKey: "k" });
    const zero = await client.checkIp("1.1.1.1");
    expect(zero.data.risk.index).toBe(0);

    fetchMock.mockResolvedValueOnce(
      mockResponse(
        200,
        successBody({ risk: { index: null, band: null, assessmentGrade: "insufficient" } }),
      ),
    );
    const unassessed = await client.checkIp("10.0.0.1");
    expect(unassessed.data.risk.index).toBeNull();
  });

  it.each([400, 401, 403, 404])("does not retry on HTTP %d", async (status) => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(
        mockResponse(status, { error: { code: "invalid_ip", message: "bad", requestId: "req_1" } }),
      );
    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 3 });

    await expect(client.checkIp("bad")).rejects.toBeInstanceOf(NetRiskScanApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])("retries HTTP %d up to maxRetries then throws", async (status) => {
    const code = status === 429 ? "rate_limit_exceeded" : "temporarily_unavailable";
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(
        mockResponse(
          status,
          { error: { code, message: "retry", requestId: "req_1" } },
          { "retry-after": "0" },
        ),
      );
    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 2 });

    await expect(client.checkIp("1.1.1.1")).rejects.toBeInstanceOf(NetRiskScanApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  /** A per-minute limit is transient; this behaviour must survive the anonymous-limit change. */
  it("still retries an ordinary 429 rate_limit_exceeded", async () => {
    // A fresh Response per call, so every attempt really re-reads the error code.
    const fetchMock = vi
      .mocked(fetch)
      .mockImplementation(() =>
        Promise.resolve(
          mockResponse(
            429,
            { error: { code: "rate_limit_exceeded", message: "slow down", requestId: "req_1" } },
            { "retry-after": "0" },
          ),
        ),
      );
    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 2 });

    await expect(client.checkIp("1.1.1.1")).rejects.toBeInstanceOf(NetRiskScanApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("succeeds after a retryable 429", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(
        mockResponse(
          429,
          { error: { code: "rate_limit_exceeded", message: "slow down", requestId: "req_1" } },
          { "retry-after": "0" },
        ),
      )
      .mockResolvedValueOnce(
        mockResponse(
          200,
          successBody({
            requestId: "req_2",
            risk: { index: 90, band: "excellent", assessmentGrade: "complete" },
          }),
        ),
      );

    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 2 });
    const { data } = await client.checkIp("1.1.1.1");

    expect(data.risk.index).toBe(90);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After before falling back to exponential backoff", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(
        429,
        { error: { code: "rate_limit_exceeded", message: "slow down", requestId: "req_1" } },
        { "retry-after": "0" },
      ),
    );
    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 1 });
    const start = Date.now();
    await expect(client.checkIp("1.1.1.1")).rejects.toBeInstanceOf(NetRiskScanApiError);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("wraps network failures in NetRiskScanNetworkError without retrying", async () => {
    const fetchMock = vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 3 });

    await expect(client.checkIp("1.1.1.1")).rejects.toBeInstanceOf(NetRiskScanNetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches usage without a query string and requires usage scope semantics server-side", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      mockResponse(200, {
        plan: "growth",
        period: { start: "2026-08-01T00:00:00Z", end: "2026-09-01T00:00:00Z" },
        units: { used: 12450, limit: 50000, remaining: 37550 },
        rateLimit: { requestsPerMinute: 120 },
      }),
    );
    const client = new NetRiskScanClient({ apiKey: "k" });
    const { data } = await client.getUsage();

    expect(data.plan).toBe("growth");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.netriskscan.com/v1/usage");
  });
});
