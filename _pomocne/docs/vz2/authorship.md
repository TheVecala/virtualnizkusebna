# Zobrazení autorství

Inventura a sjednocení 27. 9. 2026. Aktuální rozhraní VZ2 používá
společnou třídu `vz2-attribution`: 11px, běžná tloušťka, šedá
`--vz-muted`, zalamování dlouhých jmen. Autorství zůstává uložené a dostupné.

| Místo | Vykreslení | Výsledné zobrazení |
| --- | --- | --- |
| Skladba / zkouška | `js/vz2.js`, `render` | Vytvořil/a + jméno; drobný řádek nad seznamem |
| Audio / vícestopá nahrávka | `js/vz2.js`, `recordingCard` | Vložil/a + jméno v rozbaleném detailu; záhlaví obsahuje typ a délku |
| Souhrn nahrávky | `js/vz2.js`, `recordingCard` | Autor souhrnu a poslední editor pod souhrnem |
| Příloha | `js/vz2.js`, `render` | Vložil/a + jméno pod obsahem a odkazem |
| Časové značky Looperu a Mixéru | `js/vz2-timestamps.js`, `mount` | Drobný autor a editor v řádku; datum v tooltipu |
| Panel diskuse | `js/vz2-content.js`, `mountPreviews` | Autor, datum a případná úprava pod textem |
| Editor diskuse | `js/vz2-content.js`, `openDiscussion` | Stejná metadata a umístění jako panel diskuse |
| Nápady | `js/vz2-content.js`, `openDiscussion` | Stejné vykreslení jako diskuse |
| Editor textu / akordů a tabulatury | `js/vz2-content.js`, `openDocument` | Drobný řádek s verzí, autorem, editorem a datem |
| Historie dokumentů | `js/vz2-content.js`, `loadHistory` | Číslo verze v tlačítku, autor a datum na vedlejším drobném řádku |
| Deník změn | `js/vz2.js`, `loadLog` | Aktér, čas a prostředí ve stejném vedlejším stylu |

Panel i editor diskuse sdílejí `postAttribution`, včetně informace
o neaktivním účtu a o úpravě. Náhled textu a tabulatury autora nezobrazuje.
Porovnání konfliktu časové značky uvádí editora uvnitř porovnávaného textu;
jde o informaci potřebnou při řešení souběžných úprav.

Další výskyty ve starším rozhraní, mimo VZ2:

- `php/ajax/ajax_diskuse.php`: `.dk-meta`, jméno a datum pod příspěvkem.
- `php/ajax/ajax_napady.php`: `.cmeta`, jméno a datum pod příspěvkem.
- `js/multitrack-notes.js`: `.mt-note-author` u poznámek v původním Mixéru;
  styl v `css/workspace.css`.

Tyto tři původní výskyty už používají drobný šedý text (10px) a touto
úpravou se nemění. Přihlášený účet v horní liště není autorství příspěvku.
Backendová identita, oprávnění a autorství v textových exportech se nemění.

Ověření: syntaxe tří upravených JS souborů a `git diff --check` prošly.
Chromium s izolovanými API fixtures ověřilo styl a zalamování při šířkách
1440 a 390 px, shodu panelu a editoru diskuse, Nápady, metadata dokumentu
a otevření verze z historie. Bez chyb JavaScriptu. Test nepoužíval databázi
ani produkční data; nahrávky, přílohy a deník byly ověřeny kontrolou kódu.
