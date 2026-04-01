const JUDGE_CONFIG = {
  "event_name": "Build Eric's Software Factory",
  "main_tracks": [
    { "id": "Always-On-Agents", "name": "Always-On Agents", "description": "Webhook and schedule driven agents that stay useful after the demo.", "label": "LIVE TRIGGERS + ALWAYS-ON ACTIONS" },
    { "id": "Review-QA", "name": "Review + QA", "description": "Reliability systems, verifiers, incident responders, and evidence-driven debugging.", "label": "CHECKPOINTS + QUALITY GATES" },
    { "id": "Agent-Runtime-Tools", "name": "Agent Runtime Tools", "description": "Skills, MCP tools, model routing, and decision systems that make agents more capable.", "label": "SKILLS + TOOLS + DECISION LAYERS" },
    { "id": "Software-Factory", "name": "Software Factory", "description": "Systems that continuously build, test, coordinate, and improve codebases.", "label": "PIPELINES + FLEETS + CONTINUOUS IMPROVEMENT" }
  ],
  "rubric": {
    "core_max_points": 100,
    "side_bonus_cap": 30,
    "criteria": [
      { "id": "concrete_workflow_value", "name": "Concrete Workflow Value", "points": 30 },
      { "id": "track_fit", "name": "Track Fit", "points": 25 },
      { "id": "reliability_and_verification", "name": "Reliability And Verification", "points": 20 },
      { "id": "technical_execution", "name": "Technical Execution", "points": 15 },
      { "id": "demo_clarity", "name": "Demo Clarity", "points": 10 }
    ]
  },
  "judge_bonus_bucket": { "name": "Judge Bonus Bucket", "max_points": 30 },
  "side_quests": [
    { "id": "best_cursor_native_workflow", "name": "Best Cursor-Native Workflow" },
    { "id": "best_developer_tool", "name": "Best Developer Tool" },
    { "id": "best_reliability_system", "name": "Best Reliability System" },
    { "id": "most_technically_ambitious", "name": "Most Technically Ambitious" },
    { "id": "best_demo", "name": "Best Demo" },
    { "id": "best_use_of_ai_safety", "name": "Best Use of AI Safety" },
    { "id": "best_use_of_open_claw", "name": "Best Use of Open Claw" }
  ]
};

function clampInteger(value, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  if (Number.isNaN(parsed)) {
    return minimum;
  }
  return Math.max(minimum, Math.min(maximum, parsed));
}

function normalizeJudgeResponse(input) {
  const criteria = JUDGE_CONFIG.rubric.criteria;
  const sideQuests = JUDGE_CONFIG.side_quests;
  const directCoreTotal = input.core_total;

  const coreScores = {};
  let coreTotal = 0;
  if (directCoreTotal !== undefined && directCoreTotal !== null && directCoreTotal !== "") {
    coreTotal = clampInteger(directCoreTotal, 0, JUDGE_CONFIG.rubric.core_max_points);
  } else {
    for (const criterion of criteria) {
      const score = clampInteger(input.core_scores?.[criterion.id], 0, criterion.points);
      coreScores[criterion.id] = score;
      coreTotal += score;
    }
  }

  const bonusBucketScores = {};
  let bonusRaw = 0;
  for (const quest of sideQuests) {
    const score = clampInteger(input.bonus_bucket_scores?.[quest.id], 0, JUDGE_CONFIG.judge_bonus_bucket.max_points);
    bonusBucketScores[quest.id] = score;
    bonusRaw += score;
  }

  const bonusCapped = Math.min(bonusRaw, JUDGE_CONFIG.judge_bonus_bucket.max_points);

  return {
    judge_name: String(input.judge_name || "").trim(),
    repo_url: String(input.repo_url || "").trim(),
    repo_key: String(input.repo_key || "").trim(),
    project_name: String(input.project_name || "").trim(),
    chosen_track: String(input.chosen_track || "").trim(),
    scored_track: String(input.scored_track || input.chosen_track || "").trim(),
    notes: String(input.notes || "").trim(),
    timestamp: new Date().toISOString(),
    core_scores: coreScores,
    bonus_bucket_scores: bonusBucketScores,
    core_total: coreTotal,
    bonus_total_raw: bonusRaw,
    bonus_total_capped: bonusCapped,
    total_score: coreTotal + bonusCapped,
  };
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1000) / 1000;
}

function aggregateJudgeResponses(responses) {
  const grouped = new Map();

  for (const response of responses) {
    const key = response.repo_key;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(response);
  }

  const byRepo = {};
  for (const [repoKey, repoResponses] of grouped.entries()) {
    const base = repoResponses[0];
    const hasDetailedCoreScores = repoResponses.some((response) => Object.keys(response.core_scores || {}).length > 0);
    const coreAverages = {};
    if (hasDetailedCoreScores) {
      for (const criterion of JUDGE_CONFIG.rubric.criteria) {
        coreAverages[criterion.id] = average(repoResponses.map((response) => response.core_scores[criterion.id] || 0));
      }
    }
    const bonusAverages = {};
    for (const quest of JUDGE_CONFIG.side_quests) {
      bonusAverages[quest.id] = average(repoResponses.map((response) => response.bonus_bucket_scores[quest.id] || 0));
    }

    byRepo[repoKey] = {
      repo_url: base.repo_url,
      project_name: base.project_name,
      chosen_track: base.chosen_track,
      judge_count: repoResponses.length,
      responses: repoResponses,
      averages: {
        core_scores: coreAverages,
        bonus_bucket_scores: bonusAverages,
        core_total: average(repoResponses.map((response) => response.core_total)),
        bonus_total: average(repoResponses.map((response) => response.bonus_total_capped)),
        grand_total: average(repoResponses.map((response) => response.total_score)),
      },
    };
  }

  return {
    event_format: JUDGE_CONFIG,
    responses,
    by_repo: byRepo,
  };
}

module.exports = {
  JUDGE_CONFIG,
  normalizeJudgeResponse,
  aggregateJudgeResponses,
};
