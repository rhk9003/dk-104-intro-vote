// 公開結果頁：Apps Script 先統計好，只拿得到票數、部門和建議原文，拿不到姓名
(function () {
  "use strict";

  const { el, label } = window.DKV;
  const CFG = window.VOTE_CONFIG;
  const VERSIONS = window.VERSIONS;
  const $ = s => document.querySelector(s);

  const sortedDepts = obj => Object.entries(obj || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"));
  const stat = (n, t) => el("div", { class: "stat" }, [el("b", { text: String(n) }), el("span", { text: t })]);
  const byKey = k => VERSIONS.find(v => v.key === k);

  function render(data) {
    const voters = data.voters || 0;
    const res = data.versions || {};
    const get = k => res[k] || { votes: 0, depts: {}, notes: [] };
    const overall = data.overall || [];
    const noteCount = VERSIONS.reduce((n, v) => n + get(v.key).notes.length, 0) + overall.length;
    const depts = sortedDepts(data.depts);

    $("#stats").replaceChildren(stat(voters, "人投票"), stat(depts.length, "個部門參與"), stat(noteCount, "則建議"));
    $("#depts").replaceChildren(...depts.map(([d, n]) => el("li", { text: d + " " + n + " 人" })));

    const ranked = VERSIONS.slice().sort((a, b) => get(b.key).votes - get(a.key).votes || a.letter.localeCompare(b.letter));
    const top = Math.max(1, ...ranked.map(v => get(v.key).votes));
    let lastN = null, pos = 0;
    $("#rank").replaceChildren(...ranked.map((v, i) => {
      const r = get(v.key);
      if (r.votes !== lastN) { pos = i + 1; lastN = r.votes; }
      const pct = voters ? Math.round(r.votes / voters * 100) : 0;
      const dc = sortedDepts(r.depts);
      return el("li", { class: r.votes > 0 && pos === 1 ? "is-top" : "" }, [
        el("div", { class: "rank-head" }, [
          el("span", { class: "rank-pos", text: r.votes ? "第 " + pos + " 名" : "未得票" }),
          el("h3", { text: label(v) }),
        ]),
        el("div", { class: "meter" }, [
          el("div", { class: "bar" }, [el("div", { class: "fill", style: "width:" + (r.votes / top * 100) + "%" })]),
          el("span", { class: "n", text: r.votes + " 票・" + pct + "%" }),
        ]),
        dc.length ? el("p", { class: "by-dept", text: "投票部門：" + dc.map(([d, n]) => d + " " + n).join("、") }) : null,
        el("div", { class: "notes" }, [
          el("p", { class: "notes-title", text: r.notes.length ? "修改建議（" + r.notes.length + " 則）" : "還沒有修改建議" }),
          r.notes.length ? el("ul", {}, r.notes.map(n => el("li", {}, [
            el("span", { class: "by", text: n.dept + (n.picked ? "・有投這版" : "") }), n.text,
          ]))) : null,
        ]),
      ]);
    }));

    $("#overall").replaceChildren(overall.length
      ? el("ul", {}, overall.map(n => el("li", {}, [
          el("span", { class: "by", text: n.dept + (n.picks && n.picks.length ? "・投 " + n.picks.map(k => (byKey(k) || {}).letter || k).join("、") + " 版" : "") }), n.text,
        ])))
      : el("p", { class: "muted", text: "還沒有整體建議。" }));

    const d = new Date(data.updated || Date.now());
    $("#updated").textContent = "更新時間 " + d.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  async function load() {
    const btn = $("#refresh");
    btn.disabled = true; btn.textContent = "讀取中…";
    $("#board-msg").textContent = "";
    try {
      if (!CFG.scriptUrl) throw new Error("還沒接上收票的試算表");
      const res = await fetch(CFG.scriptUrl, { method: "POST", body: JSON.stringify({ action: "public" }) });
      const data = await res.json();
      if (!data.ok || typeof data.voters !== "number") throw new Error(data.error || "結果還沒準備好");
      render(data);
    } catch (err) {
      $("#updated").textContent = "";
      $("#board-msg").textContent = "讀不到票選結果（" + err.message + "），請稍後按「重新整理」再試一次。";
    } finally {
      btn.disabled = false; btn.textContent = "重新整理";
    }
  }

  $("#refresh").addEventListener("click", load);
  load();
})();
