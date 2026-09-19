NASAZENÍ VZ2 NA BETU – NEJPRVE POUZE PRO ČTENÍ

Balíček je určen pro současnou betu s osobními účty, vycházející z 0e7b92fc.
Nepatří na starší alfu 6ef87325. Neobsahuje config.php, databázová hesla, stará
uživatelská data ani SQL migraci. Migrace už byla provedena; neopakovat ji.

1. Na FTP otevřete zkusebna_beta. Její aktuální zdrojové soubory a config.php
   již máte zálohované; pokud se od zálohy změnily, nejprve uložte novou kopii.

2. Ze složky 1_soubory nahrajte OBSAH přímo do zkusebna_beta se zachováním
   podsložek. Potvrďte přepsání stejnojmenných souborů. Počkejte na dokončení
   všech přenosů. Samotnou obalovou složku 1_soubory na FTP nekopírujte.

3. Až potom nahrajte soubor z 2_konfigurace/config.vz2.php přímo jako
   zkusebna_beta/config.vz2.php. Je připraven pro ověřenou cestu a dataset:
   VZ2_ENABLED = true
   VZ2_WRITES_ENABLED = false
   VZ2_ENVIRONMENT = beta
   VZ2_STORAGE_HTTP_VERIFIED = true
   Původní config.php se nemění. Pokud config.vz2.php již existuje a je jiný,
   nejprve jej zazálohujte a oznamte jeho existenci, nepřepisujte neznámé nastavení.

4. Přihlaste se na betě jako administrátor a ve stejném prohlížeči otevřete:
   https://zkusebna_beta.dusanovakapela.cz/tools/vz2_preflight.php
   Pošlete celý zobrazený výsledek do konverzace. Není potřeba SSH.
   Kontrola nic nezakládá, neprovádí migraci ani nepovoluje zápisy.

Očekáváme ok: true, database: 18810_virtualni_zkusebna, environment: beta,
writes_enabled: false a přesně 13 VZ2 tabulek. Session SQL mode musí obsahovat
STRICT_TRANS_TABLES, ERROR_FOR_DIVISION_BY_ZERO a NO_ENGINE_SUBSTITUTION.
Odlišný nestriktní global_sql_mode je na tomto hostingu očekávaný.

Nové rozhraní je na:
https://zkusebna_beta.dusanovakapela.cz/index.php?v=2
Zatím bude prázdné, protože se starý obsah nepřevádí. VZ2 nedovolí přidávání ani
změny, dokud nejsou výslovně povoleny zápisy. V tomto režimu se na betě blokují
také změny účtů. Tento přepínač není zákazem všech operací staré části aplikace.

Pokud kontrola hlásí, že VZ2 není zapnutá, nebo vznikne jiná chyba, pošlete výpis.
Nepřepisujte kvůli tomu celý config.php ani neopakujte SQL. Současný config.php
musí načítat config.vz2.php ještě před php/auth.php; v podkladu 0e7b92fc to dělá.

Oprava hlášení „VZ2 zatím není zapnutá“:
- Ověřte, že config.vz2.php leží přímo ve zkusebna_beta vedle config.php,
  nikoli uvnitř nahrané obalové složky 2_konfigurace.
- V připraveném config.vz2.php je VZ2_ENABLED=true a VZ2_WRITES_ENABLED=false.
- V existujícím config.php na betě musí být následující načtení PŘED načtením
  php/auth.php a před prvním připojením k databázi. Chybějící blok doplňte hned
  za úvodní <?php; pokud již existuje, ověřte jeho pořadí a nevkládejte jej znovu:

  if (is_file(__DIR__ . '/config.vz2.php')) {
      require_once __DIR__ . '/config.vz2.php';
  }

Databázová hesla ani jiné existující hodnoty config.php neměňte. Poté znovu
otevřete kontrolu nasazení. Samotný preflight konfiguraci dodatečně nenačítá:
musí ji používat celá aplikace ještě před vznikem jejího databázového spojení.

Zápisy sami zatím nepovolujte. Alfa, staré audio a ochrana _vz2_storage zůstávají
beze změny. Po dokončení ověření bude následovat cílený úklid diagnostiky.
V balíčku je kontrolní seznam souborů s SHA-256 v manifest.json (nenahrávat na web).

Návrat při problému: změňte VZ2_ENABLED v novém config.vz2.php na false a vraťte
pouze soubory bety z její zálohy, pokud je to potřeba. Nové tabulky ani společné
úložiště kvůli návratu nemažte. Nezasahujte do alfy ani jiných webů.
