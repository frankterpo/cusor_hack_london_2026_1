const { sendJson, parseRequestBody } = require("./_lib/storage");
const { getSitePassword, createToken, verifyAuth, setAuthCookie } = require("./_lib/auth");

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
      const body = parseRequestBody(req) || {};
      const password = String(body.password || "").trim();

      if (!password) {
        return sendJson(res, 400, { ok: false, error: "Password required" });
      }

      const sitePassword = getSitePassword();
      if (password !== sitePassword) {
        return sendJson(res, 401, { ok: false, error: "Invalid password" });
      }

      const token = createToken();
      setAuthCookie(res, token);
      return sendJson(res, 200, { ok: true, token });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unknown error" });
  }
};
