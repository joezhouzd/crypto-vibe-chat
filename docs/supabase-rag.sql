-- Binance 单文档 RAG 初始化（Supabase SQL Editor 执行）
create extension if not exists vector;

create table if not exists public.binance_kb_chunks (
  id uuid primary key default gen_random_uuid(),
  article_url text not null,
  article_title text not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(256) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_binance_kb_chunks_article_url on public.binance_kb_chunks (article_url);
create index if not exists idx_binance_kb_chunks_embedding on public.binance_kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function public.match_binance_kb_chunks(
  query_embedding vector(256),
  match_count int default 5,
  match_threshold float default 0.1
)
returns table (
  id uuid,
  article_url text,
  article_title text,
  chunk_index integer,
  content text,
  similarity float
)
language sql
as $$
  select
    c.id,
    c.article_url,
    c.article_title,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.binance_kb_chunks c
  where 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
