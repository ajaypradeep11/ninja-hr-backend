export interface PolicyChunkDraft {
  ordinal: number;
  heading: string | null;
  text: string;
}

export const CHUNK_TARGET_CHARS = 1500;
export const CHUNK_OVERLAP_CHARS = 200;

const HEADING_RE = /^#{1,6}\s+(.+)$/;

interface Block {
  heading: string | null;
  text: string;
}

function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let heading: string | null = null;
  for (const rawPara of markdown.split(/\n{2,}/)) {
    const para = rawPara.trim();
    if (!para) continue;
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length > 0) {
        blocks.push({ heading, text: buffer.join('\n').trim() });
        buffer = [];
      }
    };
    for (const line of para.split('\n')) {
      const match = HEADING_RE.exec(line.trim());
      if (match) {
        flush();
        heading = match[1].trim();
        blocks.push({ heading, text: line.trim() });
      } else {
        buffer.push(line);
      }
    }
    flush();
  }
  return blocks;
}

function hardSplit(block: Block, target: number, overlap: number): Block[] {
  if (block.text.length <= target) return [block];
  const output: Block[] = [];
  let start = 0;
  while (start < block.text.length) {
    const end = Math.min(start + target, block.text.length);
    output.push({ heading: block.heading, text: block.text.slice(start, end) });
    if (end >= block.text.length) break;
    start = end - overlap;
  }
  return output;
}

export function chunkPolicyText(
  markdown: string,
  opts: { targetChars?: number; overlapChars?: number } = {},
): PolicyChunkDraft[] {
  const target = opts.targetChars ?? CHUNK_TARGET_CHARS;
  const overlap = opts.overlapChars ?? CHUNK_OVERLAP_CHARS;
  const blocks = toBlocks(markdown).flatMap((block) => hardSplit(block, target, overlap));

  const chunks: PolicyChunkDraft[] = [];
  let bufferText = '';
  let bufferHeading: string | null = null;
  const flush = () => {
    const text = bufferText.trim();
    if (text) chunks.push({ ordinal: chunks.length, heading: bufferHeading, text });
    bufferText = '';
  };

  for (const block of blocks) {
    if (!bufferText) {
      bufferHeading = block.heading;
      bufferText = block.text;
      continue;
    }
    if (bufferText.length + 2 + block.text.length > target) {
      const tail = bufferText.slice(-overlap);
      flush();
      bufferHeading = block.heading;
      bufferText = `${tail}\n\n${block.text}`;
    } else {
      bufferText = `${bufferText}\n\n${block.text}`;
    }
  }
  flush();
  return chunks;
}
