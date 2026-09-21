'use strict';
// Node 18+. Prepare harmless FTP probes, then verify from OUTSIDE the hosting.
// Does not contact SQL, upload files, modify config, or certify unknown aliases.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function prepare(output) {
    const folder = path.resolve(output);
    fs.mkdirSync(folder, {recursive:false}); // Never reuse/overwrite an existing package.
    const token = crypto.randomBytes(24).toString('hex');
    const control = 'vz2-control-' + token + '.txt';
    const body = 'VZ2 harmless storage probe ' + token + '\n';
    const probes = ['probe-' + token + '.txt','nested/probe-' + token + '.txt',
        'skladby/probe-' + token + '.wav','.staging/probe-' + token + '.txt',
        '.cache/peaks/probe-' + token + '.json'];
    const write = (name, text) => { const dest=path.join(folder,name); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,text,{flag:'wx'}); };
    write('public/' + control,body);
    for(const probe of probes)write('public/_vz2_storage/' + probe,body);
    write('public/_vz2_storage/.htaccess',fs.readFileSync(path.join(__dirname,'../deploy/vz2-storage/apache.htaccess')));
    const manifest={version:1,control,storage:'_vz2_storage/',probes,body,dataset:'vz2-'+token};
    write('public/_vz2_storage/.vz2-storage-id',manifest.dataset+'\n');
    write('public/_vz2_storage/.vz2-probe.json',JSON.stringify(manifest,null,2)+'\n');
    write('beta-tools/vz2_storage_probe.php',fs.readFileSync(path.join(__dirname,'vz2_storage_probe.php')));
    write('beta-php-inc/vz2_file_io.php',fs.readFileSync(path.join(__dirname,'../php/inc/vz2_file_io.php')));
    write('CTI_PRVNI.txt',fs.readFileSync(path.join(__dirname,'../deploy/vz2-storage/README.cs.md')));
    write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
    return folder;
}
function readManifest(filename) {
    const manifest=JSON.parse(fs.readFileSync(filename,'utf8'));
    const safe=p=>typeof p==='string' && /^[a-zA-Z0-9_./-]+$/.test(p) && !p.startsWith('/') && !p.includes('..');
    if(manifest.version!==1 || manifest.storage!=='_vz2_storage/' || !safe(manifest.control) || !Array.isArray(manifest.probes)
        || manifest.probes.length!==5 || !manifest.probes.every(safe) || typeof manifest.body!=='string' || !manifest.body.startsWith('VZ2 harmless storage probe '))throw new Error('Invalid probe manifest.');
    return manifest;
}
async function check(manifest, bases, report=console.log) {
    if(!bases.length)throw new Error('List every public root URL/alias to test.');
    let passed=true;
    for(const input of bases) {
        const base=new URL(input);
        if(!['http:','https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/'))throw new Error('Use public root URLs ending in / without credentials, query or fragment.');
        const nonce=crypto.randomBytes(8).toString('hex');
        const request=async(relative,method,range=false)=>{
            const url=new URL(relative,base);url.searchParams.set('vz2_probe',nonce);
            const response=await fetch(url,{method,redirect:'manual',headers:{'Cache-Control':'no-cache',...(range?{Range:'bytes=0-31'}:{})},signal:AbortSignal.timeout(10000)});
            // Limit reads: do not download a large error page or unexpected binary.
            let body='';const reader=response.body?.getReader();
            try{while(reader && body.length<8192){const part=await reader.read();if(part.done)break;body+=Buffer.from(part.value).toString('utf8');}}
            finally{if(reader)await reader.cancel();}
            return {status:response.status,body};
        };
        try {
            const control=await request(manifest.control,'GET');
            if(control.status!==200 || control.body!==manifest.body)throw new Error('Public control is not HTTP 200 with the expected contents; check host and upload paths.');
            report('OK control '+base.href);
            for(const probe of manifest.probes)for(const [method,range] of [['GET',false],['HEAD',false],['GET',true]]) {
                const response=await request(manifest.storage+probe,method,range);
                const ok=response.status===403 && !response.body.includes(manifest.body.trim());
                if(!ok)passed=false;
                report((ok?'OK ':'FAIL ')+method+(range?' Range':'')+' '+new URL(manifest.storage+probe,base).href+' HTTP '+response.status);
            }
        }catch(error){passed=false;report('FAIL '+base.href+' '+error.message);}
    }
    report(passed?'PASS: listed URLs deny the probes. Confirm PHP file access, all aliases and server rules before enabling storage.':'FAIL: storage must remain disabled. Redirects, 404, server errors and unavailable control are not accepted as proof.');
    return passed;
}
module.exports={prepare,readManifest,check};
if(require.main===module)(async()=>{
    const [action,target,...bases]=process.argv.slice(2);
    if(action==='prepare' && target && !bases.length)console.log('Prepared '+prepare(target)+' (Apache template; confirm server support before uploading).');
    else if(action==='check' && target)process.exitCode=(await check(readManifest(target),bases))?0:1;
    else throw new Error('Usage: node tools/vz2_storage_http_check.js prepare NEW_FOLDER | check MANIFEST_JSON PUBLIC_ROOT_URL [...ALIASES]');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
