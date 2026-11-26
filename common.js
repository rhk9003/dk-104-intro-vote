// 三個頁面共用的小工具：建元素、把版本內文畫出來、算字數
(function () {
  "use strict";

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "text") n.textContent = v;
      else if (k === "style") n.style.cssText = v;
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
    });
    (children || []).forEach(c => c && n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  // 「**粗體**」轉成 <b>，其他一律當純文字
  function inline(text) {
    const frag = document.createDocumentFragment();
    String(text).split(/\*\*(.+?)\*\*/).forEach((part, i) => {
      if (!part) return;
      frag.appendChild(i % 2 ? el("b", { text: part }) : document.createTextNode(part));
    });
    return frag;
  }

  function renderBlocks(blocks) {
    const box = el("div", { class: "copy" });
    blocks.forEach(b => {
      if (b.h) box.appendChild(el("h3", { class: "copy-h" }, [inline(b.h)]));
      else if (b.h2) box.appendChild(el("h4", { class: "copy-h2" }, [inline(b.h2)]));
      else if (b.b) box.appendChild(el("p", { class: "copy-b" }, [inline(b.b)]));
      else if (b.p) box.appendChild(el("p", {}, [inline(b.p)]));
      else if (b.li) box.appendChild(el("ul", {}, b.li.map(t => el("li", {}, [inline(t)]))));
    });
    return box;
  }

  // 字數：不算空白和粗體記號
  function charCount(blocks) {
    return blocks.map(b => b.h || b.h2 || b.b || b.p || (b.li || []).join("")).join("")
      .replace(/\*\*/g, "").replace(/\s+/g, "").length;
  }

  // 一般人讀中文約每分鐘 400 字
  function readTime(n) {
    const min = n / 400;
    return min < 1 ? "不到 1 分鐘" : "約 " + Math.round(min) + " 分鐘";
  }

  function label(v) { return v.letter + " " + v.name; }

  function fmtTime(t) {
    const d = new Date(t);
    if (isNaN(d)) return String(t);
    const p = n => String(n).padStart(2, "0");
    return p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  window.DKV = { el, inline, renderBlocks, charCount, readTime, label, fmtTime };
})();
