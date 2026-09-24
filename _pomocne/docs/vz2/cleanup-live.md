# Úklid po živém testu VZ2

Stav 19. 9. 2026: **úklid potvrzen uživatelem** po úspěšném vytvoření skladby,
uploadu a přehrání. Uživatel také uvedl, že adresáře tools neměly další obsah.
Agent následně ověřil všechny čtyři diagnostické URL uvedené níže: vracejí 404
bez přesměrování. Odstranění sond a testovací skladby vychází z potvrzení uživatele.
Prázdné adresáře tools mohou zůstat. Následující seznam je záznam provedeného
postupu, není nutné jej opakovat. Zdrojové soubory v místním projektu zůstávají.

## 1. Testovací skladba přes aplikaci

Na betě otevřete vlastní testovací skladbu **TEST VZ2** a jako administrátor
použijte **Úplně smazat celek**. Zkontrolujte název potvrzované položky.
Tím aplikace odstraní testovací obsah a audio a zachová záznam v deníku.
Její nahrávky neodstraňujte ručně přes FTP. Pokud mazání skončí chybou,
pošlete její znění; nepokračujte ručním mazáním audia nebo databázových řádků.

## 2. Dočasné PHP soubory na FTP

Ze společné složky `/data/www/18810/dusanovakapela_cz` odstraňte tyto čtyři
konkrétní soubory (ostatní obsah adresářů `tools` ponechte):

```text
zkusebna/tools/vz2_storage_probe_legacy.php
zkusebna/tools/vz2_storage_probe.php
zkusebna_beta/tools/vz2_storage_probe.php
zkusebna_beta/tools/vz2_preflight.php
```

Preflight zůstává v místním projektu a lze jej později znovu nahrát pro kontrolu.
Soubor `php/inc/vz2_file_io.php` není diagnostický vstup, ponechte jej.

## 3. Kontrolní soubor a sondy na FTP

Ve stejné společné složce odstraňte pouze následujících sedm konkrétních souborů:

```text
vz2-control-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4.txt
_vz2_storage/probe-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4.txt
_vz2_storage/nested/probe-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4.txt
_vz2_storage/skladby/probe-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4.wav
_vz2_storage/.staging/probe-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4.txt
_vz2_storage/.cache/peaks/probe-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4.json
_vz2_storage/.vz2-probe.json
```

**Ponechte `_vz2_storage/.htaccess` a `_vz2_storage/.vz2-storage-id`.**
Ponechte celý adresář `_vz2_storage`, jeho podsložky a všechny ostatní soubory.
Nepoužívejte hromadné mazání podsložek `.staging`, `.cache` nebo `skladby`.

Konfigurace VZ2, původní config.php, databázové tabulky, starý obsah a ostatní weby
se při tomto úklidu nemění. Pokud je některý uvedený diagnostický soubor už pryč,
není potřeba jej obnovovat kvůli smazání.

Dokončení uživatel potvrdil odpovědí „uklizeno“. Místní diagnostiku uchovat pro
případné budoucí ověření po změně hostingu nebo směrování domén.
