-- ─── Make Eren forget the old names (run once) ───────────────────────────────
-- Paste into the Supabase SQL editor for project bjnnqqxjjihmsbljeayf.
--
-- Eren's chat re-reads two things on every message: the facts he saved with
-- his `remember` tool (eren_chat_memories) and the last 30 messages of the
-- chat (eren_chat_messages). Facts saved while a partner went by an older
-- name kept that name alive after the profile was renamed.
--
-- `\m` and `\M` are word boundaries, so "Nina" and "Amina" match but words
-- that merely contain those letters do not. Matching is case-insensitive.

-- 1. See what will go (optional, read-only).
select id, user_id, fact, created_at
from eren_chat_memories
where fact ~* '\m(nina|amina)\M'
order by created_at;

-- 2. Forget every saved fact that uses either name.
delete from eren_chat_memories
where fact ~* '\m(nina|amina)\M';

-- 3. OPTIONAL: also remove old chat lines that say either name. Only the last
--    30 messages are sent back to him, and the app now tells him the names in
--    the game are the only true ones, so this is usually not needed. It does
--    remove those lines from the chat history you see in the Attic, so only
--    run it if he keeps bringing the name up after step 2.
-- delete from eren_chat_messages
-- where content ~* '\m(nina|amina)\M';
