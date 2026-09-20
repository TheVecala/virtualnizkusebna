# Oddělený úklid po přechodu na VZ2

Stav 20. 9. 2026: úklid se nespouští. Uživatel nepožaduje převod starého obsahu
a starou alfu nahradí hotová beta. To samo neurčuje seznam položek ke smazání.

Po ověření nové alfy vytvořit inventuru s přesnými názvy SQL tabulek a absolutními
cestami souborů, jejich velikostí, účelem a ověřenou obnovitelnou zálohou.
Ke každé položce doložit, že ji nepoužívá žádná další aplikace či subdoména.
Ověřování se týká sdílených zdrojů tohoto projektu; neprovádět plošné testy
jiných webů uživatele.

| Skupina | Postup |
| --- | --- |
| `users`, `auth_settings`, všech 13 `vz2_` tabulek | Zachovat. |
| `_vz2_storage` včetně `.htaccess` a `.vz2-storage-id` | Zachovat celé. |
| Konfigurace, zálohy, obsah ostatních webů | Vyloučit z úklidu. |
| `recording_notes`, konkrétní `diskuse_*`, `zkousky_*`, `napady_*`, `mt_diskuse_*` | Jen kandidáti do inventury; ověřit reálné názvy a použití. |
| Staré uploads, zkousky, multitracky, multitrack_zapisy, TXT historie a peaks | Jen kandidáti; určit přesný kořen a vztah ke staré aplikaci. |
| `uzivatele`, `maily_*` a ostatní tabulky | Nejprve zjistit účel a jiné konzumenty. |

Před samotným mazáním předložit konkrétní seznam k potvrzení. Žádné wildcard
DROP, hromadné mazání společného document rootu ani odstraňování všeho, co
není v Gitu. Nové VZ2 data se uklízí výhradně jejími běžnými operacemi.
