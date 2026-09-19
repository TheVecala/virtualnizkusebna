'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {prepare,readManifest,check}=require('../tools/vz2_storage_http_check');
const php=process.env.PHP_BIN;
assert(php,'Set PHP_BIN');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vz2-storage-'));
const pkg=prepare(path.join(temp,'package'));
const manifest=readManifest(path.join(pkg,'manifest.json'));
const publicRoot=path.join(pkg,'public'),storage=path.join(publicRoot,'_vz2_storage');
let checks=0;
function ok(condition,label){assert(condition,label);console.log('OK '+(++checks)+': '+label);}
const quote=s=>"'"+String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
function phpRun(script){return execFileSync(php,[script],{windowsHide:true,encoding:'utf8'});}
function rootCheck({mode='http-denied',verified=false,publicPath=publicRoot,dataset=manifest.dataset}={}){
    const file=path.join(temp,'root-check.php');
    fs.writeFileSync(file,`<?php
define('VZ2_STORAGE_ROOT',${quote(storage)});define('VZ2_DATASET_KEY',${quote(dataset)});
${publicPath===null?'':"define('VZ2_PUBLIC_ROOT',"+quote(publicPath)+");"}
define('VZ2_STORAGE_ACCESS',${quote(mode)});define('VZ2_STORAGE_HTTP_VERIFIED',${verified?'true':'false'});
require ${quote(path.resolve(__dirname,'../php/inc/vz2_storage.php'))};
try{vz2_root();echo 'OK';}catch(Vz2Error $e){echo $e->status;}
`);
    return phpRun(file);
}
(async()=>{
    ok(rootCheck()==='503','public storage blocked before explicit HTTP verification');
    ok(rootCheck({verified:true})==='OK','verified public storage accepted with matching marker');
    const guard=path.join(storage,'.htaccess'),originalGuard=fs.readFileSync(guard);
    fs.renameSync(guard,guard+'.held');ok(rootCheck({verified:true})==='503','missing deny file blocks storage even after declared verification');
    fs.renameSync(guard+'.held',guard);fs.writeFileSync(guard,'Require all granted\n');
    ok(rootCheck({verified:true})==='503','modified allow rule blocks storage');
    fs.writeFileSync(guard,originalGuard);
    ok(rootCheck({mode:'private',verified:true})==='503','public storage cannot masquerade as private');
    ok(rootCheck({publicPath:null,verified:true})==='503','common public root must be explicit');
    ok(rootCheck({publicPath:storage,verified:true})==='503','whole public root cannot be storage');
    ok(rootCheck({mode:'unknown',verified:true})==='503','unknown access mode rejected');
    ok(rootCheck({dataset:'wrong-dataset',verified:true})==='503','wrong dataset stays rejected');
    const otherPublic=path.join(temp,'unrelated-public');fs.mkdirSync(otherPublic);
    ok(rootCheck({mode:'private',publicPath:otherPublic})==='OK','private root outside public root remains supported');
    const probe=JSON.parse(execFileSync(php,['-d','disable_functions=link',path.resolve(__dirname,'../tools/vz2_storage_probe.php'),storage],{windowsHide:true,encoding:'utf8'}));
    ok(probe.ok && probe.exclusive_copy && !probe.link_available && probe.flock && probe.dataset===manifest.dataset,'PHP validates copy and competing locks with link() disabled');
    ok(fs.readdirSync(path.join(storage,'.staging')).length===1,'filesystem test removes only its own scratch files');
    const ioTest=path.join(temp,'io-check.php');
    fs.writeFileSync(ioTest,`<?php
require ${quote(path.resolve(__dirname,'../php/inc/vz2_file_io.php'))};
$source=__DIR__.'/io-source';$target=__DIR__.'/io-target';$body=str_repeat('audio bytes',10000);$hash=hash('sha256',$body);
file_put_contents($source,$body);file_put_contents($target,'foreign file');
$collision=false;try{vz2_copy_exclusive($source,$target,$hash);}catch(RuntimeException $e){$collision=$e->getCode()===409;}
$preserved=file_get_contents($target)==='foreign file' && file_get_contents($source)===$body;
unlink($target);vz2_copy_exclusive($source,$target,$hash);
$completed=hash_file('sha256',$target)===$hash && is_file($source);
unlink($source);vz2_copy_exclusive($source,$target,$hash);$recovered=is_file($target);
file_put_contents($source,$body);file_put_contents($target,substr($body,0,100));
$partial=false;try{vz2_copy_exclusive($source,$target,$hash);}catch(RuntimeException $e){$partial=$e->getCode()===409;}
echo json_encode([$collision && $preserved,$completed,$recovered,$partial && filesize($target)===100 && hash_file('sha256',$source)===$hash]);
`);
    const io=JSON.parse(execFileSync(php,['-d','disable_functions=link',ioTest],{windowsHide:true,encoding:'utf8'}));
    ok(io[0],'exclusive copy preserves a colliding destination and staging');
    ok(io[1],'streamed copy is verified before staging removal');
    ok(io[2],'retry recovers a completed copy even after staging was removed');
    ok(io[3],'hard-crash partial destination is refused and staging remains intact');
    assert.throws(()=>prepare(pkg));ok(fs.readFileSync(path.join(publicRoot,manifest.control),'utf8')===manifest.body,'preparation never overwrites an existing package');
    let scenario='deny';
    const server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://localhost');
        if(url.pathname==='/'+manifest.control){res.statusCode=scenario==='control-denied'?403:200;res.end(scenario==='wrong-control'?'wrong':manifest.body);return;}
        res.statusCode=403;let body='Forbidden';
        if(scenario==='exposed') {res.statusCode=200;body=manifest.body;}
        if(scenario==='range' && req.headers.range){res.statusCode=206;body=manifest.body.slice(0,32);}
        if(scenario==='head' && req.method==='HEAD')res.statusCode=200;
        if(scenario==='missing')res.statusCode=404;
        if(scenario==='error')res.statusCode=500;
        if(scenario==='redirect'){res.statusCode=302;res.setHeader('Location','/login');}
        if(scenario==='leaking-error')body=manifest.body;
        res.end(body);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port+'/';
    try{
        ok(await check(manifest,[base],()=>{}),'external check accepts verified control and 403 for all probes/methods');
        for(scenario of ['exposed','range','head','missing','error','redirect','leaking-error','wrong-control','control-denied'])ok(!(await check(manifest,[base],()=>{})),'external check rejects '+scenario);
        await assert.rejects(()=>check(manifest,[],()=>{}));checks++;console.log('OK '+checks+': empty alias list rejected');
    }finally{await new Promise(resolve=>server.close(resolve));}
    console.log('PASS '+checks+' storage checks; isolated fixtures at '+temp);
})().catch(error=>{console.error(error);process.exitCode=1;});
