# Livs magiske akvarie

Aktivt projekt fra 14. oktober 2026. Brugerens kursændring sætter Livs Dyreø på pause. BOBLEBUGTEN_BIBEL_v1_2.pdf er designgrundlag; brugerens senere ønsker om 30 baner, ti udvidelser og titlen Livs magiske akvarie går forud for dokumentets tidligere navn/omfang.

## Produktmål

Et dansk fuldskærms mobilspil, hvor brættet og det levende akvarium er centrum. Original grafik; Fishdom er en oplevelsesreference, ikke en kilde til kopierede figurer eller aktiver. Ingen reklamer, køb, tidsfrister, liv eller pasningspligter.

## Regler

- 8×8 koordinatnet med 30 individuelt formede, sammenhængende brætter. Manglende felter er åbent vand; faste sten kan ikke flyttes eller ødelægges.
- Fem letgenkendelige familier: skal, stjerne, dråbe, blad og perle. Hver bane har sit eget illustrerede sæt med andre konturer, facetter og farvenuancer. HUD og bræt viser samme sæt.
- Byt ortogonale naboer. Ugyldigt bytte koster intet. Gyldigt bytte eller aktivering koster ét træk, uanset kaskader.
- Fire i linje giver stråle; fem farveperle; L/T på mindst fem giver 3×3-bombe. Prioritet farveperle → bombe → stråle.
- To stråler giver én række + én kolonne. Bombe + stråle giver tre rækker + tre kolonner. To farveperler rydder alle spilbare felter. Hver tile-identitet og special tælles én gang per effektkø.
- Koral fjernes af et nabomatch eller direkte hit. Sand fjernes under ryddede brikker. Muslinger åbner efter to separate bølger med nabomatch/direkte hit. Én åbnet musling tæller én mod målet.
- Boblefelter løfter brikken ét felt én gang pr. gyldigt træk; nye matches opløses. Strømmen skifter i begyndelsen af et gyldigt træk; kompassets forhåndsvisning viser næste retning, og under faldet den aktuelle.
- Ingen startmatches; mindst ét gyldigt træk. Seedet PRNG, gratis omblanding af døde brætter. Alle 30 baner har testede vinderforløb; gratis hint, omspil og fem ekstra træk.

## Skaller og udvikling

Start 40; første sejr +40, gentagelse +10. 10 af førstegangsbelønningens 40 er beskyttet revopsparing, indtil de samlede 220 projekt-skaller er betalt. Det er del af samme pung, ikke ekstra valuta. Butikken viser frie skaller separat.

| Område | Baner | Adgang |
| --- | --- | --- |
| Solbugten | 1–6 | Fra start |
| Koralhaven | 7–14 | Væk korallerne: 60 efter bane 6 |
| Perlelagunen | 15–22 | Tænd perlelyset: 80 efter bane 14 |
| Stjernedybet | 23–30 | Byd stimefiskene hjem: 80 efter bane 22 |

Bobo gratis, Sky 40, Glimt 60, Plet 80. Grunddekorationer: søgræs 15, hule/ring 20, koralbue/muslingeseng 25, boblesten/trævrag 30, lanterne 35. Perletræ 100 efter andet revprojekt; måneport 140 efter tredje. Hule og ring har hver to udvidelser til 40 og 70. Det samlede katalog koster 620, udvidelser 220 og revet 220. 30 førstegangssejre + startbeløb giver 1240, altså 180 tilbage efter alt indhold.

Tolv magnetiske ankre, fri normaliseret placering og fortryd. Alle dekorationskøb og udvidelser refunderes fuldt ved salg. Der er ingen tilfældige præmiekasser. Fire fisk har to kapitler hver, udløst af indretning og udvidelser; ingen sult, sygdom eller straf for pauser.

## Gemning og kompatibilitet

Egen nøgle livs-akvarie.save.v1; version og projekt-id bevares ved navneændringen. Valideret hovedgemning + backup. En afbrudt kaskades gemte intention genafspilles deterministisk én gang. Import kræver validering og bekræftelse; eksport er lokal JSON.

Gamle gemninger beholder deres gamle brætform, også når den nye udgave af samme bane har huller. Allerede spillede baner forbliver tilgængelige. Manglende revopsparing tilføjes én gang med 10 per gammel gennemført bane; allerede frie skaller reduceres ikke.

## Accept og udgivelse

Test regler, alle 30 seeds, økonomi, save-migration, reload under kaskade, touch, regionlåse, projektbetaling, udvidelser, historier, placering, postkort, import/eksport og offline. Faktisk telefonperformance og subjektiv spilfølelse skal holdes adskilt fra browseremulering.

Aktiv kode: src/aquarium, medier: public/aquarium. GitHub Actions udgiver main til den eksisterende offentlige Pages-adresse. Øens animationsprototype er bevaret på archive/livs-dyreo-animation-wip ved 1f14aab; tidligere ø ved f29f87a. Ingen ændringer i øens save-nøgle.
