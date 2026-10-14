# Livs akvarie: billedaktiver

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

Fisk og dekorationer har transparent WebP/alfa. Alle fisk vender mod højre, med halen til venstre, og kan spejles vandret ved svømning. Illustrationerne er enkeltbilleder: svømme- og finnebevægelser skabes af spillets renderer, ikke af indbyggede animationer i filerne. Dekorationernes åbne områder (især ring og bue) skal forblive gennemsigtige. Brug `object-fit: contain` for at bevare proportioner.

Billederne er nedskaleret og komprimeret til mobil: fisk maksimalt 768 px, dekorationer maksimalt 512 px; de to baggrunde er i højformat til telefon. De originale genererings-PNG'er er ikke del af spilpakken. Ved ændringer i generering eller komprimering bør vi teste alfa-kanter og læsbarhed i cirka 390 px mobilvisning igen.

Juveler og kontrolikoner er originale SVG-tegninger i koden, ikke billeder hentet fra Fishdom. `render/gems.ts` indeholder fem temaer til baneparrene 1–2, 3–4, 5–6, 7–8 og 9–10. Lilla skal, gul stjerne, blå dråbe, grønt blad og hvid perle beholder deres farvefamilie, men silhuetter, facetter, indfatninger og nuancer varierer. HUD og bræt bruger samme tema. Partikler, lysbuer og glimt tegnes/animéres i spillet.
