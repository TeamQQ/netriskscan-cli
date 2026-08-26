import { describe, expect, it } from "vitest";
import { isValidIp } from "../src/utils/ip.js";

describe("isValidIp", () => {
  it("accepts IPv4", () => expect(isValidIp("1.1.1.1")).toBe(true));
  it("accepts IPv6", () => expect(isValidIp("2606:4700:4700::1111")).toBe(true));
  it("rejects garbage", () => expect(isValidIp("not-an-ip")).toBe(false));
  it("rejects empty string", () => expect(isValidIp("")).toBe(false));
});
