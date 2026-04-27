async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

function flagChip(value) {
  const v = Number(value);
  if (v === 0 || value === false) return '<span class="flag ok">No</span>';
  return '<span class="flag danger">Yes</span>';
}

function hasAnyFlag(row) {
  return (
    Number(row.has_commits_before_t0) > 0 ||
    Number(row.has_bulk_commits) > 0 ||
    Number(row.has_large_initial_commit_after_t0) > 0 ||
    Number(row.has_merge_commits) > 0
  );
}

function formatNumber(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function updateStats(rows) {
  const total = rows.length;
  const tracked = rows.filter((r) => r.submission_status !== "missing").length;
  const analyzed = rows.filter((r) => r.analysis_status === "analyzed").length;
  const flagged = rows.filter(
    (r) => r.analysis_status === "analyzed" && hasAnyFlag(r)
  ).length;
  const clean = rows.filter(
    (r) => r.analysis_status === "analyzed" && !hasAnyFlag(r)
  ).length;

  // Calculate total commits and LoC
  const totalCommits = rows.reduce(
    (sum, r) => sum + (Number(r.total_commits) || 0),
    0
  );
  const totalLocAdded = rows.reduce(
    (sum, r) => sum + (Number(r.total_loc_added) || 0),
    0
  );
  const totalLocDeleted = rows.reduce(
    (sum, r) => sum + (Number(r.total_loc_deleted) || 0),
    0
  );
  const totalLoc = totalLocAdded + totalLocDeleted;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText("stat-total", total);
  setText("stat-tracked", tracked);
  setText("stat-analyzed", analyzed);
  setText("stat-flagged", flagged);
  setText("stat-clean", clean);
  setText("stat-commits", formatNumber(totalCommits));
  setText("stat-loc", formatNumber(totalLoc));
  setText("submissions-count", total);
}

function extractRepoName(repoUrl) {
  const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+?)(?:\.git)?$/);
  if (match) return match[1];
  return repoUrl;
}

// Judge data cache
let judgeMap = new Map();
let submissionMap = new Map();

function normalizeRepoKey(repoUrl = "") {
  return repoUrl
    .trim()
    .replace(/\.git$/i, "")
    .toLowerCase();
}

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadJudgeData() {
  try {
    const data = await fetchJSON("/api/judges");
    const map = new Map();
    if (data && data.by_repo) {
      for (const [repoUrl, info] of Object.entries(data.by_repo)) {
        const key = normalizeRepoKey(repoUrl);
        map.set(key, info);
        // Also store raw repoUrl as-is for exact matches
        map.set(normalizeRepoKey(repoUrl.replace(/\.git$/i, "")), info);
      }
    }
    judgeMap = map;
  } catch (err) {
    console.error("Failed to load judge data", err);
    judgeMap = new Map();
  }
}

async function loadSubmissionData() {
  try {
    const data = await fetchJSON("/api/submissions");
    const map = new Map();
    for (const submission of data.submissions || []) {
      if (submission.repo_url) {
        map.set(normalizeRepoKey(submission.repo_url), submission);
      }
      if (submission.submission_id) {
        map.set(`submission:${submission.submission_id}`, submission);
      }
    }
    submissionMap = map;
  } catch (err) {
    console.error("Failed to load submission data", err);
    submissionMap = new Map();
  }
}

// Cache for AI summaries
const aiCache = new Map();

async function fetchAISummary(repoId) {
  if (aiCache.has(repoId)) return aiCache.get(repoId);
  const text = await fetchText(`/api/repo/${repoId}/ai`);
  aiCache.set(repoId, text);
  return text;
}

function getAIPreview(aiText) {
  if (!aiText) return '<span class="ai-preview no-data">No AI analysis</span>';
  // Get first two sentences or first 150 chars
  const sentences = aiText
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ");
  const preview =
    sentences.length > 180 ? sentences.slice(0, 180) + "…" : sentences;
  return `<span class="ai-preview">${escapeHtml(preview)}</span>`;
}

function extractVerdict(aiText) {
  if (!aiText)
    return { icon: "⏳", class: "pending", full: "Pending analysis" };

  const verdictMatch = aiText.match(
    /Overall authenticity assessment:\s*(.+?)$/im
  );
  if (!verdictMatch)
    return { icon: "⏳", class: "pending", full: "No assessment found" };

  const verdict = verdictMatch[1].trim();
  const isAuthentic = /consistent|authentic|legitimate/i.test(verdict);
  const isSuspicious = /suspicious|concern|flag|issue|question/i.test(verdict);

  if (isSuspicious) {
    return { icon: "⚠️", class: "suspicious", full: verdict };
  } else if (isAuthentic) {
    return { icon: "✅", class: "authentic", full: verdict };
  }
  return { icon: "➖", class: "neutral", full: verdict };
}

function getVerdictBadge(aiText) {
  const verdict = extractVerdict(aiText);
  return `<span class="verdict-icon ${verdict.class}" title="${escapeHtml(
    verdict.full
  )}">${verdict.icon}</span>`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return (text || "")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function humanizeKey(text) {
  return String(text || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getJudgeInfoForRow(row) {
  if (!row) return null;
  const key = normalizeRepoKey(row.repo || "");
  return (
    judgeMap.get(key) ||
    judgeMap.get(normalizeRepoKey(row.repo || "").replace(/\.git$/i, ""))
  );
}

function getSubmissionInfoForRow(row) {
  if (!row) return null;
  const repoKey = normalizeRepoKey(row.repo || row.repo_url || "");
  if (repoKey && submissionMap.has(repoKey)) return submissionMap.get(repoKey);
  if (row.repo_id && submissionMap.has(`submission:${row.repo_id}`))
    return submissionMap.get(`submission:${row.repo_id}`);
  return null;
}

function analysisStatusChip(row) {
  if (row.analysis_status === "analyzed")
    return '<span class="status-chip status-chip--analyzed">Analyzed</span>';
  return '<span class="status-chip status-chip--pending">Submitted</span>';
}

function trackChip(track) {
  if (!track)
    return '<span class="track-chip track-chip--empty" aria-label="Unassigned track">—</span>';
  return `<span class="track-chip">${escapeHtml(track)}</span>`;
}

function trackMatchesCategory(track, category) {
  if (!category) return true;
  if (!track) return false;
  const t = String(track).toLowerCase();
  if (category === "money-movement") return t.includes("money");
  if (category === "financial-intelligence") return t.includes("intelligence");
  return true;
}

function demoLink(submission) {
  if (!submission || !submission.demo_url) return "";
  return `<a class="repo-link" href="${escapeAttr(
    submission.demo_url
  )}" target="_blank" rel="noreferrer">Demo</a>`;
}

function repoLink(url) {
  if (!url) return "";
  return `<a class="repo-link" href="${escapeAttr(
    url
  )}" target="_blank" rel="noreferrer">Repo</a>`;
}

function buildJudgeTooltip(info) {
  if (!info || !info.responses || info.responses.length === 0)
    return "No judge responses";
  const parts = info.responses.map((r, idx) => {
    const thought = r.notes
      ? ` — ${r.notes}`
      : r.thoughts
      ? ` — ${r.thoughts}`
      : "";
    if (info.legacy_mode) {
      return `#${idx + 1}: ${r.total_score}${thought}`;
    }
    return `#${idx + 1}: ${r.total_score}/130 (core ${r.core_total}, bonus ${
      r.bonus_total_capped
    })${thought}`;
  });
  return parts.join("\n");
}

function renderJudgeCell(info) {
  if (!info || !info.responses || info.responses.length === 0) {
    return '<span class="judge-chip no-data">—</span>';
  }
  const avg = Number(
    (info.averages && info.averages.grand_total) ?? info.average_score ?? 0
  ).toFixed(1);
  const cap = info.legacy_mode ? "" : '<span class="judge-count">/130</span>';
  const tooltip = escapeAttr(buildJudgeTooltip(info));
  return `<span class="judge-chip" title="${tooltip}">${avg}${cap}<span class="judge-count"> · ${info.responses.length}</span></span>`;
}

function renderJudgeDetails(info) {
  const container = document.getElementById("judge-output");
  if (!info || !info.responses || info.responses.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">🧑‍⚖️</div><div>No judge responses</div></div>';
    return;
  }
  const grandAvg = Number(
    (info.averages && info.averages.grand_total) ?? info.average_score ?? 0
  ).toFixed(1);
  const coreAvg = Number(
    (info.averages && info.averages.core_total) ?? info.average_score ?? 0
  ).toFixed(1);
  const bonusAvg = Number(
    (info.averages && info.averages.bonus_total) ?? 0
  ).toFixed(1);
  const criterionList = info.legacy_mode
    ? ""
    : Object.entries(info.averages.core_scores || {})
        .map(
          ([key, value]) =>
            `<div class="judge-row"><div class="judge-score-pill">${escapeHtml(
              humanizeKey(key)
            )}</div><div class="judge-thought">${Number(value).toFixed(
              1
            )} avg</div></div>`
        )
        .join("");
  const bonusList = info.legacy_mode
    ? ""
    : Object.entries(info.averages.bonus_bucket_scores || {})
        .map(
          ([key, value]) =>
            `<div class="judge-row"><div class="judge-score-pill">${escapeHtml(
              humanizeKey(key)
            )}</div><div class="judge-thought">${Number(value).toFixed(
              1
            )} avg</div></div>`
        )
        .join("");
  const list = info.responses
    .map((r, idx) => {
      const thought = r.thoughts
        ? `<div class="judge-thought">${escapeHtml(r.thoughts)}</div>`
        : "";
      const scoreLine = info.legacy_mode
        ? `#${idx + 1} • ${r.total_score}`
        : `#${idx + 1} • ${r.total_score}/130 (core ${r.core_total}, bonus ${
            r.bonus_total_capped
          })`;
      return `<div class="judge-row"><div class="judge-score-pill">${scoreLine}</div>${thought}</div>`;
    })
    .join("");
  container.innerHTML = `
    <div class="judge-summary">
      <div class="judge-score-pill highlight">${grandAvg}${
    info.legacy_mode ? "" : "/130"
  }</div>
      <div class="judge-meta">${info.responses.length} response${
    info.responses.length !== 1 ? "s" : ""
  }</div>
    </div>
    ${
      info.legacy_mode
        ? ""
        : `
      <div class="judge-summary">
        <div class="judge-score-pill">Core ${coreAvg}/100</div>
        <div class="judge-score-pill">Bonus ${bonusAvg}/30</div>
      </div>
      <div class="judge-list">${criterionList}</div>
      <div class="judge-list">${bonusList}</div>
    `
    }
    <div class="judge-list">${list}</div>
  `;
}

async function renderSummaryTable(rows) {
  const tbody = document.querySelector("#summary-table tbody");
  tbody.innerHTML = "";
  const filterPre = document.querySelector("#filter-preT0").checked;
  const filterBulk = document.querySelector("#filter-bulk").checked;
  const filterMerge = document.querySelector("#filter-merge").checked;
  const sortMode = document.querySelector("#sort-select").value;

  const trackFilter = window.__trackFilter || null;
  const filteredRows = rows.filter((r) => {
    if (filterPre && Number(r.has_commits_before_t0) === 0) return false;
    if (filterBulk && Number(r.has_bulk_commits) === 0) return false;
    if (filterMerge && Number(r.has_merge_commits) === 0) return false;
    if (trackFilter) {
      const sub = getSubmissionInfoForRow(r);
      const track = sub?.chosen_track || r.chosen_track || "";
      if (!trackMatchesCategory(track, trackFilter)) return false;
    }
    return true;
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortMode === "judge") {
      const ja = getJudgeInfoForRow(a);
      const jb = getJudgeInfoForRow(b);
      const avga = ja
        ? Number(
            (ja.averages && ja.averages.grand_total) ??
              ja.average_score ??
              -Infinity
          )
        : -Infinity;
      const avgb = jb
        ? Number(
            (jb.averages && jb.averages.grand_total) ??
              jb.average_score ??
              -Infinity
          )
        : -Infinity;
      if (avga === avgb) return 0;
      return avgb - avga;
    }
    if (sortMode === "commits") {
      return Number(b.total_commits || 0) - Number(a.total_commits || 0);
    }
    return 0;
  });

  updateStats(rows);

  if (sortedRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="13">
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div>No submissions match the current filters</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Render rows first with loading placeholders for AI
  sortedRows.forEach((row) => {
    const tr = document.createElement("tr");
    const repoId =
      row.repo_id || row.submission_id || extractRepoName(row.repo);
    const submission = getSubmissionInfoForRow(row);
    const displayName =
      submission?.project_name || row.repo_id || extractRepoName(row.repo);
    const teamName = submission?.team_name || "";
    const judgeInfo = getJudgeInfoForRow(row);

    tr.innerHTML = `
      <td>
        <div class="repo-cell">
          <span class="repo-name">${escapeHtml(displayName)}</span>
          ${
            teamName
              ? `<span class="repo-meta">Team ${escapeHtml(teamName)}</span>`
              : ""
          }
          <span class="repo-url">${escapeHtml(
            row.repo || submission?.repo_url || ""
          )}</span>
          <div class="repo-actions">${repoLink(
            row.repo || submission?.repo_url || ""
          )}${demoLink(submission)}</div>
        </div>
      </td>
      <td>${trackChip(submission?.chosen_track || row.chosen_track || "")}</td>
      <td>${analysisStatusChip(row)}</td>
      <td><div class="judge-cell">${renderJudgeCell(judgeInfo)}</div></td>
      <td><span class="num-cell">${row.total_commits}</span></td>
      <td><span class="num-cell loc-add">+${formatNumber(
        row.total_loc_added
      )}</span></td>
      <td><span class="num-cell loc-del">−${formatNumber(
        row.total_loc_deleted
      )}</span></td>
      <td style="text-align:center">${flagChip(row.has_commits_before_t0)}</td>
      <td style="text-align:center">${flagChip(row.has_bulk_commits)}</td>
      <td style="text-align:center">${flagChip(
        row.has_large_initial_commit_after_t0
      )}</td>
      <td style="text-align:center">${flagChip(row.has_merge_commits)}</td>
      <td class="verdict-cell"><span class="verdict-icon pending">⏳</span></td>
      <td class="ai-cell"><span class="ai-preview no-data">Loading...</span></td>
    `;
    tr.dataset.repoId = repoId;
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.setAttribute("aria-label", `Open details for ${displayName}`);
    const openRow = () => {
      document
        .querySelectorAll("#summary-table tbody tr")
        .forEach((r) => r.classList.remove("selected"));
      tr.classList.add("selected");
      openDrawer(repoId);
    };
    tr.addEventListener("click", openRow);
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openRow();
      }
    });
    tbody.appendChild(tr);

    // Fetch AI summary async
    fetchAISummary(repoId).then((aiText) => {
      const aiCell = tr.querySelector(".ai-cell");
      const verdictCell = tr.querySelector(".verdict-cell");
      if (aiCell) aiCell.innerHTML = getAIPreview(aiText);
      if (verdictCell) verdictCell.innerHTML = getVerdictBadge(aiText);
    });
  });
}

async function loadSummary() {
  const [summaryData] = await Promise.all([
    fetchJSON("/api/summary").catch(() => ({ rows: [] })),
    loadJudgeData(),
    loadSubmissionData(),
  ]);
  const summaryRows = summaryData.rows || [];
  const merged = mergeRows(
    summaryRows,
    Array.from(submissionMap.values()).filter((value, index, array) => {
      return (
        array.findIndex(
          (candidate) => candidate.submission_id === value.submission_id
        ) === index
      );
    })
  );
  window.__summaryRows = merged;
  await renderSummaryTable(window.__summaryRows);
}

function mergeRows(summaryRows, submissions) {
  const byRepo = new Map();

  summaryRows.forEach((row) => {
    const repoKey = normalizeRepoKey(row.repo || "");
    byRepo.set(repoKey, {
      ...row,
      repo_id: row.repo_id || extractRepoName(row.repo),
      submission_status: submissionMap.has(repoKey) ? "submitted" : "missing",
      analysis_status: "analyzed",
    });
  });

  submissions.forEach((submission) => {
    const repoKey = normalizeRepoKey(submission.repo_url || "");
    if (byRepo.has(repoKey)) {
      byRepo.set(repoKey, {
        ...byRepo.get(repoKey),
        ...submission,
        submission_status: "submitted",
      });
      return;
    }

    byRepo.set(repoKey, {
      repo_id: submission.submission_id,
      repo: submission.repo_url,
      repo_url: submission.repo_url,
      submission_id: submission.submission_id,
      project_name: submission.project_name,
      team_name: submission.team_name,
      chosen_track: submission.chosen_track,
      demo_url: submission.demo_url,
      submission_status: "submitted",
      analysis_status: "pending",
      total_commits: 0,
      total_loc_added: 0,
      total_loc_deleted: 0,
      has_commits_before_t0: 0,
      has_bulk_commits: 0,
      has_large_initial_commit_after_t0: 0,
      has_merge_commits: 0,
    });
  });

  return Array.from(byRepo.values());
}

function formatJSON(obj) {
  return JSON.stringify(obj, null, 2);
}

// Drawer functionality
function openDrawer(repoId) {
  const drawer = document.getElementById("details-drawer");
  const overlay = document.getElementById("drawer-overlay");

  drawer.classList.remove("hidden");
  overlay.classList.remove("hidden");

  // Trigger reflow for animation
  drawer.offsetHeight;

  drawer.classList.add("visible");
  overlay.classList.add("visible");

  loadDetails(repoId);
}

function closeDrawer() {
  const drawer = document.getElementById("details-drawer");
  const overlay = document.getElementById("drawer-overlay");

  drawer.classList.remove("visible");
  overlay.classList.remove("visible");

  setTimeout(() => {
    drawer.classList.add("hidden");
    overlay.classList.add("hidden");
  }, 250);

  document
    .querySelectorAll("#summary-table tbody tr")
    .forEach((r) => r.classList.remove("selected"));
}

async function loadDetails(repoId) {
  document.getElementById("detail-title").textContent = repoId;

  const submissionEl = document.getElementById("submission-output");
  const summaryEl = document.getElementById("metrics-summary");
  const flagsEl = document.getElementById("metrics-flags");
  const timeEl = document.getElementById("metrics-time");
  const aiEl = document.getElementById("ai-output");
  const judgeEl = document.getElementById("judge-output");

  submissionEl.textContent = "Loading...";
  summaryEl.textContent = "Loading...";
  flagsEl.textContent = "Loading...";
  timeEl.textContent = "Loading...";
  aiEl.textContent = "Loading...";
  judgeEl.textContent = "Loading...";

  try {
    const summaryRow = (window.__summaryRows || []).find(
      (r) => (r.repo_id || extractRepoName(r.repo)) === repoId
    );
    renderSubmissionDetails(summaryRow);
    const [metrics, aiText, commitsData] = await Promise.all([
      fetchJSON(`/api/repo/${repoId}/metrics`),
      fetchText(`/api/repo/${repoId}/ai`),
      fetchJSON(`/api/repo/${repoId}/commits`).catch(() => ({ rows: [] })),
    ]);

    summaryEl.textContent = formatJSON(metrics.summary || {});
    flagsEl.textContent = formatJSON(metrics.flags || {});
    timeEl.textContent = formatJSON(metrics.time_distribution || {});

    // Format AI output with verdict highlighting
    if (aiText) {
      const formattedAI = formatAIOutput(aiText);
      aiEl.innerHTML = formattedAI;
    } else {
      aiEl.textContent = "No AI analysis available for this submission.";
    }

    const judgeInfo = getJudgeInfoForRow(summaryRow);
    renderJudgeDetails(judgeInfo);

    renderCommits(commitsData.rows || []);
  } catch (err) {
    const summaryRow = (window.__summaryRows || []).find(
      (r) => (r.repo_id || extractRepoName(r.repo)) === repoId
    );
    renderSubmissionDetails(summaryRow);
    summaryEl.textContent = rowHasAnalysis(summaryRow)
      ? `Error: ${err.message}`
      : "Analysis not generated yet.";
    flagsEl.textContent = rowHasAnalysis(summaryRow)
      ? ""
      : "Run scan.py to populate commit metrics and authenticity flags.";
    timeEl.textContent = "";
    aiEl.textContent = rowHasAnalysis(summaryRow)
      ? ""
      : "AI analysis appears after repo analysis has been run.";
    const judgeInfo = getJudgeInfoForRow(summaryRow);
    renderJudgeDetails(judgeInfo);
    renderCommits([]);
  }
}

function rowHasAnalysis(row) {
  return row && row.analysis_status === "analyzed";
}

function renderSubmissionDetails(row) {
  const container = document.getElementById("submission-output");
  const submission = getSubmissionInfoForRow(row) || row;
  if (!submission) {
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">📨</div><div>No submission metadata</div></div>';
    return;
  }
  const items = [
    ["Project", submission.project_name || row?.repo_id || "—"],
    ["Team", submission.team_name || "—"],
    ["Track", submission.chosen_track || "—"],
    ["Submitted", submission.timestamp || "—"],
    ["Repo", submission.repo_url || row?.repo || "—"],
    ["Demo", submission.demo_url || "—"],
  ];
  container.innerHTML = `
    <div class="submission-grid">
      ${items
        .map(
          ([label, value]) =>
            `<div class="submission-item"><div class="submission-label">${escapeHtml(
              label
            )}</div><div class="submission-value">${escapeHtml(
              value
            )}</div></div>`
        )
        .join("")}
    </div>
  `;
}

function formatAIOutput(text) {
  // Convert bullet points and highlight the verdict
  let html = escapeHtml(text);

  // Look for authenticity assessment line
  const verdictMatch = html.match(/(Overall authenticity assessment:.*?)$/im);
  if (verdictMatch) {
    const verdict = verdictMatch[1];
    const isSuspicious = /suspicious|concern|flag|issue|question/i.test(
      verdict
    );
    const isAuthentic = /consistent|authentic|legitimate/i.test(verdict);
    // Suspicious takes priority over authentic keywords
    const verdictClass = isSuspicious
      ? "suspicious"
      : isAuthentic
      ? "authentic"
      : "suspicious";
    html = html.replace(
      verdict,
      `<span class="verdict ${verdictClass}">${verdict}</span>`
    );
  }

  return html;
}

function renderCommits(rows) {
  const tbody = document.querySelector("#commits-table tbody");
  const countEl = document.querySelector(".commit-count");
  tbody.innerHTML = "";

  countEl.textContent = `(${rows.length})`;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--muted); padding: 20px;">
          No commits data available
        </td>
      </tr>
    `;
    return;
  }

  rows.slice(0, 100).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="num-cell">${row.seq_index}</span></td>
      <td style="font-size: 0.7rem; color: var(--muted); white-space: nowrap;">${
        row.author_time_iso
      }</td>
      <td><span class="num-cell loc-add">+${row.insertions}</span></td>
      <td><span class="num-cell loc-del">−${row.deletions}</span></td>
      <td><span class="num-cell">${row.files_changed}</span></td>
      <td style="text-align:center">${flagChip(row.flag_bulk_commit)}</td>
      <td style="text-align:center">${flagChip(row.is_before_t0)}</td>
      <td style="text-align:center">${flagChip(row.is_after_t1)}</td>
      <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(
        row.subject
      )}">${escapeHtml(row.subject)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ================================================================
// Event format (rubric / side quests / judges / prizes) + modals
// ================================================================

let eventFormat = null;
let hacksIndex = { hacks: [], active_hack_id: null };
const LOCAL_SUBMISSIONS_KEY = "bfa-london-2026-submissions";
const LOCAL_SCORES_KEY = "bfa-london-2026-scores";

function getActiveHackId() {
  return (
    hacksIndex.active_hack_id ||
    (eventFormat && eventFormat.hack_id) ||
    "cursor-briefcase-london-2026"
  );
}

function getActiveHack() {
  const id = getActiveHackId();
  return (hacksIndex.hacks || []).find((h) => h.id === id) || null;
}

async function loadHacks() {
  try {
    hacksIndex = await fetchJSON("/api/hacks");
  } catch (e) {
    hacksIndex = { hacks: [], active_hack_id: null };
  }
}

async function loadEventFormat() {
  try {
    eventFormat = await fetchJSON("/api/event-format");
  } catch (e) {
    eventFormat = null;
  }
  renderRubric();
  renderSideQuests();
  renderPrizes();
  renderJudges();
  buildJudgeFormSkeleton();
}

function renderRubric() {
  const ol = document.getElementById("rubric-criteria");
  if (!ol) return;
  const criteria = eventFormat?.rubric?.criteria || [];
  ol.innerHTML = criteria
    .map(
      (c) => `
    <li>
      <div class="rubric-criterion-body">
        <span class="rubric-criterion-name">${escapeHtml(c.name)}</span>
        <span class="rubric-criterion-desc">${escapeHtml(
          c.description || ""
        )}</span>
      </div>
      <span class="rubric-criterion-pts">${c.points} pts</span>
    </li>
  `
    )
    .join("");
}

function renderSideQuests() {
  const ul = document.getElementById("side-quests");
  if (!ul) return;
  const quests = eventFormat?.side_quests || [];
  ul.innerHTML = quests
    .map(
      (q) => `
    <li>
      <div class="sq-body">
        <span class="sq-name">${escapeHtml(q.name)}</span>
        <span class="sq-blurb">${escapeHtml(q.blurb || "")}</span>
      </div>
      <span class="sq-pts">${q.points ?? 10} pts</span>
    </li>
  `
    )
    .join("");
}

function renderPrizes() {
  const ul = document.getElementById("prize-grid");
  if (!ul) return;
  const prizes = eventFormat?.prizes || [];
  ul.innerHTML = prizes
    .map(
      (p) => `
    <li class="prize-card tier-${escapeAttr(p.tier || "default")}">
      <span class="prize-tier">${escapeHtml(p.tier || "prize")}</span>
      <span class="prize-name">${escapeHtml(p.name)}</span>
      <span class="prize-value">${escapeHtml(p.value || "")}</span>
      <span class="prize-desc">${escapeHtml(p.description || "")}</span>
    </li>
  `
    )
    .join("");
}

function renderJudges() {
  const ul = document.getElementById("judge-grid");
  if (!ul) return;
  const judges = eventFormat?.judges || [];
  ul.innerHTML = judges
    .map((j) => {
      const initials = (j.name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase();
      const color = j.avatar_color || "#429aaa";
      const avatar = j.photo_url
        ? `<img class="judge-avatar judge-avatar--img" src="${escapeAttr(
            j.photo_url
          )}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;judge-avatar&quot; style=&quot;background:${escapeAttr(
            color
          )}&quot;>${escapeHtml(initials)}</span>'">`
        : `<span class="judge-avatar" style="background:${escapeAttr(
            color
          )}">${escapeHtml(initials)}</span>`;
      const roleLine = j.title
        ? `<span class="judge-name">${escapeHtml(
            j.name
          )}</span><span class="judge-role">${escapeHtml(
            j.title
          )} · ${escapeHtml(j.role || "")}</span>`
        : `<span class="judge-name">${escapeHtml(
            j.name
          )}</span><span class="judge-role">${escapeHtml(j.role || "")}</span>`;
      const inner = `
      ${avatar}
      <div class="judge-body">
        ${roleLine}
        <span class="judge-focus">${escapeHtml(j.focus || "")}</span>
      </div>
      ${
        j.linkedin
          ? '<span class="judge-linkedin" aria-hidden="true">in →</span>'
          : ""
      }
    `;
      if (j.linkedin) {
        return `<li><a class="judge-card judge-card--link" href="${escapeAttr(
          j.linkedin
        )}" target="_blank" rel="noreferrer noopener" aria-label="${escapeAttr(
          j.name
        )} on LinkedIn">${inner}</a></li>`;
      }
      return `<li class="judge-card">${inner}</li>`;
    })
    .join("");
}

function getLocalList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function setLocalList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------- Modal infra ----------
let lastFocusedBeforeModal = null;
const GATED_MODALS = new Set(["judge-modal", "manager-modal"]);
const AUTH_KEY = "bfa_auth";
const AUTH_CODE = "BCFTW123!";
let pendingGatedModalId = null;

function isAuthed() {
  try {
    return sessionStorage.getItem(AUTH_KEY) === AUTH_CODE;
  } catch {
    return false;
  }
}

function applyAuthState() {
  const authed = isAuthed();
  document.body.classList.toggle("is-authed", authed);
  const main = document.getElementById("submissions");
  if (main) main.hidden = !authed;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (GATED_MODALS.has(id) && !isAuthed()) {
    pendingGatedModalId = id;
    openModal("password-modal");
    return;
  }
  lastFocusedBeforeModal = document.activeElement;
  modal.classList.remove("hidden");
  const firstInput = modal.querySelector("input, select, textarea, button");
  if (firstInput) setTimeout(() => firstInput.focus(), 60);
  if (id === "manager-modal") renderManagerPanel();
  if (id === "judge-modal") refreshJudgeSubmissionSelect();
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("hidden");
  if (
    lastFocusedBeforeModal &&
    typeof lastFocusedBeforeModal.focus === "function"
  ) {
    lastFocusedBeforeModal.focus();
  }
}

// ---------- Submit form ----------
function handleSubmitForm(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const entry = {
    submission_id: `local-${Date.now()}`,
    submitted_at: new Date().toISOString(),
    hack_id: getActiveHackId(),
    team_name: data.team_name || "",
    project_name: data.project_name || "",
    repo_url: data.github_url || "",
    chosen_track: data.chosen_track || "",
    demo_url: data.demo_url || "",
    team_members: data.team_members || "",
    description: data.description || "",
    notes: data.notes || "",
    source: "local-modal",
  };
  const list = getLocalList(LOCAL_SUBMISSIONS_KEY);
  list.push(entry);
  setLocalList(LOCAL_SUBMISSIONS_KEY, list);
  form.reset();
  closeModal("submit-modal");
  toast(
    `Submission saved — ${entry.project_name || "project"} (${
      entry.chosen_track || "no track"
    })`
  );
}

// ---------- Judge form ----------
function buildJudgeFormSkeleton() {
  const core = document.getElementById("judge-core-inputs");
  const bonus = document.getElementById("judge-bonus-inputs");
  if (!core || !bonus) return;
  const criteria = eventFormat?.rubric?.criteria || [];
  core.innerHTML = criteria
    .map((c) =>
      scoreRow({
        key: c.id,
        name: c.name,
        hint: `max ${c.points}`,
        max: c.points,
        group: "core",
      })
    )
    .join("");
  const quests = eventFormat?.side_quests || [];
  bonus.innerHTML = quests
    .map((q) => {
      const max = q.points ?? 10;
      return scoreRow({
        key: q.id,
        name: q.name,
        hint: `max ${max}`,
        max,
        group: "bonus",
      });
    })
    .join("");
  attachScoreInputListeners();
}

function scoreRow({ key, name, hint, max, group }) {
  return `
    <label class="score-row" data-score-group="${escapeAttr(group)}">
      <span class="score-row-name">${escapeHtml(name)}<small>${escapeHtml(
    hint
  )}</small></span>
      <input type="range" min="0" max="${max}" step="1" value="0" name="${escapeAttr(
    group
  )}_${escapeAttr(key)}" data-max="${max}">
      <span class="score-row-value">0</span>
    </label>
  `;
}

function attachScoreInputListeners() {
  document
    .querySelectorAll("#judge-modal .score-row input[type=range]")
    .forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest(".score-row");
        const out = row.querySelector(".score-row-value");
        if (out) out.textContent = input.value;
        updateJudgeRunningTotal();
      });
    });
}

function updateJudgeRunningTotal() {
  const coreSum = sumScoreInputs("core");
  let bonusSum = sumScoreInputs("bonus");
  const bonusCap = Number(eventFormat?.judge_bonus_bucket?.max_points ?? 30);
  bonusSum = Math.min(bonusSum, bonusCap);
  const total = coreSum + bonusSum;
  const el = document.getElementById("judge-running-total");
  if (el) el.textContent = String(total);
}

function sumScoreInputs(group) {
  let sum = 0;
  document
    .querySelectorAll(
      `#judge-modal .score-row[data-score-group="${group}"] input[type=range]`
    )
    .forEach((input) => {
      sum += Number(input.value) || 0;
    });
  return sum;
}

const LOCAL_JUDGE_NAME_KEY = "bfa-london-2026-judge-name";

function scoredIdsForJudge(judgeName) {
  const trimmed = (judgeName || "").trim().toLowerCase();
  if (!trimmed) return new Set();
  const scores = getLocalList(LOCAL_SCORES_KEY);
  return new Set(
    scores
      .filter((s) => (s.judge_name || "").trim().toLowerCase() === trimmed)
      .map((s) => s.submission_id)
  );
}

function refreshJudgeSubmissionSelect() {
  const select = document.getElementById("judge-submission-select");
  if (!select) return;
  const previous = select.value;
  const rows = window.__summaryRows || [];
  const local = getLocalList(LOCAL_SUBMISSIONS_KEY);
  const nameInput = document.getElementById("judge-name-input");
  const cachedName = (nameInput && nameInput.value) || "";
  const scored = scoredIdsForJudge(cachedName);
  const options = ['<option value="">— pick a submission —</option>'];

  rows.forEach((r) => {
    const sub = getSubmissionInfoForRow(r);
    const name = sub?.project_name || r.repo_id || extractRepoName(r.repo);
    const id = r.repo_id || name;
    const suffix = scored.has(id) ? " [SCORED]" : "";
    const track = sub?.chosen_track || r.chosen_track || "unassigned";
    options.push(
      `<option value="${escapeAttr(id)}">${escapeHtml(name)} · ${escapeHtml(
        track
      )}${escapeHtml(suffix)}</option>`
    );
  });
  if (local.length) {
    options.push("<option disabled>── Local (this browser) ──</option>");
    local.forEach((s) => {
      const suffix = scored.has(s.submission_id) ? " [SCORED]" : "";
      options.push(
        `<option value="${escapeAttr(s.submission_id)}">${escapeHtml(
          s.project_name
        )} · ${escapeHtml(s.chosen_track || "unassigned")}${escapeHtml(
          suffix
        )}</option>`
      );
    });
  }
  select.innerHTML = options.join("");
  if (
    previous &&
    Array.from(select.options).some((o) => o.value === previous)
  ) {
    select.value = previous;
  }
  renderJudgeSubmissionSummary();
}

function findSubmissionById(id) {
  if (!id) return null;
  const rows = window.__summaryRows || [];
  for (const r of rows) {
    const sub = getSubmissionInfoForRow(r);
    const rid = r.repo_id || sub?.project_name || extractRepoName(r.repo);
    if (rid === id) return { row: r, sub: sub || null };
  }
  const local = getLocalList(LOCAL_SUBMISSIONS_KEY).find(
    (s) => s.submission_id === id
  );
  if (local) return { row: null, sub: local };
  return null;
}

function renderJudgeSubmissionSummary() {
  const target = document.getElementById("judge-submission-summary");
  if (!target) return;
  const select = document.getElementById("judge-submission-select");
  const id = select?.value || "";
  if (!id) {
    target.innerHTML = "";
    target.classList.remove("is-visible");
    return;
  }
  const found = findSubmissionById(id);
  if (!found) {
    target.innerHTML = "";
    target.classList.remove("is-visible");
    return;
  }
  const { row, sub } = found;
  const project =
    sub?.project_name || row?.repo_id || extractRepoName(row?.repo || "");
  const team = sub?.team_name || "—";
  const track = sub?.chosen_track || row?.chosen_track || "unassigned";
  const repoUrl = sub?.repo_url || row?.repo || "";
  const demoUrl = sub?.demo_url || "";
  const judgeInfo = row ? getJudgeInfoForRow(row) : null;
  const responses = judgeInfo?.responses?.length || 0;
  const avg = judgeInfo
    ? Number(
        judgeInfo.averages?.grand_total ?? judgeInfo.average_score ?? 0
      ).toFixed(1)
    : null;
  const priorLine =
    responses > 0
      ? `<span class="judge-sub-prior">${responses} prior score${
          responses === 1 ? "" : "s"
        } · avg ${avg}</span>`
      : "";
  target.innerHTML = `
    <div class="judge-sub-head">
      <span class="judge-sub-project">${escapeHtml(project)}</span>
      <span class="judge-sub-track track-chip">${escapeHtml(track)}</span>
    </div>
    <div class="judge-sub-meta">Team ${escapeHtml(team)}</div>
    <div class="judge-sub-links">
      ${
        repoUrl
          ? `<a href="${escapeAttr(
              repoUrl
            )}" target="_blank" rel="noreferrer noopener" class="repo-link">Repo ↗</a>`
          : ""
      }
      ${
        demoUrl
          ? `<a href="${escapeAttr(
              demoUrl
            )}" target="_blank" rel="noreferrer noopener" class="repo-link">Demo ↗</a>`
          : ""
      }
      ${priorLine}
    </div>
  `;
  target.classList.add("is-visible");
}

function handleJudgeForm(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.submission_id) {
    toast("Pick a submission first");
    return;
  }
  if (!data.judge_name) {
    toast("Judge name is required");
    return;
  }
  try {
    localStorage.setItem(LOCAL_JUDGE_NAME_KEY, data.judge_name);
  } catch {}

  const coreScores = {};
  let coreTotal = 0;
  (eventFormat?.rubric?.criteria || []).forEach((c) => {
    const v = Number(data[`core_${c.id}`] ?? 0);
    coreScores[c.id] = v;
    coreTotal += v;
  });
  const bonusScores = {};
  let bonusTotal = 0;
  (eventFormat?.side_quests || []).forEach((q) => {
    const v = Number(data[`bonus_${q.id}`] ?? 0);
    bonusScores[q.id] = v;
    bonusTotal += v;
  });
  const bonusCap = Number(eventFormat?.judge_bonus_bucket?.max_points ?? 30);
  const bonusCapped = Math.min(bonusTotal, bonusCap);
  const grandTotal = coreTotal + bonusCapped;

  const entry = {
    scored_at: new Date().toISOString(),
    hack_id: getActiveHackId(),
    judge_name: data.judge_name,
    submission_id: data.submission_id,
    core_scores: coreScores,
    core_total: coreTotal,
    bonus_bucket_scores: bonusScores,
    bonus_total: bonusTotal,
    bonus_total_capped: bonusCapped,
    total_score: grandTotal,
    thoughts: data.thoughts || "",
  };
  const list = getLocalList(LOCAL_SCORES_KEY);
  list.push(entry);
  setLocalList(LOCAL_SCORES_KEY, list);

  // Reset scores only — keep judge name cached for next submission
  const scoredId = entry.submission_id;
  form.querySelectorAll("input[type=range]").forEach((i) => {
    i.value = "0";
    const row = i.closest(".score-row");
    if (row) row.querySelector(".score-row-value").textContent = "0";
  });
  const notes = form.querySelector("textarea[name=thoughts]");
  if (notes) notes.value = "";
  updateJudgeRunningTotal();

  // Refresh select so this submission shows [SCORED], then auto-advance.
  refreshJudgeSubmissionSelect();
  const select = document.getElementById("judge-submission-select");
  if (select) {
    const idx = Array.from(select.options).findIndex(
      (o) => o.value === scoredId
    );
    const nextIdx = idx >= 0 && idx < select.options.length - 1 ? idx + 1 : 0;
    for (let i = nextIdx; i < select.options.length; i++) {
      const opt = select.options[i];
      if (opt.value && !opt.disabled) {
        select.value = opt.value;
        break;
      }
    }
    renderJudgeSubmissionSummary();
  }
  toast(`Scored ${scoredId}: ${grandTotal}/130 — pick next submission`);
}

// ---------- Manager ----------
function renderManagerPanel() {
  const stats = document.getElementById("manager-stats");
  const rows = window.__summaryRows || [];
  const local = getLocalList(LOCAL_SUBMISSIONS_KEY);
  const scores = getLocalList(LOCAL_SCORES_KEY);
  const tracked = rows.length + local.length;
  const moneyMovement = rows.filter((r) =>
    trackMatchesCategory(
      getSubmissionInfoForRow(r)?.chosen_track || r.chosen_track,
      "money-movement"
    )
  ).length;
  const financialIntelligence = rows.filter((r) =>
    trackMatchesCategory(
      getSubmissionInfoForRow(r)?.chosen_track || r.chosen_track,
      "financial-intelligence"
    )
  ).length;
  const flagged = rows.filter((r) => hasAnyFlag(r)).length;

  stats.innerHTML = `
    <div class="manager-stat"><span class="manager-stat-num">${tracked}</span><span class="manager-stat-lbl">Total submissions</span></div>
    <div class="manager-stat"><span class="manager-stat-num">${moneyMovement}</span><span class="manager-stat-lbl">Money Movement</span></div>
    <div class="manager-stat"><span class="manager-stat-num">${financialIntelligence}</span><span class="manager-stat-lbl">Financial Intelligence</span></div>
    <div class="manager-stat"><span class="manager-stat-num">${flagged}</span><span class="manager-stat-lbl">Flagged</span></div>
    <div class="manager-stat"><span class="manager-stat-num">${scores.length}</span><span class="manager-stat-lbl">Local scores</span></div>
    <div class="manager-stat"><span class="manager-stat-num">${local.length}</span><span class="manager-stat-lbl">Local submissions</span></div>
  `;

  renderLeaderboard("money-movement", "leaderboard-money-movement");
  renderLeaderboard(
    "financial-intelligence",
    "leaderboard-financial-intelligence"
  );
  renderFlaggedList();
  renderLocalSubmissions();
}

function renderLeaderboard(category, listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const rows = window.__summaryRows || [];
  const ranked = rows
    .filter((r) =>
      trackMatchesCategory(
        getSubmissionInfoForRow(r)?.chosen_track || r.chosen_track,
        category
      )
    )
    .map((r) => {
      const info = getJudgeInfoForRow(r);
      const score = Number(
        info?.averages?.grand_total ?? info?.average_score ?? 0
      );
      const sub = getSubmissionInfoForRow(r);
      return {
        name: sub?.project_name || r.repo_id || extractRepoName(r.repo),
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (ranked.length === 0) {
    list.innerHTML =
      '<li style="justify-content:center;color:var(--muted);font-style:italic">No submissions yet in this track</li>';
    return;
  }
  list.innerHTML = ranked
    .map(
      (r) => `
    <li>
      <span class="lb-name">${escapeHtml(r.name)}</span>
      <span class="lb-score">${r.score > 0 ? r.score.toFixed(1) : "—"}</span>
    </li>
  `
    )
    .join("");
}

function renderFlaggedList() {
  const ul = document.getElementById("flagged-list");
  if (!ul) return;
  const rows = window.__summaryRows || [];
  const flagged = rows.filter((r) => hasAnyFlag(r)).slice(0, 30);
  if (flagged.length === 0) {
    ul.innerHTML =
      '<li style="justify-content:center;color:var(--muted);font-style:italic">No flags raised</li>';
    return;
  }
  ul.innerHTML = flagged
    .map((r) => {
      const tags = [];
      if (Number(r.has_commits_before_t0) > 0) tags.push("pre-T0");
      if (Number(r.has_bulk_commits) > 0) tags.push("bulk");
      if (Number(r.has_large_initial_commit_after_t0) > 0)
        tags.push("big-init");
      if (Number(r.has_merge_commits) > 0) tags.push("merge");
      const sub = getSubmissionInfoForRow(r);
      const name = sub?.project_name || r.repo_id;
      return `
      <li>
        <span class="flagged-name">${escapeHtml(name)}</span>
        <span class="flagged-tags">${escapeHtml(tags.join(" · "))}</span>
      </li>
    `;
    })
    .join("");
}

function renderLocalSubmissions() {
  const ul = document.getElementById("local-submissions");
  if (!ul) return;
  const local = getLocalList(LOCAL_SUBMISSIONS_KEY);
  if (local.length === 0) {
    ul.innerHTML =
      '<li style="justify-content:center;color:var(--muted);font-style:italic">None yet — try the Submit modal</li>';
    return;
  }
  ul.innerHTML = local
    .map(
      (s) => `
    <li>
      <span class="flagged-name">${escapeHtml(s.project_name)} · ${escapeHtml(
        s.team_name
      )}</span>
      <span class="flagged-tags">${escapeHtml(
        s.chosen_track || "unassigned"
      )}</span>
    </li>
  `
    )
    .join("");
}

function exportSubmissionsJSON() {
  const local = getLocalList(LOCAL_SUBMISSIONS_KEY);
  const scores = getLocalList(LOCAL_SCORES_KEY);
  const payload = {
    exported_at: new Date().toISOString(),
    event: eventFormat?.event_name || "Build Finance Agents · London 2026",
    local_submissions: local,
    local_scores: scores,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bfa-london-2026-export-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${local.length} submissions, ${scores.length} scores`);
}

// ---------- Toasts ----------
function toast(message) {
  let el = document.getElementById("toast-stack");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-stack";
    el.style.cssText =
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
    document.body.appendChild(el);
  }
  const pill = document.createElement("div");
  pill.textContent = message;
  pill.style.cssText =
    "background:#1f2937;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:500;box-shadow:0 10px 25px rgba(17,24,39,.25);animation:modal-in .18s ease-out;";
  el.appendChild(pill);
  setTimeout(() => pill.remove(), 3500);
}

// ---------- Update submissions count after load ----------
function updateSubmissionsCount(rows) {
  const el = document.getElementById("submissions-count");
  if (el) el.textContent = rows.length;
}

document.addEventListener("DOMContentLoaded", () => {
  // Filter handlers
  ["filter-preT0", "filter-bulk", "filter-merge"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      renderSummaryTable(window.__summaryRows || []);
    });
  });
  document.getElementById("sort-select").addEventListener("change", () => {
    renderSummaryTable(window.__summaryRows || []);
  });

  // Modal open triggers
  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.openModal));
  });
  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => {
      const modal = el.closest(".modal");
      if (modal) closeModal(modal.id);
    });
  });

  // Submit + Judge forms
  const submitForm = document.getElementById("submit-form");
  if (submitForm) submitForm.addEventListener("submit", handleSubmitForm);
  const judgeForm = document.getElementById("judge-form");
  if (judgeForm) judgeForm.addEventListener("submit", handleJudgeForm);

  // Restore cached judge name + react to select/name changes in judge modal
  const nameInput = document.getElementById("judge-name-input");
  if (nameInput) {
    try {
      const cached = localStorage.getItem(LOCAL_JUDGE_NAME_KEY);
      if (cached) nameInput.value = cached;
    } catch {}
    nameInput.addEventListener("input", () => {
      try {
        localStorage.setItem(LOCAL_JUDGE_NAME_KEY, nameInput.value);
      } catch {}
      refreshJudgeSubmissionSelect();
    });
  }
  const judgeSelect = document.getElementById("judge-submission-select");
  if (judgeSelect)
    judgeSelect.addEventListener("change", renderJudgeSubmissionSummary);

  // Password gate
  applyAuthState();
  const passwordForm = document.getElementById("password-form");
  if (passwordForm) {
    passwordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = passwordForm.querySelector("input[name=password]");
      const errorEl = document.getElementById("password-error");
      const value = (input && input.value) || "";
      if (value === AUTH_CODE) {
        try {
          sessionStorage.setItem(AUTH_KEY, AUTH_CODE);
        } catch {}
        passwordForm.reset();
        if (errorEl) errorEl.textContent = "";
        applyAuthState();
        closeModal("password-modal");
        const next = pendingGatedModalId;
        pendingGatedModalId = null;
        if (next) setTimeout(() => openModal(next), 80);
        toast("Unlocked — judge + manager panels available");
      } else {
        if (errorEl) errorEl.textContent = "Wrong code. Try again.";
        if (input) {
          input.value = "";
          input.focus();
        }
      }
    });
  }

  // Drawer "Score this" button opens the judge modal pre-populated
  const drawerJudgeBtn = document.getElementById("drawer-judge-btn");
  if (drawerJudgeBtn) {
    drawerJudgeBtn.addEventListener("click", () => {
      const title = document.getElementById("detail-title").textContent.trim();
      closeDrawer();
      openModal("judge-modal");
      const select = document.getElementById("judge-submission-select");
      if (select) {
        const opt = Array.from(select.options).find(
          (o) => o.value === title || o.textContent.startsWith(title)
        );
        if (opt) select.value = opt.value;
      }
    });
  }

  const exportBtn = document.getElementById("export-submissions-btn");
  if (exportBtn) exportBtn.addEventListener("click", exportSubmissionsJSON);

  // Track cards act as filters — click Money Movement / Financial Intelligence to filter the table
  const trackCards = Array.from(document.querySelectorAll(".track-card"));
  const submissionsPanel = document.querySelector(".panel.full-width");
  trackCards.forEach((card) => {
    card.addEventListener("click", () => {
      const category = card.dataset.track || null;
      const isActive = window.__trackFilter === category;
      window.__trackFilter = isActive ? null : category;
      trackCards.forEach((c) => {
        const active = c.dataset.track === window.__trackFilter;
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderSummaryTable(window.__summaryRows || []);
      if (!isActive && submissionsPanel) {
        submissionsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Drawer close handlers
  document
    .getElementById("close-drawer")
    .addEventListener("click", closeDrawer);
  document
    .getElementById("drawer-overlay")
    .addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDrawer();
      document
        .querySelectorAll(".modal:not(.hidden)")
        .forEach((m) => closeModal(m.id));
    }
  });

  // Load event format + hacks + data
  loadHacks();
  loadEventFormat();
  loadSummary()
    .then(() => {
      updateSubmissionsCount(window.__summaryRows || []);
    })
    .catch((err) => {
      const tbody = document.querySelector("#summary-table tbody");
      tbody.innerHTML = `
      <tr>
        <td colspan="13">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div>Failed to load data: ${err.message}</div>
          </div>
        </td>
      </tr>
    `;
    });
});
