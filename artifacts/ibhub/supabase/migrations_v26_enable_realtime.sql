-- v26: Enable Supabase Realtime for posts, likes and comments
-- Run this in Supabase SQL Editor

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.comments;
