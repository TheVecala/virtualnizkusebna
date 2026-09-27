# Přihlašovací cookie — aktualizace bety po etapě 6

Balíček navazuje na commit `7466cbd`. Obsahuje 41 PHP souborů: společné
nastavení session a vstupní stránky, které je používají. Konfigurace,
databáze ani uživatelské soubory nejsou součástí balíčku.

1. Rozbalte ZIP na počítači.
2. Na FTP bety nejprve nahrajte nový soubor
   `1_soubory/php/inc/session.php` do `zkusebna_beta/php/inc/session.php`.
   Musí být dostupný dřív než upravené stránky, které ho načítají; tím se
   předejde krátké chybě během nahrávání. V dalším kroku se nahraje znovu,
   což nevadí.
3. Potom nahrajte **obsah** složky `1_soubory` do `zkusebna_beta`,
   se zachováním podsložek a přepsáním odpovídajících souborů.
   Složku `1_soubory` jako takovou na FTP nevytvářejte. Nic předem nemažte.
4. Otevřete betu přes HTTPS, odhlaste se a znovu se přihlaste.
   Tím dostane i dosavadní přihlašovací cookie nové příznaky.
5. Zkontrolujte otevření skladby a přehrávání. Pak oznamte, že je nahráno;
   hlavičku nově vydané cookie lze ověřit zvenčí bez přihlašovacích údajů.

Na HTTPS má nová cookie `Secure`, `HttpOnly` a výchozí `SameSite=Lax`.
Zachovává se stávající název, doba platnosti, cesta a doména cookie.
Lokální vývoj přes HTTP zůstává možný. Detekce HTTPS používá proměnnou
webserveru, nikoli hlavičky dodané návštěvníkem; její skutečné chování
na hostingu ověříme po nahrání.

README, STAV ani manifest na hosting nepatří. Balíček neobsahuje `tools`,
žádný diagnostický soubor se znovu nevystavuje. Nasazuje se pouze na betu.

## Opakované vytvoření balíčku

`node _pomocne/tools/vz2_release.js dist/vz2-session/balicek session`

Výstupní složka musí být nová. Manifest uvádí SHA-256 přesného obsahu
pracovního stromu; změny mohou být dosud necommitnuté.
