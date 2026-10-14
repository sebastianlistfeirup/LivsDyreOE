# Livs akvarie

Et dansk match-3-mobilspil med funklende havjuveler, kædereaktioner og et akvarium, du selv indretter. Ti baner, fire fisk og otte dekorationer. Ingen reklamer, betaling, energi eller ventetid.

Spiladressen er **https://sebastianlistfeirup.github.io/LivsDyreOE/**. Adressen beholder det oprindelige repository-navn; det aktive spil hedder **Livs akvarie**. GitHub Actions tester, bygger og udgiver main til GitHub Pages.

## På telefonen

- Træk en brik hen til en nabo. Du kan også trykke på to naboer. Tre ens forsvinder; et ugyldigt bytte koster intet.
- Fire på række skaber en stråle. Fem skaber en farveperle. Et L eller T skaber en boblebombe. Byt specialbrikker med en nabo; stråler og bomber kan også vælges og aktiveres med **Brug**.
- Tryk **♪** for lyd. Brikkerne følger fingeren, hopper blødt på plads og sender indsamlede juveler op til banens mål. Specialeffekter har lysstråler, boblebrag og kædereaktioner.
- Juvelernes former og nuancer udvikler sig gennem fem temaer: Solbugten, Koralhaven, Perlelagunen, Krystalrevet og Stjernedybet. Hvert tema varer to baner; grundfarverne bevarer deres betydning.
- Tryk **Akvarium → Indret** for at købe og placere noget på sandbunden. Tryk på en placeret dekoration for at flytte den gratis, dreje den eller sælge den til fuld pris.
- Tryk på en fisk for at give den navn, farveskær og yndlingsting. Sky besøger hulen; Glimt svømmer gennem ringen. Fiskene behøver ikke fodring.
- **Et lille hint** hjælper uden at spille for dig. Hvis trækkene slipper op, er fem ekstra træk og nye forsøg gratis.

På iPhone: Åbn i Safari, vælg **Del → Føj til hjemmeskærm**. På Android: Vælg **Installer app/Føj til startskærm** i browseren. Så åbner spillet uden almindelig browserramme. Første åbning kræver net; efter den færdige offline-download kan spillet genåbnes og spilles offline i understøttede browsere. Rydning af browserdata fjerner både offline-filer og lokal gemning.

Spillet gemmer automatisk på enheden. **Indstillinger → Gem en kopi / Åbn en kopi** flytter en gemning mellem enheder. Der er ingen konto eller automatisk synkronisering. Dansk oplæsning bruger den danske stemme, enheden eventuelt har installeret.

## Udvikling

Node.js 20+; CI bruger Node.js 24. Brug det eksisterende checkout i /workspace/LivsDyreOE.

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173
```

Vites base er /LivsDyreOE/. Start en ny serverproces efter genstart af udviklingsmiljøet; en gammel proces kan ikke antages at overleve.

```sh
npm test
npm run typecheck
npm run build
npm run preview -- --host 0.0.0.0 --port 4174
```

Browserkontroller kræver Python Playwright og Chromium. I det forberedte cloudmiljø findes browseren på /usr/bin/chromium.

```sh
# Mod udviklingsserveren på port 4173:
python tests/aquarium_mobile.py
python tests/aquarium_gestures.py
# Mod den færdigbyggede preview-server på port 4174, inklusive offline:
LIVS_TEST_URL=http://127.0.0.1:4174/LivsDyreOE/ LIVS_TEST_PRODUCTION=1 python tests/aquarium_mobile.py
```

Spillet bruger TypeScript, HTML/SVG, Canvas-partikler og CSS/Web Animations. Reglerne er uafhængige af billeder og animationstiming. src/aquarium/core indeholder den seedede motor, save indeholder validering og turn-recovery, render indeholder juveler og fisk. Billederne er originale genererede illustrationer: se [aktivoversigten](docs/aquarium-assets.md). Der er ingen tredjepartsanalyse eller netværkskonto.

## Kontrolleret kvalitet og afgrænsning

75 automatiske regel-/gemme-/regressionstests, herunder 1.000 seedede træk, består. Alle ti baner er gennemført via browserens touch-kontroller. Fem mobil-/tabletstørrelser, ugyldige swipes, annullerede træk, alle specialeffekter, genindlæsning under en vindende kaskade, køb, refundering, import/eksport og offline genåbning er kontrolleret. Se [STATUS.md](STATUS.md) for den konkrete leverance og åbne telefonkontroller.

Det er browseremulering, ikke en fysisk iPhone-/Android-test. Fiskene er illustrerede 2D-figurer med animerede haler, finner, svømmebaner og adfærd — ikke fuldt riggede 3D-dyr. Referencebillederne er ambitionsmål, ikke dokumentation for 1:1-kvalitet.

## Livs Dyreø er sat på pause

Den tidligere udgivne ø er bevaret ved f29f87a. Den ikke-udgivne 3D-animationsprototype ligger på archive/livs-dyreo-animation-wip ved 1f14aab. Akvariet bruger sin egen save-nøgle, livs-akvarie.save.v1, og ændrer ikke øens gemte data.

Designgrundlaget er brugerens *BOBLEBUGTEN_BIBEL_v1_2.pdf*, med brugerens navneændring til **Livs akvarie**. Projektbeslutninger og præcise regler findes i [designnotatet](docs/LIVS_AKVARIE.md).
