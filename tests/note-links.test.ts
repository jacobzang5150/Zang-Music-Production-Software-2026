import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noteLinks} from '../lib/note-links.ts';
test('web links are clickable while multiline note content is preserved',()=>{
 const text='Mix: https://drive.google.com/file/d/123?x=1&y=2\nReference www.example.com and example.org/music.';
 const parts=noteLinks(text);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),['https://drive.google.com/file/d/123?x=1&y=2','https://www.example.com/','https://example.org/music']);
});
test('trailing punctuation stays outside the link, balanced URL parentheses stay inside',()=>{
 const text='(https://example.com/track_(live)), next.';
 const parts=noteLinks(text);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.equal(parts.find(p=>p.href)?.href,'https://example.com/track_(live)');
});
test('plain notes, empty notes, emails and unsafe schemes do not become executable links',()=>{
 for(const text of ['', 'Just notes', 'artist@example.com', 'javascript:alert(1)', '<script>alert(1)</script>']){
  assert.equal(noteLinks(text).map(p=>p.text).join(''),text);
  assert(noteLinks(text).every(p=>!p.href));
 }
});
