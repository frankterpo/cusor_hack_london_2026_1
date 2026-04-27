const { sendJson } = require("./_lib/storage");
const { getSitePassword, createToken, verifyAuth, setAuthCookie } = require("./_lib/auth");

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  try {
    const str = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : String(req.body);
    return str ? JSON.parse(str) : {};
  } catch (_) {
    return {};
  }
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  try {
    if (req.method === "GET") {
      const result = verifyAuth(req);
      return sendJson(res, 200, { authenticated: result.valid });
    }

    if (req.method === "POST") {
      const body = getBody(req);
      const password = String(body.password || "").trim();

      if (!password) {
        return sendJson(res, 400, { ok: false, error: "Password required" });
      }

      let sitePassword;
      try {
        sitePassword = getSitePassword();
      } catch (_) {
        return sendJson(res, 503, {
          ok: false,
          error: "Server not configured: set SITE_PASSWORD or site_password in Vercel env.",
        });
      }

      if (password !== sitePassword) {
        return sendJson(res, 401, { ok: false, error: "Invalid password" });
      }

      let token;
      try {
        token = createToken();
      } catch (_) {
        return sendJson(res, 503, {
          ok: false,
          error: "Server not configured: set SITE_PASSWORD (or AUTH_SECRET) in Vercel env.",
        });
      }
      setAuthCookie(res, token);
      return sendJson(res, 200, { ok: true, token });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unknown error" });
  }
};
