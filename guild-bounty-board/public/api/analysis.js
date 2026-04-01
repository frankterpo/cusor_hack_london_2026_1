const {
  readJsonObject,
  sendJson,
  normalizeRepoUrl,
} = require("./_lib/storage");
const { verifyAuth } = require("./_lib/auth");

const OBJECT_PATH = "analysis.json";

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  const auth = verifyAuth(req);
  if (!auth.valid) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const requestUrl = new URL(req.url, "http://localhost");
    const repoUrl = requestUrl.searchParams.get("repo_url") || requestUrl.searchParams.get("repo") || "";
    const repoKey = normalizeRepoUrl(repoUrl);
    if (!repoKey) {
      return sendJson(res, 400, { error: "Missing repo_url query parameter" });
    }

    const current = await readJsonObject(OBJECT_PATH, { by_repo: {} });
    return sendJson(res, 200, {
      repo_key: repoKey,
      analysis: current.by_repo?.[repoKey] || null,
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unknown error" });
  }
};
