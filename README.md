# Livs magiske akvarie

Et dansk match-3-mobilspil til Liv: 30 baner med forskellige former og juvelsæt, fire fisk med små fortællinger og et akvarium, der udvikler sig gennem dine valg. Ingen reklamer, betaling, energi eller ventetid.

Spil: **https://sebastianlistfeirup.github.io/LivsDyreOE/**. Repository-adressen er bevaret; spillet hedder **Livs magiske akvarie**. GitHub Actions tester, bygger og udgiver main.

## På telefonen

- Træk en brik til en nabo, eller tryk på to naboer. Brikken følger fingeren, naboen reagerer, og et ugyldigt bytte koster intet.
- Fire ens giver en stråle, fem en farveperle, L/T en boblebombe. To stråler giver et kryds; bombe + stråle rammer tre rækker og tre kolonner; to farveperler rydder alle brikker.
- Hver bane har sin egen form og sit eget juvelsæt. Senere møder du faste sten, muslinger med to træffere, bobler der løfter brikker og strømme, der vender faldet. Pilen viser næste strømretning.
- Væk revet i tre etaper og åbn Koralhaven, Perlelagunen og Stjernedybet. Områderne har egne baggrunde og stille musik, når lyden er slået til.
- Vælg et ønske på projektknappen. Sejren viser din opsparing og giver en direkte byggeknap, når du har råd.
- **Akvarium → Indret** køber og placerer ting. Træk en placeret ting frit med fingeren; hjælpelinjer gør det nemt at rette ind. Flytning kan fortrydes, og dekorationer inklusive udvidelser kan sælges til fuld pris.
- Udvid Skys hule og Glimts svømmebane i to trin. Tryk på fiskene for at opdage deres små historier eller ændre navn, farveskær og yndlingsting.
- Vælg solstrejf, morgenglød eller måneskin, besøg et åbent område og gem et rigtigt PNG-postkort af dit akvarium.
- **Et lille hint** hjælper uden at spille for dig. Fem ekstra træk og nye forsøg er altid gratis.

Start: 40 skaller. Første sejr: 40; gentagelse: 10. Af hver førstegangssejrs 40 skaller reserveres 10 til revet, indtil de tre etaper er betalt. Revprojekterne koster 60, 80 og 80 efter bane 6, 14 og 22. Alle 30 førstegangssejre rækker til hele revet, alle fisk, alle dekorationer og begge udvidelser af både hule og ring — uden tvungen gentagelse.

På iPhone: Safari → **Del → Føj til hjemmeskærm**. På Android: **Installer app/Føj til startskærm**. Første åbning kræver net; efter færdig offline-download kan spillet genåbnes offline i understøttede browsere. Gemningen er lokal, uden konto eller automatisk synkronisering. **Indstillinger → Gem en kopi / Åbn en kopi** flytter spillet mellem enheder. Rydning af browserdata fjerner lokal gemning og offline-filer.

## Udvikling

Node.js 24 er testet. Brug det eksisterende checkout i /workspace/LivsDyreOE.

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173
```

Vites base er /LivsDyreOE/. Serverprocesser skal genstartes efter gendannelse af cloudmiljøet.

```sh
npm test
npm run typecheck
npm run build
npm run preview -- --host 0.0.0.0 --port 4174
```

Browserkontroller kræver Python Playwright og Chromium (/usr/bin/chromium i cloudmiljøet). De bruger isolerede testprofiler, ikke spillerens gemning.

```sh
python tests/aquarium_mobile.py
python tests/aquarium_gestures.py
python tests/aquarium_expansion_mobile.py
LIVS_TEST_URL=http://127.0.0.1:4174/LivsDyreOE/ LIVS_TEST_PRODUCTION=1 python tests/aquarium_mobile.py
AQ_BASE_URL=http://127.0.0.1:4174/LivsDyreOE/ python tests/aquarium_expansion_mobile.py
```

Den sidste integrationstest bruger devserveren som fabrik for deklarerede, validerede testgemninger; alle handlinger udføres gennem produktionsspillets UI. Den fulde 30-bane-test bruger faste vinderforløb uden udviklingsimport i produktionsmodus.

TypeScript, originale billedaktiver, Canvas-partikler og CSS/Web Animations. Regler og gemning er uafhængige af animationstiming. Se [design](docs/LIVS_AKVARIE.md), [grafik](docs/aquarium-assets.md) og [verifikation/afgrænsninger](STATUS.md).

## Bevaring

Save-nøglen **livs-akvarie.save.v1** er uændret. Tidligere akvariegemninger bevarer bræt, fisk, skaller og igangværende træk. Gamle gennemførte baner får deres manglende revopsparing tilføjet én gang uden at reducere allerede frie skaller.

Livs Dyreø er på pause. Den tidligere ø findes ved f29f87a; animationsprototypen ved 1f14aab på archive/livs-dyreo-animation-wip. Akvariet ændrer ikke øens gemte data.

Designgrundlag: brugerens BOBLEBUGTEN_BIBEL_v1_2.pdf med de efterfølgende udvidelser til 30 baner og navnet **Livs magiske akvarie**. Referencerne er ambitionsmål, ikke en påstand om 1:1-kvalitet. Fiskene er animerede 2D-illustrationer, ikke skeletanimerede 3D-dyr.
