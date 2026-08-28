import { describe, expect, it } from "vitest";
import { formatIndex, formatNullable, formatTriState } from "../src/output/format.js";

describe("formatTriState", () => {
  it("true -> Yes", () => expect(formatTriState(true)).toBe("Yes"));
  it("false -> No", () => expect(formatTriState(false)).toBe("No"));
  it("null -> Unknown (never collapses to No)", () => expect(formatTriState(null)).toBe("Unknown"));
  it("undefined -> Unknown", () => expect(formatTriState(undefined)).toBe("Unknown"));
});

describe("formatIndex", () => {
  it("keeps 0 as a real value, not falsy", () => expect(formatIndex(0)).toBe("0"));
  it("keeps 92", () => expect(formatIndex(92)).toBe("92"));
  it("keeps 100", () => expect(formatIndex(100)).toBe("100"));
  it("null -> N/A", () => expect(formatIndex(null)).toBe("N/A"));
});

describe("formatNullable", () => {
  it("passes through a real string", () =>
    expect(formatNullable("residential")).toBe("residential"));
  it("null -> N/A", () => expect(formatNullable(null)).toBe("N/A"));
  it("undefined -> N/A", () => expect(formatNullable(undefined)).toBe("N/A"));
});
