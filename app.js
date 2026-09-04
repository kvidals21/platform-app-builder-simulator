let questionsData = [];
let userAnswers = {};
let submittedQuestions = {};
let currentTab = 0;
let isExamMode = false;
let examTimerInterval = null;
let examTimeSeconds = 105 * 60;

const CATEGORIES = {
  1: "Security & Access",
  2: "Automation & Logic",
  3: "Data Management",
  4: "Sales & Service Apps",
  5: "UI & Analytics",
  6: "Deployment & Sandboxes"
};

document.addEventListener("DOMContentLoaded", () => {
  loadQuestionBank();
});

function checkPassword(e) {
  e.preventDefault();
  const input = document.getElementById("password-input").value;
  if (input === "Salesforce2026") {
    document.getElementById("password-overlay").classList.add("unlocked");
  } else {
    document.getElementById("password-error").style.display = "block";
    document.getElementById("password-error").innerText = "❌ Incorrect password. Try again.";
  }
}

async function loadQuestionBank() {
  try {
    const res = await fetch("questions.json");
    questionsData = await res.json();
    document.getElementById("loading-fill").style.width = "100%";
    setTimeout(() => {
      document.getElementById("loading-overlay").classList.add("hidden");
      initApp();
    }, 400);
  } catch (err) {
    console.error("Failed to load questions.json", err);
    document.getElementById("loading-status").innerText = "❌ Error loading question bank. Check questions.json file.";
  }
}

function initApp() {
  updateBadges();
  renderDashboard();
}

function updateBadges() {
  for (let i = 1; i <= 6; i++) {
    const count = questionsData.filter(q => q.category === i).length;
    const badge = document.getElementById(`badge-${i}`);
    if (badge) badge.innerText = count;
  }
  document.getElementById("badge-7").innerText = questionsData.length;
}

function switchTab(tabIndex) {
  currentTab = tabIndex;
  document.querySelectorAll(".tab-btn").forEach((btn, idx) => {
    btn.classList.toggle("active", idx === tabIndex);
  });

  if (tabIndex === 0) {
    document.getElementById("tab-0").classList.add("active");
    document.getElementById("tab-quiz").classList.remove("active");
    renderDashboard();
  } else {
    document.getElementById("tab-0").classList.remove("active");
    document.getElementById("tab-quiz").classList.add("active");
    renderQuizTab(tabIndex);
  }
}

function toggleMode(checked) {
  isExamMode = checked;
  document.getElementById("exam-timer").classList.toggle("hidden", !isExamMode);
  document.getElementById("submit-exam-btn").classList.toggle("hidden", !isExamMode);

  if (isExamMode) {
    startTimer();
  } else {
    clearInterval(examTimerInterval);
  }

  if (currentTab !== 0) switchTab(currentTab);
}

function startTimer() {
  clearInterval(examTimerInterval);
  examTimerInterval = setInterval(() => {
    if (examTimeSeconds <= 0) {
      clearInterval(examTimerInterval);
      submitFullExam();
      return;
    }
    examTimeSeconds--;
    const hrs = String(Math.floor(examTimeSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((examTimeSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(examTimeSeconds % 60).padStart(2, '0');
    document.getElementById("timer-text").innerText = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

function renderQuizTab(tabIndex) {
  let filtered = [];
  if (tabIndex === 7) {
    filtered = questionsData;
    document.getElementById("quiz-tab-title").innerText = "🎯 Full Exam Practice";
  } else {
    filtered = questionsData.filter(q => q.category === tabIndex);
    document.getElementById("quiz-tab-title").innerText = CATEGORIES[tabIndex] || "Quiz";
  }

  const container = document.getElementById("quiz-container");
  container.innerHTML = "";

  filtered.forEach((q, idx) => {
    container.appendChild(createQuestionCard(q, idx + 1));
  });

  updateQuizProgress(filtered);
}

function correctIndices(q) {
  if (q.multiSelect) {
    const s = new Set([q.correct, q.correct2]);
    if (q.correct3 !== undefined) s.add(q.correct3);
    return s;
  }
  return new Set([q.correct]);
}

function multiSelectCount(q) {
  if (!q.multiSelect) return 1;
  return q.correct3 !== undefined ? 3 : 2;
}

function isAnswerCorrect(q, answer) {
  if (q.multiSelect) {
    const needed = multiSelectCount(q);
    if (!Array.isArray(answer) || answer.length !== needed) return false;
    const corrSet = correctIndices(q);
    return answer.every(a => corrSet.has(a));
  }
  return answer === q.correct;
}

function createQuestionCard(q, displayNum) {
  const card = document.createElement("div");
  card.className = "question-card";
  card.id = `qcard-${q.id}`;
  if (submittedQuestions[q.id]) card.classList.add("submitted");

  const answer = userAnswers[q.id];
  const selectedSet = q.multiSelect
    ? new Set(Array.isArray(answer) ? answer : [])
    : new Set(answer !== undefined ? [answer] : []);
  const corrSet = correctIndices(q);

  const multiLabel = q.multiSelect
    ? `<span class="multi-select-label">Choose ${multiSelectCount(q)} answers</span>`
    : "";

  let optionsHTML = q.options.map((opt, i) => {
    const isSelected = selectedSet.has(i) ? "selected" : "";
    let extraClass = "";
    if (submittedQuestions[q.id] && !isExamMode) {
      if (corrSet.has(i)) extraClass = "correct-answer";
      else if (selectedSet.has(i)) extraClass = "user-wrong";
    }
    const inputType = q.multiSelect ? "checkbox" : "radio";
    return `
      <div class="option-item ${isSelected} ${extraClass}" onclick="selectOption(${q.id}, ${i})">
        <div class="option-radio option-${inputType}"></div>
        <div class="option-letter">${String.fromCharCode(65 + i)}</div>
        <div class="option-text">${opt}</div>
      </div>
    `;
  }).join("");

  const isSubmitted = submittedQuestions[q.id];
  const hasSelection = q.multiSelect
    ? Array.isArray(answer) && answer.length === multiSelectCount(q)
    : answer !== undefined;
  const submitDisabled = !hasSelection || isSubmitted ? "disabled" : "";

  card.innerHTML = `
    <div class="question-header">
      <div class="question-number">Q${displayNum}</div>
      <div class="question-text">${q.text}${multiLabel}</div>
    </div>
    <div class="options-list">${optionsHTML}</div>
    ${!isExamMode ? `
      <button class="btn-submit" id="btn-sub-${q.id}" ${submitDisabled} onclick="submitAnswer(${q.id})">
        ${isSubmitted ? "Submitted" : "Submit Answer"}
      </button>
      <div class="explanation-panel ${isSubmitted ? '' : 'hidden'}" id="exp-${q.id}">
        <h4>💡 Explanation</h4>
        <p>${q.explanation || "No detailed explanation available."}</p>
      </div>
    ` : ''}
  `;

  return card;
}

function selectOption(qid, optionIdx) {
  if (submittedQuestions[qid] && !isExamMode) return;

  const q = questionsData.find(item => item.id === qid);
  if (!q) return;

  if (q.multiSelect) {
    let current = Array.isArray(userAnswers[qid]) ? [...userAnswers[qid]] : [];
    const pos = current.indexOf(optionIdx);
    if (pos >= 0) {
      current.splice(pos, 1);
    } else if (current.length < multiSelectCount(q)) {
      current.push(optionIdx);
    }
    userAnswers[qid] = current;

    const card = document.getElementById(`qcard-${qid}`);
    if (card) {
      const items = card.querySelectorAll(".option-item");
      items.forEach((item, idx) => {
        item.classList.toggle("selected", current.includes(idx));
      });
      const btn = card.querySelector(".btn-submit");
      if (btn && !submittedQuestions[qid]) btn.disabled = current.length < multiSelectCount(q);
    }
  } else {
    userAnswers[qid] = optionIdx;

    const card = document.getElementById(`qcard-${qid}`);
    if (card) {
      const items = card.querySelectorAll(".option-item");
      items.forEach((item, idx) => {
        item.classList.toggle("selected", idx === optionIdx);
      });
      const btn = card.querySelector(".btn-submit");
      if (btn && !submittedQuestions[qid]) btn.disabled = false;
    }
  }

  updateGlobalMatrix();
}

function submitAnswer(qid) {
  submittedQuestions[qid] = true;
  const q = questionsData.find(item => item.id === qid);
  const card = document.getElementById(`qcard-${qid}`);

  if (card && q) {
    card.classList.add("submitted");
    const answer = userAnswers[qid];
    const corrSet = correctIndices(q);
    const selectedSet = q.multiSelect
      ? new Set(Array.isArray(answer) ? answer : [])
      : new Set(answer !== undefined ? [answer] : []);

    const items = card.querySelectorAll(".option-item");
    items.forEach((item, idx) => {
      if (corrSet.has(idx)) item.classList.add("correct-answer");
      else if (selectedSet.has(idx)) item.classList.add("user-wrong");
    });

    const exp = card.querySelector(".explanation-panel");
    if (exp) exp.classList.remove("hidden");

    const btn = card.querySelector(".btn-submit");
    if (btn) {
      btn.innerText = "Submitted";
      btn.disabled = true;
    }
  }

  updateGlobalMatrix();
}

function updateGlobalMatrix() {
  const total = questionsData.length;
  const answered = Object.keys(userAnswers).length;

  let correctCount = 0;
  Object.keys(userAnswers).forEach(qid => {
    const q = questionsData.find(item => item.id == qid);
    if (q && isAnswerCorrect(q, userAnswers[qid])) correctCount++;
  });

  const percentage = answered > 0 ? ((correctCount / answered) * 100).toFixed(1) : "0.0";
  const isPassing = parseFloat(percentage) >= 65.0;

  document.getElementById("val-progress").innerText = `${answered}/${total}`;
  document.getElementById("val-score").innerText = `${percentage}%`;

  const statusPill = document.getElementById("pill-status");
  const valStatus = document.getElementById("val-status");

  if (isPassing) {
    statusPill.className = "score-pill passing";
    valStatus.innerText = "Passing (≥65%)";
  } else {
    statusPill.className = "score-pill failing";
    valStatus.innerText = "Not Passing";
  }

  document.getElementById("dash-answered").innerText = answered;
  document.getElementById("dash-correct").innerText = correctCount;
  document.getElementById("dash-score").innerText = `${percentage}%`;
}

function renderDashboard() {
  updateGlobalMatrix();
  const list = document.getElementById("category-progress-list");
  list.innerHTML = "";

  for (let catId = 1; catId <= 6; catId++) {
    const catQuestions = questionsData.filter(q => q.category === catId);
    const catTotal = catQuestions.length;
    let catAnswered = 0;
    let catCorrect = 0;

    catQuestions.forEach(q => {
      const ans = userAnswers[q.id];
      const hasAns = q.multiSelect
        ? Array.isArray(ans) && ans.length === multiSelectCount(q)
        : ans !== undefined;
      if (hasAns) {
        catAnswered++;
        if (isAnswerCorrect(q, ans)) catCorrect++;
      }
    });

    const pct = catTotal > 0 ? Math.round((catAnswered / catTotal) * 100) : 0;

    list.innerHTML += `
      <div class="cat-progress-item">
        <div class="cp-label">${CATEGORIES[catId]}</div>
        <div class="cp-bar">
          <div class="cp-fill" style="width: ${pct}%; background: var(--primary);"></div>
        </div>
        <div class="cp-text">${pct}% Complete (${catAnswered}/${catTotal}) · ${catCorrect} Correct</div>
      </div>
    `;
  }
}

function updateQuizProgress(filtered) {
  const answered = filtered.filter(q => {
    const ans = userAnswers[q.id];
    if (q.multiSelect) return Array.isArray(ans) && ans.length === multiSelectCount(q);
    return ans !== undefined;
  }).length;
  document.getElementById("quiz-progress-text").innerText = `${answered} / ${filtered.length} Answered`;
}

function shuffleActiveTab() {
  if (currentTab === 0) return;
  for (let i = questionsData.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questionsData[i], questionsData[j]] = [questionsData[j], questionsData[i]];
  }
  switchTab(currentTab);
}

function submitFullExam() {
  isExamMode = false;
  document.getElementById("mode-toggle").checked = false;
  Object.keys(userAnswers).forEach(qid => {
    submittedQuestions[qid] = true;
  });
  toggleMode(false);
  switchTab(0);
}
