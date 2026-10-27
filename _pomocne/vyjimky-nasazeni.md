# Výjimky ze shody Gitu a nasazeného webu

Pro alfu i betu platí, že verzované provozní soubory mají odpovídat nasazené
verzi v Gitu. V těchto dvou souborech v kořeni aplikace se může lišit nastavení
prostředí. Oba jsou verzované; výjimka neznamená ignorování Gitem.

- `config.php` — připojení k databázi a URL instalace. Export ho vynechává kvůli
  přístupovým údajům; na cílovém serveru zachovejte funkční připojení a správnou
  `SITE_URL`. Alfa používá `https://zkusebna.dusanovakapela.cz`, beta
  `https://zkusebna_beta.dusanovakapela.cz`.
- `config.vz2.php` — verzovaná konfigurace pro betu, která se zahrnuje do exportu.
  Při kopírování na alfu před vypnutím maintenance změňte pouze prostředí:

  ```php
  define('VZ2_ENVIRONMENT', 'alpha'); // V Gitu je 'beta'.
  ```

Sdílený dataset, `VZ2_PUBLIC_ROOT` a `VZ2_STORAGE_ROOT` se mezi alfou a betou
nemění. Nepoužívejte hromadné nahrazování slova `beta` v ostatním kódu.
Verzovaná konfigurace má `VZ2_WRITES_ENABLED=true`; pokud má cílová instalace
zůstat pouze pro čtení, zachovejte pro ni `false`.

Hodnoty úložiště v `config.vz2.php` vycházejí z doloženého nasazení v
[docs/vz2/storage.md](docs/vz2/storage.md). Při prvním přechodu na verzovanou
konfiguraci je porovnejte se současným souborem na serveru. Jde o konfiguraci
existujícího společného datasetu; vzor pro novou instalaci je samostatně v
`config.vz2.example.php`.

Exportní nástroj `tools/vz2_release.js` uvádí v manifestu v položce
`preserved_server_files` pouze vynechaný `config.php`. Ruční úpravu prostředí
alfy si poznamenejte k manifestu nasazené verze.

Na web se také nekopírují `.git/`, `.gitignore` a celá složka `_pomocne/`.

`config.theme.php` mezi výjimky nepatří: je součástí aplikace a na web se
nahrává ve stejné podobě jako v nasazované verzi Gitu.
