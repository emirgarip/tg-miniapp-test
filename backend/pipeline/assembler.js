// STEP E — Final Prompt Assembly + Summary Builders
// Joins named blocks in a fixed semantic order.
// Provides human-readable summaries for the structured analysis and
// the semantic interpretation sections shown in the UI.

const BLOCK_ORDER = [
  "subject",
  "age",
  "face",
  "hair",
  "eyes_expression",
  "body",
  "clothing",
  "pose",
  "environment",
  "lighting",
  "camera",
  "quality",
  "negative",
];

function assemble(blocks) {
  return BLOCK_ORDER.map((key) => blocks[key]).filter(Boolean).join("\n");
}

// ─── Structured Analysis summary ─────────────────────────────────────────────

function buildStructuredAnalysis(extraction, spec, plan) {
  const v = (tagged) => tagged?.value ?? "—";
  const flag = (b) => (b ? "yes" : "no");
  const sf = extraction.safety_flags || {};

  return [
    `Structured Analysis`,
    `- Input language      : ${extraction.input_language}`,
    `- Subject type        : ${extraction.subject_type}`,
    `- Gender              : ${v(spec.gender)}`,
    `- Age range           : ${v(spec.age_range)}`,
    `- Face                : ${v(spec.face)}`,
    `- Hair                : ${v(spec.hair.color)}, ${v(spec.hair.style)}`,
    `- Eyes / expression   : ${v(spec.eyes.color)} eyes, ${v(spec.expression)}`,
    `- Body                : ${v(spec.body.type)}, emphasis strength: ${v(spec.body.emphasis_strength)}`,
    `- Clothing            : ${v(spec.clothing)}`,
    `- Pose                : ${v(spec.pose)}`,
    `- Environment         : ${v(spec.environment.type)} — ${v(spec.environment.details)}`,
    `- Lighting            : ${v(spec.lighting)}`,
    `- Safety adjustments  : ${v(spec.safety_adjustments)}`,
    `- Safety flags        : minor=${flag(sf.minor_or_ambiguous_underage)}, explicit=${flag(sf.explicit_or_nudity_request)}, celebrity=${flag(sf.real_person_or_celebrity_request)}, illegal=${flag(sf.illegal_or_exploitative)}`,
    ``,
    `Visual Planning`,
    `- Subject emphasis    : ${plan.subject_emphasis}`,
    `- Framing strategy    : ${plan.framing_strategy}`,
    `- Framing reason      : ${plan.framing_reason}`,
    `- Emphasis targets    : ${(plan.emphasis_targets || []).join(", ") || "none"}`,
    `- Interp. regions     : ${(plan.interpretation_regions || []).join(", ") || "none"}`,
    `- Pose source         : ${plan.pose_reason || "default"}`,
    `- Pose suggestion     : ${plan.pose_suggestion || "default pose"}`,
    `- Composition goal    : ${plan.composition_goal}`,
  ].join("\n");
}

// ─── Semantic Interpretation summary ─────────────────────────────────────────

function buildInterpretationSummary(interpretation) {
  if (!interpretation) return "Not available";

  const confEmoji = { high: "[HIGH]", medium: "[MED]", low: "[LOW]" };
  const lines = ["Semantic Interpretation"];

  // Focus regions
  const regions = interpretation.focus_regions || [];
  if (regions.length > 0) {
    lines.push("Focus regions:");
    for (const r of regions) {
      lines.push(`  ${confEmoji[r.confidence] || "[?]"} ${r.region}`);
    }
  } else {
    lines.push("Focus regions: none detected");
  }

  // Pose intent
  const pi = interpretation.pose_intent;
  if (pi) {
    lines.push(`Pose intent: ${confEmoji[pi.confidence] || "[?]"} ${pi.value}`);
  }

  // Aesthetic tone
  const tones = interpretation.aesthetic_tone || [];
  if (tones.length > 0) {
    lines.push("Aesthetic tone:");
    for (const t of tones) {
      lines.push(`  ${confEmoji[t.confidence] || "[?]"} ${t.tone}`);
    }
  } else {
    lines.push("Aesthetic tone: none detected");
  }

  // Composition need
  const cn = interpretation.composition_need;
  if (cn) {
    lines.push(`Composition need: ${confEmoji[cn.confidence] || "[?]"} ${cn.value}`);
  }

  // Clothing visibility
  const cv = interpretation.clothing_visibility_need;
  if (cv) {
    lines.push(`Clothing visibility: ${confEmoji[cv.confidence] || "[?]"} ${cv.value}`);
  }

  if (interpretation._fallback) {
    lines.push("(fallback — interpretation model call failed or returned invalid output)");
  }

  return lines.join("\n");
}

module.exports = { assemble, buildStructuredAnalysis, buildInterpretationSummary, BLOCK_ORDER };
