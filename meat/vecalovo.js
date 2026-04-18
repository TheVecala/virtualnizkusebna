/*  ------------ vecalovo   */
$(document).ready(function(){
    $('[data-toggle="popover"]').popover();

    $('.zmenit_adresar').click(function() {
        $(this).removeClass("btn-sm");
    });

    $('#nova_slozka').click(function() {
        // $("#formular_vytvoreni_slozky").toggle(700);
    });

    $('#vlozit_soubor').click(function() {
        // $("#formular_vlozeni_souboru").toggle(700);
    });

    $("iframe").css({"height": "150px", "width": "100%"});

    // ---- AJAX komentář ----
    $('#odeslat').click(function() {
        $.post("php/comment.php",
            {
                vzkaz: $('#text').val(),
                odkaz: $('#odkaz').val(),
                jmeno: $('#name').val(),
            },
            function(data){
                var html = '<br><span class="datum" style="color:green; font-size:0.9em"> Tvoje čerstvá věc právě teď:</span><br>';
                html += '<span class="vzkaz">' + $('#text').val() + '</span><br>';
                html += '<span class="vzkaz">' + $('#odkaz').val() + '</span><br>';
                html += '<span class="jmeno">' + $('#name').val() + '</span>';
                $('#prispevek').prepend($(html));
                $('#text').val("");
                $('#name').val("");
            }
        );
        return false;
    });

    $(".modal_open").click(function(){
        $("#modal_detail").modal();
    });

    // ---- WaveSurfer ----
    // Inicializace pouze pokud existuje element #waveform
    if (document.getElementById("waveform")) {

        var wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'black',
            plugins: [
                WaveSurfer.regions.create({
                    regions: [{}],
                    dragSelection: { slop: 5 }
                })
            ]
        });

        wavesurfer.on('ready', function () {
            var hlaska = document.getElementById("hlaska_nacitani");
            if (hlaska) hlaska.style.display = "none";
        });

        $(".wave_loader").click(function(){
            var flek = document.getElementById("vycpavka");
            if (flek) flek.scrollIntoView();
            var waveform = document.getElementById("waveform");
            if (waveform) waveform.style.display = "block";
            var hlaska = document.getElementById("hlaska_nacitani");
            if (hlaska) hlaska.style.display = "inline";
            var val = this.getAttribute("value");
            var label_val = this.getAttribute("name");
            wavesurfer.load(val);
            var label = document.getElementById("label_wave_jumbo");
            if (label) label.innerHTML = label_val;
            $("#looper_vysuvka").collapse('show');
        });

        $("#wave_play").click(function(){ wavesurfer.play(); });
        $("#wave_pause").click(function(){ wavesurfer.pause(); });
        $("#wave_od_zacatku").click(function(){ wavesurfer.play(0); });

        $("#loop").click(function(){
            var neco = wavesurfer.getDuration();
            wavesurfer.addRegion({
                start: 0,
                end: neco - 0.1,
                color: 'hsla(400, 100%, 30%, 0.5)',
                id: 2,
                loop: true
            });
            var el = document.getElementById("test_delky");
            if (el) el.innerHTML = "délka smyčky: " + neco + " sekund";
        });

        $("#wave_clear_regions").click(function(){
            wavesurfer.clearRegions();
            var el = document.getElementById("test_delky");
            if (el) el.innerHTML = "";
        });

        $("#schovat_wave_jumbo").click(function(){
            wavesurfer.empty();
        });

        $("#empty").click(function(){
            var hlaska = document.getElementById("hlaska_nacitani");
            if (hlaska) hlaska.style.display = "initial";
        });

    } // konec if waveform

    // ---- Mazání souboru ----
    $(".deleter").click(function(){
        var val = this.getAttribute("value");
        var label_val = this.getAttribute("name");
        var lbl = document.getElementById("modal_delete_label");
        var del = document.getElementById("modal_delete_deleter");
        if (lbl) lbl.innerHTML = label_val;
        if (del) del.setAttribute("value", val);
    });

    // ---- Mazání / přejmenování válu ----
    $(".deleter_val").click(function(){
        var val = this.getAttribute("value");
        var label_val = this.getAttribute("name");
        var lbl = document.getElementById("modal_delete_val_label");
        var del = document.getElementById("modal_delete_val_deleter");
        var ren = document.getElementById("modal_rename_val_label");
        var ren_new = document.getElementById("modal_rename_val_label_novy");
        if (lbl) lbl.innerHTML = label_val;
        if (del) del.setAttribute("value", val);
        if (ren) ren.setAttribute("value", label_val);
        if (ren_new) ren_new.value = "";  // prázdné pole pro nový název
    });

    // ---- Přesunutí souboru ----
    $(".presunout").click(function(){
        var val = this.getAttribute("value");
        var label_val = this.getAttribute("name");
        var odkud = document.getElementById("modal_presunout_odkud");
        var lbl = document.getElementById("modal_presunout_label");
        var co = document.getElementById("modal_presunout_co");
        if (odkud) odkud.setAttribute("value", val);
        if (lbl) lbl.innerHTML = label_val;
        if (co) co.value = label_val;
    });

    // ---- Skiny ----
    $("#skin_default").click(function(){
        $("#playlist_vysuvka").collapse('show');
        $("#looper_vysuvka").collapse('show');
        $("#soubory_vysuvka").collapse('show');
        $("#texty_vysuvka").collapse('show');
        $("#modal_skin").modal("hide");
    });

    $("#skin_mini").click(function(){
        $("#playlist_vysuvka").collapse('hide');
        $("#looper_vysuvka").collapse('hide');
        $("#soubory_vysuvka").collapse('hide');
        $("#texty_vysuvka").collapse('hide');
        $("#modal_skin").modal("hide");
    });

    // ---- Pomocné funkce pro collapse (volané z HTML) ----
    window.rolna_playlist_show = function(){ $("#playlist_vysuvka").collapse('show'); };
    window.rolna_playlist_hide = function(){ $("#playlist_vysuvka").collapse('hide'); };
    window.rolna_looper_show   = function(){ $("#looper_vysuvka").collapse('show'); };
    window.rolna_looper_hide   = function(){ $("#looper_vysuvka").collapse('hide'); };
    window.rolna_soubory_show  = function(){ $("#soubory_vysuvka").collapse('show'); };
    window.rolna_soubory_hide  = function(){ $("#soubory_vysuvka").collapse('hide'); };
    window.rolna_texty_show    = function(){ $("#texty_vysuvka").collapse('show'); };
    window.rolna_texty_hide    = function(){ $("#texty_vysuvka").collapse('hide'); };
    window.rolna_val_show      = function(){ $("#val_vysuvka").collapse('show'); };
    window.rolna_val_hide      = function(){ $("#val_vysuvka").collapse('hide'); };

    window.zobraz = function() {
        var elmnt = document.getElementById("k");
        if (elmnt) elmnt.scrollIntoView();
    };

}); // konec document.ready

// ---- pauseOthers - musí být globální (volá se z inline onplay="") ----
function pauseOthers(aktualni) {
    $("audio").not(aktualni).each(function(index, audio) {
        audio.pause();
    });
}

// ---- Recorder - inicializace jen pokud existuje tlačítko ----
(function() {
    var button = document.getElementById('record_button');
    if (!button) return;

    var recorder = new MicRecorder({ bitRate: 128 });

    button.addEventListener('click', startRecording);

    function startRecording() {
        recorder.start().then(function() {
            button.textContent = 'Zastavit nahrávání';
            button.classList.toggle('btn-danger');
            button.removeEventListener('click', startRecording);
            button.addEventListener('click', stopRecording);
        }).catch(function(e) {
            console.error(e);
        });
    }

    function stopRecording() {
        recorder.stop().getMp3().then(function([buffer, blob]) {
            var file = new File(buffer, 'music.mp3', {
                type: blob.type,
                lastModified: Date.now()
            });
            var li = document.createElement('li');
            var player = new Audio(URL.createObjectURL(file));
            player.controls = true;
            li.appendChild(player);
            var playlist = document.querySelector('#playlist');
            if (playlist) playlist.appendChild(li);

            button.textContent = 'Začít nahrávat';
            button.classList.toggle('btn-danger');
            button.removeEventListener('click', stopRecording);
            button.addEventListener('click', startRecording);
        }).catch(function(e) {
            console.error(e);
        });
    }
})();

// ---- Sidenav (zakomentováno v HTML, funkce zachovány) ----
function openNav() {
    var nav = document.getElementById("mySidenav");
    if (nav) nav.style.width = "300px";
}

function closeNav() {
    var nav = document.getElementById("mySidenav");
    if (nav) nav.style.width = "0";
}
