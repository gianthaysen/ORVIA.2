import { readFileSync } from 'node:fs'; import vm from 'node:vm';
const src = readFileSync('supabase/tests/goals_manager_list_test.mjs','utf8');
