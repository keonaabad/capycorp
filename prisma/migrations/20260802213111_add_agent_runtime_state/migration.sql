-- CreateEnum
CREATE TYPE "AgentState" AS ENUM ('idle', 'assigned', 'walking_to_workstation', 'planning', 'working', 'using_tool', 'waiting', 'collaborating', 'needs_approval', 'completed', 'failed', 'paused');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "currentTask" TEXT,
ADD COLUMN     "resumeState" "AgentState",
ADD COLUMN     "state" "AgentState" NOT NULL DEFAULT 'idle';
