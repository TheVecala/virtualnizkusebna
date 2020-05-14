
		<tone-content>
			<tone-play-toggle></tone-play-toggle>
			<div id="tracks">
				<tone-channel label="bici" id="johny_bici"></tone-channel>
				<tone-channel label="keys" id="johny_key"></tone-channel>
				<tone-channel label="bass" id="johny_bas"></tone-channel>
			</div>
		</tone-content>
 

	<script type="text/javascript">
		function makeChannel(name){
			var channel = new Tone.Channel().toMaster();
			var player = new Tone.Player({
				url : `./data/${name}.[mp3|ogg]`,
				loop : true
			}).sync().start(0);
			player.chain(channel);

			//bind the UI
			document.querySelector(`#${name}`).bind(channel);
		}

		makeChannel("johny_bici");
		makeChannel("johny_key"); 
		makeChannel("johny_bas"); 

		document.querySelector("tone-play-toggle").bind(Tone.Transport);
	</script>