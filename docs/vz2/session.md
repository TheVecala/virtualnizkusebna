# Přihlašovací cookie po etapě 6

20. 9. 2026, výchozí commit `7466cbdf5505fce3b9a1bcff0e2070334f11f2c0`.

Živý preflight etapy 5 hlásil `secure=false` a `httponly=false`. Všechny
aplikační vstupy nyní používají `php/inc/session.php` před zahájením session.
Pomocná funkce nastaví HttpOnly, pro HTTPS Secure a výchozí SameSite=Lax.
Zachovává nastavenou cestu, doménu, dobu platnosti i přísnější Secure či
explicitní SameSite. Opakované volání při aktivní session ji nerestartuje.

HTTPS se zjišťuje z `$_SERVER['HTTPS']`; hodnoty prázdná, off a 0 znamenají
HTTP. Nedůvěřujeme X-Forwarded-Proto ani Forwarded od klienta. Při případném
ukončování TLS na proxy je potřeba správná konfigurace webserveru. Po nasazení
byl skutečný Set-Cookie na Blueboardu ověřen přes HTTPS, viz níže.

Dosavadní session a CSRF token se zachovají. Příznaky se do prohlížeče
propíšou při vydání cookie (nová session, přihlášení nebo odhlášení VZ2
s regenerací ID). Pro stávající přihlášení proto návod požaduje odhlášení
a nové přihlášení. Cookie se zbytečně nevydává při každém souběžném AJAX
požadavku. Klasické odhlášení maže cookie se stejnými atributy včetně SameSite.

Sjednoceny jsou i legacy vstupy přítomné ve zdrojích bety, aby nevydávaly
cookie s jinými příznaky před kontrolou VZ2_ONLY. Do živé alfy se nic
nenasazuje. Moderní diagnostické nástroje v repozitáři používají stejný helper;
samostatná historická sonda pro starou alfu zůstává beze změny.

## Ověření

- `tests/session_cookie.test.js`: šest skupin kontrol nad skutečnými HTTP
  odpověďmi PHP; HTTPS metadata simuluje izolovaná testovací stránka.
  Ověřuje atributy, zachování parametrů, ignorování podvržených proxy hlaviček,
  pokračování existující session, regeneraci a neplatnost původní session.
- Integrační test VZ2 nově kontroluje HttpOnly a SameSite také při skutečném
  přihlášení všech rolí a odhlášení hosta. **176 kontrol PASS**, včetně
  navigace a Mixéru v headless Edge. Izolovaný běh `vz2-integration-xZU6Wt`.
- Integrační testy účtů: lifecycle 25 a guest 19 kontrol PASS.
- PHP lint všech 44 dotčených PHP souborů, syntaxe JS a `git diff --check`
  prošly. Lokální runtime PHP 8.5.10 a MariaDB 11.4.5; živý hosting má PHP 8.1.32.

Uživatel potvrdil nahrání aktualizace. Dne 20. 9. 2026 anonymní HTTPS GET
na `https://zkusebna_beta.dusanovakapela.cz/` vrátil HTTP 200 a novou cookie:
`PHPSESSID=[redacted]; path=/; secure; HttpOnly; SameSite=Lax`.
Živé vydání cookie se všemi třemi příznaky je tedy ověřeno. Hodnota session
se neukládá do dokumentace. Odhlášení a nové přihlášení po této aktualizaci
uživatel zatím výslovně nepotvrdil; funkční testy přihlášení výše jsou lokální.
Konfigurace, SQL, obsah, CSS a navigace nejsou touto aktualizací měněny.
