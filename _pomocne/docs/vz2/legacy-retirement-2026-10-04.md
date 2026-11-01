# Odstranění původní zkušebny z aktuální bety

Výchozí stav: `560688d` na `feature/VZ1_cleanup`, hlavní pracovní adresář.
Nová aplikace je nasazená na `zkusebna_beta`; gitová `alpha` a hlavní web
dosud obsahují starý kód. Původní zkušebna má také samostatnou subdoménu.
Tento úklid mění pouze lokální zdroje nové aplikace, nikoli hosting a data.

## Provedené změny

- `index.php` bez podmínky otevírá `vz2.php`. Dotazy a současné deep linky
  předává beze změny; parametr `v=1` již nemůže obnovit původní aplikaci.
- Odstraněno 119 provozních souborů: původní inventura 117, starý vstup
  `multitrack.php` a ikona kazety, kterou po odstranění starého seznamu
  mixéru už žádný provozní soubor nepoužívá.
- Mixér zůstává: odstraněny staré uploady, samostatný katalog, Bootstrap /
  jQuery modály a příslušné styly. Zachováno přehrávání, zdrojová kontrola
  vzorkovací frekvence, ztlumení/sólo, offline kopie a rozhraní MultitrackApp.
- Administrace používá jen SQL přehled současného obsahu. Starý průchod
  `user/`, strom adresářů, přepočet a session cache jsou odstraněné.
- Povolené PHP vstupy se kontrolují trvale. VZ2_ONLY už kód nečte, ale
  VZ2_ENABLED, kontrola režimu zápisu, rolí, CSRF a datasetu zůstávají.
- Přihlašování používá stejné osobní účty; odstraněny nepoužívané barvy
  staré session a pomocná větev pro dávný bootstrap prvního administrátora.
- Nápověda popisuje společný katalog, vícestopé nahrávky a mapu skladby;
  je dostupná z nabídky nové aplikace. Starý vložený panel nápovědy odstraněn.
- Staré testy workspace a offline main.js vyřazeny. Kontroly mixéru,
  administrace a účtů převedeny na současnou aplikaci.
- Integrační fixture a preflight doplněny o existující migraci 005. Bez ní
  stará sada vytvářela pouze 13 tabulek, ačkoli aktuální katalog čte historii.
- Release nástroj vytváří kompletní balíček 66 provozních souborů a explicitní
  seznam 119 cest k odstranění. Historické dílčí režimy stage6/session již
  nejsou nabízeny. Konfigurace, SQL, diagnostika a data se nebalí.

Přesný seznam pro FTP je v `../../deploy/vz1-retirement/removed-files.txt`.
Postup aktualizace bety a následného přesunu přejmenováním adresáře je v
`../../deploy/vz1-retirement/README.cs.md`. Dokumenty z 3. října jsou historickou
inventurou; rozhodující je nynější seznam a ověřený obsah balíčku.

## Data a pozdější změna adresy

Žádné tabulky ani skutečná uživatelská data nebyly změněny. Soukromé config.php
a config.vz2.php na serveru se nenahrazují. Sdílené _vz2_storage a identita
datasetu zůstávají na místě. Přejmenování adresáře aplikace a změna SITE_URL
jsou následný krok; ověřit document root, veřejné aliasy, ochranu storage a
VZ2_ENVIRONMENT. Cookies a lokální offline kopie se mezi doménami nepřenášejí.

Odstranění starého uživatelského obsahu a tabulek vyžaduje samostatnou inventuru
serveru. removed-files.txt je pouze seznam zdrojového kódu a statických podkladů.

## Ověření 4. října 2026

Testy používají samostatnou dočasnou MariaDB, dočasné kopie aplikace a vlastní
konfiguraci. Nepřipojují se k provozní databázi ani nenačítají její konfiguraci.

Úspěšně dokončeno:

- Cílená HTTP integrace úklidu: 65 kontrol. Ověřuje nové vstupy i při `v=1`
  a starém `VZ2_ONLY=false`, všechny odstraněné PHP adresy, osobní účty,
  správu obsahu, role, diagnostiku a přepnutí prostředí se stejnými daty.
- Integrace účtů: 48 kontrol (přihlášení, host, CSRF, změny rolí a hesel,
  zneplatnění session, ochrana posledního správce, deep link).
- Přehled úložiště: 6 kontrol včetně chyb a nedokončených operací.
- Mixér: kontrola HTML/JS/CSS, parser vzorkovací frekvence a prohlížečový
  smoke test přehrávání, ovládání, offline kopií a částečně chybějících stop.
- Start aplikace v prohlížeči: opožděné/chybějící styly a skripty, chyba
  katalogu, opakování, pomalé audio, různá rozlišení a vypnutý JavaScript.
- Testy cookies, timestampových intervalů/exportu a kontraktu historie.
- Inventura 119 odstraněných cest, kontrola zbývajících odkazů a vytvoření
  balíčku 66 souborů bez konfigurace a dat.
- Syntaxe 38 PHP souborů, 18 JS souborů a `git diff --check`.

Cílený HTTP běh: nastavte `PHP_BIN`, port **samostatné testovací MariaDB**
v `VZ2_TEST_DB_PORT` a `VZ2_TEST_SUITE=cleanup`; spusťte
`node _pomocne/tests/vz2_integration.test.js`. Přidání
`VZ2_TEST_BROWSER=cleanup` zahrne prohlížečové scénáře přihlášení a odhlášení.

**Omezení:** kompletní integrační/prohlížečová sada není potvrzena jako zelená.
Dlouhé HTTP běhy opakovaně končily timeoutem na různých místech, také v dočasné
kopii výchozího kódu. Cílené browser scénáře dokončily administrátora a člena,
ale celý běh včetně hosta nedoběhl spolehlivě (timeout při navigaci/odhlášení).
Starší browser testy časových značek a Looperu navíc očekávají již neaktuální
přesné texty (`Začátek` bez doplňku neúplného úseku, `Aktualizovat čas`). Jejich
produkční implementace se tímto úklidem nemění. Nasazení na skutečném hostingu
ani kompletní uživatelský průchod tam nebyly provedeny.
