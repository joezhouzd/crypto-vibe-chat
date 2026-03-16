export type RAGChunk = {
  id: string;
  article_url: string;
  article_title: string;
  chunk_index: number;
  content: string;
  similarity: number;
};
