const crypto = require("crypto");

const OWNER = "korm1274-cpu";
const REPO = "lush-logistics-workspace";
const BRANCH = "main";

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeAppJwt() {
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT"
    })
  );

  const payload = b64url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: process.env.GITHUB_APP_ID
    })
  );

  const unsigned = `${header}.${payload}`;

  const key = (process.env.GITHUB_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n");

  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsigned), key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsigned}.${signature}`;
}

async function github(path, options = {}, token) {
  const response = await fetch(
    `https://api.github.com${path}`,
    {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "LUSH-Logistics-Workspace-Bot",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text
    };
  }

  if (!response.ok) {
    const error = new Error(
      data.message ||
      `GitHub API error ${response.status}`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

async function getInstallationToken() {
  const jwt = makeAppJwt();

  const data = await github(
    `/app/installations/${process.env.GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST"
    },
    jwt
  );

  return data.token;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 5_000_000) {
        reject(
          new Error("Request too large")
        );

        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(
          body
            ? JSON.parse(body)
            : {}
        );
      } catch {
        reject(
          new Error("Invalid JSON")
        );
      }
    });

    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  try {

    if (req.method !== "POST") {
      res.statusCode = 405;

      res.setHeader(
        "Allow",
        "POST"
      );

      return res.end(
        JSON.stringify({
          ok: false,
          error: "POST only"
        })
      );
    }

    const suppliedSecret =
      req.headers["x-update-secret"];

    const expectedSecret =
      process.env.UPDATE_API_SECRET;

    if (
      !expectedSecret ||
      !suppliedSecret ||
      suppliedSecret !== expectedSecret
    ) {
      res.statusCode = 401;

      return res.end(
        JSON.stringify({
          ok: false,
          error: "Unauthorized"
        })
      );
    }

    const body =
      await readBody(req);

    const content =
      body.content;

    const message =
      body.message ||
      "Update LUSH Logistics workspace";

    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      res.statusCode = 400;

      return res.end(
        JSON.stringify({
          ok: false,
          error: "content is required"
        })
      );
    }

    const token =
      await getInstallationToken();

    let currentFile;

    try {
      currentFile =
        await github(
          `/repos/${OWNER}/${REPO}/contents/index.html?ref=${BRANCH}`,
          {},
          token
        );
    } catch (error) {

      if (error.status !== 404) {
        throw error;
      }

      currentFile = null;
    }

    const payload = {
      message,

      content:
        Buffer
          .from(content, "utf8")
          .toString("base64"),

      branch: BRANCH,

      ...(currentFile?.sha
        ? {
            sha: currentFile.sha
          }
        : {})
    };

    const result =
      await github(
        `/repos/${OWNER}/${REPO}/contents/index.html`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        },
        token
      );

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );

    return res.end(
      JSON.stringify({
        ok: true,
        commit:
          result.commit?.sha,
        message:
          result.commit?.message
      })
    );

  } catch (error) {

    console.error(error);

    res.statusCode = 500;

    res.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );

    return res.end(
      JSON.stringify({
        ok: false,
        error:
          error.message ||
          "Internal error"
      })
    );
  }
};
