import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { PolicyChunkDraft } from '../domain/policy-chunker';
import type {
  PolicyDocumentStatus,
  PolicyDocumentSummary,
  PolicySourceType,
} from '../domain/policy.types';

export interface PolicyChunkTextRow {
  id: string;
  ordinal: number;
  heading: string | null;
  text: string;
}

export interface ReadyPolicyChunkRow {
  ordinal: number;
  heading: string | null;
  text: string;
  embedding: number[];
  documentTitle: string;
}

@Injectable()
export class PolicyRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

  async listDocuments(): Promise<PolicyDocumentSummary[]> {
    const rows = await this.prisma.policyDocument.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      sourceType: row.sourceType as PolicySourceType,
      status: row.status as PolicyDocumentStatus,
      uploadedAt: row.uploadedAt.toISOString(),
      chunkCount: row._count.chunks,
    }));
  }

  async getDocument(id: string): Promise<{ id: string; status: PolicyDocumentStatus } | null> {
    const row = await this.prisma.policyDocument.findFirst({ where: { id } });
    return row ? { id: row.id, status: row.status as PolicyDocumentStatus } : null;
  }

  async createDocument(input: {
    title: string;
    sourceType: PolicySourceType;
  }): Promise<{ id: string }> {
    const row = await this.prisma.policyDocument.create({
      // TenantPrismaService stamps companyId in its create extension at runtime.
      data: {
        title: input.title,
        sourceType: input.sourceType,
        status: 'Processing',
      } as never,
    });
    return { id: row.id };
  }

  async deleteAllDocuments(): Promise<void> {
    await this.prisma.policyDocument.deleteMany({});
  }

  async deleteDocument(id: string): Promise<void> {
    await this.prisma.policyDocument.delete({ where: { id } });
  }

  async setStatus(id: string, status: PolicyDocumentStatus): Promise<void> {
    await this.prisma.policyDocument.update({ where: { id }, data: { status } });
  }

  async replaceChunks(documentId: string, drafts: PolicyChunkDraft[]): Promise<void> {
    await this.prisma.policyChunk.deleteMany({ where: { documentId } });
    await this.prisma.policyChunk.createMany({
      // TenantPrismaService stamps companyId on each createMany row.
      data: drafts.map((draft) => ({
        documentId,
        ordinal: draft.ordinal,
        heading: draft.heading,
        text: draft.text,
        embedding: [],
      })) as never,
    });
  }

  async listChunkTexts(documentId: string): Promise<PolicyChunkTextRow[]> {
    return this.prisma.policyChunk.findMany({
      where: { documentId },
      orderBy: { ordinal: 'asc' },
      select: { id: true, ordinal: true, heading: true, text: true },
    });
  }

  async countChunks(documentId: string): Promise<number> {
    return this.prisma.policyChunk.count({ where: { documentId } });
  }

  async setChunkEmbedding(id: string, embedding: number[]): Promise<void> {
    await this.prisma.policyChunk.update({ where: { id }, data: { embedding } });
  }

  async listReadyChunks(): Promise<ReadyPolicyChunkRow[]> {
    const rows = await this.prisma.policyChunk.findMany({
      where: { document: { status: 'Ready' } },
      orderBy: { ordinal: 'asc' },
      select: {
        ordinal: true,
        heading: true,
        text: true,
        embedding: true,
        document: { select: { title: true } },
      },
    });
    return rows.map((row) => ({
      ordinal: row.ordinal,
      heading: row.heading,
      text: row.text,
      embedding: row.embedding,
      documentTitle: row.document.title,
    }));
  }
}
