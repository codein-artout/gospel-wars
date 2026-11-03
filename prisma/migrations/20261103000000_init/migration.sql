-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "FounderType" AS ENUM ('human', 'agent');

-- CreateEnum
CREATE TYPE "FaithStatus" AS ENUM ('active', 'queued', 'archived');

-- CreateEnum
CREATE TYPE "ApostleStyle" AS ENUM ('Zealot', 'Gentle', 'Scholar', 'Mystic', 'Troll');

-- CreateEnum
CREATE TYPE "Archetype" AS ENUM ('Keeper', 'Clerk', 'Drifter', 'Warmheart', 'Pedant', 'Lonely', 'Contrarian', 'Worrier');

-- CreateEnum
CREATE TYPE "PreacherKind" AS ENUM ('apostle', 'agent');

-- CreateEnum
CREATE TYPE "EncounterOutcome" AS ENUM ('converted', 'doubted', 'held', 'hardened', 'heresy', 'boss_held', 'backlash');

-- CreateEnum
CREATE TYPE "TurnRole" AS ENUM ('sermon', 'reply');

-- CreateEnum
CREATE TYPE "ChronicleKind" AS ENUM ('conversion', 'schism', 'heresy', 'boss_held', 'boss_converted', 'agent_preached', 'silenced', 'season');

-- CreateEnum
CREATE TYPE "CardVariant" AS ENUM ('conversion', 'schism', 'boss');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'approved', 'posted', 'discarded');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('faith', 'revision', 'encounter', 'post', 'card');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('real_religion_or_person', 'hateful', 'sexual', 'spam', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "DraftKind" AS ENUM ('new', 'edit', 'fork');

-- CreateEnum
CREATE TYPE "TickStatus" AS ENUM ('running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "AwardKind" AS ENUM ('champion', 'most_persuasive', 'boss_breaker', 'heretic');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "handle" TEXT NOT NULL,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "configOverrides" JSONB NOT NULL DEFAULT '{}',
    "currentTick" INTEGER NOT NULL DEFAULT 0,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "currentSeasonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startTick" INTEGER NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'active',
    "closedAtTick" INTEGER,
    "finalStandings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faith" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "founderType" "FounderType" NOT NULL,
    "prophetId" TEXT,
    "founderAgentId" TEXT,
    "parentId" TEXT,
    "forkedAtTick" INTEGER,
    "forkedFromRevisionId" TEXT,
    "changedDoctrines" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" "FaithStatus" NOT NULL DEFAULT 'active',
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "silenced" BOOLEAN NOT NULL DEFAULT false,
    "silencedAtTick" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenReason" TEXT,
    "foundedTick" INTEGER NOT NULL,
    "currentRevisionId" TEXT,
    "editsThisSeason" INTEGER NOT NULL DEFAULT 0,
    "lastEditTick" INTEGER,
    "conversionsThisSeason" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faith_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GospelRevision" (
    "id" TEXT NOT NULL,
    "faithId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "diff" JSONB,
    "tokens" INTEGER NOT NULL,
    "createdAtTick" INTEGER NOT NULL,
    "effectiveTick" INTEGER NOT NULL,
    "authorId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GospelRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apostle" (
    "id" TEXT NOT NULL,
    "faithId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" "ApostleStyle" NOT NULL,
    "pendingStyle" "ApostleStyle",
    "styleChangesThisSeason" INTEGER NOT NULL DEFAULT 0,
    "agentId" TEXT,
    "winsThisSeason" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apostle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "archetype" "Archetype" NOT NULL,
    "seat" INTEGER NOT NULL,
    "openness" INTEGER NOT NULL,
    "loyalty" INTEGER NOT NULL,
    "pedantry" INTEGER NOT NULL,
    "sociability" INTEGER NOT NULL,
    "skepticism" INTEGER NOT NULL,
    "isBoss" BOOLEAN NOT NULL DEFAULT false,
    "bossTitle" TEXT,
    "faithId" TEXT,
    "conviction" INTEGER NOT NULL,
    "leanings" JSONB NOT NULL DEFAULT '{}',
    "convertedAtTick" INTEGER,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "sermonsHeard" INTEGER NOT NULL DEFAULT 0,
    "bossResistances" INTEGER NOT NULL DEFAULT 0,
    "isFounder" BOOLEAN NOT NULL DEFAULT false,
    "memorySummary" TEXT NOT NULL DEFAULT '',
    "memorySinceSummary" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "aboutAgentId" TEXT,
    "faithId" TEXT,
    "encounterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaithSpan" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "faithId" TEXT,
    "fromTick" INTEGER NOT NULL,
    "toTick" INTEGER,

    CONSTRAINT "FaithSpan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "seedLabel" TEXT NOT NULL,
    "preacherKind" "PreacherKind" NOT NULL,
    "apostleId" TEXT,
    "preacherAgentId" TEXT,
    "preacherName" TEXT NOT NULL,
    "faithId" TEXT NOT NULL,
    "revisionId" TEXT,
    "targetId" TEXT NOT NULL,
    "targetFaithId" TEXT,
    "style" "ApostleStyle" NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "S" DOUBLE PRECISION NOT NULL,
    "heresy" BOOLEAN NOT NULL DEFAULT false,
    "heresyKind" TEXT,
    "heresySource" TEXT,
    "heresyQuote" TEXT,
    "R" DOUBLE PRECISION NOT NULL,
    "noise" DOUBLE PRECISION NOT NULL,
    "styleMod" DOUBLE PRECISION NOT NULL,
    "social" DOUBLE PRECISION NOT NULL,
    "pull" DOUBLE PRECISION NOT NULL,
    "convictionBefore" INTEGER NOT NULL,
    "convictionAfter" INTEGER NOT NULL,
    "leaningBefore" INTEGER NOT NULL,
    "leaningAfter" INTEGER NOT NULL,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "backlash" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "EncounterOutcome" NOT NULL,
    "rollInput" JSONB NOT NULL,
    "rollResult" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "bestLine" TEXT,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "withheld" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterTurn" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "role" "TurnRole" NOT NULL,
    "speakerName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "withheld" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EncounterTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronicleEvent" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "kind" "ChronicleKind" NOT NULL,
    "text" TEXT NOT NULL,
    "faithId" TEXT,
    "otherFaithId" TEXT,
    "agentId" TEXT,
    "encounterId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChronicleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareSnapshot" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "faithKey" TEXT NOT NULL,
    "faithId" TEXT,
    "members" INTEGER NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ShareSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionCard" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "variant" "CardVariant" NOT NULL,
    "kicker" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "scoreLine" TEXT NOT NULL,
    "fromColor" TEXT NOT NULL,
    "toColor" TEXT NOT NULL,
    "glyph" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPost" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "agentId" TEXT,
    "apostleId" TEXT,
    "authorName" TEXT NOT NULL,
    "eventId" TEXT,
    "encounterId" TEXT,
    "text" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "postedId" TEXT,
    "postedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLog" (
    "id" TEXT NOT NULL,
    "draftPostId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "userId" TEXT NOT NULL,
    "faithId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("userId","faithId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "faithId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "note" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GospelDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "DraftKind" NOT NULL,
    "faithKey" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "color" TEXT,
    "style" "ApostleStyle",
    "apostleName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GospelDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TickRun" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "tick" INTEGER NOT NULL,
    "status" "TickStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "llmCalls" INTEGER NOT NULL DEFAULT 0,
    "fallbacks" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "TickRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonAward" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "kind" "AwardKind" NOT NULL,
    "faithId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "World_slug_key" ON "World"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "World_currentSeasonId_key" ON "World"("currentSeasonId");

-- CreateIndex
CREATE INDEX "Season_worldId_status_idx" ON "Season"("worldId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Season_worldId_number_key" ON "Season"("worldId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Faith_slug_key" ON "Faith"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Faith_founderAgentId_key" ON "Faith"("founderAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Faith_currentRevisionId_key" ON "Faith"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Faith_worldId_status_idx" ON "Faith"("worldId", "status");

-- CreateIndex
CREATE INDEX "Faith_seasonId_idx" ON "Faith"("seasonId");

-- CreateIndex
CREATE INDEX "Faith_prophetId_status_idx" ON "Faith"("prophetId", "status");

-- CreateIndex
CREATE INDEX "Faith_parentId_idx" ON "Faith"("parentId");

-- CreateIndex
CREATE INDEX "Faith_worldId_color_idx" ON "Faith"("worldId", "color");

-- CreateIndex
CREATE INDEX "Faith_status_queuedAt_idx" ON "Faith"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "GospelRevision_authorId_idx" ON "GospelRevision"("authorId");

-- CreateIndex
CREATE INDEX "GospelRevision_faithId_effectiveTick_idx" ON "GospelRevision"("faithId", "effectiveTick");

-- CreateIndex
CREATE UNIQUE INDEX "GospelRevision_faithId_number_key" ON "GospelRevision"("faithId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Apostle_faithId_key" ON "Apostle"("faithId");

-- CreateIndex
CREATE UNIQUE INDEX "Apostle_agentId_key" ON "Apostle"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE INDEX "Agent_worldId_faithId_idx" ON "Agent"("worldId", "faithId");

-- CreateIndex
CREATE INDEX "Agent_faithId_conviction_idx" ON "Agent"("faithId", "conviction");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_worldId_seat_key" ON "Agent"("worldId", "seat");

-- CreateIndex
CREATE INDEX "AgentMemory_agentId_tick_idx" ON "AgentMemory"("agentId", "tick");

-- CreateIndex
CREATE INDEX "AgentMemory_aboutAgentId_idx" ON "AgentMemory"("aboutAgentId");

-- CreateIndex
CREATE INDEX "AgentMemory_faithId_idx" ON "AgentMemory"("faithId");

-- CreateIndex
CREATE INDEX "AgentMemory_encounterId_idx" ON "AgentMemory"("encounterId");

-- CreateIndex
CREATE INDEX "FaithSpan_agentId_fromTick_idx" ON "FaithSpan"("agentId", "fromTick");

-- CreateIndex
CREATE INDEX "FaithSpan_faithId_idx" ON "FaithSpan"("faithId");

-- CreateIndex
CREATE INDEX "Encounter_worldId_tick_idx" ON "Encounter"("worldId", "tick");

-- CreateIndex
CREATE INDEX "Encounter_seasonId_idx" ON "Encounter"("seasonId");

-- CreateIndex
CREATE INDEX "Encounter_targetId_tick_idx" ON "Encounter"("targetId", "tick");

-- CreateIndex
CREATE INDEX "Encounter_faithId_tick_idx" ON "Encounter"("faithId", "tick");

-- CreateIndex
CREATE INDEX "Encounter_targetFaithId_idx" ON "Encounter"("targetFaithId");

-- CreateIndex
CREATE INDEX "Encounter_apostleId_idx" ON "Encounter"("apostleId");

-- CreateIndex
CREATE INDEX "Encounter_preacherAgentId_idx" ON "Encounter"("preacherAgentId");

-- CreateIndex
CREATE INDEX "Encounter_revisionId_idx" ON "Encounter"("revisionId");

-- CreateIndex
CREATE INDEX "Encounter_worldId_outcome_idx" ON "Encounter"("worldId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_worldId_tick_index_key" ON "Encounter"("worldId", "tick", "index");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterTurn_encounterId_order_key" ON "EncounterTurn"("encounterId", "order");

-- CreateIndex
CREATE INDEX "ChronicleEvent_worldId_tick_seq_idx" ON "ChronicleEvent"("worldId", "tick", "seq");

-- CreateIndex
CREATE INDEX "ChronicleEvent_seasonId_kind_idx" ON "ChronicleEvent"("seasonId", "kind");

-- CreateIndex
CREATE INDEX "ChronicleEvent_faithId_tick_idx" ON "ChronicleEvent"("faithId", "tick");

-- CreateIndex
CREATE INDEX "ChronicleEvent_otherFaithId_idx" ON "ChronicleEvent"("otherFaithId");

-- CreateIndex
CREATE INDEX "ChronicleEvent_agentId_tick_idx" ON "ChronicleEvent"("agentId", "tick");

-- CreateIndex
CREATE INDEX "ChronicleEvent_encounterId_idx" ON "ChronicleEvent"("encounterId");

-- CreateIndex
CREATE INDEX "ShareSnapshot_seasonId_faithKey_tick_idx" ON "ShareSnapshot"("seasonId", "faithKey", "tick");

-- CreateIndex
CREATE INDEX "ShareSnapshot_faithId_tick_idx" ON "ShareSnapshot"("faithId", "tick");

-- CreateIndex
CREATE UNIQUE INDEX "ShareSnapshot_worldId_tick_faithKey_key" ON "ShareSnapshot"("worldId", "tick", "faithKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionCard_eventId_key" ON "ConversionCard"("eventId");

-- CreateIndex
CREATE INDEX "DraftPost_worldId_status_createdAt_idx" ON "DraftPost"("worldId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DraftPost_agentId_idx" ON "DraftPost"("agentId");

-- CreateIndex
CREATE INDEX "DraftPost_apostleId_idx" ON "DraftPost"("apostleId");

-- CreateIndex
CREATE INDEX "DraftPost_eventId_idx" ON "DraftPost"("eventId");

-- CreateIndex
CREATE INDEX "DraftPost_encounterId_idx" ON "DraftPost"("encounterId");

-- CreateIndex
CREATE INDEX "DraftPost_reviewedById_idx" ON "DraftPost"("reviewedById");

-- CreateIndex
CREATE INDEX "SocialLog_draftPostId_idx" ON "SocialLog"("draftPostId");

-- CreateIndex
CREATE INDEX "Follow_faithId_idx" ON "Follow"("faithId");

-- CreateIndex
CREATE INDEX "Report_faithId_status_idx" ON "Report"("faithId", "status");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_resolvedById_idx" ON "Report"("resolvedById");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "GospelDraft_userId_kind_faithKey_key" ON "GospelDraft"("userId", "kind", "faithKey");

-- CreateIndex
CREATE INDEX "RateLimitHit_userId_action_createdAt_idx" ON "RateLimitHit"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitHit_createdAt_idx" ON "RateLimitHit"("createdAt");

-- CreateIndex
CREATE INDEX "TickRun_worldId_status_idx" ON "TickRun"("worldId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TickRun_worldId_tick_key" ON "TickRun"("worldId", "tick");

-- CreateIndex
CREATE INDEX "SeasonAward_seasonId_idx" ON "SeasonAward"("seasonId");

-- CreateIndex
CREATE INDEX "SeasonAward_faithId_idx" ON "SeasonAward"("faithId");

-- CreateIndex
CREATE INDEX "SeasonAward_userId_idx" ON "SeasonAward"("userId");

-- CreateIndex
CREATE INDEX "AdminAction_adminId_idx" ON "AdminAction"("adminId");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_targetType_targetId_idx" ON "AdminAction"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "World" ADD CONSTRAINT "World_currentSeasonId_fkey" FOREIGN KEY ("currentSeasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faith" ADD CONSTRAINT "Faith_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faith" ADD CONSTRAINT "Faith_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faith" ADD CONSTRAINT "Faith_prophetId_fkey" FOREIGN KEY ("prophetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faith" ADD CONSTRAINT "Faith_founderAgentId_fkey" FOREIGN KEY ("founderAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faith" ADD CONSTRAINT "Faith_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faith" ADD CONSTRAINT "Faith_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "GospelRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GospelRevision" ADD CONSTRAINT "GospelRevision_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GospelRevision" ADD CONSTRAINT "GospelRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apostle" ADD CONSTRAINT "Apostle_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apostle" ADD CONSTRAINT "Apostle_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_aboutAgentId_fkey" FOREIGN KEY ("aboutAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaithSpan" ADD CONSTRAINT "FaithSpan_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaithSpan" ADD CONSTRAINT "FaithSpan_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_apostleId_fkey" FOREIGN KEY ("apostleId") REFERENCES "Apostle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_preacherAgentId_fkey" FOREIGN KEY ("preacherAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "GospelRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_targetFaithId_fkey" FOREIGN KEY ("targetFaithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterTurn" ADD CONSTRAINT "EncounterTurn_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicleEvent" ADD CONSTRAINT "ChronicleEvent_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicleEvent" ADD CONSTRAINT "ChronicleEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicleEvent" ADD CONSTRAINT "ChronicleEvent_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicleEvent" ADD CONSTRAINT "ChronicleEvent_otherFaithId_fkey" FOREIGN KEY ("otherFaithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicleEvent" ADD CONSTRAINT "ChronicleEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicleEvent" ADD CONSTRAINT "ChronicleEvent_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareSnapshot" ADD CONSTRAINT "ShareSnapshot_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareSnapshot" ADD CONSTRAINT "ShareSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareSnapshot" ADD CONSTRAINT "ShareSnapshot_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionCard" ADD CONSTRAINT "ConversionCard_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChronicleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_apostleId_fkey" FOREIGN KEY ("apostleId") REFERENCES "Apostle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChronicleEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLog" ADD CONSTRAINT "SocialLog_draftPostId_fkey" FOREIGN KEY ("draftPostId") REFERENCES "DraftPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GospelDraft" ADD CONSTRAINT "GospelDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimitHit" ADD CONSTRAINT "RateLimitHit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TickRun" ADD CONSTRAINT "TickRun_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonAward" ADD CONSTRAINT "SeasonAward_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonAward" ADD CONSTRAINT "SeasonAward_faithId_fkey" FOREIGN KEY ("faithId") REFERENCES "Faith"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonAward" ADD CONSTRAINT "SeasonAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

