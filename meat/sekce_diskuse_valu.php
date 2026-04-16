<?php
define("ROWS", 5);
require "php/login/connect.php";

// Název tabulky ze SESSION
$aktualni_diskuse_valu = 'diskuse_' . $_SESSION['kapela'] . '_' . $_SESSION['slozka_souboru_k_zobrazeni'];
$aktualni_diskuse_valu = $mysqli->real_escape_string($aktualni_diskuse_valu);

// Počet záznamů
if (!isset($_GET["celkem"])) {
    $res    = $mysqli->query("SELECT COUNT(*) as pocet FROM `$aktualni_diskuse_valu`");
    $zaznam = $res ? $res->fetch_assoc() : ["pocet" => 0];
    $celkem = (int) $zaznam["pocet"];
} else {
    $celkem = (int) $_GET["celkem"];
}

// Výběr záznamů
$od = isset($_GET["od"]) ? (int) $_GET["od"] : 1;
if ($celkem > ROWS) {
    $offset   = $od - 1;
    $vysledek = $mysqli->query("SELECT cas, vzkaz, jmeno FROM `$aktualni_diskuse_valu`
        ORDER BY cas DESC LIMIT $offset, " . ROWS);
} else {
    $vysledek = $mysqli->query("SELECT * FROM `$aktualni_diskuse_valu` ORDER BY cas DESC");
}
?>

<div><!-- hlavička -->
    <div id="diskuse" style="font-size:1.5em">
        <div class="card bg-dark text-white" style="margin-top:1px; border:1px solid #dee2e6;">
            <div class="card-body" style="text-align:center">
                <h2 style="text-align:left; display:inline; color:#ffc107; background-color:#343a40; font-weight:bold; text-shadow:2px -2px 20px #ffc107;">POZNÁMKY</h2>
                <div style="text-align:right; display:inline">
                    <button class="btn btn-sm btn-secondary" style="display:inline"
                        data-toggle="modal" data-target="#modal_vlozit_komentar">NAPSAT</button>
                </div>
                <div id="od_do" class="bg-dark text-white" style="font-size:0.8em">
                    <?php
                    echo ' ' . $od . '-';
                    echo (($od + ROWS - 1) <= $celkem) ? ($od + ROWS - 1) : $celkem;
                    echo ' z ' . $celkem . '  ';
                    ?>
                </div>
            </div>
        </div>
    </div>
</div>

<div>
    <div id="prispevek" style="overflow:auto">

        <div id="navigace">
            <?php
            $self = htmlspecialchars($_SERVER["PHP_SELF"]);
            if ($od != 1)
                echo '<a href="' . $self . '?celkem=' . $celkem . '&od=1"><div class="btn btn-dark btn-sm" style="font-size:0.6em">NEJNOVĚJŠÍ</div></a> ';
            if ($od > ROWS)
                echo '<a href="' . $self . '?celkem=' . $celkem . '&od=' . ($od - ROWS) . '"><div class="btn btn-dark btn-sm" style="font-size:0.6em">NOVĚJŠÍ</div></a> ';
            if ($od + ROWS < $celkem)
                echo '<a href="' . $self . '?celkem=' . $celkem . '&od=' . ($od + ROWS) . '"><div class="btn btn-dark btn-sm" style="font-size:0.6em">STARŠÍ</div></a> ';
            if ($od < $celkem - ROWS)
                echo '<a href="' . $self . '?celkem=' . $celkem . '&od=' . ($celkem - $celkem % ROWS + 1) . '"><div class="btn btn-dark btn-sm" style="font-size:0.6em">NEJSTARŠÍ</div></a> ';
            ?>
        </div>

        <div class="row">
            <div class="col-lg-12">
                <ul class="list-group sloupec">
                    <?php if ($vysledek): while ($zaznam = $vysledek->fetch_assoc()): ?>
                        <li class="list-group-item vzkaz_karta" style="background-color:#ffffff59;">
                            <span class="vzkaz"><?php echo $zaznam["vzkaz"]; ?></span><br>
                            <div style="text-align:right;">
                                <span style="font-size:0.6em;">VLOŽIL:&nbsp;</span>
                                <span style="font-size:0.9em;"><?php echo htmlspecialchars(strip_tags($zaznam["jmeno"])); ?>&nbsp;</span>
                                <span style="font-size:0.6em;"><?php echo date("j.n.Y G:i:s", $zaznam["cas"]); ?></span>
                            </div>
                        </li>
                    <?php endwhile; endif; ?>
                </ul>
            </div>
        </div>

    </div>
</div>
