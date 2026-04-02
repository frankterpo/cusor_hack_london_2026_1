function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function supabaseRest(path, options = {}) {
  const url = getEnv("SUPABASE_PROJECT_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_SECRET");
  const response = await fetch(`${url}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`DB ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// --- Submissions ---

async function getSubmissions() {
  const rows = await supabaseRest("/submissions?order=submitted_at.desc.nullsfirst");
  return (rows || []).map(r => ({ ...r, timestamp: r.submitted_at }));
}

async function upsertSubmission(row) {
  const payload = {
    repo_key: row.repo_key,
    repo_url: row.repo_url,
    repo_id: row.repo_id || "",
    team_name: row.team_name || "",
    project_name: row.project_name || "",
    chosen_track: row.chosen_track || "",
    demo_url: row.demo_url || "",
    team_members: row.team_members || "",
    notes: row.notes || "",
    submitted_at: row.timestamp || row.submitted_at || new Date().toISOString(),
    analysis_status: row.analysis_status || "pending",
    analyzed_at: row.analyzed_at || null,
    analysis_error: row.analysis_error || "",
    ai_text: row.ai_text || "",
    ai_model: row.ai_model || "",
    ai_generated_at: row.ai_generated_at || null,
    ai_error: row.ai_error || "",
    total_commits: row.total_commits || 0,
    total_commits_before_t0: row.total_commits_before_t0 || 0,
    total_commits_during_event: row.total_commits_during_event || 0,
    total_commits_after_t1: row.total_commits_after_t1 || 0,
    total_loc_added: row.total_loc_added || 0,
    total_loc_deleted: row.total_loc_deleted || 0,
    has_commits_before_t0: row.has_commits_before_t0 || 0,
    has_bulk_commits: row.has_bulk_commits || 0,
    has_large_initial_commit_after_t0: row.has_large_initial_commit_after_t0 || 0,
    has_merge_commits: row.has_merge_commits || 0,
    default_branch: row.default_branch || "",
  };
  const result = await supabaseRest("/submissions?on_conflict=repo_key", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(payload),
  });
  return result && result[0] ? { ...result[0], timestamp: result[0].submitted_at } : payload;
}

// --- Judge Responses ---

async function getJudgeResponses(repoKey) {
  const filter = repoKey ? `&repo_key=eq.${encodeURIComponent(repoKey)}` : "";
  const rows = await supabaseRest(`/judge_responses?order=submitted_at.desc${filter}`);
  return (rows || []).map(r => ({ ...r, timestamp: r.submitted_at }));
}

async function upsertJudgeResponse(row) {
  const payload = {
    judge_name: row.judge_name,
    repo_key: row.repo_key,
    repo_url: row.repo_url || "",
    project_name: row.project_name || "",
    chosen_track: row.chosen_track || "",
    scored_track: row.scored_track || "",
    notes: row.notes || "",
    submitted_at: row.timestamp || row.submitted_at || new Date().toISOString(),
    core_scores: row.core_scores || {},
    bonus_bucket_scores: row.bonus_bucket_scores || {},
    core_total: row.core_total || 0,
    bonus_total_raw: row.bonus_total_raw || 0,
    bonus_total_capped: row.bonus_total_capped || 0,
    total_score: row.total_score || 0,
  };
  const result = await supabaseRest("/judge_responses?on_conflict=judge_name,repo_key", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(payload),
  });
  return result && result[0] ? { ...result[0], timestamp: result[0].submitted_at } : payload;
}

// --- Analyses ---

async function getAnalysis(repoKey) {
  const rows = await supabaseRest(`/analyses?repo_key=eq.${encodeURIComponent(repoKey)}`);
  return rows && rows[0] ? rows[0].analysis_data : null;
}

async function upsertAnalysis(repoKey, analysisData) {
  await supabaseRest("/analyses?on_conflict=repo_key", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({
      repo_key: repoKey,
      analysis_data: analysisData,
      analyzed_at: new Date().toISOString(),
    }),
  });
}

// --- Settings ---

async function getAnalysisSettings() {
  const rows = await supabaseRest("/analysis_settings?id=eq.1");
  if (!rows || !rows[0]) return null;
  const s = rows[0];
  return {
    event_t0: s.event_t0,
    event_t1: s.event_t1,
    bulk_insertion_threshold: s.bulk_insertion_threshold,
    bulk_files_threshold: s.bulk_files_threshold,
    max_commits_to_analyze: s.max_commits_to_analyze,
  };
}

async function upsertAnalysisSettings(settings) {
  const result = await supabaseRest("/analysis_settings?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      id: 1,
      event_t0: settings.event_t0,
      event_t1: settings.event_t1,
      bulk_insertion_threshold: settings.bulk_insertion_threshold,
      bulk_files_threshold: settings.bulk_files_threshold,
      max_commits_to_analyze: settings.max_commits_to_analyze,
    }),
  });
  return result && result[0] ? result[0] : settings;
}

module.exports = {
  getSubmissions,
  upsertSubmission,
  getJudgeResponses,
  upsertJudgeResponse,
  getAnalysis,
  upsertAnalysis,
  getAnalysisSettings,
  upsertAnalysisSettings,
};
