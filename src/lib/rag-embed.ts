const EMBEDDING_DIM = 256;

function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();

  const latinTokens = normalized
    .split(/\s+/)
    .filter((token) => token.length > 1);

  // For CJK text (no spaces), add character bigrams to improve recall.
  const cjkOnly = normalized.replace(/\s+/g, "");
  const cjkChars = Array.from(cjkOnly).filter((char) => /[\p{Script=Han}]/u.test(char));
  const cjkBigrams: string[] = [];
  for (let i = 0; i < cjkChars.length - 1; i += 1) {
    cjkBigrams.push(`${cjkChars[i]}${cjkChars[i + 1]}`);
  }

  return [...latinTokens, ...cjkChars, ...cjkBigrams];
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function createLocalEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const idx = hashToken(token) % EMBEDDING_DIM;
    vector[idx] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => Number(v.toFixed(8))).join(",")}]`;
}
