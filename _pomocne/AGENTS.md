# Pravidla práce v celém repozitáři

Pokyny jsou uložené v `_pomocne/`, aby mimo tuto složku zůstávaly jen soubory
nasazované na web. Platí pro práci v celém projektu, nejen v `_pomocne/`.

## Struktura a nasazování

- Kořen repozitáře a jeho provozní podsložky mají odpovídat souborům na webu.
  Vývojové podklady, dokumentace, testy, SQL migrace, nástroje, náhledy,
  přílohy a vygenerované balíčky patří výhradně do `_pomocne/`.
- `.git/`, `.gitignore` a `_pomocne/` se na web nekopírují.
- Serverové `config.php` a `config.vz2.php` jsou schválené výjimky ze shody
  Gitu a webu; při nasazení zachovej jejich cílové verze. Seznam a pravidla
  udržuj v [vyjimky-nasazeni.md](vyjimky-nasazeni.md).
- Nové provozní soubory musí být automaticky zahrnuté do úplného balíčku.
  Nepoužívej ručně udržovaný seznam přípon, kořenových stránek ani adresářů.
- Balíček vytvářej přes `_pomocne/tools/vz2_release.js`; výstup uvnitř
  repozitáře patří do `_pomocne/dist/`. Součástí výstupu je přesný manifest
  cest a hashů, zdrojový commit a informace o necommitnutých změnách.
- Přístupové údaje a skutečné serverové konfigurace nevkládej do veřejného
  balíčku. Při změně způsobu konfigurace nejprve připrav a ověř celý přechod;
  funkční nastavení serveru se nesmí přepsat nevyplněným vzorem.
- Nahrání souborů není důkazem skutečně nasazené verze. Nepovažuj větev
  `alpha` nebo `beta` automaticky za stav hostingu; pro porovnání použij
  doložený commit/manifest nasazení.

## Aktuální commit před začátkem práce

- Před každou novou prací, která mění soubory repozitáře, nejprve zkontroluj `git status`, aktuální větev a její upstream.
- Cílovou větev určuje uživatel. Pokud neurčí jinou, používej `origin/beta`. Lokální pracovní větev (například `work`) sama o sobě neurčuje cílovou vzdálenou větev.
- Ještě před úpravami spusť `git fetch origin <cílová-větev>` a ověř aktuální commit vzdálené větve. Nestačí vycházet z dříve uloženého remote-tracking odkazu.
- Práci začínej na nejnovějším commitu cílové vzdálené větve. Pokud je pracovní strom čistý a lokální větev lze posunout přímo vpřed, použij `git merge --ff-only origin/<cílová-větev>`. Pokud lokální větev obsahuje vlastní commity nebo jinou historii, vytvoř samostatnou pracovní větev či worktree z aktuálního `origin/<cílová-větev>` a zachovej původní práci.
- Nepřepisuj ani nemaž necommitnuté změny. Při rozpracovaných změnách použij samostatný worktree z aktuální cílové větve; pokud je úkol potřebuje zahrnout, nejprve bezpečně vyřeš jejich zachování a začlenění.
- Pokud fetch selže, neprováděj změny na předpokládané aktuální verzi. Uveď překážku; pokračovat ze staršího commitu lze jen na výslovný pokyn uživatele.
- Před pushem znovu načti cílovou větev a ověř, že push zachová všechny její commity. Případné nové změny bezpečně začleň a ověř výsledek.
- Nepoužívej `git reset --hard`, `git push --force` ani `git push --force-with-lease` bez výslovného souhlasu uživatele s konkrétním přepsáním historie či odstraněním změn.

Tato kontrola není potřeba pro pouhé vysvětlení nebo čtení kódu bez úprav.
