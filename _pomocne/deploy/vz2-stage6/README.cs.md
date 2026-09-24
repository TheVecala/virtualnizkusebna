# Etapa 6 — Mixér ve společném seznamu

Aktualizace pro betu po etapě 5 (`4de4c3e`). Balíček mění tři provozní soubory.
Nejde o kompletní web: **nic z bety nemažte**.

## Nahrání na betu

1. Uložte si dosavadní tři soubory mimo veřejný web pro případ návratu.
2. Obsah `1_soubory` nahrajte do `zkusebna_beta`, zachovejte podsložky a přepište
   stejné názvy. Nejprve oba soubory v `js`, nakonec `vz2.php`. Během přenosu
   web nepoužívejte; potom obnovte otevřená okna přes Ctrl+F5.

```text
js/multitrack.js
js/vz2.js
vz2.php
```

`config.php` ani `config.vz2.php` neměňte. Nespouštějte SQL, nenahrávejte nic
do `tools` a neměňte úložiště. Samostatná alfa zatím zůstává beze změny.
README, STAV a manifest slouží pro kontrolu balíčku, na FTP nepatří.

## Co se změnilo a co vyzkoušet

- Samostatný odkaz „Mixér“ v horní navigaci zmizel. Běžné i vícestopé nahrávky
  jsou v jednom seznamu u příslušné skladby nebo zkoušky.
- U vícestopé nahrávky stiskněte **Otevřít Mixér**. Přehrávač se objeví přímo
  v její kartě. Společný seznam skladeb a zkoušek zůstává dostupný.
- Vyzkoušejte přehrávání, hlasitosti stop, smyčku a přidání timestampu.
  V otevřené nahrávce je právě jeden přehled timestampů; po zavření Mixéru
  zůstávají tytéž zápisy u nahrávky. Diskuse stále patří její skladbě či zkoušce.
- **Zavřít Mixér** zastaví přehrávání. Také přepnutí na jinou skladbu nebo
  zkoušku zruší předchozí přehrávání i rozpracované načítání.
- Zkuste tlačítka prohlížeče Zpět/Vpřed, obnovení stránky a **Kopírovat odkaz
  na čas** v Mixéru. Odkaz otevírá stejnou nahrávku i po přesunu do jiné kolekce.
- Host může přehrávat a číst; nedostává nová oprávnění k úpravám.
- Dřívější odkaz `?v=2&view=mixer` bez ID otevře společný seznam. Pokud obsahuje
  `recording_id`, otevře příslušnou nahrávku. Smazaná nahrávka zobrazí zprávu;
  nahrávka s odebraným audiem ponechá dostupné informace a zápisy.

Jde o změnu navigace. Úprava barev, typografie a dalšího vzhledu bude následovat
v samostatném CSS vlákně. Přenos finální bety na alfu počká až na ni.

## Případný návrat

Vraťte společně všechny tři původní soubory a obnovte prohlížeč přes Ctrl+F5.
Databáze, nahrávky, identity a offline klíče se touto aktualizací nemění;
žádná obnova databáze není potřeba.
