/**
 * character-builder.ts
 *
 * Converts a Muse CharacterBrief into a complete AvatarProfile ready for
 * DynamoDB storage. Also exports all TypeScript types for the avatar-gen system.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonalityProfile {
  core_traits:       string[];
  delivery_style:    string;
  hook_style:        string;
  content_strengths: string[];
  audience_rapport:  string;
  verbal_tics:       string[];
  avoid:             string[];
}

export interface ExpressionHint {
  content_type: string;
  skyreels_params: {
    expression: string;
    intensity:  number;
    pacing:     "FAST" | "MEASURED" | "SLOW";
    energy:     "HIGH" | "MEDIUM" | "LOW";
  };
}

export interface ContentAssignment {
  primary_types:    string[];
  secondary_types:  string[];
  excluded_types:   string[];
  niche_fit_score:  Record<string, number>;
}

export interface PresenterPerformanceScores {
  avg_ctr:              number;
  avg_retention:        number;
  avg_likes_ratio:      number;
  content_type_scores:  Record<string, number>;
  last_updated:         string;
  video_count:          number;
}

export interface EvolutionRecord {
  version:          number;
  evolved_at:       string;
  trigger:          "ORACLE_REVIEW" | "ZEUS_DIRECTIVE" | "MANUAL";
  changed_fields:   string[];
  reason:           string;
  performance_delta: number;
}

export interface AvatarProfile {
  // Identity
  channelId:        string;
  presenterId:      string;
  displayName:      string;
  gender:           "FEMALE" | "MALE" | "NEUTRAL";
  archetype:        string;

  // Portrait (immutable after generation)
  seed:             number;
  base_prompt:      string;
  s3_reference:     string;
  generated_at:     string;
  portrait_version: number;

  // Voice
  voice_id:          string;
  voice_style:       string;
  edge_tts_fallback: string;

  // Personality (evolves)
  personality:        PersonalityProfile;
  expression_hints:   ExpressionHint[];
  content_assignment: ContentAssignment;

  // Performance
  performance_scores: PresenterPerformanceScores;
  use_count:          number;
  last_used:          string;

  // Evolution
  version:            number;
  evolution_history:  EvolutionRecord[];

  // Approval
  approval_status:    "PENDING_APPROVAL" | "APPROVED" | "AUTO_APPROVED";
  approved_at?:       string;
  approved_by?:       "HUMAN" | "AUTO_TIMEOUT";

  // Portrait upload tracking (set by EC2 UserData bootstrap)
  portraitStatus?:    "rendered" | "uploaded";
}

export interface CharacterBrief {
  slotId:       string;
  gender:       "FEMALE" | "MALE" | "NEUTRAL";
  ageRange:     string;
  archetype:    string;
  visualDirection: {
    style:           string;
    colourPalette:   string;
    hairDirection:   string;
    makeupIntensity: "MINIMAL" | "NATURAL" | "POLISHED" | "BOLD";
    backgroundNote:  string;
  };
  personality: {
    coreTraits:      string[];
    deliveryStyle:   string;
    hookStyle:       string;
    audienceRapport: string;
    verbalTics:      string[];
    avoid:           string[];
  };
  contentFit:         string[];
  voiceDirection:     string;
  strategicRationale: string;
}

// ─── Archetype FLUX prompt templates ─────────────────────────────────────────

const ARCHETYPE_PROMPTS: Record<string, string> = {
  presenter_f1:
    "Professional female presenter, tailored power blazer in deep navy " +
    "or charcoal, clean structured collar, bold confident direct gaze into camera, " +
    "sharp strong features, elegant grooming, immaculate skin, hair styled away from " +
    "face or sleek blowout, modern dark studio background with subtle rim lighting, " +
    "cinematic portrait photography, photorealistic, 8k quality, Hasselblad medium " +
    "format aesthetic, no jewelry distraction, authority and composure, age 28-38",

  presenter_f2:
    "Intelligent female presenter, contemporary smart-casual styling, " +
    "structured knit or refined blouse, warm expressive eyes conveying curiosity and " +
    "depth, relaxed yet composed posture, natural soft makeup, glossy healthy hair, " +
    "modern neutral background soft bokeh, cinematic portrait photography, " +
    "photorealistic, 8k quality, editorial magazine lighting, approachable and " +
    "credible, relatable warmth without losing authority, age 25-35",

  presenter_f3:
    "Charismatic female lifestyle presenter, bold statement outfit in " +
    "rich jewel tone or confident colour, expressive animated face, radiant flawless " +
    "skin, statement hair styling, dynamic energy in posture, editorial beauty " +
    "lighting, warm skin tones, vibrant photorealistic portrait, 8k quality, " +
    "high-fashion editorial aesthetic, magnetic presence, engaging eyes, age 24-33",

  presenter_m1:
    "Authoritative male documentary presenter, premium dark charcoal " +
    "suit, crisp white or light blue shirt, no tie or understated tie, strong jaw, " +
    "calm analytical expression, direct intelligent gaze, distinguished professional " +
    "appearance, dark studio background with subtle depth lighting, cinematic portrait " +
    "photography, photorealistic, 8k quality, BBC documentary presenter aesthetic, " +
    "trustworthy measured gravitas, age 32-45",
};

const FEMALE_EXPANSION_TEMPLATE =
  "Professional female presenter, {style_descriptor}, " +
  "confident direct gaze, photorealistic portrait, cinematic studio lighting, " +
  "well-groomed, polished appearance, dark professional background, 8k quality, " +
  "{age_range}";

const MALE_EXPANSION_TEMPLATE =
  "Professional male presenter, {style_descriptor}, " +
  "confident composed expression, photorealistic portrait, cinematic studio " +
  "lighting, authoritative but approachable, dark professional background, " +
  "8k quality, {age_range}";

// ─── Default expression hints by archetype ────────────────────────────────────

const ARCHETYPE_EXPRESSION_HINTS: Record<string, ExpressionHint[]> = {
  editorial_power: [
    {
      content_type: "BREAKING_NEWS",
      skyreels_params: { expression: "concentrated_focus", intensity: 0.8, pacing: "MEASURED", energy: "HIGH" },
    },
    {
      content_type: "EXPLAINER",
      skyreels_params: { expression: "engaged_clarity", intensity: 0.6, pacing: "MEASURED", energy: "MEDIUM" },
    },
    {
      content_type: "TECH_ANALYSIS",
      skyreels_params: { expression: "analytical_precision", intensity: 0.7, pacing: "MEASURED", energy: "MEDIUM" },
    },
  ],
  smart_casual: [
    {
      content_type: "EXPLAINER",
      skyreels_params: { expression: "warm_curiosity", intensity: 0.6, pacing: "MEASURED", energy: "MEDIUM" },
    },
    {
      content_type: "SCIENCE",
      skyreels_params: { expression: "genuine_discovery", intensity: 0.7, pacing: "SLOW", energy: "MEDIUM" },
    },
    {
      content_type: "EDUCATION",
      skyreels_params: { expression: "patient_clarity", intensity: 0.5, pacing: "SLOW", energy: "LOW" },
    },
  ],
  bold_lifestyle: [
    {
      content_type: "LIFESTYLE",
      skyreels_params: { expression: "expressive_energy", intensity: 0.9, pacing: "FAST", energy: "HIGH" },
    },
    {
      content_type: "ENTERTAINMENT",
      skyreels_params: { expression: "charismatic_delivery", intensity: 0.8, pacing: "FAST", energy: "HIGH" },
    },
    {
      content_type: "GAMING_CULTURE",
      skyreels_params: { expression: "enthusiastic_engagement", intensity: 0.85, pacing: "FAST", energy: "HIGH" },
    },
  ],
  documentary_authority: [
    {
      content_type: "FINANCE",
      skyreels_params: { expression: "measured_authority", intensity: 0.7, pacing: "SLOW", energy: "MEDIUM" },
    },
    {
      content_type: "GEOPOLITICS",
      skyreels_params: { expression: "grave_gravitas", intensity: 0.8, pacing: "SLOW", energy: "LOW" },
    },
    {
      content_type: "INVESTIGATIVE",
      skyreels_params: { expression: "analytical_precision", intensity: 0.75, pacing: "MEASURED", energy: "MEDIUM" },
    },
  ],
};

// ─── Default voice config by archetype ───────────────────────────────────────

const ARCHETYPE_VOICE: Record<string, { voice_id: string; voice_style: string; edge_tts_fallback: string }> = {
  editorial_power:       { voice_id: "21m00Tcm4TlvDq8ikWAM", voice_style: "authoritative",  edge_tts_fallback: "en-US-AriaNeural" },
  smart_casual:          { voice_id: "AZnzlk1XvdvUeBnXmlld", voice_style: "warm",            edge_tts_fallback: "en-US-JennyNeural" },
  bold_lifestyle:        { voice_id: "MF3mGyEYCl7XYWbV9V6O", voice_style: "energetic",       edge_tts_fallback: "en-US-SaraNeural" },
  documentary_authority: { voice_id: "VR6AewLTigWG4xSOukaG", voice_style: "measured",        edge_tts_fallback: "en-US-GuyNeural" },
};

// ─── Default display names by slotId ─────────────────────────────────────────

const SLOT_DISPLAY_NAMES: Record<string, string> = {
  presenter_f1: "Zara",
  presenter_f2: "Maya",
  presenter_f3: "Nia",
  presenter_m1: "Marcus",
};

// ─── Default content assignments by archetype ─────────────────────────────────

const ARCHETYPE_CONTENT: Record<string, Omit<ContentAssignment, "niche_fit_score">> = {
  editorial_power: {
    primary_types:   ["BREAKING_NEWS", "TECH_ANALYSIS", "FINANCE", "AI"],
    secondary_types: ["EXPLAINER", "GEOPOLITICS", "SCIENCE"],
    excluded_types:  ["BEAUTY", "GAMING_CULTURE", "LIFESTYLE"],
  },
  smart_casual: {
    primary_types:   ["EXPLAINER", "SCIENCE", "HEALTH", "EDUCATION", "DEEP_DIVE_SERIES"],
    secondary_types: ["TECH_ANALYSIS", "ENVIRONMENT", "CULTURE"],
    excluded_types:  ["BREAKING_NEWS", "GAMING_CULTURE"],
  },
  bold_lifestyle: {
    primary_types:   ["LIFESTYLE", "ENTERTAINMENT", "GAMING_CULTURE", "BEAUTY", "SOCIAL_TRENDS"],
    secondary_types: ["EDUCATION", "CULTURE"],
    excluded_types:  ["FINANCE", "GEOPOLITICS", "INVESTIGATIVE"],
  },
  documentary_authority: {
    primary_types:   ["FINANCE", "GEOPOLITICS", "INVESTIGATIVE", "TECH_ANALYSIS", "BUSINESS"],
    secondary_types: ["SCIENCE", "ENVIRONMENT"],
    excluded_types:  ["BEAUTY", "LIFESTYLE", "GAMING_CULTURE"],
  },
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildFluxPrompt(brief: CharacterBrief): string {
  // Use archetype preset if slotId matches a known slot
  if (ARCHETYPE_PROMPTS[brief.slotId]) {
    return ARCHETYPE_PROMPTS[brief.slotId];
  }

  // Build from template using brief's visual direction
  const template = brief.gender === "MALE" ? MALE_EXPANSION_TEMPLATE : FEMALE_EXPANSION_TEMPLATE;
  const styleDescriptor = [
    brief.visualDirection.style,
    brief.visualDirection.colourPalette,
    brief.visualDirection.hairDirection,
    `${brief.visualDirection.makeupIntensity.toLowerCase()} makeup`,
    brief.visualDirection.backgroundNote,
  ]
    .filter(Boolean)
    .join(", ");

  return template
    .replace("{style_descriptor}", styleDescriptor)
    .replace("{age_range}", `age ${brief.ageRange}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a complete AvatarProfile from a Muse CharacterBrief and content
 * assignment. This record is written to DynamoDB avatar-profiles.
 */
export function buildAvatarProfile(
  channelId: string,
  brief: CharacterBrief,
  contentAssignment: ContentAssignment,
): AvatarProfile {
  const presenterId = brief.slotId;
  const seed = Math.floor(Math.random() * 2 ** 32);
  const base_prompt = buildFluxPrompt(brief);
  const archetype = brief.archetype;
  const voice = ARCHETYPE_VOICE[archetype] ?? ARCHETYPE_VOICE["editorial_power"];
  const expressionHints = ARCHETYPE_EXPRESSION_HINTS[archetype] ?? ARCHETYPE_EXPRESSION_HINTS["editorial_power"];
  const now = new Date().toISOString();

  const zeroScores: PresenterPerformanceScores = {
    avg_ctr:             0,
    avg_retention:       0,
    avg_likes_ratio:     0,
    content_type_scores: {},
    last_updated:        now,
    video_count:         0,
  };

  return {
    channelId,
    presenterId,
    displayName:      SLOT_DISPLAY_NAMES[presenterId] ?? presenterId,
    gender:           brief.gender,
    archetype,

    seed,
    base_prompt,
    s3_reference:     `avatars/dynamic/${channelId}/${presenterId}/reference.jpg`,
    generated_at:     now,
    portrait_version: 1,

    voice_id:          voice.voice_id,
    voice_style:       voice.voice_style,
    edge_tts_fallback: voice.edge_tts_fallback,

    personality: {
      core_traits:       brief.personality.coreTraits,
      delivery_style:    brief.personality.deliveryStyle,
      hook_style:        brief.personality.hookStyle,
      content_strengths: contentAssignment.primary_types,
      audience_rapport:  brief.personality.audienceRapport,
      verbal_tics:       brief.personality.verbalTics,
      avoid:             brief.personality.avoid,
    },
    expression_hints:   expressionHints,
    content_assignment: contentAssignment,

    performance_scores: zeroScores,
    use_count:          0,
    last_used:          now,

    version:           1,
    evolution_history: [],

    approval_status: "PENDING_APPROVAL",
  };
}

/**
 * Builds a ContentAssignment for a presenter based on their archetype and
 * the channel's niche context.
 */
export function buildContentAssignment(
  brief: CharacterBrief,
  channelNiches: string[],
): ContentAssignment {
  const archetypeDefaults = ARCHETYPE_CONTENT[brief.archetype] ?? ARCHETYPE_CONTENT["editorial_power"];

  // Seed niche_fit_score based on archetype + contentFit from brief
  const niche_fit_score: Record<string, number> = {};
  for (const niche of channelNiches) {
    const isPrimary  = brief.contentFit.some(c => c.toLowerCase().includes(niche.toLowerCase()));
    const isSecondary = archetypeDefaults.secondary_types.some(t => t.toLowerCase().includes(niche.toLowerCase()));
    niche_fit_score[niche] = isPrimary ? 85 : isSecondary ? 55 : 30;
  }

  return {
    ...archetypeDefaults,
    primary_types:   brief.contentFit.length > 0 ? brief.contentFit : archetypeDefaults.primary_types,
    niche_fit_score,
  };
}
