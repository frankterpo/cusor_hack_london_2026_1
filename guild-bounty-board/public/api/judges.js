const {
  readJsonObject,
  writeJsonObject,
  parseRequestBody,
  sendJson,
  normalizeRepoUrl,
} = require("./_lib/storage");
const {
  JUDGE_CONFIG,
  normalizeJudgeResponse,
  aggregateJudgeResponses,
} = require("./_lib/judging");
const { verifyAuth } = require("./_lib/auth");

const OBJECT_PATH = "judges.json";

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  const auth = verifyAuth(req);
  if (!auth.valid) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  try {
    const current = await readJsonObject(OBJECT_PATH, { responses: [] });
    const responses = Array.isArray(current.responses) ? current.responses : [];

    if (req.method === "GET") {
      return sendJson(res, 200, aggregateJudgeResponses(responses));
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const body = parseRequestBody(req) || {};
    const repoUrl = String(body.repo_url || "").trim();
    const judgeName = String(body.judge_name || "").trim();
    if (!repoUrl || !judgeName) {
      return sendJson(res, 400, { error: "Missing judge name or repo URL" });
    }

    const repoKey = normalizeRepoUrl(repoUrl);
    const normalized = normalizeJudgeResponse({
      ...body,
      repo_url: repoUrl,
      repo_key: repoKey,
    });

    const nextResponses = responses.filter((response) => {
      return !(response.repo_key === repoKey && String(response.judge_name || "").trim().toLowerCase() === judgeName.toLowerCase());
    });
    nextResponses.push(normalized);

    await writeJsonObject(OBJECT_PATH, { responses: nextResponses });
    return sendJson(res, 200, {
      ok: true,
      response: normalized,
      ...aggregateJudgeResponses(nextResponses),
      rubric: JUDGE_CONFIG,
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unknown error" });
  }
};
