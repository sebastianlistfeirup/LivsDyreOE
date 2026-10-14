import type { Tile } from "../core";

const cache = new Map<string, string>();
const themeNames = [
  "Solbugten",
  "Koralhaven",
  "Perlelagunen",
  "Krystalrevet",
  "Stjernedybet",
] as const;
let activeTheme = 0;

function themeForLevel(levelId: number): number {
  return Number.isFinite(levelId)
    ? Math.max(0, Math.min(4, Math.floor((levelId - 1) / 2)))
    : 0;
}

export function setGemTheme(levelId: number): void {
  activeTheme = themeForLevel(levelId);
}

export function getGemThemeName(levelId: number): string {
  return themeNames[themeForLevel(levelId)];
}

const baseDefs = `<defs>
<radialGradient id="purple" cx="30%" cy="15%" r="90%"><stop stop-color="#f9e0ff"/><stop offset=".32" stop-color="#bb76ff"/><stop offset=".72" stop-color="#803ad5"/><stop offset="1" stop-color="#3f1685"/></radialGradient>
<linearGradient id="gold" x1=".2" y1="0" x2=".8" y2="1"><stop stop-color="#fff8b1"/><stop offset=".3" stop-color="#ffe34b"/><stop offset=".65" stop-color="#ffb918"/><stop offset="1" stop-color="#dc650b"/></linearGradient>
<radialGradient id="blue" cx="28%" cy="24%" r="80%"><stop stop-color="#aff6ff"/><stop offset=".25" stop-color="#2de0ff"/><stop offset=".58" stop-color="#0099ed"/><stop offset="1" stop-color="#0348aa"/></radialGradient>
<linearGradient id="green" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dcff99"/><stop offset=".35" stop-color="#84db3a"/><stop offset=".7" stop-color="#2a9b3d"/><stop offset="1" stop-color="#0d5434"/></linearGradient>
<radialGradient id="pearl" cx="32%" cy="25%" r="78%"><stop stop-color="#fff"/><stop offset=".22" stop-color="#fffdf5"/><stop offset=".52" stop-color="#e5e8f2"/><stop offset=".74" stop-color="#aeb7d3"/><stop offset=".9" stop-color="#f2d9bd"/><stop offset="1" stop-color="#7b8caa"/></radialGradient>
<radialGradient id="prism" cx="32%" cy="25%" r="85%"><stop stop-color="#fff"/><stop offset=".16" stop-color="#fff8a5"/><stop offset=".33" stop-color="#ff87d6"/><stop offset=".51" stop-color="#a277ff"/><stop offset=".7" stop-color="#44dafa"/><stop offset=".86" stop-color="#9ceb94"/><stop offset="1" stop-color="#288ba4"/></radialGradient>
<linearGradient id="shine" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="2.3" flood-color="#001d38" flood-opacity=".62"/></filter>
</defs>`;

// One material palette per two levels. Families stay purple/gold/blue/green/pearl
// so a child's learned match and objective colours never change meaning.
const palettes = [
  [
    ["#f9e0ff", "#bb76ff", "#803ad5", "#3f1685"],
    ["#fff8b1", "#ffe34b", "#ffb918", "#dc650b"],
    ["#aff6ff", "#2de0ff", "#0099ed", "#0348aa"],
    ["#dcff99", "#84db3a", "#2a9b3d", "#0d5434"],
    ["#fffdf5", "#e5e8f2", "#aeb7d3", "#7b8caa"],
  ],
  [
    ["#ffe1f6", "#da81d5", "#96369e", "#54216f"],
    ["#fff0b2", "#ffbc57", "#ed861b", "#a94316"],
    ["#c6ffff", "#53d5df", "#0d9cbb", "#165188"],
    ["#e6ffbf", "#86d387", "#399877", "#155e55"],
    ["#fff9ef", "#f3dbe8", "#b5a1c8", "#8474aa"],
  ],
  [
    ["#fff0ff", "#c3a3f3", "#7960c0", "#4c348d"],
    ["#fffbd9", "#f6d278", "#cca54d", "#8d5e29"],
    ["#e2faff", "#7bc9f3", "#478cce", "#2a58a3"],
    ["#f3ffd6", "#acd795", "#5b9d80", "#316e68"],
    ["#fffdfa", "#e5e7f8", "#b9c7dc", "#7e9bba"],
  ],
  [
    ["#fbd5ff", "#ac5dea", "#692cb3", "#371778"],
    ["#fff8ae", "#ffcb37", "#df9017", "#975310"],
    ["#c6faff", "#3ac6f0", "#1474d0", "#133e9c"],
    ["#e1ffb1", "#63d590", "#179d82", "#075d66"],
    ["#f6ffff", "#ccecf7", "#9bb8d1", "#547da6"],
  ],
  [
    ["#f7ccff", "#ae61f5", "#7127c5", "#3c1688"],
    ["#fff6ba", "#ffc65e", "#de851e", "#a54a0e"],
    ["#c5ffff", "#3fb3fa", "#1267cc", "#142d96"],
    ["#e2ffb6", "#5fd7b2", "#148c8c", "#084c69"],
    ["#fff9ff", "#dedcf6", "#aea9d7", "#625aa4"],
  ],
] as const;

function themedDefs(): string {
  if (activeTheme === 0) return baseDefs;
  let svg = baseDefs;
  for (let type = 0; type < 5; type++) {
    for (let shade = 0; shade < 4; shade++) {
      svg = svg.replaceAll(
        palettes[0][type][shade],
        palettes[activeTheme][type][shade],
      );
    }
  }
  return svg;
}

function normal(type: number): string {
  if (type === 0)
    return `<path d="M44 85 18 63C-1 46 13 29 23 30 17 13 38 8 43 19 48 4 65 9 66 22 82 11 94 30 83 38 103 44 91 63 78 69L57 86Q50 92 44 85Z" fill="url(#purple)" stroke="#efc8ff" stroke-width="1.3"/>
    <g fill="none" stroke-linecap="round"><path d="M49 83 26 36M50 84 43 23M52 84 63 26M54 83 79 42M47 81 17 47" stroke="#4b1d92" stroke-width="5" opacity=".55"/><path d="M47 78 24 32M49 80 41 22M53 80 63 24M56 79 79 40M44 76 15 44" stroke="url(#shine)" stroke-width="3.2"/></g><path d="m43 85 14 0" stroke="#d5a4ff" stroke-width="4" stroke-linecap="round"/>`;
  if (type === 1)
    return `<path d="m50 7 12 27 30 3-23 21 7 31-26-16-26 16 6-31L8 37l30-3Z" fill="url(#gold)" stroke="#ffe88b" stroke-width="1.6" stroke-linejoin="round"/><path d="M50 7v43L8 37l30-3ZM50 50l26 39-7-31 23-21ZM50 50 24 89l26-16Z" fill="#c77908" opacity=".28"/><path d="M50 50 50 7l12 27 30 3ZM50 50l-26 39 6-31Z" fill="#fff8b7" opacity=".6"/><path d="m48 17-7 20-21 2" fill="none" stroke="#fffce0" stroke-width="2.5" stroke-linecap="round"/>`;
  if (type === 2)
    return `<path d="M50 7C47 23 16 43 17 61 18 101 84 101 84 61 84 44 59 22 50 7Z" fill="url(#blue)" stroke="#72ecff" stroke-width="1.3"/><path d="M47 24C38 40 22 49 25 63" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".82"/><path d="M28 74Q52 96 74 71" fill="none" stroke="#74f5ff" stroke-width="2.8" opacity=".8"/><ellipse cx="69" cy="64" rx="5" ry="10" fill="#02eeff" opacity=".48"/><ellipse cx="37" cy="80" rx="7" ry="2.5" fill="#fff" opacity=".58"/>`;
  if (type === 3)
    return `<path d="M78 9C48 12 10 24 18 58 21 74 38 82 50 74 78 61 86 35 78 9Z" fill="url(#green)" stroke="#a6ec73" stroke-width="1.3"/><path d="M20 91Q30 51 76 15" fill="none" stroke="#daf6a0" stroke-width="2.5" stroke-linecap="round"/><g fill="none" stroke="#c4ef90" opacity=".5" stroke-width="1.2"><path d="M32 60Q22 48 24 35M42 46Q36 33 42 23M51 37Q51 24 58 19M32 61Q51 64 67 48M44 45Q63 44 76 30"/></g><path d="M25 45Q28 27 57 20" fill="none" stroke="url(#shine)" stroke-width="4" stroke-linecap="round"/>`;
  return `<circle cx="50" cy="50" r="35" fill="url(#pearl)" stroke="#fdf5e4" stroke-width="1.4"/><ellipse cx="39" cy="32" rx="13" ry="9" transform="rotate(-33 39 32)" fill="#fff" opacity=".88"/><path d="M22 52Q24 77 46 81" fill="none" stroke="#ffefd9" stroke-width="3" opacity=".75"/><path d="M72 27Q88 50 71 72" fill="none" stroke="#b7d8ff" stroke-width="2" opacity=".7"/>`;
}

function starPath(points: number, inner: number): string {
  const vertices: string[] = [];
  for (let n = 0; n < points * 2; n++) {
    const angle = -Math.PI / 2 + (n * Math.PI) / points;
    const radius = n % 2 ? inner : 42;
    vertices.push(
      `${(50 + Math.cos(angle) * radius).toFixed(1)} ${(50 + Math.sin(angle) * radius).toFixed(1)}`,
    );
  }
  return `M${vertices.join("L")}Z`;
}

const themedShapes = [
  [
    "M43 87 14 67Q5 56 13 45Q7 33 22 31Q19 17 36 20Q44 7 52 20Q65 8 73 24Q89 21 86 38Q99 47 87 63L57 87Q50 91 43 87Z",
    "M42 87Q8 64 14 42Q17 30 31 32Q28 17 43 18Q53 6 62 20Q78 13 84 30Q95 40 87 58Q77 73 56 87Z",
    "M41 87 9 58 16 37 27 39 30 17 43 29 51 8 61 29 76 17 78 39 91 37 89 59 58 87Z",
    "M42 87Q6 69 11 47Q17 37 27 39Q20 21 37 24Q43 7 53 22Q66 8 72 25Q90 20 84 42Q101 51 87 68L59 87Z",
  ],
  [starPath(6, 21), starPath(5, 27), starPath(8, 28), starPath(7, 18)],
  [
    "M50 8Q43 28 23 42Q10 56 17 73Q23 93 50 93Q77 93 83 73Q91 56 75 39Z",
    "M50 7Q44 24 26 43Q13 57 19 75Q26 93 50 93Q75 93 82 75Q88 58 71 38Z",
    "M50 7 72 37 85 62 77 82 61 92 38 92 22 82 15 62 27 38Z",
    "M50 6Q44 27 25 46Q9 65 24 83Q34 95 50 94Q70 94 79 81Q92 64 72 42Z",
  ],
  [
    "M76 8Q52 14 24 28Q14 35 19 45Q8 55 24 62Q19 78 43 78Q80 64 76 8Z",
    "M80 8Q58 12 39 28Q11 51 21 68Q27 81 47 76Q72 59 80 8Z",
    "M79 8 62 13 42 16 20 37 15 59 30 77 51 72 70 50Z",
    "M80 8Q59 17 43 17Q20 30 24 42Q12 50 22 61Q22 75 42 77Q73 68 80 8Z",
  ],
  [
    "M50 15A35 35 0 1 1 50 85A35 35 0 1 1 50 15Z",
    "M50 15A35 35 0 1 1 50 85A35 35 0 1 1 50 15Z",
    "M50 14Q81 13 86 46Q93 79 62 86Q31 95 17 66Q8 36 34 18Z",
    "M50 15A35 35 0 1 1 50 85A35 35 0 1 1 50 15Z",
  ],
] as const;

function themedNormal(type: number): string {
  if (activeTheme === 0) return normal(type);
  const safeType = Number.isInteger(type) && type >= 0 && type < 5 ? type : 4;
  const shape = themedShapes[safeType][activeTheme - 1];
  const fill = ["purple", "gold", "blue", "green", "pearl"][safeType];
  const edge = palettes[activeTheme][safeType][0];
  const setting =
    safeType !== 4
      ? ""
      : activeTheme === 1
        ? '<path d="M11 54Q15 18 36 15L28 29 50 8 72 29 84 15Q95 37 89 57L78 81Q48 98 20 78Z" fill="#bb5a9d" stroke="#ffe4f1" stroke-width="2"/>'
        : activeTheme === 2
          ? '<path d="M14 68Q50 100 86 68L85 80Q50 102 15 80Z" fill="#a89bc2" stroke="#fff6e6" stroke-width="2"/>'
          : activeTheme === 3
            ? '<path d="M50 5 65 18 80 12 86 32 95 50 85 68 80 88 60 84 50 97 35 84 19 88 14 68 5 50 15 31 20 12 36 19Z" fill="#83cbd9" stroke="#efffff" stroke-width="2"/>'
            : '<circle cx="50" cy="50" r="43" fill="#6757bd" stroke="#defaff" stroke-width="2"/>';
  const detail =
    safeType === 0
      ? '<g fill="none" stroke-linecap="round"><path d="M50 84 21 42M50 84 34 27M50 84 50 18M50 84 66 27M50 84 80 41" stroke="#341557" stroke-width="5" opacity=".37"/><path d="M47 78 21 42M49 80 34 27M51 80 50 18M53 80 66 27M55 78 80 41" stroke="#fff" stroke-width="2.5" opacity=".76"/></g><path d="M28 37Q50 21 72 37" fill="none" stroke="#fff" stroke-width="4" opacity=".35"/>'
      : safeType === 1
        ? '<path d="M50 49 50 8 62 37ZM50 49 89 37 68 56ZM50 49 74 86 49 73ZM50 49 23 85 32 57ZM50 49 10 38 40 34Z" fill="#fffce7" opacity=".52"/><path d="M50 49 73 86 68 56ZM50 49 22 85 32 57Z" fill="#965016" opacity=".19"/><circle cx="50" cy="50" r="6" fill="#fffadf" opacity=".8"/>'
        : safeType === 2
          ? '<path d="M47 22Q31 46 25 58Q21 75 36 83" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".78"/><path d="M31 75Q48 88 68 77" fill="none" stroke="#b8ffff" stroke-width="2.5" opacity=".78"/><path d="M55 22 72 49 59 57 49 44Z" fill="#e1ffff" opacity=".3"/><path d="M59 57 73 49 79 68 67 77 49 75Z" fill="#083c89" opacity=".19"/>'
          : safeType === 3
            ? '<path d="M20 88Q34 55 77 15" fill="none" stroke="#ecffc0" stroke-width="3" stroke-linecap="round"/><g fill="none" stroke="#e5ffd3" stroke-width="1.6" opacity=".76"><path d="M30 63Q22 51 24 37M42 47Q35 33 41 23M54 34Q52 22 60 17M30 63Q49 63 66 49M44 47Q60 46 76 31"/></g><path d="M25 44Q32 27 59 20" fill="none" stroke="#fff" stroke-width="4" opacity=".54"/>'
            : '<ellipse cx="39" cy="32" rx="13" ry="8" transform="rotate(-32 39 32)" fill="#fff" opacity=".88"/><path d="M22 54Q25 76 46 81" fill="none" stroke="#fff6e5" stroke-width="3" opacity=".75"/><path d="M70 27Q86 47 72 71" fill="none" stroke="#bdefff" stroke-width="2" opacity=".7"/><path d="M28 65Q51 78 74 58" fill="none" stroke="#eec5ff" stroke-width="2" opacity=".46"/>';
  const sparkle =
    activeTheme >= 3
      ? '<path d="m76 10 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#fffbe0"/><circle cx="20" cy="21" r="2" fill="#fff"/>'
      : "";
  return `${setting}<clipPath id="shape"><path d="${shape}"/></clipPath><path d="${shape}" fill="url(#${fill})" stroke="${edge}" stroke-width="2.1" stroke-linejoin="round"/><g clip-path="url(#shape)">${detail}</g><path d="${shape}" fill="none" stroke="#fff" stroke-width=".7" stroke-opacity=".55" stroke-linejoin="round"/>${sparkle}`;
}

export function gemArt(tile: Pick<Tile, "type" | "special">): string {
  const key = `${activeTheme}-${tile.type}-${tile.special ?? ""}`;
  if (cache.has(key)) return cache.get(key)!;
  let art = themedNormal(tile.type);
  if (tile.special === "color")
    art = `<circle cx="50" cy="50" r="39" fill="#8a6ac7" opacity=".6"/><circle cx="50" cy="50" r="35" fill="url(#prism)" stroke="#fff4c9" stroke-width="2.7"/><circle cx="50" cy="50" r="29" fill="none" stroke="#fff" stroke-width="1.6" opacity=".65"/><path d="M22 66Q47 80 81 40M19 40Q59 11 82 63" fill="none" stroke="#fff" stroke-width="2" opacity=".55"/><path d="m50 27 5 17 18 6-18 5-5 18-5-18-18-5 18-6Z" fill="#fff"/><circle cx="29" cy="29" r="5" fill="#fff" opacity=".9"/>`;
  if (tile.special === "bomb")
    art = `<circle cx="50" cy="54" r="36" fill="#8e63b9" opacity=".62"/><circle cx="50" cy="54" r="32" fill="url(#blue)" stroke="#b8fcff" stroke-width="2.6"/><path d="M19 49Q50 29 81 51M21 67Q50 45 79 68" fill="none" stroke="#f3b4ff" stroke-width="6" stroke-linecap="round"/><path d="M42 20v-8h16v9" fill="#ffe490" stroke="#bb792e" stroke-width="2"/><path d="M55 12Q65 4 70 12" fill="none" stroke="#ffe5ac" stroke-width="3"/><path d="m74 5 2 7 7 2-7 3-2 7-3-7-7-3 7-2Z" fill="#fff5ab"/><ellipse cx="35" cy="32" rx="8" ry="4" fill="#fff" opacity=".85"/>`;
  if (tile.special === "row" || tile.special === "column")
    art += `<g ${tile.special === "column" ? 'transform="rotate(90 50 50)"' : ""}><rect x="9" y="41" width="82" height="18" rx="9" fill="#113c60" opacity=".88" stroke="#fff2bd" stroke-width="1.5"/><path d="M24 50h52" stroke="#fffce1" stroke-width="5" stroke-linecap="round"/><path d="m11 50 14-11v22ZM89 50 75 39v22Z" fill="#fff6bd"/><path d="M31 45h39" stroke="#fff" stroke-width="1.5" opacity=".85"/></g>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${themedDefs()}<g filter="url(#shadow)">${art}</g></svg>`)}`;
  cache.set(key, uri);
  return uri;
}

export const coralArt = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="c" x2="0" y2="1"><stop stop-color="#ffb99e"/><stop offset="1" stop-color="#bf3e79"/></linearGradient></defs><ellipse cx="50" cy="85" rx="35" ry="8" fill="#00253d" opacity=".4"/><g stroke="url(#c)" fill="none" stroke-width="10" stroke-linecap="round"><path d="M47 82V26m0 32L25 42V24m23 20 16-11V17M51 69l25-17V37M30 45 16 36M65 32l13-11"/></g><path d="M47 74V30M25 38V26M76 49V40" stroke="#ffdbc1" fill="none" stroke-width="2" stroke-linecap="round"/></svg>')}`;
