const {
  readJsonObject,
  writeJsonObject,
  sendJson,
  normalizeRepoUrl,
} = require("./_lib/storage");
const {
  getAnalysisSettings,
} = require("./_lib/analysis-settings");
const {
  analyzeGitHubRepo,
} = require("./_lib/github-analysis");
const {
  generateAiSummary,
} = require("./_lib/ai-analysis");

const { verifyAuth } = require("./_lib/auth");

const SUBMISSIONS_OBJECT_PATH = "submissions.json";
const ANALYSIS_OBJECT_PATH = "analysis.json";

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  const auth = verifyAuth(req);
  if (!auth.valid) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const settings = await getAnalysisSettings();
    const submissionsPayload = await readJsonObject(SUBMISSIONS_OBJECT_PATH, { submissions: [] });
    const analysisPayload = await readJsonObject(ANALYSIS_OBJECT_PATH, { by_repo: {} });
    const submissions = Array.isArray(submissionsPayload.submissions) ? submissionsPayload.submissions : [];

    const results = [];
    const nextSubmissions = [];
    for (const submission of submissions) {
      try {
        const analysis = await analyzeGitHubRepo(submission.repo_url, settings);
        try {
          const aiSummary = await generateAiSummary({
            repoUrl: submission.repo_url,
            track: submission.chosen_track,
            metrics: analysis,
            repoMetadata: analysis.repo_metadata,
          });
          analysis.ai_text = aiSummary.text;
          analysis.ai_model = aiSummary.model;
          analysis.ai_generated_at = aiSummary.generated_at;
        } catch (aiError) {
          analysis.ai_text = "";
          analysis.ai_error = aiError.message || "AI analysis failed";
        }
        const repoKey = normalizeRepoUrl(submission.repo_url);
        analysisPayload.by_repo[repoKey] = analysis;
        nextSubmissions.push({
          ...submission,
          repo_id: analysis.repo_id,
          analysis_status: "analyzed",
          analyzed_at: analysis.generated_at,
          analysis_error: "",
          ai_text: analysis.ai_text || "",
          ai_model: analysis.ai_model || "",
          ai_generated_at: analysis.ai_generated_at || null,
          ai_error: analysis.ai_error || "",
          default_branch: analysis.default_branch,
          ...analysis.summary_row,
        });
        results.push({ repo_url: submission.repo_url, ok: true });
      } catch (error) {
        nextSubmissions.push({
          ...submission,
          analysis_status: "analysis_failed",
          analysis_error: error.message || "GitHub analysis failed",
          ai_text: "",
          ai_model: "",
          ai_generated_at: null,
          ai_error: "",
        });
        results.push({ repo_url: submission.repo_url, ok: false, error: error.message || "GitHub analysis failed" });
      }
    }

    await writeJsonObject(SUBMISSIONS_OBJECT_PATH, { submissions: nextSubmissions });
    await writeJsonObject(ANALYSIS_OBJECT_PATH, analysisPayload);

    return sendJson(res, 200, {
      ok: true,
      results,
      analyzed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      settings,
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unknown error" });
  }
};
