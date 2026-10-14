# Livs Dyreø

Et dansksproget, mobilvenligt park- og redningsspil. Byg tre trygge levesteder, red seks dyr gennem minispil, og åbn din egen dyreø gennem ti kapitler.

Når GitHub Pages er aktiveret, kan spillet åbnes på telefonen her: **https://sebastianlistfeirup.github.io/LivsDyreOE/**. Der kræves ingen installation eller konto. Drej telefonen, hvis du foretrækker mere plads til byggekortet.

## Spil på telefon

- Tryk **Byg → Byg forslag** for at starte med kapivarernes hjem. Forslaget kan senere flyttes eller bygges om.
- Tryk **Park → Fortsæt historien** og derefter **Missioner** for at begynde den første redning.
- I minispillene kan du altid bruge **Hjælp til ét trin** eller **Løs med hjælp**. Der er ingen tidsgrænse.
- Tryk på kortet for at placere stier, hegn og objekter. Træk kortet for at panorere; brug `+` og `−` til at zoome.
- Spillet gemmer automatisk på den aktuelle enhed. Under **Indstillinger** kan du eksportere et gemt spil til en fil og importere det på en anden telefon.

Spillets regler, økonomi, missioner, kapitler og navn er baseret på den vedlagte *LIVS_DYREOE_BIBEL_v1_2*. Illustrationerne i denne prototype er originale, spiltilpassede billeder. Referencebillederne er stilretning, ikke skærmbilleder af den aktuelle implementering.

## Udvikling

Kræver Node.js 20 eller nyere.

```sh
npm ci
npm run dev
npm test
npm run build
```

Åbn Vites adresse med stien `/LivsDyreOE/`. Produktionsbygningen ligger i `dist/`. GitHub Actions tester og bygger før udgivelse til GitHub Pages fra `main`.

Spillet bruger Three.js til parken og almindelige HTML-knapper til opgaverne. Gemte data bliver i browserens lokale lager, medmindre spilleren selv vælger at eksportere dem. Ingen konto, reklamer eller analyseværktøjer er indbygget.

## Kvalitet og kendte begrænsninger

Den fulde historie er gennemspillet automatisk i Chromium ved fem skærmstørrelser, inklusive telefon i stående og liggende format. Den faktiske park er interaktiv og bruger illustrerede objekter, men dens 3D-detaljer og animationer er endnu ikke på 1:1-niveau med de ambitiøse konceptbilleder. Fysiske iOS- og Android-enheder bør også prøves før spillet kaldes færdigt.
