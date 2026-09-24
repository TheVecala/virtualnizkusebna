# Etapa 5 — dokončení bety

Výchozí stav: commit `d8fd9722`, etapa 4 ověřená uživatelem na hostingu.
Nejprve dokončíme a ověříme funkce bety, potom v samostatném vlákně upravíme
její CSS a vzhled. Do té doby současná alfa zůstává v provozu beze změny.
Teprve funkčně i vzhledově hotovou betou uživatel nahradí alfu;
původní zkušebna zůstane odděleně jako prázdná ukázka pro porovnávání.

**Upřesnění:** stará verze se zachová bez uživatelského obsahu na samostatné
subdoméně, pracovně `zkusebna-old.dusanovakapela.cz`. Dodatečné heslo Apache
uživatel odmítl; původní přihlášení aplikace se tím nemění. Její kód se neslučuje
s VZ2 a ukázka se nepřipojí k živému uživatelskému obsahu. Před přepsáním
současné alfy se zachová její kód a ověří oddělená prázdná verze.
Podrobnosti jsou v `_pomocne/docs/vz2/legacy-comparison.md` v repozitáři.

## Teď: aktualizace bety

1. Uložte si mimo veřejný web aktuální soubory a oba konfigurační soubory bety.
   Databázi ani uživatelská data tato aktualizace nepřevádí.
2. Obsah **`1_soubory`** nahrajte do **`zkusebna_beta`** se zachováním podsložek
   a přepsáním stejných názvů. Obalovou složku `1_soubory` nekopírujte.
   Během přenosu web nepoužívejte; `index.php` přeneste poslední.
3. Až jsou všechny soubory nahrané, v existujícím **`config.vz2.php` na betě**
   přidejte následující řádek za úvodní `<?php` (pokud tam už je, změňte jej;
   každou konstantu definujte právě jednou):

   ```php
   define('VZ2_ONLY', true);
   ```

   `VZ2_ENABLED` a `VZ2_WRITES_ENABLED` ponechte `true`, prostředí `beta`.
   Dataset, privátní úložiště a ostatní hodnoty ponechte beze změny.
   Soukromý `config.php` se v tomto kroku nemění.
4. Otevřete [hlavní adresu bety](https://zkusebna_beta.dusanovakapela.cz/)
   a obnovte stránku přes Ctrl+F5. Už bez `?v=2` se musí otevřít VZ2.

**V této etapě se nespouští žádné SQL. Migrace 001–003 už byly použité.**
Databáze zůstává `18810_virtualni_zkusebna`; prázdná `18810_VZ2` se nepoužívá.
ZIP neobsahuje konfiguraci, hesla, úložiště ani starý uživatelský obsah.

## Ověření dokončené bety

- Přihlášení a odhlášení správce, muzikanta a hosta. Host jen čte.
- Hlavní stránka i návrat z Účtů vedou do VZ2. Odkaz „Původní zkušebna“ zmizel.
  „Server“ v administraci ukazuje evidenci VZ2, ne staré adresáře.
- Skladba i zkouška: vytvoření, přejmenování, pořadí; běžná nahrávka i vícestopá
  nahrávka, přehrání a posun, Mixér, příloha. Vyzkoušejte vlastní zkušební obsah.
- Timestamp a smyčka, text a akordy, tabulatura, historie a obnovení verze,
  diskuse a Nápady. Otevření nahrávky přes přímý odkaz po přihlášení.
- Muzikant neupraví cizí příspěvek; dvě otevřená okna při souběžné úpravě
  nabídnou konflikt a zachovají rozepsaný text.
- Správce vidí změny v Deníku, včetně změny zkušebního účtu s prostředím beta.
  Deaktivovaný účet ztratí přístup. Neměňte při zkoušce jediného správce.
- Odebrání audia u vlastní zkušební nahrávky zachová její poznámky a timestampy.
  Staré soubory zkušebny se tím nemažou.

Přímé staré AJAXové a zapisovací stránky nyní vracejí HTTP 410. To je záměrné:
starý obsah se už přes ně nemění. Neznamená to, že byl ze serveru smazán.

## Dočasná kontrola před předáním

Obsah složky `2_docasna_kontrola` nahrajte do kořene bety; vznikne jediný soubor
`tools/vz2_preflight.php`. Přihlaste se jako správce a otevřete
[kontrolu bety](https://zkusebna_beta.dusanovakapela.cz/tools/vz2_preflight.php).

Očekáváme `ok: true`, `environment: beta`, `vz2_only: true`,
`writes_enabled: true`, databázi `18810_virtualni_zkusebna`, 13 tabulek,
diskuse typu MEDIUMTEXT, strict režim spojení, žádné nedokončené operace
a `available_files.invalid_count: 0`. Velikosti se porovnávají se SQL;
nejde o porovnání hashů obsahu ani nové ověření HTTP ochrany.

Po kontrole smažte **jen `tools/vz2_preflight.php`**, nikoli celou složku tools.
Anonymní návštěva této konkrétní adresy potom má vrátit 404.
Výsledek kontroly lze poslat do této konverzace; neposílejte `config.php`.

## Později: hotová beta nahradí alfu

Tento krok následuje až po dokončené funkční kontrole **a úpravě vzhledu bety
v samostatném vlákně**, když je připravená také stará verze na `old`.
Dosavadní ZIP etapy 5 není finální balíček po změně CSS: pro kopírování na
alfu připravte kompletní aktuální verzi včetně upravených stylů a assetů.
Nejde o přizpůsobování
nového kódu staré alfě: nasadí se kompletní ověřený kód bety. Přírůstkový ZIP
v režimu `beta` k tomu nestačí. Režim balíčku je uvedený v `manifest.json`.

1. Pořiďte čerstvou zálohu společné DB, privátního úložiště a obou konfigurací
   mimo veřejný web. Nejdřív připravte starou verzi jako samostatnou prázdnou
   ukázku bez kopírování uživatelských souborů a SQL obsahu. Ověřte zobrazení,
   původní přihlášení a prázdné katalogy, teprve pak pokračujte nahrazením alfy.
   Kvůli přípravě ukázky nemažte data současné instalace.
2. Vyhraďte krátké servisní okno. Na betě nastavte `VZ2_WRITES_ENABLED=false`,
   nechte doběhnout již zahájené požadavky a uploady (hosting má limit 300 s).
   Zkontrolujte nedokončené operace. Případnou obnovu dokončete na betě ještě
   před předáním; alfu zatím nezapínejte pro zápis. Po obnově betu opět uzamkněte.
3. Alfu při nahrávání uzavřete proti HTTP přístupu: původní `.htaccess` si
   uschovejte mimo web a dočasně v samotné složce `zkusebna` použijte
   `Require all denied`. Ověřte HTTP 403. Neměňte společný kořen ani ochranu
   `_vz2_storage`. Potom nahrajte kompletní provozní soubory ověřené bety.
4. Soukromou funkční konfiguraci bety zkopírujte lokálně pro alfu a upravte
   `SITE_URL` na `https://zkusebna.dusanovakapela.cz`, `VZ2_ENVIRONMENT` na
   `alpha`, `VZ2_WRITES_ENABLED` zatím na `false`. `VZ2_ONLY` zůstane `true`.
   Zkontrolujte `MAIL_FROM` a případné cookie domény/cesty. Relativní cesty
   nahrávek, připojení ke společné DB, dataset i storage root se **nemění**.
   Konfigurační soubory nepřidávejte do Gitu ani veřejného ZIPu.
5. Obnovte původní pravidla webu místo servisní blokace (případná pravidla,
   která přesměrovávala na starou aplikaci, musí odpovídat nové instalaci).
   Ověřte alfu pouze pro čtení: stejné položky, přehrávání, dokumenty,
   přihlášení všech rolí a správné odkazy bez návratu na betu. Stejný dočasný
   preflight musí projít i na alfě s `environment: alpha`, `writes_enabled: false`.
6. Až pak zapněte zápisy na alfě. Beta zůstane pouze pro čtení. Na alfě ověřte
   jeden upload, úpravu textu a zkušebního účtu a prostředí `alpha` v Deníku.
   Odstraňte dočasný preflight z obou instalací.

Obě instalace používají stejný dataset
`vz2-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4` a stejnou fyzickou cestu
`/data/www/18810/dusanovakapela_cz/_vz2_storage`. Obsah se nekopíruje ani
znovu nemigruje. Místní audio cache prohlížeče se mezi prostředími nepřenáší;
uživatel si případné offline kopie na nové adrese uloží znovu.

## Návrat při problému

Před předáním alfě stačí opravit betu; `VZ2_ONLY=false` dočasně vrátí její
původní rozcestí, přičemž VZ2 zůstává na `index.php?v=2`.

Po předání nejprve vypněte zápisy na alfě a nechte doběhnout požadavky.
Ověřená beta se stejnou DB a storage může poté znovu dostat zápisy. Nové položky
vytvořené na alfě zůstanou dostupné. **Neobnovujte celou společnou databázi přes
novější obsah nebo účty.** Přepínače jsou ruční: před zapnutím jednoho webu
ověřte, že druhý má zápisy vypnuté.

## Starý obsah

Samotné nahrazení aplikace nemaže staré tabulky ani userdata. Úklid je oddělený
krok až po úspěšném přechodu; konkrétní postup je v `_pomocne/docs/vz2/cleanup.md` v repozitáři.
Kód a oddělené provozní závislosti prázdné staré ukázky zůstávají z úklidu
vyloučené. Starý uživatelský obsah se do ukázky nepřenáší; jeho případné
smazání na původním místě zůstává samostatným krokem.
