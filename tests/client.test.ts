import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NetRiskScanClient } from "../src/client/NetRiskScanClient.js";
import { NetRiskScanApiError, NetRiskScanConfigError, NetRiskScanNetworkError } from "../src/client/errors.js";
import { mockResponse } from "./helpers.js";

function successBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requestId: "req_abc",
    risk: { index: 72, band: "good", assessmentGrade: "complete" },
    network: { type: "residential", connectionType: "isp", asn: "AS4134", organization: "China Telecom" },
    flags: { proxy: false, vpn: false, tor: false, datacenter: false, scanner: false, abuse: false },
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

  it("throws NetRiskScanConfigError when apiKey is missing", () => {
    expect(() => new NetRiskScanClient({ apiKey: "" })).toThrow(NetRiskScanConfigError);
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

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe("Bearer nrs_live_test");
    expect(init.headers["X-Request-Id"]).toBe("req_myjob_12345678");
  });

  it("preserves index=0 and index=null instead of treating them as falsy", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(mockResponse(200, successBody({ risk: { index: 0, band: "high_risk", assessmentGrade: "complete" } })));
    const client = new NetRiskScanClient({ apiKey: "k" });
    const zero = await client.checkIp("1.1.1.1");
    expect(zero.data.risk.index).toBe(0);

    fetchMock.mockResolvedValueOnce(
      mockResponse(200, successBody({ risk: { index: null, band: null, assessmentGrade: "insufficient" } })),
    );
    const unassessed = await client.checkIp("10.0.0.1");
    expect(unassessed.data.risk.index).toBeNull();
  });

  it.each([400, 401, 403, 404])("does not retry on HTTP %d", async (status) => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(mockResponse(status, { error: { code: "invalid_ip", message: "bad", requestId: "req_1" } }));
    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 3 });

    await expect(client.checkIp("bad")).rejects.toBeInstanceOf(NetRiskScanApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])("retries HTTP %d up to maxRetries then throws", async (status) => {
    const code = status === 429 ? "rate_limit_exceeded" : "temporarily_unavailable";
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(mockResponse(status, { error: { code, message: "retry", requestId: "req_1" } }, { "retry-after": "0" }));
    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 2 });

    await expect(client.checkIp("1.1.1.1")).rejects.toBeInstanceOf(NetRiskScanApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("succeeds after a retryable 429", async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(
        mockResponse(429, { error: { code: "rate_limit_exceeded", message: "slow down", requestId: "req_1" } }, { "retry-after": "0" }),
      )
      .mockResolvedValueOnce(mockResponse(200, successBody({ requestId: "req_2", risk: { index: 90, band: "excellent", assessmentGrade: "complete" } })));

    const client = new NetRiskScanClient({ apiKey: "k", maxRetries: 2 });
    const { data } = await client.checkIp("1.1.1.1");

    expect(data.risk.index).toBe(90);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After before falling back to exponential backoff", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(429, { error: { code: "rate_limit_exceeded", message: "slow down", requestId: "req_1" } }, { "retry-after": "0" }),
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
