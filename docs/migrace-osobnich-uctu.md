# Osobní účty – nasazení na betu a poté alfu

Checkout obsahuje **cílový nový login**. Nenahrávat všechny soubory najednou před
vytvořením prvního admina. Společnou databázi nemění žádná PHP stránka automaticky.

## A. Ruční kroky na betě PŘED přepnutím loginu

1. Zálohujte společnou databázi a současné serverové soubory bety, zejména
   `config.php`, `index.php` a `php/loginbox4.php`. Alfa zatím zůstává beze změny.
2. Ve společné databázi jednou spusťte celý soubor
   `migrations/001_personal_accounts.sql`. Vytvoří jen `users`, `auth_settings`
   a záznam `auth_settings.id = 1` s vypnutým hostem. Nevytváří žádné účty.
   SQL není určeno k opakovanému spuštění. Pokud tabulky již existují, nejprve
   ověřte jejich strukturu a stav; nemažte je ani neresetujte nastavení.
3. Na betu nahrajte pouze `php/auth.php`, `css/admin.css` a
   `create_first_admin.php`. Stávající `css/help.css` už na betě musí být.
   **Zatím ponechte serverový starý `config.php`, `index.php` a login beze změny.**
4. Na `https://zkusebna_beta.dusanovakapela.cz/` se přihlaste současným
   administrátorským heslem (`HESLO_ADMIN`). Ve stejném prohlížeči otevřete
   `/create_first_admin.php`, zadejte jméno, osobní heslo a jeho potvrzení.
   Heslo si bezpečně uschovejte; nelze jej později zobrazit.
5. Ověřte hlášení, že aktivní administrátor již existuje, a v databázi:

   ```sql
   SELECT id, name, role, active FROM users;
   SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1;
   ```

   Počet musí být alespoň 1. Opětovné otevření nebo odeslání bootstrapu dalšího
   prvního admina nevytvoří. **Dokud vytvoření nepotvrdíte, nepřepínejte login.**

## B. Přepnutí bety a ověření

1. V krátkém servisním okně nahrajte `admin.php`, nový `index.php` a nový
   `php/loginbox4.php`; `php/auth.php` a `css/admin.css` musí být již nahrané.
2. Do serverového **beta** `config.php` přeneste blok na konci tohoto checkoutu
   začínající komentářem `// Osobní účty:` (`require_once` a `try/catch`).
   Ponechte databázové údaje, `SITE_URL`, `MAIL_FROM` i mapu `PRAVA` bety.
   Neměňte session cookies ani `session_name()`.
3. Odhlaste se a přihlaste se heslem nového admina. Staré session bez osobní
   identity jsou po přepnutí zneplatněné. Login používá výhradně `users` a
   `auth_settings`, nemá fallback na konstanty ani přepínač režimu.
4. Otevřete Administraci z hlavního menu (na mobilu v nabídce dalších možností).
   Přidejte muzikanta a případně dalšího admina. Ověřte změnu jména/role/hesla,
   deaktivaci, opětovnou aktivaci, odmítnutí duplicitního hesla a odmítnutí
   deaktivace i degradace posledního aktivního admina.
5. Samostatně nastavte a povolte hosta. Vyzkoušejte admina, muzikanta i hosta
   v oddělených prohlížečích nebo po odhlášení. Ověřte `last_login` členů,
   přesměrování z přímého odkazu na nahrávku a dosavadní akce odpovídající rolím.
   Muzikant, host i nepřihlášený návštěvník musí při GET i POST na `admin.php`
   dostat HTTP 403. Stejně je chráněn bootstrap.
6. Ověřte vypnutí hosta, reset hesla a změnu role také v již otevřeném okně.
   Nový login ukládá původní `logged_in_single` a `role`, navíc `user_id`,
   `user_name` a interní otisk hashe pro zneplatnění session po změně hesla.
   Vstupní stránka a endpointy načítající `config.php` průběžně obnovují roli
   a ověřují aktivitu účtu. Staré čtecí endpointy, které konfiguraci vůbec
   nenačítají, zůstávají beze změny; úplné sjednocení jejich autorizace není
   součástí této migrace.
7. Po úspěšném ověření odstraňte ze serverového beta `config.php` definice
   `HESLO_ADMIN`, `HESLO_MUZIKANT`, `HESLO_HOST` (v cílovém checkoutu již nejsou).
   Odstraňte `create_first_admin.php` ze serveru i z checkoutu. Bootstrap je
   dočasná pomůcka, není součástí dlouhodobé správy. Není v menu.

Při aktivaci neaktivního člena nebo zapnutí vypnutého hosta je nutné zadat heslo
a potvrzení, klidně stejné jako dříve, pokud není v konfliktu. Dva různě solené
hashe nelze porovnat pro zjištění shodného hesla, proto server potřebuje heslo
znovu ověřit proti ostatním aktivním přístupům. Pouhé přejmenování aktivního
člena ani vypnutí hosta nové heslo nevyžaduje. Změna vlastního hesla admina
ukončí jeho přihlášení; degradace vlastní role jej vrátí do aplikace.

Zápisy a kontrola prvního/posledního admina jsou v transakcích se společným
zámkem řádku `auth_settings.id = 1`. Stejný zámek musí zachovat i budoucí úpravy
těchto tabulek. Hesla mají alespoň 3 znaky, nejvýše 72 bajtů UTF-8 kvůli limitu
bcryptu používaného `PASSWORD_DEFAULT`. Nejsou trimována ani jinak normalizována.

## C. Přenos beta → alfa

Po úplném ověření bety přeneste `admin.php`, `php/auth.php`, `css/admin.css`,
`php/loginbox4.php` a `index.php`. Stávající `css/help.css` musí být přítomné.
Do **alfa** `config.php` ručně přeneste pouze blok `// Osobní účty:` a po ověření
odstraňte staré `HESLO_*` definice. **Nikdy nepřepisujte celý alfa config beta
konfigurací:** alfa musí zachovat vlastní `SITE_URL`, další lokální hodnoty
a databázové připojení.

SQL ani bootstrap na alfě znovu nespouštějte. Účty a hostovské nastavení jsou
již ve společné databázi. Bootstrap, dokumentaci a testy není třeba na alfu
nahrávat. Alfa do přepnutí nadále používá vlastní starý login a nové tabulky
ignoruje; změny osobních účtů její stará sdílená hesla neovlivňují.

## Co vyžaduje skutečný server a ruční krok

- Záloha a jednorázové provedení SQL ve společné databázi.
- Přihlášení starým admin heslem a vytvoření skutečného prvního admina.
- Postupné nahrání souborů, ruční úprava configu se zachováním adresy subdomény.
- Ověření reálných rolí, přímých odkazů a stávajících funkcí na betě.
- Následné odstranění bootstrapu a přenos na alfu.

Žádný z těchto kroků se nepovažuje za provedený pouze změnou checkoutu.

## Lokální integrační testy

`tests/auth_integration.php` se spouští pouze přes PHP CLI s rozšířením `mysqli`.
Vyžaduje samostatnou lokální MariaDB na nestandardním portu (například 33316).
Test nikdy nepoužije připojení aplikace: vytvoří náhodně pojmenovanou testovací
databázi, kopii stránek s lokálním configem a PHP HTTP server na loopbacku.
V `finally` svůj server ukončí a pouze tuto vlastní databázi odstraní. Dočasné
soubory a log zůstanou pro diagnostiku v adresáři vypsaném testem.

PowerShell, při dostupném `php` v PATH:

```powershell
$env:AUTH_TEST_DB_PORT = '33316'
php tests/auth_integration.php
```

Pro kratší samostatné běhy nastavte `AUTH_TEST_SUITE` na `bootstrap`, `guest`
nebo `lifecycle` a spusťte postupně všechny tři skupiny. Každá si vytváří vlastní
databázi. Výchozí `all` pokrývá celý tok v jednom běhu.

Volitelně nastavte `AUTH_TEST_DB_USER` a `AUTH_TEST_DB_PASS`; výchozí jsou `root`
a prázdné heslo izolované testovací instance. Testovací účet musí smět vytvářet
a odstraňovat své dočasné databáze. Test pokrývá SQL, bootstrap ze staré admin
session, přepnutí session, všechny role, CSRF a serverovou autorizaci, posledního
admina, kolize hesel včetně reaktivace, `last_login`, UTF-8/HTML escapování,
změny hesel a kompatibilitu mapy práv. Skutečné staré přihlášení na hostingu,
kopírování souborů a vytvoření prvního reálného admina zůstávají ručními kroky.

Ověření v tomto checkoutu (10. 9. 2026): syntaxe všech změněných/přidaných PHP
souborů prošla na PHP 8.5.10. Na izolované MariaDB 11.4.5 prošlo všech 30 kontrol
skupiny `bootstrap`. Delší běhy se v místním Windows prostředí pozastavovaly;
jednotlivě ověřily i hosta, reaktivaci, reset hesel a ztrátu admin přístupu, ale
celou sadu nelze označit za dokončenou. Rozložení administrace bylo vizuálně
zkontrolováno na desktopu i při šířce 390 px včetně rozbaleného formuláře.
