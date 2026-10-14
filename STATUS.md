# Livs magiske akvarie — leverancestatus

14. oktober 2026. Version: **magiske-0.2.0**. Livs Dyreø er fortsat sat på pause og bevaret separat i Git-historikken.

## Implementeret

- Dansk mobilspil med **30 seedede baner**, 30 forskellige brætformer og 150 originale illustrerede juveler. Hver bane skifter silhuetter, facetter og farvenuancer; fem genkendelige farvefamilier og målbetydninger bevares. Faste sten introduceres i de senere baner.
- Brikker følger fingeren; naboen reagerer før slip. Pop, forskudte fald, små landingshop, indsamling, klange og understøttet vibration. Ugyldige/annullerede træk er gratis. Alternativ betjening med to tryk og tastatur.
- Fire ens giver stråler, fem farveperler, L/T bomber. To stråler giver et lysende kryds; bombe + stråle rammer tre rækker og tre kolonner; to farveperler skaber regnbuekaskade over alle spillefelter. Effekterne følger de faktisk ramte felter.
- Skaller finansierer et rev i tre etaper. Koraller, perlelys og stimefisk vender tilbage. Projekterne åbner Koralhaven, Perlelagunen og Stjernedybet, med egne baggrunde, musik og nye mekanikker.
- Hule og ring kan hver opgraderes to gange. Fiskene får nye ruter og aktiviteter. Fire fisk har hver to små historieafsnit med en scene; ingen sult, sygdom eller straf for pauser.
- Muslinger åbnes efter to nabomatches; bobler løfter brikker; strømme ændrer faldretning. Korte visuelle introduktioner og en pil, som viser næste strøm.
- Valgfrit opsparingsmål, sejrsanimation til projektet og direkte byggeknap, når målet er klar. Sjældent perletræ og måneport har faste priser, ikke tilfældige præmiekasser.
- Ti dekorationer, 12 pladser og fri flytning med magnetiske hjælpelinjer. Fortryd, spejling/drejning og fuld refundering inklusive opgraderinger. Solstrejf, morgenglød og måneskin. Postkort eksporteres som rigtig PNG uden brugerflade.
- Animerede fisk, finner, haler, bobler, tang og lys. Fisk vender i svømmeretningen; illustrationernes proportioner bevares.
- Lokal valideret gemning, backup, import/eksport og deterministisk genoptagelse af en afbrudt kaskade. Den eksisterende nøgle **livs-akvarie.save.v1** bevares. Gamle gemninger får revopsparing tilføjet én gang uden at miste frie skaller, fisk eller igangværende bræt.
- Standalone-manifest, hjemmeskærmsikoner og offline-cache af alle 30 juvelsæt. Lyd kræver brugertryk; reduceret bevægelse er valgfri. Ingen reklamer, betaling, livssystem, konto eller ventetid.

## Økonomi

Start: 40 skaller. Første sejr: 40, gentagelse: 10. Ti af hver førstegangssejrs 40 reserveres til revet, indtil alle tre etaper er finansieret. Butikken kan ikke bruge disse reserver. Projekterne koster 60/80/80 efter bane 6/14/22.

Alle 30 førstegangssejre giver 1.240 inklusive startbeløbet. Hele revet, alle fisk, alle dekorationer og begge udvidelser af hule og ring koster tilsammen 1.060. Der er 180 tilbage: intet indhold kræver tvungen gentagelse.

## Verificeret i cloudmiljøet

Node.js 24.19.0, TypeScript/Vite, Python Playwright 1.62.0 og Chromium. Browserkontroller bruger isolerede profiler; deklarerede integrationsfixtures ændrer aldrig en spillers gemning.

- Reproducerbar `npm ci --cache /workspace/shared/npm-cache`, typecheck og produktionsbuild består.
- **214 unit-/regressionstests** består: bl.a. alle 30 faste baner, 1.000 seedede træk, specialkombinationers nøjagtige felter, terræn, økonomi, gamle gemninger, 150 unikke juvelaktiver og 27 touch-input-regressioner.
- Både udviklingsversionen og produktionsbuild er gennemført gennem touch-UI på alle 30 baner. Produktionsforløbet bruger faste vindertræk uden udviklingsimport/debug-hooks. Tre revprojekter er betalt via brugerfladen, og slutsaldoen er præcis 1.020 før indkøb. Alle 30 brætformer og temaer er forskellige. Dette tester lovlige vinderforløb, ikke et barns oplevede sværhedsgrad.
- 27 produktions-UI-scenarier består: ni forløb på hver af 390×844, 320×640 og 844×390. Omfatter titel, alle 30 banevalg/temaer, beskyttet opsparing, projekter, opgraderinger, historier, sjældne dekorationer, lys/regioner, flytning, øjeblikkelig fortryd, annullering, refundering, genåbning og PNG-eksport. Ingen JavaScriptfejl eller manglende billedfiler.
- Seks ekstra produktionskontroller efter sidste grafikrettelse: fisk bevæger sig fremad i alle målte frames, halerne klippes på den korrekte side, reduceret bevægelse stopper animationerne, og PNG-postkort eksporteres på alle tre telefonvisninger.
- Layout kontrolleret på fem skærmstørrelser: 390×844, 320×640, 844×390, 768×1024 og 1024×768. Primære kontroller er mindst 48×48 CSS-pixels og bliver inden for skærmen. De otte brætfelter pr. række er mindre på smalle telefoner.
- Afbrudt vindende kaskade genoptages med samme bræt og præcis én belønning. Korrupte hoveddata kan gendannes fra gyldig backup. Ugyldig import efterlader eksisterende spil urørt.
- Touch-regressioner dækker knapper umiddelbart efter træk og retargeterede dubletklik efter lukning af en dialog. Specialknappen er flyttet væk fra brættets nederste felter.
- CDP-fingertræk følger fingeren og påvirker naboen før slip. Gyldigt bytte, gratis ugyldigt bytte og annullering består. Fire specialeffekter animeres synligt og bruger ét træk; kombinationerne rammer præcis 15/39/64 felter på et fuldt bræt, og de endelige brikidentiteter matcher regelmotoren.

- Produktions-serviceworker er kontrolleret med offline genåbning og et efterfølgende lovligt træk. Alle 150 banespecifikke juveler og de tre nye områders baggrunde findes i cachen; billeder fra sidste bane og Stjernedybet hentes også offline.

Offentlig adresse: https://sebastianlistfeirup.github.io/LivsDyreOE/ . GitHub Actions tester, bygger og udgiver main. Deployment-resultat og offentlig side kontrolleres separat fra den lokale build.

## Bevidste afgrænsninger / næste telefonkontrol

- Ingen fysisk iPhone eller Android er tilgængelig her. Reel fingerfølelse, billedhastighed, varme/batteri, Safari-bundbjælke, rotation, lyd/vibration og hjemmeskærmsinstallation skal kontrolleres på telefonen. Chromium-emulering dokumenterer ikke konstant 60 fps på ældre enheder.
- Fiskene er 2D-illustrationer med animerede dele og adfærd, ikke skeletanimerede 3D-dyr. Referencer og Fishdom er ambitions- og oplevelsesretning; der påstås ikke dokumenteret 1:1- eller AAA-kvalitet.
- Dansk oplæsning bruger Web Speech og enhedens tilgængelige stemmer; der er ingen separat dansk voiceover-pakke.
- Lagring er lokal uden automatisk synkronisering. Safari/private faner kan begrænse eller fjerne data. Eksportér en kopi før browserskift eller rydning af historik.
- De 30 baners sværhedsgrad, forståelighed og spilletid skal stadig vurderes med Liv. Gratis hints, ekstra træk og nye forsøg er altid tilgængelige.
