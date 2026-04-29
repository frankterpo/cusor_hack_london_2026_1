let judgeConfig = null;
let submissions = [];
let judgedRepoKeys = new Set();

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function renderScoreFields() {
  const coreContainer = document.getElementById("core-fields");
  const bonusContainer = document.getElementById("bonus-fields");
  const selectedSubmission = getSelectedSubmission();
  const selectedTrack = selectedSubmission?.chosen_track || "";

  const otherCount = Math.max(0, judgeConfig.main_tracks.length - 1);
  const othersPhrase =
    otherCount <= 0
      ? ""
      : otherCount === 1
        ? "The other track is shown only for context."
        : `The other ${otherCount} tracks are shown only for context.`;
  const trackBoard = `
    <div class="track-board">
      ${judgeConfig.main_tracks.map((track) => `
        <article class="track-card ${selectedTrack === track.name ? "track-card--active" : "track-card--inactive"}" data-track-name="${escapeHtml(track.name)}">
          <div class="track-card-title">${escapeHtml(track.name)}</div>
          <div class="track-card-label">${escapeHtml(track.label || "")}</div>
          <div class="track-card-copy">${escapeHtml(track.description || "")}</div>
        </article>
      `).join("")}
    </div>
    <div class="track-guidance">The competitor submission determines the main track. Judges score only that track out of 100. ${othersPhrase}</div>
    <div class="track-score-panel">
      <div class="track-score-title">Selected Main Track: ${escapeHtml(selectedTrack || "Track not selected")}</div>
      <div class="track-score-copy">Give one overall main-track score out of 100 for the submitted road.</div>
      <div id="main-track-counter" class="track-score-counter track-score-counter--ok">Main Track Score 0/100</div>
      <input class="track-score-input core-score" id="main-track-score" type="number" min="0" max="${judgeConfig.rubric.core_max_points}" value="0" data-id="main_track_total">
    </div>
  `;

  coreContainer.innerHTML = trackBoard;

  bonusContainer.innerHTML = judgeConfig.side_quests.map((quest) => {
    const cap = Number.isFinite(quest.points) ? quest.points : judgeConfig.judge_bonus_bucket.max_points;
    return `
    <div class="score-item">
      <label for="${quest.id}">${escapeHtml(quest.name)}</label>
      <small>0-${cap}</small>
      <input class="score-input bonus-score" id="${quest.id}" type="number" min="0" max="${cap}" value="0" data-id="${quest.id}">
    </div>
  `;
  }).join("");
}

function renderSubmissions() {
  const select = document.getElementById("submission-select");
  select.innerHTML = submissions.map((submission) => {
    const repoKey = (submission.repo_url || "").trim().replace(/\.git$/i, "").toLowerCase();
    const judged = judgedRepoKeys.has(repoKey);
    const label = (submission.project_name || submission.repo_url) + (judged ? " [SCORED]" : "");
    return `<option value="${escapeHtml(submission.repo_url)}">${escapeHtml(label)}</option>`;
  }).join("");
  renderScoreFields();
  renderSubmissionSummary();
}

function getSelectedSubmission() {
  const repoUrl = document.getElementById("submission-select").value;
  return submissions.find((submission) => submission.repo_url === repoUrl) || null;
}

function renderSubmissionSummary() {
  const submission = getSelectedSubmission();
  const target = document.getElementById("submission-summary");
  if (!submission) {
    target.innerHTML = "No submissions available yet.";
    return;
  }
  target.innerHTML = `
    <div><strong>${escapeHtml(submission.project_name || "Untitled Project")}</strong></div>
    <div>Team ${escapeHtml(submission.team_name || "Unknown")}</div>
    <div>Main Track: ${escapeHtml(submission.chosen_track || "Track not selected")}</div>
    <div class="submission-links">
      <a class="repo-link" href="${escapeHtml(submission.repo_url)}" target="_blank" rel="noreferrer">Repo</a>
      ${submission.demo_url ? `<a class="repo-link" href="${escapeHtml(submission.demo_url)}" target="_blank" rel="noreferrer">Demo</a>` : ""}
    </div>
  `;
}

function getScoreValue(selector) {
  return Array.from(document.querySelectorAll(selector)).reduce((sum, input) => {
    const value = Number.parseInt(input.value || "0", 10);
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);
}

function getValidationState() {
  const coreRaw = getScoreValue(".core-score");
  const bonusRaw = getScoreValue(".bonus-score");
  return {
    coreRaw,
    bonusRaw,
    coreValid: coreRaw <= judgeConfig.rubric.core_max_points,
    bonusValid: bonusRaw <= judgeConfig.judge_bonus_bucket.max_points,
  };
}

function updateTotals() {
  const { coreRaw, bonusRaw, coreValid, bonusValid } = getValidationState();
  const cappedBonus = Math.min(bonusRaw, judgeConfig.judge_bonus_bucket.max_points);

  document.getElementById("totals-output").textContent = `Core ${coreRaw}/100 • Bonus ${cappedBonus}/30 • Total ${coreRaw + cappedBonus}/130`;

  const mainCounter = document.getElementById("main-track-counter");
  mainCounter.textContent = `Main Track Score ${coreRaw}/100`;
  mainCounter.className = `track-score-counter ${coreValid ? "track-score-counter--ok" : "track-score-counter--error"}`;

  const bonusCounter = document.getElementById("bonus-counter");
  bonusCounter.textContent = `Bonus Bucket ${bonusRaw}/30`;
  bonusCounter.className = `score-callout ${bonusValid ? "score-callout--ok" : "score-callout--error"}`;
}

function setSubmitStatus(message, isError = false) {
  const status = document.getElementById("submit-status");
  status.textContent = message;
  status.classList.toggle("status-text--error", isError);
  status.classList.toggle("status-text--success", !isError && Boolean(message));
}

function collectScores(selector) {
  const payload = {};
  document.querySelectorAll(selector).forEach((input) => {
    payload[input.dataset.id] = Number.parseInt(input.value || "0", 10) || 0;
  });
  return payload;
}

async function submitJudgeScore() {
  const judgeName = document.getElementById("judge-name").value.trim();
  const submission = getSelectedSubmission();
  const { coreRaw, bonusRaw, coreValid, bonusValid } = getValidationState();

  if (!judgeName) {
    setSubmitStatus("Enter your judge name.", true);
    return;
  }
  if (!submission) {
    setSubmitStatus("No submission selected.", true);
    return;
  }
  if (!coreValid) {
    setSubmitStatus(`Main track score cannot exceed 100. Current value: ${coreRaw}.`, true);
    return;
  }
  if (!bonusValid) {
    setSubmitStatus(`Judge bonus bucket cannot exceed 30 total. Current value: ${bonusRaw}.`, true);
    return;
  }

  setSubmitStatus("Submitting...");

  const response = await fetch("/api/judges", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      judge_name: judgeName,
      repo_url: submission.repo_url,
      project_name: submission.project_name,
      chosen_track: submission.chosen_track,
      scored_track: submission.chosen_track,
      core_total: Number.parseInt(document.getElementById("main-track-score")?.value || "0", 10) || 0,
      notes: document.getElementById("judge-notes").value.trim(),
      bonus_bucket_scores: collectScores(".bonus-score"),
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    setSubmitStatus(payload.error || "Failed to submit score.", true);
    return;
  }

  // Cache judge name and mark as judged
  localStorage.setItem("judge_name", judgeName);
  judgedRepoKeys.add((submission.repo_url || "").trim().replace(/\.git$/i, "").toLowerCase());

  setSubmitStatus("Score submitted! Ready for next project.");

  // Reset form but keep judge name
  document.querySelectorAll(".bonus-score").forEach(input => { input.value = "0"; });
  const mainTrackInput = document.getElementById("main-track-score");
  if (mainTrackInput) mainTrackInput.value = "0";
  document.getElementById("judge-notes").value = "";
  updateTotals();

  // Update dropdown to show [SCORED] and move to next
  renderSubmissions();
  const select = document.getElementById("submission-select");
  if (select.selectedIndex < select.options.length - 1) {
    select.selectedIndex += 1;
    renderScoreFields();
    renderSubmissionSummary();
    updateTotals();
  }
}

async function loadPage() {
  judgeConfig = await fetchJson("/judge-config.json");
  const submissionsPayload = await fetchJson("/api/submissions");
  submissions = submissionsPayload.submissions || [];
  renderSubmissions();
  updateTotals();

  // Restore cached judge name and load their existing scores
  const cachedName = localStorage.getItem("judge_name");
  if (cachedName) {
    document.getElementById("judge-name").value = cachedName;
  }

  try {
    const judgeData = await fetchJson("/api/judges");
    const judgeName = (cachedName || "").trim().toLowerCase();
    if (judgeName && judgeData.responses) {
      for (const r of judgeData.responses) {
        if ((r.judge_name || "").trim().toLowerCase() === judgeName) {
          judgedRepoKeys.add((r.repo_url || "").trim().replace(/\.git$/i, "").toLowerCase());
        }
      }
      renderSubmissions();
    }
  } catch (_) {}

  const handleScoreInput = (event) => {
    if (event.target.classList.contains("score-input") || event.target.classList.contains("track-score-input") || event.target.classList.contains("core-score")) {
      updateTotals();
    }
  };
  document.addEventListener("input", handleScoreInput);
  document.addEventListener("change", handleScoreInput);
  document.getElementById("submission-select").addEventListener("change", () => {
    renderScoreFields();
    renderSubmissionSummary();
    updateTotals();
  });
  document.getElementById("submit-score").addEventListener("click", submitJudgeScore);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    loadPage().catch((error) => {
      document.getElementById("submit-status").textContent = error.message;
    });
  });
} else {
  loadPage().catch((error) => {
    document.getElementById("submit-status").textContent = error.message;
  });
}
