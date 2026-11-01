# Přihlašování uživatelským jménem a heslem

Feature `feature/změna_přihlašování`, výchozí commit
`b52a1bfaf933b367d683af505a22639fa11b2856`.

## Chování

- Člen zadává uživatelské jméno a své dosavadní heslo. Samotné heslo nestačí.
- Uživatelské jméno má 3–32 ASCII znaků. Začíná písmenem nebo číslicí,
  dále může obsahovat také tečku, pomlčku a podtržítko. Okrajové mezery se
  odstraní a písmena převedou na malá. Jedinečnost bez rozlišení velikosti
  písmen platí i pro neaktivní účty a je vynucená databází.
- `users.name` je dál zobrazované jméno, může obsahovat diakritiku a nemusí
  být jedinečné. ID účtů a vazby na obsah se nemění.
- Hesla se neobnovují ani nepřehashovávají při migraci. Zůstává minimum
  3 znaků, maximum 72 bajtů a zákaz hesla tvořeného jen mezerami. Žádné
  požadavky na velká písmena, číslice nebo speciální znaky. Hesla se netrimují.
- Host zadává rezervované jméno `host` a stávající hostovské heslo.
  Má stále roli `host`, žádné `user_id` a nemůže měnit obsah.
- Chybné údaje, neexistující i neaktivní účet mají společnou chybovou zprávu.
  Formulář zachová zadané jméno, heslo nikdy nevrací do HTML.
- Neúspěšné pokusy se počítají v databázi společně pro obě instalace:
  50 pokusů z jedné IP adresy během okna 15 minut od první chyby. 51. pokus
  dostane HTTP 429 s `Retry-After`. Další pokusy konec okna neposouvají.
  Úspěšný login chyby v běžícím okně nemaže; přihlášené session omezení neovlivní.
  Nová cookie ani změna uživatelského jména limit neobejde. Po vypršení lze
  opět zkusit přihlášení; žádný účet se trvale nezamyká. Počítadlo obsahuje
  hash adresy a čas, nikoli heslo nebo uživatelské jméno. Expirované záznamy
  se uklízejí při dalších pokusech.
- Zdrojová adresa se bere pouze z `REMOTE_ADDR`, ne z klientských hlaviček.
  Při nasazení za reverzní proxy musí webserver předávat skutečnou klientskou
  adresu svou důvěryhodnou konfigurací. Více členů za jednou veřejnou IP
  sdílí vysoký limit 50 pokusů.
- Reset hesla řeší administrátor. Změna hesla zneplatní staré session.
  Vypnutí a zapnutí účtu/hosta zvýší interní čítač revokace, takže se neobnoví
  ani session, která během vypnutí neprovedla žádný požadavek.

## 1. Příprava a migrace 007

Nejdříve ověřte skutečné zapojení alfy a bety. Tento postup předpokládá
jednu společnou databázi s migracemi 001–006 a osobními účty.

1. Zálohujte databázi a serverové soubory obou instalací. Zaznamenejte jejich
   nasazené verze. Ověřte přístup alespoň jednoho aktivního administrátora.
2. Domluvte krátké servisní okno: až do dokončení přechodu na obou instalacích
   nepřidávejte ani neupravujte účty ani hosta. Předejde se tak vzniku účtu
   bez jména ze staré administrace i obnově starých session při změnách stavů.
3. Jednou spusťte `_pomocne/migrations/007_login_usernames.sql` v této databázi.
   Při chybě zastavte a ověřte již provedené DDL; SQL není určeno k opakování
   ani jej PHP nespouští automaticky. **008 zatím nespouštějte.**
4. Každý existující člen dostane jednoznačné jméno `clen-<id>`, například
   `clen-1`. Projděte přehled včetně neaktivních účtů:

   ```sql
   SELECT id, username, name, role, active FROM users ORDER BY id;
   SELECT username_login_finalized FROM auth_settings WHERE id = 1;
   ```

   Stav musí být `0`. Jména lze před přepnutím změnit podle konkrétního ID,
   například `UPDATE users SET username = 'dusan' WHERE id = 1;` **jen pokud
   jste právě ověřili, komu ID 1 patří**. Ověřte výsledek a předejte členům
   jejich jména. Hesla zůstávají platná, nepatří do přehledu ani dokumentace.

Sloupec `username` je v této fázi záměrně nullable. Starý PHP kód nové sloupce
ignoruje a dál funguje se stejnými hesly. Nová administrace jméno již vyžaduje.
Pokud někdo přesto vytvoří účet starým kódem, doplňte mu jednoznačné jméno
podle ID ještě před přepnutím; preflight chybějící jména odmítne.

## 2. Nasazení a ověření bety

V servisním okně společně nahrajte:

- `php/auth.php`
- `php/loginbox4.php`
- `admin.php`
- `_pomocne/tools/vz2_preflight.php` do serverového `tools/vz2_preflight.php`,
  pokud tento diagnostický nástroj používáte.

Konfigurace, obsah a hesla se nepřenášejí. Nezaměňte serverové konfigurace
alfy a bety. SQL a testovací soubory nevystavujte ve veřejném webovém adresáři.

Ověřte čerstvé přihlášení jménem a heslem administrátora, muzikanta a
povoleného hosta. Zkontrolujte práva, mobilní formulář a přímý odkaz na nahrávku.
Pouhé otevření už přihlášené session neověřuje nový login. Preflight musí
projít; v `details.login` bude zatím `username_login_finalized: false`.

Dokud alfa používá původní login, zůstává kontrola unikátních hesel i požadavek
zadat heslo při reaktivaci člena/hosta. Nelze jej předčasně vypnout: starý login
vybírá účet podle hesla a při shodě by mohl vybrat jiného uživatele.

## 3. Přepnutí alfy a migrace 008

1. Nahrajte stejné změněné soubory také na alfu a zopakujte kontroly nového
   přihlášení. Migraci 007 ve společné databázi znovu nespouštějte.
2. Ověřte, že žádná další instalace nad touto databází už nepoužívá přihlášení
   pouze heslem a že žádný účet včetně neaktivních nemá chybějící username.
3. Teprve nyní spusťte `_pomocne/migrations/008_login_usernames_finalize.sql`.
   Při chybě `ALTER TABLE` zastavte; nenavazujte samotným `UPDATE`.
4. Preflight na obou instalacích musí projít a hlásit
   `username_login_finalized: true`. Obnovte běžnou správu účtů.

Od této chvíle mohou různé účty i host mít stejné heslo. Jméno vždy rozhoduje,
který účet se ověřuje. Reaktivace člena a již nastaveného hosta nevyžaduje
znovuzadání hesla; ochrana posledního aktivního administrátora zůstává.

## Návrat

Před migrací 008 lze v servisním okně vrátit současně PHP soubory dané
instalace ze zálohy. Přidané sloupce a tabulku ponechte, původní kód je ignoruje.
Přechodná kontrola hesel stále zaručuje jejich jednoznačnost pro starý login.

**Po migraci 008 už nevracejte původní login založený jen na hesle.** Shodná
hesla mohou patřit více účtům a z jejich hashů nelze shodu zjistit. Ani samotné
nastavení `username_login_finalized = 0` tento problém neopraví. Případnou opravu
nasaďte nadále s loginem jméno + heslo; nepřepisujte sdílenou databázi starší
zálohou a neztrácejte nově vytvořený obsah.

## Lokální ověření

`AUTH_TEST_DB_PORT=<port> php _pomocne/tests/auth_integration.php` spouští skutečné
PHP HTTP požadavky proti náhodné databázi na samostatné lokální MariaDB
(port nad 1024, nikoli 3306). Prochází migraci existujících účtů, přechodný
režim i finalizaci, jednoduchá a shodná hesla, role, deaktivaci a dormantní
session, generické chyby, hluboký odkaz a přesnou hranici 50 neúspěšných pokusů.
Nečte produkční konfiguraci a v závěru odstraní pouze svou testovací databázi.

Pro širší regresi:

```sh
PHP_BIN=php VZ2_TEST_DB_PORT=<port> node _pomocne/tests/vz2_integration.test.js
PHP_BIN=php node _pomocne/tests/session_cookie.test.js
```

Skutečné nasazení, migrace hostované databáze a ověření živých účtů nejsou
provedené tím, že jsou připravené soubory a prošly lokální testy.

### Výsledek ověření 27. 10. 2026

- Izolované PHP 8.4.27 a MariaDB 11.4.13: `auth_integration.php`, **167 kontrol PASS**.
- Celá `vz2_integration.test.js`: **185 kontrol PASS**, včetně obsahu, autorství,
  oprávnění, diagnostiky a sdílené databáze dvou instalací.
- Samostatný scénář `VZ2_TEST_SUITE=cleanup`: **71 kontrol PASS**.
- `session_cookie.test.js`: všech 6 skupin PASS (HTTP/HTTPS, HttpOnly,
  SameSite, zachování parametrů, rotace a společná politika vstupních bodů).
- Chromium: skutečně vykreslený login a HTML chybového i administračního
  formuláře při šířkách 320, 390 a 1440 px; bez vodorovného přetékání,
  správné pořadí fokusu a autocomplete, prázdné pole hesla po chybě.
- PHP syntaxe změněných souborů, syntaxe změněných JS testů a `git diff --check`: PASS.

Při širší regresi byla na výchozím commitu reprodukována starší chyba
testovacích dat: test přehledu začátků nechával v databázi syntetickou nahrávku
bez fyzického souboru ve stavu `available`. Jeho testovací záznam se nyní po
ověření uklidí, aby neblokoval navazující kontrolu úložiště alfy. Produkční
nakládání s nahrávkami se touto opravou testu nemění.
