import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import path from "path";

describe("locale files", () => {
  const localesDir = path.resolve("src/locales");
  const files = readdirSync(localesDir).filter((f) => f.endsWith(".ftl"));
  const localeMap = new Map<string, string>();

  beforeAll(() => {
    for (const file of files) {
      const content = readFileSync(path.join(localesDir, file), "utf-8");
      localeMap.set(file, content);
    }
  });

  function parseKeys(content: string): string[] {
    return content
      .split("\n")
      .filter((line) => /^[a-z_][a-z0-9_]+ *=/i.test(line.trim()))
      .map((line) => line.trim().split("=")[0].trim())
      .sort();
  }

  it("should have en.ftl and es.ftl", () => {
    expect(localeMap.has("en.ftl")).toBe(true);
    expect(localeMap.has("es.ftl")).toBe(true);
  });

  it("should have the same keys in en and es", () => {
    const enKeys = parseKeys(localeMap.get("en.ftl")!);
    const esKeys = parseKeys(localeMap.get("es.ftl")!);

    const onlyInEn = enKeys.filter((k) => !esKeys.includes(k));
    const onlyInEs = esKeys.filter((k) => !enKeys.includes(k));

    expect(onlyInEn).toEqual([]);
    expect(onlyInEs).toEqual([]);
  });
});

describe("i18n instance", () => {
  it("should load translations without error", async () => {
    const { i18n } = await import("@/i18n");
    expect(i18n).toBeDefined();
    const enTitle = i18n.t("en", "start_admin");
    expect(enTitle).toBeString();
    expect(enTitle.length).toBeGreaterThan(0);
    const esTitle = i18n.t("es", "start_admin");
    expect(esTitle).toBeString();
    expect(esTitle.length).toBeGreaterThan(0);
  });

  it("should translate a key with variables", async () => {
    const { i18n } = await import("@/i18n");
    const result = i18n.t("en", "admin_pending_title", {
      count: "3",
      list: "user1\nuser2\nuser3",
    });
    expect(result).toContain("3");
    expect(result).toContain("user1");
  });
});
