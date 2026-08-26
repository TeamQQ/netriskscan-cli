import { describe, expect, it } from "vitest";
import { runPool } from "../src/utils/pool.js";

describe("runPool", () => {
  it("preserves result order regardless of completion order", async () => {
    const items = [30, 10, 20];
    const results = await runPool(items, 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(results).toEqual([30, 10, 20]);
  });

  it("never runs more than the configured concurrency at once", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await runPool(items, 3, async (i) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return i;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("does not lose results when some items fail", async () => {
    const items = [1, 2, 3, 4];
    const results = await runPool(items, 2, async (i) => {
      if (i === 2) return { ok: false as const, i };
      return { ok: true as const, i };
    });
    expect(results).toHaveLength(4);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
  });
});
