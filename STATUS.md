# Livs akvarie — leverancestatus

14. oktober 2026. Aktiv version: akvarie-0.1.0. Livs Dyreø er sat på pause og bevaret separat i Git-historikken.

## Implementeret

- Fuldskærms dansk mobilspil med 8×8 bræt, ti seedede baner, måltællere og gratis hjælp. Ingen tidsgrænse, reklamer, betaling eller livssystem.
- Direkte fingertræk og alternativt tryk på to naboer. Træk følger fingeren, slipper uden at springe tilbage og falder med et lille hop. Ugyldige og annullerede træk koster intet.
- Stråler ved fire ens, farveperler ved fem og bomber ved L/T. Specialkombinationer og kaskader bruger præcis ét træk. Partikler, lysbuer, boblechokbølger, indsamling op til målene og stigende klange.
- Fem visuelt forskellige juveltemaer, ét pr. banepar. Koralformer, perlemor, krystalfacetter og stjerneindfatninger varierer, mens farvefamilier og målbetydning er stabile. Målikonerne følger brættets tema.
- Originale undervandsbaggrunde med bevægeligt lys, tang og bobler. Fire fisk med svømmebaner, hale-/finnebevægelser og forskellige aktiviteter; hulebesøg, ringpassager, hvil og reaktion på tryk.
- Otte dekorationer på sandbunden. Køb, gratis flytning, fortryd flytning, drejning/spejling og fuld tilbagebetaling. Navn, yndlingsting og et lille farveskær til hver fisk.
- Særskilt lokal gemning med validering, backup og import/eksport. Genoptagelse af en afbrudt kaskade uden dobbelt træk eller belønning. Ingen ændring af Livs Dyreøs save-nøgle.
- Hjemmeskærmsikon og standalone-manifest. Offline-cache efter første fuldførte download. Lyd kræver brugertryk; reduceret bevægelse kan vælges.

## Verificeret i cloudmiljøet

Node.js 24.19.0, TypeScript/Vite, Chromium og Python Playwright 1.62.0.

- 75 unit-/regressionstests består. Herunder alle ti faste baner, specialregler, sand/koraller, unik tile-identitet, 1.000 seedede træk, økonomi, gemmevalidering og konsistente juveltemaer.
- Produktionsbuild og typecheck består.
- Produktionsspillet er gennemført gennem touch-UI på alle ti baner; brugte træk: 4, 6, 6, 5, 3, 8, 6, 3, 15, 10. Førstegangsbelønninger gav samlet 440 skaller inklusive startbeløbet. Dette er en test af lovlige vinderveje, ikke en måling af et barns sværhedsgrad.
- Fem skærmstørrelser: 390×844, 320×640, 844×390, 768×1024, 1024×768. Primære kontrolknapper er mindst 48×48 CSS-pixels. Brættets enkelte felter er mindre på smalle telefoner, fordi otte felter skal kunne vises samtidig.
- Reload under den sidste vindende kaskade giver samme bræt og præcis én belønning. Køb, flytning, fortryd, refundering, eksport og gyldig/ugyldig import er kontrolleret.
- Produktions-serviceworker er kontrolleret med offline genåbning og et efterfølgende lovligt træk. En reel cachefejl med Vary: Origin blev fundet og rettet i denne test.
- CDP-touch test kontrollerer positionen mens fingeren trækkes, gyldigt bytte, ugyldigt bytte og touchCancel. Række-, kolonne-, bombe- og farveeffekter er kontrolleret for synlige partikler og korrekt trækforbrug.
- Ingen browser-JavaScriptfejl i den fulde gennemspilning.

## Bevidste afgrænsninger / næste telefonkontrol

- Ingen fysisk iPhone eller Android er tilgængelig her. Test derfor reel fingerfølelse, billedhastighed, varme/batteri, browserens bundbjælke, rotation og hjemmeskærmsinstallation på telefonen. Emulering dokumenterer ikke konstant 60 fps på ældre enheder.
- Fiskene er 2D-illustrationer med animerede dele og adfærd, ikke 3D-skeletter. Billedreference og Fishdom er stil-/oplevelsesretning, ikke kopierede aktiver eller en dokumenteret 1:1-leverance.
- Dansk oplæsning er Web Speech og afhænger af enhedens stemmer. Der er ikke produceret en separat dansk voiceover-pakke.
- Lagring er lokal. Safari/private faner kan begrænse eller fjerne data; eksportér en kopi før browserskift eller rydning af historik.
- Spillet er indholdsmæssigt afgrænset til bibelens ti baner; gentagelser er mulige. Sværhedsgrad og 2–5 minutters menneskelig spilletid skal vurderes sammen med Liv.
- GitHub Pages udgives af workflowet ved push til main. Udgivelsesstatus kontrolleres separat fra lokale test; en grøn lokal build er ikke i sig selv en bekræftelse på offentlig deployment.
