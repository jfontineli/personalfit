begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

select ok(public.nutrition_valid_draft($${"title":"Teste","guidance":"","meals":[],"individualNotes":[{"id":"note-1","section":"meta","item":"Meta individual","quantity":"1 unidade","note":"Texto fictício","showToStudent":true}]}$$::jsonb,false), 'valid individual note is accepted in draft');
select ok(not public.nutrition_valid_draft($${"title":"Teste","guidance":"","meals":[],"individualNotes":[{"id":"note-1","section":"meta","item":"Meta individual","quantity":"1 unidade","note":"Texto fictício","showToStudent":"yes"}]}$$::jsonb,false), 'visibility must be boolean');

select is(jsonb_array_length(public.nutrition_public_snapshot($${"title":"Teste","sourceImport":{"rows":[{"item":"Fonte privada"}]},"individualNotes":[{"id":"note-1","section":"meta","item":"Aluno","quantity":"","note":"Público","showToStudent":true},{"id":"note-2","section":"supl","item":"Nota privada","quantity":"","note":"Reservado","showToStudent":false}]}$$::jsonb)->'individualNotes'),1,'only selected note reaches published snapshot');
select ok(not (public.nutrition_public_snapshot($${"title":"Teste","sourceImport":{"rows":[{"item":"Fonte privada"}]},"individualNotes":[]}$$::jsonb) ? 'sourceImport'),'original source is absent from published snapshot');
select is(public.nutrition_public_snapshot($${"individualNotes":[{"id":"note-1","item":"Aluno","showToStudent":true},{"id":"note-2","item":"Privada","showToStudent":false}]}$$::jsonb)#>>'{individualNotes,0,item}','Aluno','selected note retains its content');
select is(jsonb_array_length(public.nutrition_public_snapshot($${"title":"Legado"}$$::jsonb)->'individualNotes'),0,'old snapshots without notes remain readable');

select * from finish();
rollback;
