import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import path from "path";

describe("FTL file validation", () => {
  const localesDir = path.resolve("src/locales");
  const files = readdirSync(localesDir).filter((f) => f.endsWith(".ftl"));

  for (const file of files) {
    const content = readFileSync(path.join(localesDir, file), "utf-8");
    const lines = content.split("\n");

    it(`${file} should not have truly empty values`, () => {
      const keys = lines
        .map((l, i) => ({ line: l.trim(), index: i }))
        .filter((l) => /^[a-z_][a-z0-9_]*\s*=\s*/i.test(l.line));

      const emptyKeys = keys.filter((k) => {
        const sameLineVal = k.line.substring(k.line.indexOf("=") + 1).trim();
        if (sameLineVal) return false;
        // Check next non-empty line for indentation (multiline value)
        for (let j = k.index + 1; j < lines.length; j++) {
          const next = lines[j];
          if (next.trim() === "") continue;
          if (/^\s/.test(next)) return false; // indented → it's the value
          break; // non-indented non-empty → no value
        }
        return true;
      });

      expect(emptyKeys).toEqual([]);
    });

    it(`${file} should not have duplicate keys`, () => {
      const keys = lines
        .filter((l) => /^[a-z_]/.test(l.trim()))
        .map((l) => l.trim().split("=")[0].trim());
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect([...new Set(dupes)]).toEqual([]);
    });

    it(`${file} should have valid variable placeholders`, () => {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!/^[a-z_]/.test(trimmed)) continue;
        const val = trimmed.substring(trimmed.indexOf("=") + 1).trim();
        if (!val || val.startsWith(".")) continue;
        const refs = val.match(/\{ \$[a-z_]+\}/gi);
        if (refs) {
          for (const ref of refs) {
            expect(ref).toMatch(/^\{\$[a-z_]+\}$/i);
          }
        }
      }
    });

    it(`${file} should not have HTML entities or raw HTML`, () => {
      const htmlPatterns = [/&[a-z]+;/, /<[a-z]+/];
      for (const pattern of htmlPatterns) {
        const testLines = lines.filter((l) => pattern.test(l));
        expect(testLines).toEqual([]);
      }
    });
  }
});
