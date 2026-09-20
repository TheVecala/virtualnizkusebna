# Etapa 6 — Mixér ve společné navigaci

20. 9. 2026. Větev `feature/zkusebna2.0`, výchozí HEAD
`4de4c3e80e08dd238fc30142daa62941242f9534`.

## Chování

Samostatná sekce Mixéru byla nahrazena přehrávačem uvnitř karty vícestopé
nahrávky ve společném seznamu skladeb a zkoušek. Vždy existuje jediná instance
přehrávače a v otevřené kartě jediný panel timestampů. Zavření přehrávače
obnoví běžnou kartu se stejnými timestampy. Souhrn, soubory, práva a akce
nahrávky zůstávají součástí karty. Diskuse dál používá rodičovskou kolekci.

Výběr kolekce nebo nahrávky se propisuje do URL, podporuje reload i historii
prohlížeče. ID nahrávky má přednost před zastaralým collection_id, takže odkaz
po přesunu otevře současného rodiče. Mixér umí zkopírovat odkaz s time_ms.
Starý view=mixer bez ID otevře katalog; odkaz se single recording_id zůstává
u běžného přehrávače. Chybějící ID nikdy nevybere náhradní nahrávku k přehrávání.

Přepnutí kolekce a zavření zastaví smyčku, zruší načítání a uvolní přehrávač.
Čítač navigací odmítá opožděný výsledek seznamu Mixéru po opuštění nahrávky;
čítač katalogu odmítá starší souběžnou odpověď. Událost ready aplikuje čas
odkazu pouze jednou, takže obnovení katalogu nepřevíjí již hrající audio.

`managedNavigation` v existujícím přehrávači umožňuje VZ2 řídit výběr, ruší
jeho samostatný seznam a automatické počáteční načítání. Výchozí chování
starého samostatného modulu se nemění. Prázdný skrytý mt-selector zůstává
jako součást existujícího DOM rozhraní přehrávače.

Bez změny SQL, API, autorství, auditu, souborových cest či klíčů offline cache.
Interní multitrack zůstává; v nové navigaci se používá „Mixér“ a „vícestopá
nahrávka“. CSS se v této etapě nepředělává.

## Ověření

Výsledek: **176 integračních kontrol PASS**, z toho 9 nových scénářů navigace.
Prošly i samostatné regrese Mixéru v prohlížeči, DOM kontrakt (45 ID), parser
sample rate, timestampové intervaly/export a kontrakt offline stahování.
Syntaxe PHP a JavaScriptu i `git diff --check` jsou v pořádku. Mobilní
zobrazení bylo zkontrolované také vizuálně. Poslední integrační běh:
`vz2-integration-igoz23` v lokálním dočasném adresáři.

Rozšířené browser scénáře ověřují společný katalog, jediný vložený přehrávač
a timestampový panel, URL a přímý časový odkaz, historii bez reloadu,
prázdnou zkoušku, pozdní odpověď při navigaci, přesun se zachovanými file ID,
hosta, mobilní rozměry, odebrané audio a zcela smazanou nahrávku.
Dosavadní integrační scénáře etap 2–5 zůstávají součástí stejného běhu.
Testy vytvářejí vlastní DB a storage; nepoužívají živou konfiguraci.

Lokální runtime: PHP 8.5.10, MariaDB 11.4.5 s nestriktním globálním režimem,
headless Edge přes Playwright. Živé nasazení etapy 6 ještě neproběhlo.

## Nasazení a stav repozitáře

Provozní změny: `vz2.php`, `js/vz2.js`, `js/multitrack.js`.
Testy: nový `tests/vz2_navigation.browser.js`, upravené
`tests/vz2_integration.test.js` a `tests/vz2_timestamps.browser.js`.
Balíček a návod: `deploy/vz2-stage6/README.cs.md`, režim `stage6` v
`tools/vz2_release.js`; vygenerované soubory v `dist/vz2-stage6` jsou ignorované.

Při začátku byly necommitnuté změny postupu etapy 5, úklidu a zachování staré
verze na old. Zůstávají zachované. Etapa 6 nezakládá CSS vlákno, nenasazuje
alfu, nezřizuje old a nemaže data. Secure/HttpOnly přihlašovací cookie zůstává
samostatně evidované k dořešení před finálním nasazením.

Nebyl proveden commit ani push. Výsledný HEAD zůstává stejný jako výchozí;
změny této etapy i předchozí dokumentační změny jsou v pracovním stromu.
