(function(){
'use strict';
const $=id=>document.getElementById(id), n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let data=null, transposed=false, scroll={x:0,y:0}, cell=null, listCell=null, playsByCell=new Map();
async function request(body){const r=await fetch('php/ajax/vz2_history.php',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-CSRF-Token':window.VZ2.csrf}:{},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'Historii nelze načíst.');if(body){const rid=body.source_recording_id||data?.plays.find(p=>Number(p.id)===Number(body.id))?.source_recording_id;if(rid)window.Vz2Timestamps.reload(rid).catch(()=>{});}return j;}
function playable(p){return [p.clip,p.source].some(r=>r?.files?.some(f=>f.url));}
function clock(ms){return Vz2Timestamps.format(ms);}
function recordingName(r){return (r?.files||[]).map(f=>f.display_name||f.original_name||f.title).filter(Boolean).join(', ')||r?.title||'';}
function contextTitle(song,rehearsal){return 'skladba: '+song+' × zkouška: '+rehearsal;}
function title(p){return recordingName(p.clip)||p.clip_title||(recordingName(p.source)?recordingName(p.source)+' · ':'')+clock(p.start_ms||0);}
function origin(p){
 if(p.source_recording_id!=null)return p.clip_recording_id!=null?{key:'linked-clip',label:'Úsek + výstřižek'}:{key:'interval',label:'Úsek bez výstřižku'};
 return {key:'standalone',label:'Samostatný soubor'};
}
function option(value,text){const o=n('option',text);o.value=value;return o;}
function refreshFilter(){const select=$('history-song-filter'),v=select.value;select.replaceChildren(option('','Všechny skladby'));data.songs.forEach(s=>select.append(option(s.id,s.title)));select.value=v;}
function cellKey(songId,rehearsalId){return String(songId)+':'+String(rehearsalId);}
function indexPlays(){
 const onlyAudio=$('history-audio-filter').checked;
 playsByCell=new Map();
 data.plays.forEach(p=>{
  if(onlyAudio&&!playable(p))return;
  const key=cellKey(p.song_collection_id,p.rehearsal_collection_id);
  if(!playsByCell.has(key))playsByCell.set(key,[]);
  playsByCell.get(key).push(p);
 });
}
function cellPlays(song,rehearsal){return playsByCell.get(cellKey(song.id,rehearsal.id))||[];}
function render(){if(!data)return;indexPlays();refreshFilter();syncControls();const selected=Number($('history-song-filter').value)||null;
 const songs=data.songs.filter(s=>!selected||Number(s.id)===selected), rehearsals=data.rehearsals, rows=transposed?songs:rehearsals, cols=transposed?rehearsals:songs;
 const matrix=$('history-matrix');
 if(!songs.length||!rehearsals.length){const empty=n('div',undefined,'history-empty'),icon=n('i');icon.className='ti ti-calendar-off';icon.setAttribute('aria-hidden','true');empty.append(icon,n('h3',selected?'Pro výběr nejsou žádná data':'Historie je zatím prázdná'),n('p',selected?'Zkuste zobrazit všechny skladby nebo změnit filtr.':'Až propojíte úsek zkoušky se skladbou, objeví se tady.'));matrix.replaceChildren(empty);return;}
 const table=n('table');table.className='history-table';table.style.minWidth=(160+cols.length*84)+'px';
 const head=n('thead'),hr=n('tr'),corner=n('th',transposed?'Skladba':'Zkouška','history-axis');corner.scope='col';hr.append(corner);
 cols.forEach(c=>{const th=n('th',c.title);th.title=c.title;th.scope='col';hr.append(th);});head.append(hr);table.append(head);const body=n('tbody');
 rows.forEach(row=>{
  const tr=n('tr'),rh=n('th',row.title);rh.title=row.title;rh.scope='row';tr.append(rh);
  cols.forEach(col=>{
   const song=transposed?row:col,rehearsal=transposed?col:row,td=n('td'),plays=cellPlays(song,rehearsal);
   td.dataset.songId=song.id;td.dataset.rehearsalId=rehearsal.id;
   if(plays.length || data.can_edit){
    const badge=n('button',String(plays.length),'history-count'+(plays.length?'':' is-empty'));
    badge.type='button';badge.setAttribute('aria-haspopup','dialog');badge.setAttribute('aria-controls','history-list');
    badge.title='Nahrávky a výstřižky: '+song.title+' × '+rehearsal.title+' ('+plays.length+')';badge.setAttribute('aria-label',badge.title);
    badge.onclick=()=>openList(song,rehearsal);td.append(badge);
   }else{const blank=n('span','—','history-blank');blank.setAttribute('aria-hidden','true');td.append(blank);}
   tr.append(td);
  });body.append(tr);
 });table.append(body);matrix.replaceChildren(table);matrix.scrollTo(scroll.x,scroll.y);
}
function renderList(){
 if(!listCell)return;
 const {song,rehearsal}=listCell,items=$('history-list').querySelector('.history-attempts'),plays=cellPlays(song,rehearsal);
 $('history-list-title').textContent=contextTitle(song.title,rehearsal.title);
 items.replaceChildren();
 const groups=new Map();
 plays.forEach(p=>{
  if(p.source_recording_id!=null){
   const key=p.source_recording_id;
   if(!groups.has(key))groups.set(key,{source:p.source,sourceTitle:p.source_title,plays:[]});
   groups.get(key).plays.push(p);
  }
 });
 function appendPlay(p,target){
  const li=n('li'),button=n('button',undefined,'history-list-row'),icon=n('i'),text=n('span',undefined,'history-list-text');
  const hasSource=p.source_recording_id!=null,hasClip=p.clip_recording_id!=null,type=origin(p);
  const start=p.start_body?.trim(),name=hasSource?(start && start!=='↑'?start:'Úsek '+clock(p.start_ms||0)):title(p);
  const description=[];
  if(hasSource){
   description.push(p.start_ms!=null && p.end_ms!=null?'Čas zkoušky: '+clock(p.start_ms)+'–'+clock(p.end_ms):'Čas zkoušky není dostupný');
   if(hasClip)description.push('Soubor: '+(recordingName(p.clip)||p.clip_title||'Nedostupný soubor'));
  }else description.push('Bez vazby na časový úsek zkoušky');
  if(p.notes?.length)description.push('Poznámky: '+p.notes.length);
  if(!playable(p))description.push('Audio není dostupné');
  icon.className='ti '+(playable(p)?'ti-file-music':'ti-volume-off');icon.setAttribute('aria-hidden','true');
  text.append(n('span',type.label,'history-origin-badge'),n('strong',name),n('small',description.join(' · ')));
  button.type='button';button.dataset.playId=p.id;button.dataset.origin=type.key;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','history-detail');
  button.append(icon,text);button.onclick=()=>{$('history-list').close();detail(p);};li.append(button);target.append(li);
 }
 groups.forEach(group=>{
  const li=n('li',undefined,'history-source-group'),heading=n('h3','Zdroj: '+(recordingName(group.source)||group.sourceTitle||'Nedostupná nahrávka'),'history-source-title'),clips=n('ul',undefined,'history-source-clips');
  group.plays.sort((a,b)=>(a.start_ms??Infinity)-(b.start_ms??Infinity)||Number(a.id)-Number(b.id));
  group.plays.forEach(clip=>appendPlay(clip,clips));
  li.append(heading,clips);items.append(li);
 });
 const standalone=plays.filter(p=>p.source_recording_id==null);
 if(standalone.length){
  const li=n('li',undefined,'history-direct-group'),heading=n('h3','Soubory bez časové vazby na zkoušku','history-source-title'),clips=n('ul',undefined,'history-direct-clips');
  standalone.forEach(p=>appendPlay(p,clips));
  li.append(heading,clips);items.append(li);
 }
 if(!plays.length)items.append(n('li','V této buňce nejsou žádné pokusy odpovídající filtrům.','history-list-empty'));
 $('history-list-add').hidden=!data.can_edit;
}
function openList(song,rehearsal){listCell={song,rehearsal};renderList();if(!$('history-list').open)$('history-list').showModal();}
function renderUnassigned(){
 const content=$('history-unassigned-content');content.replaceChildren();
 const sections=[
  {heading:'Úseky',items:data.unassigned_intervals,empty:'Žádné nezařazené úseky.',row:i=>[i.recording_title,'Zkouška: '+i.rehearsal_title+' · '+clock(i.start_ms)+'–'+clock(i.end_ms),i.start_body]},
  {heading:'Výstřižky',items:data.unassigned_clips,empty:'Žádné nezařazené výstřižky.',row:c=>[c.title,'Skladba: '+c.collection_title+(c.audio_state==='available'?'':' · Audio není dostupné')]}
 ];
 sections.forEach(({heading,items,empty,row})=>{
  const section=n('section',undefined,'history-unassigned-section'),title=n('h3',heading+' ('+items.length+')');section.append(title);
  if(!items.length)section.append(n('p',empty,'history-list-empty'));
  else{
   const list=n('ul',undefined,'history-unassigned-items');
   items.forEach(item=>{const [name,context,note]=row(item),li=n('li');li.append(n('strong',name),n('small',context));if(note?.trim())li.append(n('p',note,'history-candidate-note'));list.append(li);});
   section.append(list);
  }
  content.append(section);
 });
}
$('history-unassigned-open').onclick=async()=>{
 $('history-options').open=false;
 const dialog=$('history-unassigned'),content=$('history-unassigned-content');
 if(data)renderUnassigned();else content.replaceChildren(n('p','Načítám nezařazené položky…'));
 dialog.showModal();
 if(!data)try{data=await request();render();if(dialog.open)renderUnassigned();}catch(error){if(dialog.open)content.replaceChildren(n('p',error.message,'error'));}
};
function returnToList(){if(listCell && !$('history-workspace').hidden)openList(listCell.song,listCell.rehearsal);}
$('history-list-add').onclick=()=>{const {song,rehearsal}=listCell;$('history-list').close();openAdd(song,rehearsal);};
$('history-detail').addEventListener('close',()=>{ $('history-detail').querySelectorAll('audio').forEach(audio=>audio.pause());returnToList(); });
document.querySelectorAll('[data-history-back]').forEach(b=>b.onclick=()=>{$('history-add').close();returnToList();});
function audioButton(recording,label,start=0){const f=recording?.files?.find(x=>x.url);if(!f)return null;const a=n('audio');a.preload='metadata';a.src=f.url;a.addEventListener('loadedmetadata',()=>{a.currentTime=start/1000;},{once:true});const box=n('div',undefined,'history-card-audio');box.append(Vz2Audio.mount(a,{knownDurationMs:recording.duration_ms,label,inlineControls:true}).root);return box;}
function details(label,contents){const d=n('details'),s=n('summary',label);d.append(s,...contents);return d;}
function historyCard(label,contents,open=false){const card=details(label,contents);card.className='history-detail-card';card.open=open;card.addEventListener('toggle',()=>{if(!card.open)card.querySelectorAll('audio').forEach(audio=>audio.pause());});return card;}
function detail(p){
 const dialog=$('history-detail'),body=dialog.querySelector('.history-detail-body'),context=dialog.querySelector('.history-detail-context');
 context.replaceChildren(n('span','zkouška: ','history-context-label'),n('strong',p.rehearsal_title),n('span',' × ','history-context-cross'),n('span','skladba: ','history-context-label'),n('strong',p.song_title));
 $('history-detail-title').textContent=p.start_body?.trim()||title(p);
 body.replaceChildren();
 const type=origin(p),badge=n('span',type.label,'history-origin-badge history-detail-origin');badge.dataset.origin=type.key;body.append(badge);
 if(p.source_recording_id||p.source){
  const deleted=!p.source||p.source.audio_state==='deleted',contents=[];
  const player=audioButton(p.source,'Původní nahrávka ze zkoušky',p.start_ms);
  if(p.source){
   const line=n('div',undefined,'history-source-line');line.append(n('strong',recordingName(p.source),'history-card-filename'));
   if(p.start_ms!=null&&p.end_ms!=null){
    const range='Úsek '+clock(p.start_ms)+'–'+clock(p.end_ms);
    if(player){
     const jump=n('button',range,'history-card-range history-range-jump');jump.type='button';jump.title='Přejít na začátek úseku';
     jump.setAttribute('aria-label','Přejít na začátek úseku '+clock(p.start_ms));
     jump.onclick=()=>{window.Vz2Timestamps?.stopLoop();const audio=player.querySelector('audio'),time=p.start_ms/1000;if(audio.readyState>=1)audio.currentTime=time;else{audio.addEventListener('loadedmetadata',()=>{audio.currentTime=time;},{once:true});audio.load();}};
     line.append(jump);
    }else line.append(n('small',range,'history-card-range'));
   }
   contents.push(line);
  }else contents.push(n('p','Původní nahrávka už není dostupná.','history-card-unavailable'));
  if(player)contents.push(player);
  body.append(historyCard('Původní nahrávka ze zkoušky'+(deleted?' (smazána)':''),contents,true));
 }
 const clipContents=[];
 if(p.clip){
  clipContents.push(n('strong',recordingName(p.clip),'history-card-filename'));
  if(p.clip.summary)clipContents.push(n('small',p.clip.summary,'history-card-range'));
  const player=audioButton(p.clip,'Výstřižek');if(player)clipContents.push(player);
 }else if(p.clip_recording_id)clipContents.push(n('p','Výstřižek už není dostupný.','history-card-unavailable'));
 if(p.can_edit){
  const clips=data.unassigned_clips.filter(c=>c.collection_id==p.song_collection_id),sel=n('select'),label=n('label','Připojený výstřižek');
  sel.append(option('','Bez připojeného výstřižku'));
  if(p.clip_recording_id)sel.append(option(p.clip_recording_id,recordingName(p.clip)||p.clip_title));
  clips.forEach(c=>sel.append(option(c.id,c.title)));sel.value=p.clip_recording_id||'';sel.id='history-clip-select';label.htmlFor=sel.id;
  const save=n('button');
  const updateAction=()=>{
   const next=sel.value?Number(sel.value):null;
   save.textContent=next?(p.clip_recording_id?'Změnit připojený výstřižek':'Připojit výstřižek'):(p.clip_recording_id?'Odpojit výstřižek':'Připojit výstřižek');
   save.disabled=next===(p.clip_recording_id??null);
  };
  sel.onchange=updateAction;updateAction();
  save.onclick=async()=>{data=await request({action:'update',id:p.id,revision:p.revision,song_collection_id:p.song_collection_id,rehearsal_collection_id:p.rehearsal_collection_id,source_recording_id:p.source_recording_id,start_timestamp_id:p.start_timestamp_id,end_timestamp_id:p.end_timestamp_id,clip_recording_id:sel.value?Number(sel.value):null});$('history-detail').close();render();};
  clipContents.push(label,sel,save);
 }
 if(p.clip||p.clip_recording_id||p.can_edit){
  const clipCard=historyCard(p.source_recording_id!=null?'Výstřižek':'Samostatný soubor',clipContents,false);
  if(p.clip||p.clip_recording_id)body.append(clipCard);
  else{
   const add=n('button','+ Přidat výstřižek','history-add-clip');add.type='button';clipCard.hidden=true;
   add.onclick=()=>{add.hidden=true;clipCard.hidden=false;clipCard.open=true;clipCard.querySelector('select')?.focus();};
   body.append(add,clipCard);
  }
 }
 if(p.source)body.append(details('Poznámky ('+p.notes.length+')',p.notes.length?p.notes.map(x=>n('p',Vz2Timestamps.format(x.time_ms)+' · '+x.body)):[n('p','Žádné poznámky v úseku.')]));
 if(p.can_edit){
  const del=n('button','Odebrat pokus z historie');del.className='danger';
  del.onclick=async()=>{if(!confirm('Odebrat pouze historický pokus? Audio ani značky se nesmažou.'))return;data=await request({action:'delete',id:p.id,revision:p.revision});$('history-detail').close();render();};
  body.append(n('p','Nahrávky, výstřižky a časové značky zůstanou zachované.','history-removal-help'),del);
 }
 dialog.showModal();}
let addBusy=false;
function renderCandidates(){
 const {song,rehearsal}=cell,box=$('history-add').querySelector('.history-candidates');box.replaceChildren();
 $('history-add').querySelector('.history-context').textContent=contextTitle(song.title,rehearsal.title);
 function candidate(key,name,description,startBody,fields){
  const row=n('div',undefined,'history-candidate'),text=n('div',undefined,'history-candidate-text'),add=n('button','Přidat');
  row.dataset.candidate=key;text.append(n('strong',name),n('small',description));
  if(startBody)text.append(n('p',startBody,'history-candidate-note'));
  add.type='button';add.disabled=addBusy;add.onclick=()=>addCandidate(fields,row);row.append(text,add);box.append(row);
 }
 data.unassigned_intervals.filter(i=>i.rehearsal_collection_id==rehearsal.id && i.can_assign!==false).forEach(i=>candidate(
  'i:'+i.recording_id+':'+i.start_timestamp_id+':'+i.end_timestamp_id,i.recording_title,
  'úsek: '+clock(i.start_ms)+' - '+clock(i.end_ms),i.start_body,
  {source_recording_id:Number(i.recording_id),start_timestamp_id:Number(i.start_timestamp_id),end_timestamp_id:Number(i.end_timestamp_id)}
 ));
 data.unassigned_clips.filter(c=>c.collection_id==song.id).forEach(c=>candidate(
  'c:'+c.id,c.title,'Výstřižek'+(c.audio_state==='available'?'':' · Audio není dostupné'),null,{clip_recording_id:Number(c.id)}
 ));
 if(!box.children.length)box.append(n('p','Pro tuto buňku není žádný dokončený nezařazený úsek ani volný výstřižek.'));
}
function openAdd(song,rehearsal){
 cell={song,rehearsal};renderCandidates();$('history-add').querySelector('.error').textContent='';$('history-add').querySelector('.history-add-status').textContent='';$('history-add').showModal();
}
async function addCandidate(fields,row){
 if(addBusy)return;
 const context=cell,dialog=$('history-add'),next=row.nextElementSibling?.querySelector('button')?.closest('[data-candidate]')?.dataset.candidate;
 addBusy=true;dialog.querySelectorAll('.history-candidate button').forEach(button=>button.disabled=true);dialog.querySelector('.error').textContent='';dialog.querySelector('.history-add-status').textContent='';
 try{
  data=await request({action:'create',song_collection_id:Number(context.song.id),rehearsal_collection_id:Number(context.rehearsal.id),source_recording_id:null,start_timestamp_id:null,end_timestamp_id:null,clip_recording_id:null,...fields});
  render();if($('history-list').open)renderList();
  if(dialog.open && context===cell){
   addBusy=false;renderCandidates();dialog.querySelector('.history-add-status').textContent='Pokus přidán.';
   const remaining=[...dialog.querySelectorAll('.history-candidate')];
   (remaining.find(candidate=>candidate.dataset.candidate===next)?.querySelector('button')||remaining[0]?.querySelector('button')||dialog.querySelector('[data-history-close]')).focus({preventScroll:true});
  }
 }catch(error){if(dialog.open && context===cell)dialog.querySelector('.error').textContent=error.message;}
 finally{addBusy=false;dialog.querySelectorAll('.history-candidate button').forEach(button=>button.disabled=false);}
}
document.querySelectorAll('[data-history-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
let loading = false;
async function loadHistory(){
 if(loading)return;
 loading=true;$('history-status').textContent='Načítám historii…';
 try{data=await request();render();$('history-status').textContent='';}
 catch(e){$('history-status').textContent=e.message;}
 finally{loading=false;}
};
function syncControls(){
 const select=$('history-song-filter'), filtered=!!select.value;
 $('history-filter').classList.toggle('is-active',filtered);
 $('history-filter-label').textContent=filtered ? select.selectedOptions[0]?.textContent || 'Skladby' : 'Všechny skladby';
 $('history-filter').querySelector('summary').title=filtered ? 'Filtr: '+select.selectedOptions[0]?.textContent : 'Filtr skladeb';
 $('history-audio-filter').closest('label').classList.toggle('is-active',$('history-audio-filter').checked);
}
$('history-orientation').onclick=e=>{transposed=!transposed;e.currentTarget.setAttribute('aria-pressed',String(transposed));render();};
$('history-song-filter').onchange=()=>{render();$('history-filter').open=false;};
$('history-audio-filter').onchange=()=>{syncControls();render();};
$('history-matrix').onscroll=e=>{scroll={x:e.currentTarget.scrollLeft,y:e.currentTarget.scrollTop};};
$('history-filter').addEventListener('toggle',()=>{if($('history-filter').open)$('history-options').open=false;});
$('history-options').addEventListener('toggle',()=>{if($('history-options').open)$('history-filter').open=false;});
document.addEventListener('click',e=>{if(!$('history-filter').contains(e.target))$('history-filter').open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('history-filter').open){$('history-filter').open=false;$('history-filter').querySelector('summary').focus();e.preventDefault();}});
document.addEventListener('vz2:workspace-changed',e=>{if(e.detail.workspace==='history')loadHistory();else{$('history-filter').open=false;$('history-options').open=false;}});
document.addEventListener('vz2:timestamps-updated',()=>{if(window.Vz2Layout.getWorkspace()==='history')loadHistory();});
if(window.Vz2Layout.getWorkspace()==='history')loadHistory();
})();
