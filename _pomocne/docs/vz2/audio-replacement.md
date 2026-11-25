# Náhrada zvukového souboru

Výchozí commit: `7f1ffeda`. Před nasazením PHP použij migraci
`_pomocne/migrations/011_vz2_audio_replacement.sql` na sdílené databázi alfy a bety.
Migrace rozšiřuje evidenci souborových operací, nemění nahrávky ani značky.

V nabídce **Další → Soubor** lze nahradit jednotlivé audio, včetně odstraněného
nebo neočekávaně chybějícího. Vyžaduje oprávnění upload a mazání vlastní nahrávky
(admin může nahradit cizí). Vícestopá sada zachovává formát původní stopy.

Nový soubor se nejdříve nahraje do soukromého stagingu a server ověří obsah,
hash a délku. Dialog zobrazí původní a novou délku, rozdíl, počet značek mimo
novou délku a počet přesahujících úseků. U multitracku je rozhodující maximum
délek všech stop. Uživatel náhradu potvrdí; jiná délka není důvod k odmítnutí.

Po potvrzení vznikne obnovitelná operace `replace_audio`. Ověřená kopie má novou
unikátní cestu. Teprve poté se v jedné databázové transakci přepne odkaz a
metadata souboru, přepočítá délka nahrávky a zapíše audit. Následuje úklid starého
audia a jeho peaks cache. Neúspěšnou operaci lze dokončit standardním opakováním.
Opakování po přepnutí odkazu nepřipisuje další revizi ani audit.

ID, název stopy, pořadí, autorství, souhrn a vazby na historii zůstávají.
Nový hash odděluje offline kopie i waveform cache od starého obsahu. Otevřený
mixér se obnoví a zachová hlasitosti, mute a solo. Původní audio se neverzuje.

Značky se nemažou ani neposouvají. Čas na konci audia nebo za ním není
přehratelným začátkem. Přesahující interval si ponechá uložené hranice;
přehrávání a opakování končí na skutečném konci audia. Po delší náhradě se
značky opět zpřístupní. Lze upravit text značky za koncem beze změny jejího
času; nově zadané časy nadále musí ležet v nahrávce.

Zrušení dialogu uklidí připravený upload, pokud ještě nezačala souborová
operace. Nepotvrzená příprava platí 24 hodin. Při pádu prohlížeče může zůstat
v `.staging/<token>/` soubor `replacement.json` a audio; při údržbě je možné
odstranit jen prošlé přípravy, jejichž token není v
`vz2_file_operations.request_key`. Staging rozpracovaných operací zachovej
pro opakování.

Ověření:

- `node _pomocne/tests/vz2_integration.test.js` s `PHP_BIN`,
  `VZ2_TEST_DB_PORT` (izolovaná DB mimo port 3306),
  `VZ2_TEST_SUITE=audio-replacement` a volitelně
  `VZ2_TEST_BROWSER=replacement`.
- `node _pomocne/tests/vz2_timestamp_model.test.js` s `PHP_BIN`.
- `node _pomocne/tests/vz2_timestamp_replacement_playback.test.js`.

Lokální ověření: 19 kontrol náhrady včetně desktopového/mobilního dialogu,
zkrácené smyčky a zachování mixu; 16 kontrol intervalů; 28 kontrol úložiště.
Prošly také PHP/JS kontroly syntaxe, shoda modelů značek, přehrávání zkrácených
intervalů a existující testy modelů značek, segmentů a kontraktu mixéru.
Celá původní integrační sada na lokálním Windows PHP serveru nedoběhla kvůli
HTTP timeoutu. Browser fixture proto statické soubory a audio čte přímo
z připravených souborů; mutace, metadata a potvrzení používají skutečné HTTP API.
