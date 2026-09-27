TEST ÚLOŽIŠTĚ VZ2 NA BLUEBOARDU

Tento balíček obsahuje pouze malé testovací soubory. Neobsahuje nahrávky, hesla,
připojení k databázi ani migraci. VZ2 jím nezapínáte.

1. Rozbalte ZIP. Na FTP otevřete složku, ve které vidíte vedle sebe „zkusebna“
   a „zkusebna_beta“:
   /data/www/18810/dusanovakapela_cz

2. Z balíčku public sem nahrajte:
   - novou složku _vz2_storage se VŠÍM obsahem;
   - soubor vz2-control-...txt vedle této složky.

   Složku public samotnou na FTP nekopírujte. Pokud _vz2_storage již existuje,
   nepřepisujte ji: nejprve to oznamte, ať zachováme existující dataset a soubory.
   Zkontrolujte, že FTP přeneslo i .htaccess, .vz2-storage-id, .vz2-probe.json,
   .staging a .cache. Soubory začínající tečkou mohou být v FTP klientu skryté.
   .htaccess patří POUZE do _vz2_storage. Nenahrazujte .htaccess hlavního webu,
   alfy nebo bety – tím byste zablokovali celý web.

3. Soubor beta-tools/vz2_storage_probe.php nahrajte do:
   /data/www/18810/dusanovakapela_cz/zkusebna_beta/tools/vz2_storage_probe.php
   Podsložku tools případně založte. Nekopírujte celou složku beta-tools.
   Soubor beta-php-inc/vz2_file_io.php nahrajte do:
   /data/www/18810/dusanovakapela_cz/zkusebna_beta/php/inc/vz2_file_io.php

4. Přihlaste se ve své betě jako administrátor. Ve stejném prohlížeči otevřete:
   https://zkusebna_beta.dusanovakapela.cz/tools/vz2_storage_probe.php
   Klikněte na „Spustit kontrolu souborů“.
   Stránka vytvoří a odstraní jen své malé testovací soubory. Ověří, zda PHP
   soubory přečte, bezpečně zkopíruje a zamkne. Funkci link() nepotřebuje.
   Do databáze nic nevkládá ani v ní nic nemaže.

5. Napište do konverzace „nahráno“ a zkopírujte výsledek kontroly (nebo chybu).
   Můžeme pak zvenčí ověřit, zda nejdou testovací soubory stáhnout přes web.
   manifest.json nechte na počítači; nepřenášejte jej do veřejného webu.

Výsledek „Kontrola souborů prošla“ SÁM o sobě nestačí k zapnutí VZ2. Ještě musí
projít vnější HTTP test a ověření všech adres, přes které se ke složce dá dostat.
Pokud budou adresy na hostingu jinak směrované, upravíme test podle skutečného
nastavení. Z chyby 404 nebo přesměrování automaticky nevyvozujeme, že je ochrana správná.

Zatím neimportujte SQL, nezapínejte VZ2 ani neměňte její konfigurační příznaky.
Alfa na commitu 6ef87325 má starší přihlášení. Pro kontrolu z alfy použijte zvláštní
balíček vz2-diagnostika-alfa-6ef87325.zip a vstup vz2_storage_probe_legacy.php;
moderní diagnostiku tam přímo nespouštějte. Podrobnosti jsou v docs/vz2/storage.md.
Po ověření se diagnostické PHP soubory na obou webech a konkrétní sondy odstraní.
.htaccess a .vz2-storage-id zůstanou: jsou součástí ochrany a identity úložiště.
