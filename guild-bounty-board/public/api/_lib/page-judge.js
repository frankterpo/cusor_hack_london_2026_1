module.exports = `
  <header>
    <div class="logo-block">
      <div class="logo">Cursor Guild Judge Portal</div>
      <div class="meta">Score projects on the 100 + 30 model</div>
    </div>
    <div class="header-links">
      <a class="board-link" href="/">Hack Board</a>
      <a class="board-link" href="/admin">Hack Manager</a>
    </div>
  </header>

  <main class="judge-main">
    <section class="panel full-width">
      <div class="panel-header">
        <h2>Submit A Judge Score</h2>
      </div>
      <div class="judge-layout">
        <div class="judge-column">
          <div class="section">
            <h3>Judge</h3>
            <div class="box">
              <label class="field">
                <span>Judge Name</span>
                <input id="judge-name" type="text" placeholder="Your name">
              </label>
            </div>
          </div>

          <div class="section">
            <h3>Select Submission</h3>
            <div class="box">
              <label class="field">
                <span>Project</span>
                <select id="submission-select"></select>
              </label>
              <div id="submission-summary" class="submission-summary"></div>
            </div>
          </div>
        </div>

        <div class="judge-column judge-column-wide">
          <div class="section">
            <h3>Main Track Score</h3>
            <div id="core-fields" class="box form-grid"></div>
          </div>

          <div class="section">
            <h3>Judge Bonus Bucket</h3>
            <div id="bonus-fields" class="box form-grid"></div>
            <div class="score-callout" id="bonus-counter">
              Bonus Bucket 0/30
            </div>
            <div class="score-callout">
              Combined side-quest bonus is capped at <strong>30</strong>.
            </div>
          </div>

          <div class="section">
            <h3>Notes</h3>
            <div class="box">
              <label class="field">
                <span>Optional Notes</span>
                <textarea id="judge-notes" rows="5" placeholder="Anything judges or organizers should know"></textarea>
              </label>
            </div>
          </div>

          <div class="section">
            <div class="box totals-box">
              <div id="totals-output" class="totals-output">Core 0/100 &bull; Bonus 0/30 &bull; Total 0/130</div>
              <button id="submit-score" class="action-button">Submit Score</button>
              <div id="submit-status" class="status-text"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
`;
