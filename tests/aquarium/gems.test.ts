import { afterEach, describe, expect, it } from "vitest";
import {
  gemArt,
  getGemThemeName,
  setGemTheme,
} from "../../src/aquarium/render/gems";
import type { TileType } from "../../src/aquarium/core";

afterEach(() => setGemTheme(1));

describe("level jewel themes", () => {
  it("gives each consecutive level pair its own named theme", () => {
    const names = Array.from({ length: 10 }, (_, i) => getGemThemeName(i + 1));
    expect(new Set(names).size).toBe(5);
    for (let i = 0; i < 10; i += 2) expect(names[i]).toBe(names[i + 1]);
    expect(names[0]).toBe("Solbugten");
    expect(names[9]).toBe("Stjernedybet");
  });
  it("varies all five jewel families across the five themes", () => {
    for (let type = 0; type < 5; type++) {
      const variants = [1, 3, 5, 7, 9].map((level) => {
        setGemTheme(level);
        return gemArt({ type: type as TileType });
      });
      expect(new Set(variants).size).toBe(5);
    }
  });
  it("keeps special types visibly distinct from normal jewels and each other", () => {
    for (const level of [1, 3, 5, 7, 9]) {
      setGemTheme(level);
      const sprites = [undefined, "row", "column", "bomb", "color"].map(
        (special) =>
          gemArt({
            type: 2,
            special: special as "row" | "column" | "bomb" | "color" | undefined,
          }),
      );
      expect(new Set(sprites).size).toBe(5);
      for (const sprite of sprites) {
        expect(sprite.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(
          true,
        );
        const svg = decodeURIComponent(sprite.split(",")[1]);
        expect(svg).toContain('viewBox="0 0 100 100"');
        expect(svg).not.toMatch(/undefined|NaN|<script/);
        expect(svg.endsWith("</svg>")).toBe(true);
      }
    }
  });
  it("uses deterministic cached art when returning to an earlier level", () => {
    setGemTheme(1);
    const original = gemArt({ type: 0 });
    setGemTheme(7);
    expect(gemArt({ type: 0 })).not.toBe(original);
    setGemTheme(2);
    expect(gemArt({ type: 0 })).toBe(original);
  });
  it("falls back or clamps safely for non-game level inputs", () => {
    expect(getGemThemeName(Number.NaN)).toBe("Solbugten");
    expect(getGemThemeName(Number.POSITIVE_INFINITY)).toBe("Solbugten");
    expect(getGemThemeName(-10)).toBe("Solbugten");
    expect(getGemThemeName(99)).toBe("Stjernedybet");
  });
});
