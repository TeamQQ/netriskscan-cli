import { isIP } from "node:net";

export function isValidIp(value: string): boolean {
  return isIP(value) !== 0;
}
