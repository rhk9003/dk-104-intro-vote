(function () {
  "use strict";

  const { el, renderBlocks, charCount, readTime, label } = window.DKV;
  const CFG = window.VOTE_CONFIG;
  const VERSIONS = window.VERSIONS;
  const MAX = CFG.maxPicks;
  const STORE_KEY = "dk-104-intro-vote.v1";

  // ── 本機暫存（只是方便，讀寫失敗也能正常用） ──
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無痕模式等情況，略過 */ }
  }

  const saved = load();
  const validKeys = new Set(VERSIONS.map(v => v.key));
  const state = {
    dept: saved.dept || "",
    name: saved.name || "",
    picks: (saved.picks || []).filter(k => validKeys.has(k)).slice(0, MAX),
    notes: saved.notes || {},
    overall: saved.overall || "",
    order: saved.order || null,
  };

  // 每台電腦第一次打開時打亂一次順序，之後固定，避免「排第一個的比較容易被選」
  if (!state.order || state.order.length !== VERSIONS.length || !state.order.every(k => validKeys.has(k))) {
    const keys = VERSIONS.map(v => v.key);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    state.order = keys;
    save();
  }
  const byKey = k => VERSIONS.find(v => v.key === k);
  const ordered = state.order.map(byKey);

  const $ = sel => document.querySelector(sel);
  const steps = { who: $("#step-who"), vote: $("#step-vote"), done: $("#step-done") };
  function show(step) {
    Object.entries(steps).forEach(([k, n]) => { n.hidden = k !== step; });
    window.scrollTo(0, 0);
  }

  $("#total").textContent = VERSIONS.length;

  // ── 步驟一 ──
  $("#dept").value = state.dept;
  $("#name").value = state.name;
  $("#who-form").addEventListener("submit", e => {
    e.preventDefault();
    const dept = $("#dept").value.trim();
    const name = $("#name").value.trim();
    if (!dept || !name) {
      $("#who-msg").textContent = !dept ? "請填所屬部門。" : "請填姓名。";
      (!dept ? $("#dept") : $("#name")).focus();
      return;
    }
    $("#who-msg").textContent = "";
    // 換人用同一台電腦時，不要沿用上一個人的選擇和建議
    if ((state.dept || state.name) && (state.dept !== dept || state.name !== name)) {
      state.picks = []; state.notes = {}; state.overall = "";
      VERSIONS.forEach(v => { const ta = document.getElementById("note-" + v.key); if (ta) ta.value = ""; });
      $("#overall").value = "";
      renderPicks(); renderSummary();
    }
    state.dept = dept; state.name = name; save();
    $("#voter-label").textContent = dept + "・" + name;
    show("vote");
  });
  $("#edit-who").addEventListener("click", () => show("who"));

  // ── 版本卡 ──
  const cards = {};
  function buildCards() {
    const jump = $("#jump");
    const root = $("#versions");
    ordered.forEach(v => {
      const n = charCount(v.blocks);
      jump.appendChild(el("a", { href: "#v-" + v.key }, [el("b", { text: v.letter }), " " + v.name, el("small", { text: n.toLocaleString() + " 字" })]));

      const pickBtn = el("button", { type: "button", class: "pick", "aria-pressed": "false" });
      const ta = el("textarea", { id: "note-" + v.key, maxlength: "2000", placeholder: "例：開頭太長、這句求職者看不懂、想保留創辦人蹲下試鞋那段…" });
      ta.value = state.notes[v.key] || "";
      const li = el("li", { class: "version", id: "v-" + v.key }, [
        el("div", { class: "version-head" }, [
          el("span", { class: "letter", text: v.letter }),
          el("h2", { text: v.name }),
          el("span", { class: "meta", text: n.toLocaleString() + " 字・" + readTime(n) }),
        ]),
        renderBlocks(v.blocks),
        el("div", { class: "version-foot" }, [
          pickBtn,
          el("label", { class: "note", for: "note-" + v.key }, [el("span", { text: "對 " + v.letter + " 版的修改建議（選填）" })]),
          ta,
        ]),
      ]);
      pickBtn.addEventListener("click", () => togglePick(v.key));
      let t;
      ta.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (ta.value.trim()) state.notes[v.key] = ta.value; else delete state.notes[v.key];
          save(); renderSummary();
        }, 300);
      });
      cards[v.key] = { li, pickBtn };
      root.appendChild(li);
    });

    const cur = window.CURRENT_VERSION;
    if (cur) {
      const n = charCount(cur.blocks);
      $("#current").replaceChildren(el("p", { class: "meta", text: n.toLocaleString() + " 字・" + readTime(n) }), renderBlocks(cur.blocks));
    } else {
      document.querySelector(".current").hidden = true;
    }
  }

  let hintTimer;
  function hint(msg) {
    const h = $("#bar-hint");
    h.textContent = msg;
    clearTimeout(hintTimer);
    if (msg) hintTimer = setTimeout(() => { h.textContent = ""; }, 4000);
  }

  function togglePick(key) {
    const i = state.picks.indexOf(key);
    if (i >= 0) state.picks.splice(i, 1);
    else if (MAX === 1) state.picks = [key];          // 只能選一版：直接換成這版
    else if (state.picks.length >= MAX) { hint("最多選 " + MAX + " 版，先取消一版再選這版。"); return; }
    else state.picks.push(key);
    hint("");
    save(); renderPicks(); renderSummary();
  }

  function renderPicks() {
    VERSIONS.forEach(v => {
      const c = cards[v.key]; if (!c) return;
      const on = state.picks.includes(v.key);
      c.pickBtn.setAttribute("aria-pressed", on ? "true" : "false");
      c.pickBtn.textContent = on ? "已選 " + v.letter + " 版（再按一次取消）" : "選這版放上 104";
      c.li.classList.toggle("is-picked", on);
    });
    $("#pick-status").textContent = state.picks.length
      ? "已選：" + state.picks.map(k => label(byKey(k))).join("、")
      : "還沒選";
  }

  function summaryNode(picks, notes, overall) {
    const frag = document.createDocumentFragment();
    frag.appendChild(el("p", { class: "muted", text: "選的版本" }));
    const ul = el("ul", { class: "summary-list" });
    if (picks.length) picks.forEach(k => ul.appendChild(el("li", {}, [el("b", { text: label(byKey(k)) })])));
    else ul.appendChild(el("li", { text: "還沒選" }));
    frag.appendChild(ul);
    const noteKeys = state.order.filter(k => (notes[k] || "").trim());
    frag.appendChild(el("p", { class: "muted", text: "修改建議：" + (noteKeys.length ? noteKeys.length + " 版有寫" : "沒有寫") }));
    if (noteKeys.length) {
      const nl = el("ul", { class: "summary-list" });
      noteKeys.forEach(k => nl.appendChild(el("li", {}, [el("b", { text: byKey(k).letter + " 版：" }), notes[k].trim()])));
      frag.appendChild(nl);
    }
    if ((overall || "").trim()) {
      frag.appendChild(el("p", { class: "muted", text: "整體建議" }));
      frag.appendChild(el("p", { class: "summary-quote", text: overall.trim() }));
    }
    return frag;
  }
  function renderSummary() {
    $("#summary").replaceChildren(summaryNode(state.picks, state.notes, state.overall));
  }

  const overallTa = $("#overall");
  overallTa.value = state.overall;
  let ot;
  overallTa.addEventListener("input", () => {
    clearTimeout(ot);
    ot = setTimeout(() => { state.overall = overallTa.value; save(); renderSummary(); }, 300);
  });

  // ── 送出 ──
  let sending = false;
  async function submit() {
    if (sending) return;
    // 打字後 300 毫秒內就按送出時，先把畫面上的內容收進來
    state.overall = overallTa.value;
    VERSIONS.forEach(v => {
      const ta = document.getElementById("note-" + v.key);
      if (ta && ta.value.trim()) state.notes[v.key] = ta.value; else delete state.notes[v.key];
    });
    save();

    const msg = $("#submit-msg");
    if (!state.picks.length) {
      msg.textContent = "請先選一個版本才能送出。";
      hint("請先選一個版本才能送出。");
      msg.scrollIntoView({ block: "center" });
      return;
    }
    if (!CFG.scriptUrl) {
      msg.textContent = "投票還沒開放：管理者還沒接上收票的試算表。你填的內容已經存在這台電腦，開放後回來直接按送出就好。";
      msg.scrollIntoView({ block: "center" });
      return;
    }
    const notes = {};
    Object.keys(state.notes).forEach(k => { const t = (state.notes[k] || "").trim(); if (t && validKeys.has(k)) notes[k] = t; });
    const labels = {};
    VERSIONS.forEach(v => { labels[v.key] = label(v); });
    const payload = { action: "vote", dept: state.dept, name: state.name, picks: state.picks.slice(), notes, overall: state.overall.trim(), labels };

    sending = true;
    setSending(true);
    msg.textContent = "";
    try {
      const res = await fetch(CFG.scriptUrl, { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "試算表沒有收下這筆投票");
      $("#done-summary").replaceChildren(summaryNode(payload.picks, notes, payload.overall));
      show("done");
    } catch (err) {
      msg.textContent = "送出失敗（" + err.message + "）。請檢查網路後再按一次送出；你填的內容都還在。";
      msg.scrollIntoView({ block: "center" });
    } finally {
      sending = false;
      setSending(false);
    }
  }
  function setSending(on) {
    ["#submit-top", "#submit-bottom"].forEach(s => {
      const b = $(s); b.disabled = on; b.textContent = on ? "送出中…" : "送出投票";
    });
  }
  $("#submit-top").addEventListener("click", submit);
  $("#submit-bottom").addEventListener("click", submit);
  $("#back-to-vote").addEventListener("click", () => show("vote"));

  // ── 開場 ──
  buildCards();
  renderPicks();
  renderSummary();
  show("who");
})();
