'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
module.exports = async function ({ request, clients, db, good, check, login }) {
    const endpoint = 'php/ajax/vz2_content.php';
    const a = await good('alice',{action:'collection_create',kind:'song',title:'Dokumenty A'});
    const b = await good('bob',{action:'collection_create',kind:'rehearsal',title:'Diskuse B'});
    const get = (who, query) => request(clients[who],endpoint+'?'+new URLSearchParams(query));
    const post = (who, fields, options) => request(clients[who],endpoint,fields,options);
    const query = {action:'document',collection_id:a.id,kind:'lyrics_chords'};
    const save = {action:'document_save',collection_id:a.id,kind:'lyrics_chords',document_id:null,current_revision:0,title:'Text a akordy',body:'  C       G\nText písně\n'};
    let r = await get('alice',query);
    check(r.status===200 && r.json().document===null && r.json().can_edit && db('SELECT * FROM vz2_documents').length===0,'document read does not create empty SQL records');
    check((await get('anon',query)).status===401 && !(await get('guest',query)).json().can_edit,'document reads require login; guest reads without edit rights');
    check((await post('guest',save)).status===403 && (await post('alice',save,{noCsrf:true})).status===403,'document writes enforce identity and CSRF');
    for(const body of ['', '  ', 'x'.repeat(1048577)]) assert.equal((await post('alice',{...save,body})).status,400);
    assert.equal((await post('alice',{...save,kind:'unknown'})).status,400);
    const race = await Promise.all(['alice','bob'].map(who=>post(who,save)));
    assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
    let doc = (await get('alice',query)).json(); const id = doc.document.id, creator = doc.document.created_by;
    check(doc.version.body===save.body && doc.document.current_revision===1 && db('SELECT * FROM vz2_document_versions WHERE document_id=?',[id]).length===1,'concurrent first save creates one document/version; indentation and newlines preserved');
    r = await post('bob',{...save,document_id:id,current_revision:1,body:'Nová verze',created_by:1});
    assert.equal(r.status,200,r.text); doc=r.json();
    check(doc.document.created_by===creator && doc.document.updated_by===3 && doc.version.created_by===3 && doc.document.current_revision===2,'member edits any shared document; creator preserved and version author from session');
    assert.equal((await post('alice',{...save,document_id:id,current_revision:1})).status,409);
    assert.equal((await post('alice',{...save,document_id:id+10000,current_revision:2})).status,404);
    assert.equal((await post('alice',{...save,collection_id:b.id,document_id:id})).status,404);
    check((await get('guest',{...query,revision:1})).json().version.body===save.body,'stale or wrong-scope saves do not alter immutable prior version');
    const restore = {action:'document_restore',collection_id:a.id,kind:'lyrics_chords',document_id:id,current_revision:2,source_revision:1,body:'Ignored client content'};
    r=await post('alice',restore); assert.equal(r.status,200,r.text); doc=r.json();
    check(doc.document.current_revision===3 && doc.version.body===save.body && doc.version.created_by===2 && db('SELECT * FROM vz2_document_versions WHERE document_id=?',[id]).length===3,'restore creates new revision with server-side historic content');
    assert.equal((await post('alice',restore)).status,409);
    assert.equal((await post('alice',{...restore,current_revision:3,source_revision:999})).status,404);
    db("CREATE TRIGGER reject_content_audit BEFORE INSERT ON vz2_activity_log FOR EACH ROW BEGIN IF NEW.action='document.version_created' OR NEW.action LIKE 'discussion.post_%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test audit failure'; END IF; END");
    try {
        assert.equal((await post('alice',{...save,document_id:id,current_revision:3,body:'Must roll back'})).status,500);
        assert.equal((await post('alice',{...save,kind:'tablature'})).status,500);
        check(db('SELECT * FROM vz2_documents WHERE current_revision IS NULL').length===0 && db('SELECT * FROM vz2_documents').length===1 && db('SELECT * FROM vz2_document_versions WHERE document_id=?',[id]).length===3,'audit failure rolls back both first document creation and new version');
    } finally { db('DROP TRIGGER reject_content_audit'); }
    for(let revision=3;revision<23;revision++) { r=await post('bob',{...save,document_id:id,current_revision:revision,body:'Verze '+(revision+1)}); assert.equal(r.status,200,r.text); }
    const first=(await get('guest',{...query,action:'history'})).json();
    const second=(await get('guest',{...query,action:'history',before:first.next_before})).json();
    check(first.versions.length===20 && second.versions.length===3 && second.next_before===null && new Set([...first.versions,...second.versions].map(v=>v.revision)).size===23,'complete document history paginates without gaps or duplicates');
    r=await post('alice',{...save,kind:'tablature',body:'😀'.repeat(262144)}); assert.equal(r.status,200,r.text);
    check(Buffer.byteLength(r.json().version.body,'utf8')===1048576 && db('SELECT * FROM vz2_documents WHERE collection_id=?',[a.id]).length===2,'separate tablature supports exact 1 MiB Unicode boundary');
    const threadA=(await get('alice',{action:'discussion',collection_id:a.id})).json().thread;
    const threadB=(await get('bob',{action:'discussion',collection_id:b.id})).json().thread;
    const ideas=(await get('guest',{action:'discussion',scope:'ideas'})).json().thread;
    check(threadA.id!==threadB.id && ideas.collection_id===null && ideas.global_key==='ideas','collections and global ideas resolve distinct stable threads');
    const create={action:'post_create',thread_id:threadA.id,body:'Příspěvek do cizí skladby'};
    assert.equal((await post('guest',create)).status,403);
    assert.equal((await post('bob',create,{noCsrf:true})).status,403);
    for(const body of ['', ' ', 'Ž'.repeat(20001)]) assert.equal((await post('bob',{...create,body})).status,400);
    r=await post('bob',{...create,body:'😀'.repeat(20000),created_by:1}); assert.equal(r.status,200,r.text); const postId=r.json().post_id;
    let item=(await get('alice',{action:'discussion',thread_id:threadA.id,post_id:postId})).json().posts[0];
    check(item.created_by===3 && Buffer.byteLength(item.body)===80000 && !item.can_edit,'migration 003 supports 20,000 emoji; parent owner cannot edit foreign post');
    const update={action:'post_update',thread_id:threadA.id,post_id:postId,revision:1,body:'Úprava'};
    assert.equal((await post('alice',update)).status,403);
    assert.equal((await post('alice',{...update,action:'post_delete'})).status,403);
    assert.equal((await post('bob',{...update,thread_id:threadB.id})).status,404);
    assert.equal((await get('admin',{action:'discussion',thread_id:threadB.id,post_id:postId})).status,404);
    r=await post('bob',update); assert.equal(r.status,200,r.text);
    assert.equal((await post('bob',update)).status,409);
    assert.equal((await post('admin',{...update,action:'post_delete'})).status,409);
    r=await post('admin',{...update,revision:2,body:'Admin opravil'}); assert.equal(r.status,200,r.text);
    item=(await get('alice',{action:'discussion',thread_id:threadA.id,post_id:postId})).json().posts[0];
    check(item.created_by===3 && item.updated_by===1 && item.revision===3,'post author preserved through admin edit; wrong thread and stale versions rejected');
    const beforeCount=db('SELECT * FROM vz2_discussion_posts WHERE thread_id=?',[threadA.id]).length;
    db("CREATE TRIGGER reject_content_audit BEFORE INSERT ON vz2_activity_log FOR EACH ROW BEGIN IF NEW.action LIKE 'discussion.post_%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test audit failure'; END IF; END");
    try {
        assert.equal((await post('bob',create)).status,500);
        assert.equal((await post('bob',{...update,revision:3})).status,500);
        assert.equal((await post('admin',{...update,action:'post_delete',revision:3})).status,500);
    } finally { db('DROP TRIGGER reject_content_audit'); }
    check(db('SELECT * FROM vz2_discussion_posts WHERE thread_id=?',[threadA.id]).length===beforeCount && db('SELECT revision FROM vz2_discussion_posts WHERE id=?',[postId])[0].revision===3,'failed audit rolls back post create/edit/delete');
    db("UPDATE vz2_collections SET lifecycle='deleting' WHERE id=?",[a.id]);
    try {
        assert.equal((await post('bob',create)).status,409);
        assert.equal((await post('bob',{...save,document_id:id,current_revision:23})).status,409);
    } finally { db("UPDATE vz2_collections SET lifecycle='active' WHERE id=?",[a.id]); }
    db('UPDATE users SET active=0 WHERE id=3');
    check((await post('bob',create)).status===401 && (await get('admin',{action:'discussion',thread_id:threadA.id,post_id:postId})).json().posts[0].author_active===0
        && (await get('admin',{...query,action:'history'})).json().versions.some(v=>Number(v.author_active)===0),'deactivation stops writes and marks retained document/post authors inactive');
    db('UPDATE users SET active=1 WHERE id=3'); await login('bob');
    const newPosts=await Promise.all(['alice','bob'].map(who=>post(who,{...create,body:who})));
    assert(newPosts.every(x=>x.status===200)); assert.notEqual(newPosts[0].json().post_id,newPosts[1].json().post_id);
    for(let i=0;i<21;i++) assert.equal((await post('bob',{...create,body:'Řádek '+i})).status,200);
    const page1=(await get('guest',{action:'discussion',thread_id:threadA.id})).json();
    const page2=(await get('guest',{action:'discussion',thread_id:threadA.id,before:page1.next_before})).json();
    check(page1.posts.length===20 && page2.posts.length===4 && new Set([...page1.posts,...page2.posts].map(p=>p.id)).size===24,'simultaneous posts use stable IDs and paginate even with identical timestamps');
    const idea=await post('alice',{action:'post_create',thread_id:ideas.id,body:'Nápad zůstane'}); assert.equal(idea.status,200,idea.text);
    const delayed=await post('bob',{...create,body:'Opožděný zápis stále do A'});
    check(delayed.status===200 && (await get('bob',{action:'discussion',thread_id:threadB.id})).json().posts.length===0,'explicit thread ID routes delayed write independently of selected collection');
    r=await post('bob',{...update,action:'post_delete',revision:3}); assert.equal(r.status,200,r.text);
    check((await get('admin',{action:'discussion',thread_id:threadA.id,post_id:postId})).status===404 && db("SELECT id FROM vz2_activity_log WHERE action='discussion.post_deleted' AND target_id=?",[postId]).length===1,'member may delete own post; audit survives');
    for(const collection of [a,b]) {
        const stored=db('SELECT * FROM vz2_collections WHERE id=?',[collection.id])[0];
        await good('admin',{action:'delete_collection',id:stored.id,revision:stored.revision,confirm:stored.title,request_key:crypto.randomBytes(16).toString('hex')});
    }
    check(db('SELECT * FROM vz2_document_versions WHERE document_id=?',[id]).length===0 && (await get('guest',{action:'discussion',thread_id:ideas.id})).json().posts.some(p=>p.id===idea.json().post_id)
        && db("SELECT id FROM vz2_activity_log WHERE action='document.version_created' AND target_id=?",[id]).length===23,'collection deletion removes its documents/history/posts but keeps global ideas and audit');
    assert.equal((await post('admin',{action:'post_delete',thread_id:ideas.id,post_id:idea.json().post_id,revision:1})).status,200);
};
