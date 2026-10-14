# Livs Dyreø

Et dansksproget, mobilvenligt park- og redningsspil. Byg tre trygge levesteder, red seks dyr gennem minispil, og åbn din egen dyreø gennem ti kapitler.

Spillet kan åbnes på telefonen her: **https://sebastianlistfeirup.github.io/LivsDyreOE/**. En kort [kapivar-animationstest](https://sebastianlistfeirup.github.io/LivsDyreOE/previews/capy-animation.html) viser gangen uden at gennemføre redningsmissionen først. Der kræves ingen installation eller konto. Drej telefonen, hvis du foretrækker mere plads til byggekortet.
På iPhone kan siden føjes til hjemmeskærmen via Safaris delingsmenu; på Android bruges browserens **Føj til startskærm**. Internet er stadig nødvendigt for at hente spillet.

GitHub Pages er sat til **GitHub Actions**. Nye ændringer til `main` udgiver automatisk en opdateret version.

## Spil på telefon

- Tryk **Byg → Byg færdigt hjem** for at starte med kapivarernes hjem. Det bygger sti, hegn, port og det nødvendige inventar i ét trin; du kan ændre det senere.
- Tryk **Park → Fortsæt historien** og derefter **Missioner** for at begynde den første redning.
- I minispillene kan du altid bruge **Hjælp til ét trin** eller **Løs med hjælp**. Der er ingen tidsgrænse.
- Vil du bygge selv, så vælg et værktøj under **Byg**, tryk på øen, læs forhåndsvisningen, og tryk **Placér**. Ugyldige placeringer forklares, før du betaler.
- Vælg **Flyt**, tryk på en bygget ting og derefter på dens nye sted. **Fortryd** ruller den seneste ændring tilbage. Du kan også trykke direkte på en bygget ting for at flytte den.
- Træk på øen for at panorere; knib med to fingre eller brug `+` og `−` for at zoome.
- Sommerfugle og natur bevæger sig fra starten. Dyrene kommer først til øen, når de er reddet. Kapivarernes gang bruger en billedsekvens fra videoreferencen; deres animation kan ses tydeligere med **Flod** og zoomknapperne.
- Spillet gemmer automatisk på den aktuelle enhed. Under **Indstillinger** kan du eksportere et gemt spil til en fil og importere det på en anden telefon.

Spillets regler, økonomi, missioner, kapitler og navn er baseret på den vedlagte *LIVS_DYREOE_BIBEL_v1_2*. Øens illustrationer er spiltilpassede billeder; kapivarens gangbilleder er udklip fra en videoreference stillet til rådighed af brugeren. Referencebillederne er stilretning, ikke skærmbilleder af den aktuelle implementering.

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
