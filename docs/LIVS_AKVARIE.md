# Livs akvarie

Aktivt projekt fra 14. oktober 2026. Brugerens kursændring erstatter arbejdet på Livs Dyreø. Navnet **Livs akvarie** erstatter Boblebugten; den uploadede BOBLEBUGTEN_BIBEL_v1_2.pdf er designgrundlag, ikke en leveringserklæring.

## Bevaring og udgivelse

Livs Dyreø er sat på pause. Den ikke-udgivne 3D-animationsprototype er bevaret i commit `1f14aab` på `archive/livs-dyreo-animation-wip`; den blev ikke godkendt som visuel slutkvalitet. Den tidligere udgivne ø findes i historikken ved `f29f87a`.

Akvariet udvikles på `feat/livs-akvarie` med egen kode under `src/aquarium`, egne medier under `public/aquarium` og sin egen save-nøgle. Den eksisterende offentlige GitHub Pages-ramme genbruges. Ændringer udgives først efter funktionel og visuel kontrol.

## Produktmål

Et dansk, fuldskærms mobilspil til Liv på 9 år. Spillepladen er centrum, ikke en rullende hjemmeside. Original grafik inspireret af bibelens undervandsstemning og match-3-genrens taktile effekter; ingen kopier af Fishdoms figurer eller assets. Bløde træk, tydelig feedback, skinnende formkodede brikker, korte eksplosioner, kædereaktioner og fisk med synlig adfærd.

## Bindende spilindhold

- 8×8 bræt. Lilla skal, gul stjerne, blå dråbe, grønt blad og hvid perle.
- Byt kun ortogonale naboer. Ugyldigt bytte returnerer uden trækforbrug. Gyldigt bytte koster ét træk, uanset kaskader.
- Fire i linje giver en række-/kolonnestråle; fem i linje en farveperle; L/T med mindst fem en 3×3-boblebombe. Prioritet farveperle, bombe, stråle.
- Koral tåler ét direkte eller ortogonalt nabohit. Sand fjernes ved rydning på selve feltet. Købaserede specialeffekter tæller hvert tile-id én gang.
- Ingen startmatches, mindst ét gyldigt træk, deterministisk gemt PRNG, gratis omblanding af døde brætter.
- Ti baner med bibelens mål og trækgrænser. Gratis gentagelser, forslag og fem ekstra træk. Ingen tidspres, liv, køb eller annoncer.
- Start 40 skaller. Første sejr pr. bane +40; gentagelser +10. Belønninger og køb gemmes atomisk; ingen dobbelt førstegangsbelønning.
- Bobo gratis, Sky 40, Glimt 60, Plet 80. Søgræs 15, hule 20, ring 20, koralbue 25, muslingeseng 25, boblesten 30, trævrag 30, festlanterne 35. Otte dekorationspladser. Gratis flytning og fuld refundering af dekorationer.
- Dansk hjælp/op­læsning når browseren understøtter den, lyd på brugertryk, pause ved skjult fane. Eksport/import af valideret save med backup.

## Accept

Test regler, determinisme, alle ti seed-baner, økonomi, genindlæsning under kaskade og mobile layouts. Faktisk telefonperformance og subjektiv spilfølelse skal holdes adskilt fra automatiske testresultater. Referencebilleder er ambitionsmål, ikke bevis for implementeret kvalitet.
