<script>

console.log("DIY forever!");
console.log("  <?php echo "loged = ".$loged.",    login = ".$login.",     kapela = ".$kapela.",    session id = ".(isset($_SESSION['id'])?$_SESSION['id']:'---') ?>");

console.log("  <?php echo "vysledek = ".(isset($_SESSION['vysledek'])?$_SESSION['vysledek']:'---').",   aktualni_diskuse = ".$aktualni_diskuse.",  SESSION aktualni_diskuse= ".(isset($_SESSION['diskuse'])?$_SESSION['diskuse']:'---').",  nazev= ".(isset($_SESSION['nazev'])?$_SESSION['nazev']:'---');?>  "); 

console.log("  <?php echo "sekce = ".$sekce.",    slozka_slozek= ".$slozka_slozek .",   slozka_souboru = ".$slozka_souboru.",    SESSIONslozka_souboru_k_zobrazeni=".(isset($_SESSION['slozka_souboru_k_zobrazeni'])?$_SESSION['slozka_souboru_k_zobrazeni']:'---')  ?> ");

console.log("  <?php echo "session sekce_k_zobrazeni = ".(isset($_SESSION['sekce_k_zobrazeni'])?$_SESSION['sekce_k_zobrazeni']:'---').",     SESSION chyba_prihlaseni= ". $_SESSION['chyba_prihlaseni'].", befelemepesseveze= ".$befelemepesseveze   ?> ");

console.log("  <?php echo "skin = ".$skin."   aktualni_text = ".$aktualni_text."   delka_pole_souboru = ".$delka_pole_souboru     ?>   ");

console.log("  <?php echo "delka_pole_slozek = ".$delka_pole_slozek     ?>   ");
</script>   
  
 
 
  
  
  
  
  
  
  
 