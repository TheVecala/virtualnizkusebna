<?php
declare(strict_types=1);

// Contract v1, shared by API, catalogue and exports; JS conformance tests cover
// the fallback projection used by old offline caches. No view-specific geometry.
function vz2_passage_types(): array {
    return ['intro'=>'Intro','verse'=>'Sloka','chorus'=>'Refrén','bridge'=>'Bridge','solo'=>'Sólo','outro'=>'Outro','custom'=>'Vlastní'];
}
function vz2_timestamp_annotations(array $recording, array $entries): array {
    $duration = isset($recording['duration_ms']) ? (int)$recording['duration_ms'] : null;
    $entries = array_values(array_filter($entries, fn($e)=>isset($e['time_ms']) && is_numeric($e['time_ms']) && (int)$e['time_ms'] >= 0 && ($duration === null || (int)$e['time_ms'] <= $duration)));
    usort($entries, fn($a,$b)=>[(int)$a['time_ms'],(int)$a['id']] <=> [(int)$b['time_ms'],(int)$b['id']]);
    $items=[]; $used=[]; $number=0;
    foreach ($entries as $entry) {
        if ($entry['kind']==='song_end') continue;
        $take=$entry['kind']==='song_start'; if ($take) $number++;
        $ends=$take?array_values(array_filter($entries,fn($e)=>$e['kind']==='song_end' && (int)($e['paired_timestamp_id']??0)===(int)$entry['id'] && (int)$e['time_ms']>(int)$entry['time_ms'])):[];
        $end=count($ends)===1?$ends[0]:null;
        if($end)$used[]=(int)$end['id'];
        $endMs=$take?($end['time_ms']??null):($entry['kind']==='passage'?($entry['end_time_ms']??null):null);
        $endMs=$endMs!==null && (int)$endMs>(int)$entry['time_ms'] && ($duration===null || (int)$endMs<=$duration)?(int)$endMs:null;
        $label=trim($entry['body']??''); if(in_array($label,['↑','↓'],true))$label='';
        $items[]=['id'=>'t'.$entry['id'],'recording_id'=>(int)($recording['id']??$recording['recording_id']),'timestamp_id'=>(int)$entry['id'],'end_timestamp_id'=>$end?(int)$end['id']:null,
            'kind'=>$take?'take':$entry['kind'],'start_ms'=>(int)$entry['time_ms'],'end_ms'=>$endMs,
            'status'=>$entry['kind']==='note'?'point':($endMs===null?'open':'complete'),
            'label'=>$label!==''?$label:($take?'Pokus '.$number:(vz2_passage_types()[$entry['passage_type']??'']??'Poznámka')),
            'passage_type'=>$entry['kind']==='passage'?(($entry['passage_type']??null)?:'custom'):null,'note_text'=>$entry['note_text']??'',
            'parent_id'=>empty($entry['parent_timestamp_id'])?null:'t'.$entry['parent_timestamp_id'],
            'song_id'=>$take && isset($entry['song_collection_id'])?(int)$entry['song_collection_id']:null,'song_title'=>$entry['song_title']??$entry['history_song_title']??'',
            'can_edit'=>!empty($entry['can_edit']) && (!$end || !empty($end['can_edit'])),'can_delete'=>!empty($entry['can_delete']) && (!$end || !empty($end['can_delete'])),
            'source'=>$entry,'end_source'=>$end,'boundary'=>$entry['kind']==='note'?'point':($endMs===null?'open':($take?'paired':'explicit'))];
    }
    foreach($items as &$item)foreach($items as $parent)if($parent['kind']==='take' && $parent['id']===$item['parent_id']){$item['song_id']=$parent['song_id'];$item['song_title']=$parent['song_title'];break;}unset($item);
    foreach($entries as $entry)if($entry['kind']==='song_end' && !in_array((int)$entry['id'],$used,true)){
        $label=trim($entry['body']??'');if($label==='↓')$label='';
        $items[]=['id'=>'t'.$entry['id'],'recording_id'=>(int)($recording['id']??$recording['recording_id']),'timestamp_id'=>(int)$entry['id'],'end_timestamp_id'=>null,
            'kind'=>'boundary','start_ms'=>(int)$entry['time_ms'],'end_ms'=>null,'status'=>'orphan','label'=>$label?:'Konec bez začátku','passage_type'=>null,'note_text'=>'','parent_id'=>null,'song_id'=>null,'song_title'=>'',
            'can_edit'=>!empty($entry['can_edit']),'can_delete'=>!empty($entry['can_delete']),'source'=>$entry,'end_source'=>null,'boundary'=>'open'];
    }
    usort($items,fn($a,$b)=>[$a['start_ms'],$a['timestamp_id']]<=>[$b['start_ms'],$b['timestamp_id']]);return $items;
}
