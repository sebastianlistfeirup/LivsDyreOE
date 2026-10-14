import type { Save } from "../save/store";
import { DECORATIONS } from "./catalog";

export type RegionId = "sun" | "coral" | "pearl" | "star";
export type GoalId = "reef" | "cave" | "ring" | "pearl-tree" | "moon-gate";
export type Adventure = {
  reefStage: 0 | 1 | 2 | 3;
  reefSavings: number;
  upgrades: Record<string, number>;
  stories: Record<string, number>;
  goal: GoalId;
  lighting: "day" | "dawn" | "moon";
  region: RegionId;
  seenTutorials: number[];
};
export const REGIONS = [
  {
    id: "sun",
    name: "Solbugten",
    first: 1,
    last: 6,
    stage: 0,
    description: "Dit første lille hav. Lær juvelernes magi.",
  },
  {
    id: "coral",
    name: "Koralhaven",
    first: 7,
    last: 14,
    stage: 1,
    description: "Farverige passager, klipper og boblende strømme.",
  },
  {
    id: "pearl",
    name: "Perlelagunen",
    first: 15,
    last: 22,
    stage: 2,
    description: "Muslinger gemmer perler bag deres skinnende låg.",
  },
  {
    id: "star",
    name: "Stjernedybet",
    first: 23,
    last: 30,
    stage: 3,
    description: "Et lysende hav, hvor strømmen vender juvelernes fald.",
  },
] as const;
export const REEF_PROJECTS = [
  {
    title: "Væk korallerne",
    price: 60,
    after: 6,
    region: "coral",
    detail:
      "Plant de første levende koraller. Koralhaven åbner med otte nye baner.",
    image: "decor-arch",
    celebration: "Korallerne folder sig ud. Koralhaven er åben!",
  },
  {
    title: "Tænd perlelyset",
    price: 80,
    after: 14,
    region: "pearl",
    detail:
      "Giv revet sit bløde perlelys tilbage. Oplev Perlelagunens muslinger.",
    image: "decor-clam",
    celebration: "Tusind perleglimt vågner. Perlelagunen er åben!",
  },
  {
    title: "Byd stimefiskene hjem",
    price: 80,
    after: 22,
    region: "star",
    detail: "Gør revet klar til en lille stime. Rejs videre til Stjernedybet.",
    image: "fish-glimt",
    celebration: "Små stimefisk flytter ind. Stjernedybet er åben!",
  },
] as const;
export const UPGRADES = {
  cave: [
    {
      title: "Skys dobbelthule",
      price: 40,
      detail: "Et ekstra skjulested, som Sky kan undersøge.",
    },
    {
      title: "Det lysende grottesystem",
      price: 70,
      detail: "Tre indgange og perlelygter til en ny udforskertur.",
    },
  ],
  ring: [
    {
      title: "Glimts dobbeltring",
      price: 40,
      detail: "To ringe og en ny sløjfe gennem vandet.",
    },
    {
      title: "Den magiske svømmebane",
      price: 70,
      detail: "Tre porte, som Glimt svømmer igennem på skift.",
    },
  ],
} as const;

export function emptyAdventure(): Adventure {
  return {
    reefStage: 0,
    reefSavings: 0,
    upgrades: {},
    stories: {},
    goal: "reef",
    lighting: "day",
    region: "sun",
    seenTutorials: [],
  };
}
export function adventureOf(save: Save): Adventure {
  return (save.adventure ??= emptyAdventure());
}
export function spendableShells(save: Save): number {
  return save.shells - (save.adventure?.reefSavings ?? 0);
}
export function regionForLevel(level: number) {
  return REGIONS.find((region) => level <= region.last) ?? REGIONS[3];
}
export function nextReef(save: Save) {
  const stage = adventureOf(save).reefStage;
  return stage < 3 ? REEF_PROJECTS[stage as 0 | 1 | 2] : undefined;
}
export function canPlayLevel(save: Save, id: number): boolean {
  if (!Number.isInteger(id) || id < 1 || id > 30) return false;
  if (save.completed.includes(id) || save.active.board.levelId === id)
    return true;
  return (
    id <= Math.max(0, ...save.completed) + 1 &&
    regionForLevel(id).stage <= adventureOf(save).reefStage
  );
}
export function reserveFirstWin(save: Save): void {
  const p = adventureOf(save);
  const paid = REEF_PROJECTS.slice(0, p.reefStage).reduce(
    (n, project) => n + project.price,
    0,
  );
  const needed = 220 - paid - p.reefSavings;
  // These are ten of the forty earned shells, not an additional currency.
  // Protecting them makes the next region reachable even after buying fish.
  p.reefSavings += Math.max(0, Math.min(10, needed));
}
export function restoreReef(save: Save): string | null {
  const project = nextReef(save),
    p = adventureOf(save);
  if (!project) return "Hele revet er allerede vågnet.";
  if (!save.completed.includes(project.after))
    return `Klar først bane ${project.after}. Dine revskaller venter trygt.`;
  if (p.reefSavings < project.price)
    return `Der mangler ${project.price - p.reefSavings} revskaller. Nye baner sparer automatisk op.`;
  save.shells -= project.price;
  p.reefSavings -= project.price;
  p.reefStage = (p.reefStage + 1) as Adventure["reefStage"];
  p.region = project.region;
  return null;
}
export function upgradeDecoration(save: Save, id: string): string | null {
  if (id !== "cave" && id !== "ring")
    return "Denne ting har ingen opgradering.";
  if (!save.decorations.includes(id))
    return "Placér først den lille udgave i dit akvarium.";
  const p = adventureOf(save),
    level = p.upgrades[id] ?? 0,
    next = UPGRADES[id][level];
  if (!next) return "Alle opgraderinger er allerede bygget.";
  if (spendableShells(save) < next.price)
    return `Du mangler ${next.price - spendableShells(save)} frie skaller.`;
  save.shells -= next.price;
  p.upgrades[id] = level + 1;
  return null;
}
export function decorationRefund(save: Save, id: string): number {
  const base = DECORATIONS.find((d) => d.id === id)?.price ?? 0;
  if (id !== "cave" && id !== "ring") return base;
  return (
    base +
    UPGRADES[id]
      .slice(0, adventureOf(save).upgrades[id] ?? 0)
      .reduce((n, u) => n + u.price, 0)
  );
}
export function rareStage(id: string): number {
  return id === "pearl-tree" ? 2 : id === "moon-gate" ? 3 : 0;
}

const STORIES = {
  bobo: [
    {
      title: "En hemmelig passage",
      line: "Bobo har fundet en åbning i koralbuen. Kom, vi ser, hvor den fører hen!",
      need: "Placér en koralbue.",
      ready: (s: Save) => s.decorations.includes("arch"),
    },
    {
      title: "Revet vågner",
      line: "Se! De nye koraller har åbnet sig. Bobo vil vise alle vennerne rundt.",
      need: "Væk korallerne i det første revprojekt.",
      ready: (s: Save) => adventureOf(s).reefStage >= 1,
    },
  ],
  sky: [
    {
      title: "Et roligt sted",
      line: "Sky kigger forsigtigt ud af sin nye hule. Her er der rart at være.",
      need: "Placér Skys lille hule.",
      ready: (s: Save) => s.decorations.includes("cave"),
    },
    {
      title: "Mod på en opdagelse",
      line: "En ny indgang! Sky tager en lille udforskertur og finder vejen hjem igen.",
      need: "Opgradér hulen til Skys dobbelthule.",
      ready: (s: Save) => (adventureOf(s).upgrades.cave ?? 0) >= 1,
    },
  ],
  glimt: [
    {
      title: "Den første sløjfe",
      line: "Glimt suser gennem ringen og vender rundt. Vil du se én tur mere?",
      need: "Placér en svømmering.",
      ready: (s: Save) => s.decorations.includes("ring"),
    },
    {
      title: "Glimts store nummer",
      line: "To ringe, én flot sløjfe! Glimt har øvet et lille nummer til vennerne.",
      need: "Opgradér ringen til Glimts dobbeltring.",
      ready: (s: Save) => (adventureOf(s).upgrades.ring ?? 0) >= 1,
    },
  ],
  plet: [
    {
      title: "En boblende skat",
      line: "Plet følger en lille boble. Den glimter som den fineste sten i samlingen.",
      need: "Placér en boblesten.",
      ready: (s: Save) => s.decorations.includes("bubbles"),
    },
    {
      title: "Perlesamleren",
      line: "Perlelyset får hele Plets samling til at glimte. Der er nok til at vise alle en skat.",
      need: "Tænd perlelyset i det andet revprojekt.",
      ready: (s: Save) => adventureOf(s).reefStage >= 2,
    },
  ],
};
export function nextStory(save: Save, fish: string) {
  if (!(fish in STORIES)) return null;
  const chapter = adventureOf(save).stories[fish] ?? 0;
  const story = STORIES[fish as keyof typeof STORIES][chapter];
  return story
    ? {
        ...story,
        chapter: chapter + 1,
        ready: save.fishIds.includes(fish) && story.ready(save),
      }
    : null;
}
export function claimStory(
  save: Save,
  fish: string,
): ReturnType<typeof nextStory> {
  const next = nextStory(save, fish);
  if (!next?.ready) return null;
  adventureOf(save).stories[fish] = next.chapter;
  return next;
}
export function goalSummary(save: Save) {
  const p = adventureOf(save),
    id = p.goal;
  if (id === "reef") {
    const next = nextReef(save);
    return next
      ? {
          id,
          title: next.title,
          price: next.price,
          saved: p.reefSavings,
          image: next.image,
          ready:
            p.reefSavings >= next.price && save.completed.includes(next.after),
          action: "restore-reef",
        }
      : {
          id,
          title: "Dit rev er fuldt af liv",
          price: 220,
          saved: 220,
          image: "fish-glimt",
          ready: false,
          action: "projects",
        };
  }
  const decor = DECORATIONS.find((d) => d.id === id)!;
  const upgrade =
    id === "cave" || id === "ring" ? UPGRADES[id][p.upgrades[id] ?? 0] : null;
  const owned = save.decorations.includes(id);
  const price = owned ? (upgrade?.price ?? 0) : decor.price;
  return {
    id,
    title: owned ? (upgrade?.title ?? decor.name) : decor.name,
    price,
    saved: spendableShells(save),
    image: `decor-${id}`,
    ready:
      price > 0 &&
      spendableShells(save) >= price &&
      p.reefStage >= rareStage(id),
    action: owned ? "upgrade-decor" : "goal-place",
  };
}
