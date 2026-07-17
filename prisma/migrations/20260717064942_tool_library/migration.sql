-- CreateEnum
CREATE TYPE "ToolKind" AS ENUM ('PROMPT', 'BUILTIN');

-- CreateTable
CREATE TABLE "AiTool" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "ToolKind" NOT NULL DEFAULT 'PROMPT',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "inputs" JSONB NOT NULL DEFAULT '[]',
    "surfaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "href" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyToolSetting" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "CompanyToolSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolGrant" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,

    CONSTRAINT "ToolGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiTool_slug_key" ON "AiTool"("slug");

-- CreateIndex
CREATE INDEX "CompanyToolSetting_companyId_idx" ON "CompanyToolSetting"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyToolSetting_companyId_toolId_key" ON "CompanyToolSetting"("companyId", "toolId");

-- CreateIndex
CREATE INDEX "ToolGrant_companyId_idx" ON "ToolGrant"("companyId");

-- CreateIndex
CREATE INDEX "ToolGrant_userId_idx" ON "ToolGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolGrant_companyId_toolId_userId_key" ON "ToolGrant"("companyId", "toolId", "userId");

-- AddForeignKey
ALTER TABLE "CompanyToolSetting" ADD CONSTRAINT "CompanyToolSetting_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "AiTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyToolSetting" ADD CONSTRAINT "CompanyToolSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolGrant" ADD CONSTRAINT "ToolGrant_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "AiTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolGrant" ADD CONSTRAINT "ToolGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolGrant" ADD CONSTRAINT "ToolGrant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
