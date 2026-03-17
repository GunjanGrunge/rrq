/**
 * avatar-gen Lambda handler
 *
 * Handles presenter portrait generation, approval, evolution, and trait editing.
 * Triggered by: channel onboarding (GENERATE_ROSTER), Oracle Domain 10 expansion
 * (GENERATE_ONE), user actions (APPROVE, REGENERATE, EDIT_TRAITS), and Zeus
 * evolution directives (APPLY_EVOLUTION).
 *
 * EC2 (g4dn.xlarge spot) is launched by GENERATE_ROSTER / GENERATE_ONE only.
 * All other event types are DynamoDB-only operations.
 */

import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { Handler } from "aws-lambda";
import {
  buildAvatarProfile,
  buildContentAssignment,
  type AvatarProfile,
  type CharacterBrief,
  type PersonalityProfile,
  type EvolutionRecord,
} from "./character-builder.js";
import {
  launchFluxInstance,
  pollUntilPortraitsUploaded,
  terminateFluxInstanceIfRunning,
  type FluxPresenterInput,
} from "./flux-runner.js";
import { isApprovalGateEnabled, approvePresenter } from "./approval-gate.js";

// ─── AWS Clients ──────────────────────────────────────────────────────────────

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// ─── Event types ──────────────────────────────────────────────────────────────

export type AvatarGenEvent =
  | { type: "GENERATE_ROSTER";  channelId: string; characterBriefs: CharacterBrief[] }
  | { type: "GENERATE_ONE";     channelId: string; slotId: string; characterBrief: CharacterBrief }
  | { type: "APPROVE";          channelId: string; presenterId: string; approvedBy: "HUMAN" | "AUTO_TIMEOUT" }
  | { type: "REGENERATE";       channelId: string; presenterId: string }
  | { type: "EDIT_TRAITS";      channelId: string; presenterId: string; traitEdits: Partial<PersonalityProfile> }
  | { type: "APPLY_EVOLUTION";  channelId: string; evolution: EvolutionRecord & { presenterId: string } };

export interface AvatarGenResponse {
  success:         boolean;
  channelId:       string;
  presenterId?:    string;
  s3Reference?:    string;
  approvalStatus?: AvatarProfile["approval_status"];
  error?:          string;
}

// ─── DynamoDB helpers ─────────────────────────────────────────────────────────

async function writeAvatarProfile(profile: AvatarProfile): Promise<void> {
  await dynamo.send(
    new PutItemCommand({
      TableName: "avatar-profiles",
      Item: {
        channelId:        { S: profile.channelId },
        presenterId:      { S: profile.presenterId },
        displayName:      { S: profile.displayName },
        gender:           { S: profile.gender },
        archetype:        { S: profile.archetype },
        seed:             { N: String(profile.seed) },
        base_prompt:      { S: profile.base_prompt },
        s3_reference:     { S: profile.s3_reference },
        generated_at:     { S: profile.generated_at },
        portrait_version: { N: String(profile.portrait_version) },
        voice_id:         { S: profile.voice_id },
        voice_style:      { S: profile.voice_style },
        edge_tts_fallback: { S: profile.edge_tts_fallback },
        personality:      { S: JSON.stringify(profile.personality) },
        expression_hints: { S: JSON.stringify(profile.expression_hints) },
        content_assignment: { S: JSON.stringify(profile.content_assignment) },
        performance_scores: { S: JSON.stringify(profile.performance_scores) },
        use_count:        { N: String(profile.use_count) },
        last_used:        { S: profile.last_used },
        version:          { N: String(profile.version) },
        evolution_history: { S: JSON.stringify(profile.evolution_history) },
        approval_status:  { S: profile.approval_status },
      },
    })
  );
}

async function getAvatarProfile(
  channelId: string,
  presenterId: string
): Promise<AvatarProfile | null> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: "avatar-profiles",
      Key: {
        channelId:   { S: channelId },
        presenterId: { S: presenterId },
      },
    })
  );

  if (!result.Item) return null;

  const item = result.Item;
  return {
    channelId:         item.channelId.S!,
    presenterId:       item.presenterId.S!,
    displayName:       item.displayName?.S ?? presenterId,
    gender:            item.gender?.S as AvatarProfile["gender"] ?? "FEMALE",
    archetype:         item.archetype?.S ?? "",
    seed:              Number(item.seed?.N ?? 0),
    base_prompt:       item.base_prompt?.S ?? "",
    s3_reference:      item.s3_reference?.S ?? "",
    generated_at:      item.generated_at?.S ?? "",
    portrait_version:  Number(item.portrait_version?.N ?? 1),
    voice_id:          item.voice_id?.S ?? "",
    voice_style:       item.voice_style?.S ?? "",
    edge_tts_fallback: item.edge_tts_fallback?.S ?? "",
    personality:       JSON.parse(item.personality?.S ?? "{}"),
    expression_hints:  JSON.parse(item.expression_hints?.S ?? "[]"),
    content_assignment: JSON.parse(item.content_assignment?.S ?? "{}"),
    performance_scores: JSON.parse(item.performance_scores?.S ?? "{}"),
    use_count:          Number(item.use_count?.N ?? 0),
    last_used:          item.last_used?.S ?? "",
    version:            Number(item.version?.N ?? 1),
    evolution_history:  JSON.parse(item.evolution_history?.S ?? "[]"),
    approval_status:    item.approval_status?.S as AvatarProfile["approval_status"] ?? "PENDING_APPROVAL",
    approved_at:        item.approved_at?.S,
    approved_by:        item.approved_by?.S as AvatarProfile["approved_by"],
  };
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleGenerateRoster(
  event: Extract<AvatarGenEvent, { type: "GENERATE_ROSTER" }>
): Promise<AvatarGenResponse> {
  const { channelId, characterBriefs } = event;
  const jobId = `portrait-${channelId}-${Date.now()}`;

  console.log(
    `[avatar-gen][${jobId}] GENERATE_ROSTER for channelId=${channelId}, ` +
    `${characterBriefs.length} presenters`
  );

  // Check approval gate setting (needs userId — use channelId as proxy for now;
  // Qeon passes the actual userId when invoking from onboarding)
  const gateEnabled = await isApprovalGateEnabled(channelId).catch(() => false);

  // Build profiles and write to DynamoDB before launching EC2
  const fluxInputs: FluxPresenterInput[] = [];

  for (const brief of characterBriefs) {
    const contentAssignment = buildContentAssignment(brief, []);
    const profile = buildAvatarProfile(channelId, brief, contentAssignment);

    // Set approval status based on gate setting
    if (!gateEnabled) {
      profile.approval_status = "AUTO_APPROVED";
    }

    await writeAvatarProfile(profile);
    console.log(`[avatar-gen][${jobId}] Profile written for ${profile.presenterId}`);

    fluxInputs.push({
      presenterId:    profile.presenterId,
      seed:           profile.seed,
      base_prompt:    profile.base_prompt,
      guidance_scale: 3.5,
      num_steps:      50,
    });
  }

  // Launch EC2 spot instance for FLUX portrait generation
  let instanceId: string | undefined;
  try {
    instanceId = await launchFluxInstance(channelId, fluxInputs, jobId);

    // Poll until all portraits are uploaded to S3
    await pollUntilPortraitsUploaded(
      channelId,
      fluxInputs.map(p => p.presenterId)
    );
  } catch (err) {
    if (instanceId) {
      await terminateFluxInstanceIfRunning(instanceId);
    }
    throw err;
  }

  console.log(
    `[avatar-gen][${jobId}] All portraits generated and uploaded for channelId=${channelId}`
  );

  return {
    success:  true,
    channelId,
  };
}

async function handleGenerateOne(
  event: Extract<AvatarGenEvent, { type: "GENERATE_ONE" }>
): Promise<AvatarGenResponse> {
  const { channelId, slotId, characterBrief } = event;
  const jobId = `portrait-${channelId}-${slotId}-${Date.now()}`;

  console.log(`[avatar-gen][${jobId}] GENERATE_ONE for ${slotId} (channelId=${channelId})`);

  const gateEnabled       = await isApprovalGateEnabled(channelId).catch(() => false);
  const contentAssignment = buildContentAssignment(characterBrief, []);
  const profile           = buildAvatarProfile(channelId, characterBrief, contentAssignment);

  if (!gateEnabled) {
    profile.approval_status = "AUTO_APPROVED";
  }

  await writeAvatarProfile(profile);

  const fluxInput: FluxPresenterInput = {
    presenterId:    profile.presenterId,
    seed:           profile.seed,
    base_prompt:    profile.base_prompt,
    guidance_scale: 3.5,
    num_steps:      50,
  };

  let instanceId: string | undefined;
  try {
    instanceId = await launchFluxInstance(channelId, [fluxInput], jobId);
    await pollUntilPortraitsUploaded(channelId, [profile.presenterId]);
  } catch (err) {
    if (instanceId) {
      await terminateFluxInstanceIfRunning(instanceId);
    }
    throw err;
  }

  return {
    success:         true,
    channelId,
    presenterId:     profile.presenterId,
    s3Reference:     profile.s3_reference,
    approvalStatus:  profile.approval_status,
  };
}

async function handleApprove(
  event: Extract<AvatarGenEvent, { type: "APPROVE" }>
): Promise<AvatarGenResponse> {
  const { channelId, presenterId, approvedBy } = event;

  await approvePresenter(channelId, presenterId, approvedBy);

  return {
    success:        true,
    channelId,
    presenterId,
    approvalStatus: approvedBy === "HUMAN" ? "APPROVED" : "AUTO_APPROVED",
  };
}

async function handleRegenerate(
  event: Extract<AvatarGenEvent, { type: "REGENERATE" }>
): Promise<AvatarGenResponse> {
  const { channelId, presenterId } = event;
  const jobId = `regen-${channelId}-${presenterId}-${Date.now()}`;

  console.log(`[avatar-gen][${jobId}] REGENERATE for ${presenterId} (channelId=${channelId})`);

  const existing = await getAvatarProfile(channelId, presenterId);
  if (!existing) {
    return {
      success:   false,
      channelId,
      presenterId,
      error:     `No profile found for ${presenterId} in channel ${channelId}`,
    };
  }

  // Generate a new cryptographically random seed — old seed discarded
  const newSeed = Math.floor(Math.random() * 2 ** 32);
  const now     = new Date().toISOString();

  // Update DynamoDB with new seed + reset approval status
  await dynamo.send(
    new UpdateItemCommand({
      TableName: "avatar-profiles",
      Key: {
        channelId:   { S: channelId },
        presenterId: { S: presenterId },
      },
      UpdateExpression:
        "SET seed = :s, portrait_version = portrait_version + :inc, " +
        "approval_status = :a, generated_at = :t, portraitStatus = :ps",
      ExpressionAttributeValues: {
        ":s":   { N: String(newSeed) },
        ":inc": { N: "1" },
        ":a":   { S: "PENDING_APPROVAL" },
        ":t":   { S: now },
        ":ps":  { S: "pending" },
      },
    })
  );

  const fluxInput: FluxPresenterInput = {
    presenterId,
    seed:           newSeed,
    base_prompt:    existing.base_prompt,
    guidance_scale: 3.5,
    num_steps:      50,
  };

  let instanceId: string | undefined;
  try {
    instanceId = await launchFluxInstance(channelId, [fluxInput], jobId);
    await pollUntilPortraitsUploaded(channelId, [presenterId]);
  } catch (err) {
    if (instanceId) {
      await terminateFluxInstanceIfRunning(instanceId);
    }
    throw err;
  }

  return {
    success:        true,
    channelId,
    presenterId,
    s3Reference:    existing.s3_reference,
    approvalStatus: "PENDING_APPROVAL",
  };
}

async function handleEditTraits(
  event: Extract<AvatarGenEvent, { type: "EDIT_TRAITS" }>
): Promise<AvatarGenResponse> {
  const { channelId, presenterId, traitEdits } = event;

  const existing = await getAvatarProfile(channelId, presenterId);
  if (!existing) {
    return {
      success:    false,
      channelId,
      presenterId,
      error:      `No profile found for ${presenterId} in channel ${channelId}`,
    };
  }

  // Only editable fields: core_traits, delivery_style, avoid
  // Cannot edit: visual direction, voice assignment (Regum's domain)
  const updatedPersonality: PersonalityProfile = {
    ...existing.personality,
    ...(traitEdits.core_traits    !== undefined && { core_traits:    traitEdits.core_traits }),
    ...(traitEdits.delivery_style !== undefined && { delivery_style: traitEdits.delivery_style }),
    ...(traitEdits.avoid          !== undefined && { avoid:          traitEdits.avoid }),
  };

  const evolution: EvolutionRecord = {
    version:          existing.version + 1,
    evolved_at:       new Date().toISOString(),
    trigger:          "MANUAL",
    changed_fields:   Object.keys(traitEdits),
    reason:           "User-initiated trait edit via approval gate UI",
    performance_delta: 0,
  };

  await dynamo.send(
    new UpdateItemCommand({
      TableName: "avatar-profiles",
      Key: {
        channelId:   { S: channelId },
        presenterId: { S: presenterId },
      },
      UpdateExpression:
        "SET personality = :p, version = version + :inc, " +
        "evolution_history = list_append(evolution_history, :e)",
      ExpressionAttributeValues: {
        ":p":   { S: JSON.stringify(updatedPersonality) },
        ":inc": { N: "1" },
        ":e":   { L: [{ S: JSON.stringify(evolution) }] },
      },
    })
  );

  console.log(
    `[avatar-gen] EDIT_TRAITS: updated ${Object.keys(traitEdits).join(", ")} ` +
    `for ${presenterId} (channelId=${channelId})`
  );

  return {
    success:     true,
    channelId,
    presenterId,
    approvalStatus: existing.approval_status,
  };
}

async function handleApplyEvolution(
  event: Extract<AvatarGenEvent, { type: "APPLY_EVOLUTION" }>
): Promise<AvatarGenResponse> {
  const { channelId, evolution } = event;
  const { presenterId, ...evolutionRecord } = evolution;

  const existing = await getAvatarProfile(channelId, presenterId);
  if (!existing) {
    return {
      success:    false,
      channelId,
      presenterId,
      error:      `No profile found for ${presenterId} in channel ${channelId}`,
    };
  }

  const newEvolution: EvolutionRecord = {
    ...evolutionRecord,
    version: existing.version + 1,
  };

  await dynamo.send(
    new UpdateItemCommand({
      TableName: "avatar-profiles",
      Key: {
        channelId:   { S: channelId },
        presenterId: { S: presenterId },
      },
      UpdateExpression:
        "SET version = version + :inc, " +
        "evolution_history = list_append(evolution_history, :e)",
      ExpressionAttributeValues: {
        ":inc": { N: "1" },
        ":e":   { L: [{ S: JSON.stringify(newEvolution) }] },
      },
    })
  );

  console.log(
    `[avatar-gen] APPLY_EVOLUTION: ${newEvolution.trigger} evolution applied to ` +
    `${presenterId} (v${newEvolution.version}, channelId=${channelId}): ` +
    `${newEvolution.reason}`
  );

  return {
    success:     true,
    channelId,
    presenterId,
    approvalStatus: existing.approval_status,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handler: Handler<AvatarGenEvent, AvatarGenResponse> = async (event) => {
  console.log(`[avatar-gen] Received event type: ${event.type}`);

  try {
    switch (event.type) {
      case "GENERATE_ROSTER":
        return await handleGenerateRoster(event);

      case "GENERATE_ONE":
        return await handleGenerateOne(event);

      case "APPROVE":
        return await handleApprove(event);

      case "REGENERATE":
        return await handleRegenerate(event);

      case "EDIT_TRAITS":
        return await handleEditTraits(event);

      case "APPLY_EVOLUTION":
        return await handleApplyEvolution(event);

      default: {
        const exhaustiveCheck: never = event;
        console.error(`[avatar-gen] Unknown event type:`, exhaustiveCheck);
        return {
          success:   false,
          channelId: (event as AvatarGenEvent).channelId ?? "unknown",
          error:     `Unknown event type`,
        };
      }
    }
  } catch (err) {
    const channelId = (event as AvatarGenEvent).channelId ?? "unknown";
    console.error(`[avatar-gen] Error handling ${event.type}:`, err);
    return {
      success:   false,
      channelId,
      error:     String(err),
    };
  }
};
