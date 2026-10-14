import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { gemArt, getGemColors, getGemThemeName, setGemTheme } from "../../src/aquarium/render/gems";
import type { TileType } from "../../src/aquarium/core";

afterEach(() => setGemTheme(1));
const fileFor = (url: string) => `public/aquarium/art/jewels/${url.split("/").at(-1)}`;

describe("thirty illustrated jewel themes", () => {
  it("gives every level its own named theme, not one theme per pair", () => {
    const names = Array.from({ length: 30 }, (_, i) => getGemThemeName(i + 1));
    expect(new Set(names).size).toBe(30);
    expect(names[0]).toBe("Solbugtens skatte");
    expect(names[29]).toBe("Den magiske krone");
  });
  it("ships thirty genuinely distinct bitmap illustrations for each of five families", () => {
    for (let type = 0; type < 5; type++) {
      const hashes = Array.from({ length: 30 }, (_, i) => {
        setGemTheme(i + 1);
        const file = fileFor(gemArt({ type: type as TileType }));
        const bytes = readFileSync(file);
        expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
        expect(bytes.length).toBeLessThan(25_000);
        return createHash("sha256").update(bytes).digest("hex");
      });
      expect(new Set(hashes).size).toBe(30);
    }
  });
  it("keeps the four special abilities visibly distinct and every asset present", () => {
    for (const level of [1, 10, 11, 20, 21, 30]) {
      setGemTheme(level);
      for (let type = 0; type < 5; type++) {
        const sprites = [undefined, "row", "column", "bomb", "color"].map((special) =>
          gemArt({ type: type as TileType, special: special as "row" | "column" | "bomb" | "color" | undefined }),
        );
        expect(new Set(sprites).size).toBe(5);
        sprites.forEach((url) => {
          expect(url).toMatch(/aquarium\/art\/jewels\/.*\.webp$/);
          expect(statSync(fileFor(url)).size).toBeGreaterThan(1_000);
        });
      }
    }
  });
  it("returns deterministic art when returning to an earlier level", () => {
    setGemTheme(1);
    const original = gemArt({ type: 0 });
    setGemTheme(2);
    expect(gemArt({ type: 0 })).not.toBe(original);
    setGemTheme(1);
    expect(gemArt({ type: 0 })).toBe(original);
  });
  it("falls back or clamps safely for non-game inputs", () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -10, 0]) {
      expect(getGemThemeName(invalid)).toBe(getGemThemeName(1));
      setGemTheme(invalid);
      expect(gemArt({ type: 0 })).toContain("level-01-0.webp");
    }
    expect(getGemThemeName(99)).toBe(getGemThemeName(30));
    expect(getGemThemeName(4.8)).toBe(getGemThemeName(4));
  });
  it("provides a consistent five-colour effect palette for each selected level", () => {
    setGemTheme(17);
    expect(getGemColors()).toEqual(getGemColors(17));
    expect(new Set(getGemColors()).size).toBe(5);
    expect(getGemColors(2)).not.toEqual(getGemColors(1));
  });
});
