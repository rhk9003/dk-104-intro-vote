// 管理頁：輸入密碼後拿到每一筆送出（含姓名），在這裡統計
(function () {
  "use strict";

  const { el, label, fmtTime } = window.DKV;
  const CFG = window.VOTE_CONFIG;
  const VERSIONS = window.VERSIONS;
  const PW_KEY = "dk-104-intro-vote.results-pw";
  const $ = s => document.querySelector(s);
  const stat = (n, t) => el("div", { class: "stat" }, [el("b", { text: String(n) }), el("span", { text: t })]);
  const byKey = k => VERSIONS.find(v => v.key === k);
  const who = p => String(p.dept).trim() + "|" + String(p.name).trim();

  let password = "";
  try { password = sessionStorage.getItem(PW_KEY) || ""; } catch (e) { /* 略過 */ }

  async function fetchRows() {
    if (!CFG.scriptUrl) throw new Error("還沒設定收票網址（config.js 的 scriptUrl）");
    const res = await fetch(CFG.scriptUrl, { method: "POST", body: JSON.stringify({ action: "results", password }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "讀不到資料");
    return data.rows;
  }

  // 同一個人（部門＋姓名）只取最後一次送出
  function latestPerPerson(rows) {
    const map = new Map();
    rows.slice().sort((a, b) => String(a.t).localeCompare(String(b.t))).forEach(r => map.set(who(r), r));
    return [...map.values()];
  }

  function render(rows) {
    const people = latestPerPerson(rows);
    const tally = new Map(VERSIONS.map(v => [v.key, []]));
    people.forEach(p => (p.picks || []).forEach(k => { if (tally.has(k)) tally.get(k).push(p); }));

    const noteCount = people.reduce((n, p) => n + Object.keys(p.notes || {}).length + (p.overall ? 1 : 0), 0);
    $("#stats").replaceChildren(stat(people.length, "人投票"), stat(rows.length, "次送出"), stat(noteCount, "則建議"));
    const depts = new Map();
    people.forEach(p => depts.set(p.dept, (depts.get(p.dept) || 0) + 1));
    $("#depts").replaceChildren(...[...depts.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => el("li", { text: d + " " + n + " 人" })));

    // 排行＋各版建議（含姓名）
    const ranked = VERSIONS.slice().sort((a, b) => tally.get(b.key).length - tally.get(a.key).length || a.letter.localeCompare(b.letter));
    const top = Math.max(1, ...ranked.map(v => tally.get(v.key).length));
    let lastN = null, pos = 0;
    $("#rank").replaceChildren(...ranked.map((v, i) => {
      const voters = tally.get(v.key);
      const n = voters.length;
      if (n !== lastN) { pos = i + 1; lastN = n; }
      const pct = people.length ? Math.round(n / people.length * 100) : 0;
      const notes = people.filter(p => (p.notes || {})[v.key]);
      return el("li", { class: n > 0 && pos === 1 ? "is-top" : "" }, [
        el("div", { class: "rank-head" }, [el("span", { class: "rank-pos", text: n ? "第 " + pos + " 名" : "未得票" }), el("h3", { text: label(v) })]),
        el("div", { class: "meter" }, [
          el("div", { class: "bar" }, [el("div", { class: "fill", style: "width:" + (n / top * 100) + "%" })]),
          el("span", { class: "n", text: n + " 票・" + pct + "%" }),
        ]),
        n ? el("p", { class: "by-dept", text: "投給這版：" + voters.map(p => p.dept + " " + p.name).join("、") }) : null,
        el("div", { class: "notes" }, [
          el("p", { class: "notes-title", text: notes.length ? "修改建議（" + notes.length + " 則）" : "還沒有修改建議" }),
          notes.length ? el("ul", {}, notes.map(p => el("li", {}, [
            el("span", { class: "by", text: p.dept + " " + p.name + ((p.picks || []).includes(v.key) ? "・有投這版" : "") }), p.notes[v.key],
          ]))) : null,
        ]),
      ]);
    }));

    const overall = people.filter(p => p.overall);
    $("#overall").replaceChildren(overall.length
      ? el("ul", {}, overall.map(p => el("li", {}, [
          el("span", { class: "by", text: p.dept + " " + p.name + ((p.picks || []).length ? "・投 " + p.picks.map(k => (byKey(k) || {}).letter || k).join("、") + " 版" : "") }), p.overall,
        ])))
      : el("p", { class: "muted", text: "還沒有整體建議。" }));

    // 名單
    const sendCount = new Map();
    rows.forEach(r => sendCount.set(who(r), (sendCount.get(who(r)) || 0) + 1));
    const roster = people.slice().sort((a, b) => String(b.t).localeCompare(String(a.t)));
    $("#roster").replaceChildren(...(roster.length ? roster.map(p => {
      const times = sendCount.get(who(p)) || 1;
      const nNotes = Object.keys(p.notes || {}).length + (p.overall ? 1 : 0);
      return el("tr", {}, [
        el("td", { class: "num", text: fmtTime(p.t) + (times > 1 ? "（送了 " + times + " 次）" : "") }),
        el("td", { text: p.dept }),
        el("td", { text: p.name }),
        el("td", { text: (p.picks || []).map(k => byKey(k)).filter(Boolean).map(label).join("、") || "—" }),
        el("td", { class: "num", text: nNotes ? nNotes + " 則" : "—" }),
      ]);
    }) : [el("tr", {}, [el("td", { colspan: "5", class: "muted", text: "還沒有人投票。" })])]));

    $("#updated").textContent = "更新時間 " + new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  }

  async function loadAndRender() {
    const btn = $("#refresh");
    btn.disabled = true; btn.textContent = "讀取中…";
    try {
      render(await fetchRows());
      $("#pw-form").hidden = true;
      $("#results").hidden = false;
    } catch (err) {
      $("#pw-form").hidden = false;
      $("#results").hidden = true;
      $("#pw-msg").textContent = err.message === "密碼不對" ? "密碼不對，請再確認一次。" : "讀取失敗：" + err.message;
    } finally {
      btn.disabled = false; btn.textContent = "重新整理";
    }
  }

  $("#pw-form").addEventListener("submit", e => {
    e.preventDefault();
    password = $("#pw").value;
    if (!password) { $("#pw-msg").textContent = "請輸入密碼。"; return; }
    $("#pw-msg").textContent = "";
    try { sessionStorage.setItem(PW_KEY, password); } catch (err) { /* 略過 */ }
    loadAndRender();
  });
  $("#refresh").addEventListener("click", loadAndRender);

  if (password) loadAndRender();
})();
