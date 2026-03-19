// STEP E — Final Prompt Assembly
// Joins the named blocks in a fixed, semantically ordered sequence.
// Order is: subject → age → face → hair → eyes/expression → body →
//           clothing → pose → environment → lighting → camera → quality → negative

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

// Builds the human-readable structured analysis summary.
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
    `- Body                : ${v(spec.body.type)}, emphasis: ${v(spec.body.emphasis_strength)}`,
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
    `- Composition goal    : ${plan.composition_goal}`,
  ].join("\n");
}

module.exports = { assemble, buildStructuredAnalysis, BLOCK_ORDER };
