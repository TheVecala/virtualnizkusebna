# Prázdná stará zkušebna pro porovnávání

Aktuální požadavek uživatele z 20. 9. 2026: dokončit novou betu, tou nahradit
alfu a zachovat starou verzi na samostatné subdoméně pro porovnávání.
**Ve staré ukázce nebude žádný uživatelský obsah. Dodatečné heslo Apache
se nezavádí.** Tím je nahrazen dřívější plán soukromého webu se starými daty.
Původní přihlášení aplikace tím není zrušeno; bez další ochrany není subdoména
vyhrazená pouze vlastníkovi.

Uživatel potvrdil vytvoření subdomény `zkusebna_old` (s podtržítkem),
čímž nahrazuje původní návrh `zkusebna-old`. Pro starou ukázku zvolil původní
betu z commitu `52f6b2be35f7c2320bbc1b785df773612b367355`.
Nahrání ani funkčnost této instalace zatím nejsou potvrzené.

Časování: nejprve dokončit funkce nové bety, potom její CSS a vzhled
v samostatném vlákně. Současná alfa zatím zůstává dostupná beze změny.
Prázdnou starou ukázku lze připravovat mezitím; musí být připravená předtím,
než uživatel nahradí alfu finální funkčně i vzhledově ověřenou betou.

## Příprava před nahrazením alfy

1. Pro ukázku použít uživatelem zvolený commit původní bety `52f6b2be`.
   Ověřeno: používá osobní účty `users` a `auth_settings`, staré obsahové
   tabulky (například `napady_kapela`) a lokální adresář `user`.
   Samotné nahrání Git stromu bez úpravy konfigurace tedy nezajistí prázdnou,
   oddělenou instalaci. Existující zálohy konfigurace a dat zůstávají oddělené.
2. Připravit samostatnou složku a HTTPS subdoménu. Přenést pouze kód a veřejné
   statické součásti aplikace. Nekopírovat uživatelské audio, přílohy, texty,
   diskuse, historie, peaks ani uživatelské TXT/JSON soubory.
3. Konfiguraci přizpůsobit nové adrese a vlastnímu prázdnému datovému prostoru.
   Pokud aplikace potřebuje databázi, připravit oddělené prázdné schéma a jen
   nezbytná provozní nastavení; nepřipojovat ukázku k živým účtům a obsahu alfy,
   bety ani VZ2. Konkrétní schéma se určí podle závislostí starého kódu.
   Do `18810_VZ2` se bez výslovné změny dosavadního plánu nic neimportuje.
4. Nezavádět HTTP Basic Authentication ani soubor `.htpasswd`. Ostatní potřebná
   pravidla `.htaccess` zachovat; odmítnutí dodatečného hesla neznamená odstranění
   ochrany konfigurace nebo privátního úložiště nové VZ2.
5. Ověřit původní přihlašovací mechanismus, navigaci, prázdné seznamy a absenci
   odkazů na živý uživatelský obsah. Chybějící obsah nesmí způsobovat PHP chyby.
   Případné úpravy starého kódu zůstanou pouze v této oddělené instalaci.

Po dokončení vzhledu i funkcí bety lze hlavní alfu nahradit její finální verzí.
Samotná příprava `old` přepnutí nespouští. Nová alfa a beta nadále
používají společnou VZ2 databázi a úložiště podle postupu etapy 5.

## Úklid a stav

Kód prázdné ukázky a její oddělené provozní závislosti se zachovají.
Požadavek „bez uživatelského obsahu“ se naplní přípravou čisté ukázky,
nikoli smazáním dat současné alfy. Případný pozdější úklid původních dat má
vlastní seznam a postup v `cleanup.md`.

Subdoménu vytvořil uživatel. Agent prověřil zvolený historický commit pouze
čtením; nepřepínal pracovní větev ani neměnil živá data nebo ochranná pravidla.
Samostatná konfigurace, databáze s účtem pro ukázku a její nasazení zbývají.
