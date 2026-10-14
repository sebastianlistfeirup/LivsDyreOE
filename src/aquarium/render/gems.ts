import type { Tile } from "../core";

/** Separately illustrated, prerendered silhouettes; stable colour families. */
const themeNames = [
  "Solbugtens skatte", "Koralglimt", "Gyldne strømme", "Muslingehaven", "Bølgedans",
  "Havfruens smykker", "Smaragdrevet", "Regnbuekoraller", "Solstråleskatte", "Koralhjertet",
  "Perleporten", "Opaldrømme", "Lagunesølv", "Morgendug", "Muslingemagi",
  "Måneskær", "Krystalspejlet", "Perlemorshaven", "Diamantstrømmen", "Lagunens krone",
  "Stjernelys", "Safirnatten", "Nordlysperler", "Dybhavsdrømme", "Månejuveler",
  "Stjernestøv", "Kosmiske koraller", "Nattens skatte", "Auroraglimt", "Den magiske krone",
] as const;

const ART_ROOT = `${import.meta.env.BASE_URL}aquarium/art/jewels/`;
let activeLevel = 1;

function levelNumber(levelId: number): number {
  return Number.isFinite(levelId) ? Math.max(1, Math.min(30, Math.floor(levelId))) : 1;
}

export function setGemTheme(levelId: number): void {
  activeLevel = levelNumber(levelId);
}

export function getGemThemeName(levelId: number): string {
  return themeNames[levelNumber(levelId) - 1];
}

/** Match sparks follow the illustrated palette without changing match rules. */
export function getGemColors(levelId = activeLevel): readonly string[] {
  const index = levelNumber(levelId) - 1;
  const shift = [0, 7, -8, 12, -5, 16, -11, 4, -15, 10][index % 10];
  return [
    `hsl(${284 + shift} 88% 73%)`,
    `hsl(${45 + shift / 2} 100% 69%)`,
    `hsl(${190 + shift / 2} 96% 70%)`,
    `hsl(${111 + shift} 76% 69%)`,
    `hsl(${42 + shift * 3} 60% 94%)`,
  ];
}

export function gemArt(tile: Pick<Tile, "type" | "special">): string {
  const type = Number.isInteger(tile.type) && tile.type >= 0 && tile.type < 5 ? tile.type : 4;
  if (tile.special === "color" || tile.special === "bomb") {
    return `${ART_ROOT}power-${tile.special}.webp`;
  }
  // Stable power-up symbols teach their ability independently of a level's cut.
  if (tile.special === "row" || tile.special === "column") {
    return `${ART_ROOT}ray-${tile.special}-${type}.webp`;
  }
  return `${ART_ROOT}level-${String(activeLevel).padStart(2, "0")}-${type}.webp`;
}

export const coralArt = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="c" x2="0" y2="1"><stop stop-color="#ffb99e"/><stop offset="1" stop-color="#bf3e79"/></linearGradient></defs><ellipse cx="50" cy="85" rx="35" ry="8" fill="#00253d" opacity=".4"/><g stroke="url(#c)" fill="none" stroke-width="10" stroke-linecap="round"><path d="M47 82V26m0 32L25 42V24m23 20 16-11V17M51 69l25-17V37M30 45 16 36M65 32l13-11"/></g><path d="M47 74V30M25 38V26M76 49V40" stroke="#ffdbc1" fill="none" stroke-width="2" stroke-linecap="round"/></svg>')}`;
