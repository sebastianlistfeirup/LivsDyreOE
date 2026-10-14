# Livs magiske akvarie: billedaktiver

Alle billeder i `public/aquarium/art/` er skabt til dette projekt som originale illustrationer. Brugerens akvarie-reference var en visuel rettesnor for farve, dybde og materialekvalitet; skærmbillederne er ikke lagt ind som spilaktiver. Der er ingen indkøbte eller eksterne model-/billedaktiver i denne pakke.

| Fil | Formål | Størrelse |
| --- | --- | ---: |
| `underwater-world.webp` | Stemningsfuld baggrund til puslespillet; fri midte til brættet. | 941 × 1672 |
| `underwater-aquarium.webp` | Akvarie/dekoration; sammenhængende sandbund fra omtrent 47 % af billedhøjden. | 941 × 1672 |
| `fish-bobo.webp` | Orange guldfisk med lang hale. | 768 × 768 |
| `fish-sky.webp` | Safirblå fisk. | 768 × 512 |
| `fish-glimt.webp` | Gul sommerfuglefisk. | 768 × 512 |
| `fish-plet.webp` | Grønplettet kuglefisk. | 768 × 512 |
| `decor-seagrass.webp` | Søgræs. | 468 × 512 |
| `decor-cave.webp` | Lille hule. | 512 × 410 |
| `decor-ring.webp` | Stenring, som fisk kan svømme igennem. | 512 × 512 |
| `decor-arch.webp` | Koralbue. | 512 × 341 |
| `decor-clam.webp` | Muslingeseng. | 512 × 468 |
| `decor-bubbles.webp` | Boblesten. | 505 × 512 |
| `decor-wreck.webp` | Trævrag. | 512 × 512 |
| `decor-lantern.webp` | Festlanterne. | 512 × 498 |
| `region-coral.webp` | Koralhaven: turkis vand, varmt lys og gylden sandbund. | 941 × 1672 |
| `region-pearl.webp` | Perlelagunen: lyse, iriserende ruiner og perlemorssand. | 941 × 1672 |
| `region-star.webp` | Stjernedybet: safirblåt vand og selvlysende koraller. | 941 × 1672 |
| `decor-pearl-tree.webp` | Sjældent perletræ med transparente mellemrum mellem grenene. | 512 × 468 |
| `decor-moon-gate.webp` | Sjælden måneport med transparent åbning. | 427 × 512 |
| `jewels/level-01-0.webp` … `jewels/level-30-4.webp` | 150 særskilt illustrerede juveler, fem familier på hver af 30 baner. | 192 × 192 |
| `jewels/ray-row-0.webp` … `jewels/ray-row-4.webp` | Fem vandrette strålebrikker. | 192 × 192 |
| `jewels/ray-column-0.webp` … `jewels/ray-column-4.webp` | Fem lodrette strålebrikker. | 192 × 192 |
| `jewels/power-bomb.webp`, `jewels/power-color.webp` | Boblebombe og regnbueperle. | 192 × 192 |
| `terrain-rock.webp` | Uflyttelig klippeblok med kvartsårer og havmos. | 240 × 240 |
| `terrain-clam-closed.webp`, `terrain-clam-cracked.webp` | Sammenhørende lukket/åbnet musling med perle. | 240 × 240 |

Fisk og dekorationer har transparent WebP/alfa. Alle fisk vender mod højre, med halen til venstre, og kan spejles vandret ved svømning. Illustrationerne er enkeltbilleder: svømme- og finnebevægelser skabes af spillets renderer, ikke af indbyggede animationer i filerne. Dekorationernes åbne områder (især ring og bue) skal forblive gennemsigtige. Brug `object-fit: contain` for at bevare proportioner.

Billederne er nedskaleret og komprimeret til mobil: fisk maksimalt 768 px, dekorationer maksimalt 512 px; de to baggrunde er i højformat til telefon. De originale genererings-PNG'er er ikke del af spilpakken. Ved ændringer i generering eller komprimering bør vi teste alfa-kanter og læsbarhed i cirka 390 px mobilvisning igen.

## Juveler og banetemaer

Juvelerne er nu originale, AI-genererede illustrationer med præ-renderet glasdybde, reflekser, facetter og perlemor — ikke de tidligere flade SVG-brikker. En tidlig Blender-prototype blev visuelt vurderet og erstattet, da de genererede illustrationer havde klart bedre materialefølelse i telefonstørrelse. Der kræves hverken Blender, billedgenerering eller en ekstern billedtjeneste under spillet.

`render/gems.ts` vælger et særskilt sæt på **hver af de 30 baner**. De 150 normale juveler er fordelt på fem originale 5 × 6-atlasillustrationer: lilla musling, gylden stjerne, blå dråbe, grønt blad og lys perle. Silhuetterne varierer reelt: antal skalflige og stjernespidser, dråbesnit, bladformer og perleformer. Facetter, reflektioner og farvenuancer varierer også. Farvefamilierne forbliver genkendelige, så brættet og målene ikke skifter betydning. Perler kan bl.a. være runde, ovale, hjerteformede og barokke. Powerup-pilene forbliver stabile på tværs af baner for at gøre retningen tydelig.

HUD og bræt bruger samme aktuel-bane-billeder. `getGemColors()` leverer en tilsvarende femfarvet effektpalet. Partikler, lysbuer, stråler og glimt animeres i spillet; billederne er ikke videoer. Brikkerne bruger kun små statiske WebP-filer og kræver ingen 3D-rendering på telefonen.

Atlaspakningen bruger hver figurs fulde alfa-bounds frem for at antage, at genereringen er en matematisk perfekt celleinddeling. Dermed bliver perlespidser og bladkanter ikke skåret af, og nabofragmenter fra andre atlasrækker undgås. Tærskel bruges kun til at lokalisere bounds; kildens bløde alfapixels bevares i kodningen. En diskret farvet lyskant er en del af nogle kildeillustrationer. Silhuetterne er kontrolleret både enkeltvis og på det faktiske 390 px-bræt.

De nye regioner har åbent vand i øvre halvdel og sammenhængende sandbund i nederste halvdel. Dekorationerne placeres særskilt på denne bund. De tre baggrunde fylder tilsammen ca. 750 KB; juvelerne ca. 2,5 MB. Filerne caches til offlinebrug af spillets service worker. Originale genereringsark er ikke lagt i den offentlige spilpakke.

Kontrolikoner og koralmarkøren er fortsat originale SVG-tegninger. Ingen af illustrationerne, ikonerne eller lydene er kopieret fra Fishdom.
