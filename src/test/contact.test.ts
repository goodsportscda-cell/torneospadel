import { describe, expect, it } from "vitest";
import { normalizeWhatsApp, SUPPORT_URL, whatsappUrl } from "@/lib/contact";

describe("public contact links", () => {
  it("normalizes international numbers without inventing a country code", () => {
    expect(normalizeWhatsApp("+54 9 (11) 6594-2709")).toBe("5491165942709");
    expect(normalizeWhatsApp("+34 612 345 678")).toBe("34612345678");
  });
  it("rejects invalid and executable input", () => {
    for (const input of ["", "123", "005491165942709", "javascript:alert(123456789)", "1234567890123456", "5491165942709?text=hola"]) {
      expect(normalizeWhatsApp(input)).toBeNull();
      expect(whatsappUrl(input, "hola")).toBeNull();
    }
  });
  it("encodes messages without leaking player data or adding URL parameters", () => {
    const url = new URL(whatsappUrl("5491165942709", "Club A & B / puntos?")!);
    expect(url.searchParams.get("text")).toBe("Club A & B / puntos?");
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(SUPPORT_URL).toContain("https://wa.me/5491165942709?");
  });
});
