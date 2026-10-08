// Native Pro (Stock Enhancer) — Trajectory Snapshotting & Forking Helpers

export const ACTIVE_STEP_STATUSES = new Set([1, 2, 8, 9, 11]);

export function snapshotThroughResponse(trajectory: any, sourceCascadeId: string, forkAtStepIndex: number): any {
  const allSteps = trajectory?.steps;
  const end = forkAtStepIndex === -1 ? allSteps?.length - 1 : forkAtStepIndex;
  if (!Array.isArray(allSteps) || !Number.isSafeInteger(end) || end < 0 || end >= allSteps.length) {
    throw new Error("Could not load history snapshot.");
  }
  if (trajectory.cascadeId && trajectory.cascadeId !== sourceCascadeId) {
    throw new Error("History belongs to a different conversation.");
  }

  const steps = allSteps.slice(0, end + 1).map((step: any) =>
    ACTIVE_STEP_STATUSES.has(step.status) ? { ...step, status: 6, interaction: undefined } : step
  );
  const generatorMetadata = [];
  for (const metadata of trajectory.generatorMetadata || []) {
    const stepIndices = (metadata.stepIndices || []).filter(
      (index: number) => Number.isSafeInteger(index) && index >= 0 && index <= end
    );
    if (stepIndices.length) generatorMetadata.push({ ...metadata, stepIndices });
  }
  const executorMetadatas = (trajectory.executorMetadatas || []).filter(
    (metadata: any) => Number.isSafeInteger(metadata.lastStepIdx) && metadata.lastStepIdx >= 0 && metadata.lastStepIdx <= end
  );

  return {
    ...trajectory,
    steps,
    generatorMetadata,
    executorMetadatas,
    parentReferences: [],
    battleModeInfos: []
  };
}

export async function forkFromSnapshot(agentService: any, request: any): Promise<any> {
  if (typeof agentService.getCascadeTrajectory !== "function" || typeof agentService.startCascade !== "function") {
    throw new Error("Snapshot service unavailable.");
  }
  const history = await agentService.getCascadeTrajectory({ cascadeId: request.sourceCascadeId, verbosity: 3 });
  const snapshot = snapshotThroughResponse(history?.trajectory, request.sourceCascadeId, request.forkAtStepIndex);
  const metadata = snapshot.metadata || {};
  const projectId = metadata.projectId;
  const workspaceUris = metadata.workspaceUris?.length
    ? metadata.workspaceUris
    : (metadata.workspaces || []).map((w: any) => w.workspaceFolderAbsoluteUri).filter(Boolean);
  const projectEnvConfig =
    projectId && projectId !== "outside-of-project"
      ? {
          projectId,
          target: metadata.environmentId
            ? { case: "environmentId", value: metadata.environmentId }
            : { case: "defaultProjectEnvironment", value: {} }
        }
      : undefined;
  const lastModelStep = snapshot.steps.findLast((step: any) => step.metadata?.generatorModel > 0);
  const snapshotId = crypto.randomUUID();
  let started;
  try {
    started = await agentService.startCascade({
      cascadeId: snapshotId,
      source: 1,
      trajectoryType: 4,
      baseTrajectoryIdentifier: {
        identifier: { case: "trajectory", value: snapshot }
      },
      workspaceUris,
      projectEnvConfig,
      agentScriptItem: metadata.agentScript,
      customAgentSpec: metadata.staticConfig,
      requestedModel: lastModelStep?.metadata.generatorModel
    });
    if (!started?.cascadeId || started.cascadeId !== snapshotId) {
      throw new Error("No conversation ID returned.");
    }
  } catch (error) {
    try {
      await agentService.updateConversationAnnotations?.(snapshotId, { archived: true }, true);
    } catch {}
    throw error;
  }

  return {
    newCascadeId: snapshotId,
    newProjectId: started.projectEnvInfo?.projectId || projectId || "outside-of-project",
    forkedAtStepIndex: snapshot.steps.length - 1
  };
}

export async function performFork(agentService: any, request: any): Promise<any> {
  try {
    return await agentService.forkConversation(request);
  } catch (error: any) {
    const message = error?.message || String(error);
    if (/must be fully idle|conversation.{0,100}(?:in progress|is busy)/i.test(message)) {
      return forkFromSnapshot(agentService, request);
    }
    throw error;
  }
}
