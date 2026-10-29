/*!
 * CaseDesk — app interactions. Vanilla JavaScript, no dependencies.
 * Each feature is opt-in through data-* attributes, so you can delete any part you don't use.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  var root = document.documentElement;

  /* Money ----------------------------------------------------------------
     window.CASEDESK (set in each page's <head>) holds the currency symbol and tax rate,
     with any values saved in Settings → Firm (localStorage "casedesk-firm"). */
  var cfg = window.CASEDESK || {};
  if (typeof cfg.currency !== "string" || !cfg.currency.trim() || cfg.currency.length > 4) cfg.currency = "$";
  cfg.tax = Number(cfg.tax); if (!isFinite(cfg.tax) || cfg.tax < 0 || cfg.tax > 50) cfg.tax = 10;
  function symbol() { var c = cfg.currency; return /^[A-Za-z]/.test(c) ? c + " " : c; }
  function fmt(v, noCents) {
    v = Number(v) || 0;
    var s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: noCents ? 0 : 2, maximumFractionDigits: noCents ? 0 : 2 });
    return (v < 0 ? "-" : "") + symbol() + s;
  }
  function showMoney(scope) {
    $$("[data-money]", scope).forEach(function (m) { m.textContent = fmt(m.getAttribute("data-money"), m.hasAttribute("data-nocents")); });
    $$("[data-currency]", scope).forEach(function (m) { m.textContent = symbol().trim(); });
  }
  // The demo's "today" (Monday 2 November 2026), used for rows added with forms. Set CASEDESK.today, or use the real date, in your project.
  function realDate(v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return false; var p = v.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); return d.getMonth() === +p[1] - 1 && d.getDate() === +p[2]; }
  var today = realDate(cfg.today) ? cfg.today : "2026-11-02";
  function shortDate(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); }
  window.CaseDesk = { fmt: fmt, symbol: symbol, tax: function () { return cfg.tax; }, showMoney: showMoney };
  if (cfg.currency !== "$") showMoney(document);

  /* Theme ---------------------------------------------------------------- */
  function setTheme(t) {
    root.setAttribute("data-theme", t);
    store.set("casedesk-theme", t);
    $$("[data-theme-toggle]").forEach(function (b) { b.setAttribute("aria-pressed", t === "dark"); });
    document.dispatchEvent(new CustomEvent("themechange", { detail: t }));
  }
  $$("[data-theme-toggle]").forEach(function (b) {
    b.setAttribute("aria-pressed", root.getAttribute("data-theme") === "dark");
    b.addEventListener("click", function () { setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark"); });
  });

  /* Sidebar -------------------------------------------------------------- */
  if (store.get("casedesk-collapsed") === "1") root.classList.add("sidebar-collapsed");
  $$("[data-sidebar-collapse]").forEach(function (b) {
    b.setAttribute("aria-controls", "sidebar");
    var label = function (c) { b.setAttribute("aria-expanded", !c); b.setAttribute("aria-label", c ? "Expand sidebar" : "Collapse sidebar"); };
    label(root.classList.contains("sidebar-collapsed"));
    b.addEventListener("click", function () {
      var on = root.classList.toggle("sidebar-collapsed");
      store.set("casedesk-collapsed", on ? "1" : "0");
      label(on);
      setTimeout(function () { window.CaseDeskCharts && window.CaseDeskCharts.renderAll(); }, 30);
    });
  });
  $$("[data-sidebar-open]").forEach(function (b) {
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () {
      root.classList.add("sidebar-open"); b.setAttribute("aria-expanded", "true");
      var first = $(".sidebar a"); if (first) setTimeout(function () { first.focus(); }, 60);
    });
  });
  function closeDrawer() {
    if (!root.classList.contains("sidebar-open")) return;
    root.classList.remove("sidebar-open");
    var ob = $("[data-sidebar-open]"); if (ob) { ob.setAttribute("aria-expanded", "false"); if (getComputedStyle(ob).display !== "none") ob.focus(); }
  }
  $$("[data-sidebar-close], .sidebar-backdrop").forEach(function (b) { b.addEventListener("click", closeDrawer); });

  /* Dropdowns ------------------------------------------------------------ */
  $$("[data-dropdown]").forEach(function (dd) {
    var btn = $("[data-dropdown-toggle]", dd);
    if (!btn) return;
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !dd.classList.contains("open");
      closeDropdowns();
      dd.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open);
    });
    // Close the menu when keyboard focus moves out of it
    dd.addEventListener("focusout", function (e) {
      if (e.relatedTarget && !dd.contains(e.relatedTarget) && dd.classList.contains("open")) { dd.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    });
  });
  function closeDropdowns() {
    $$("[data-dropdown].open").forEach(function (d) { d.classList.remove("open"); var b = $("[data-dropdown-toggle]", d); if (b) b.setAttribute("aria-expanded", "false"); });
  }
  document.addEventListener("click", function (e) { if (!e.target.closest(".menu")) closeDropdowns(); });
  // iPhone Safari sends no click for a tap on plain text, so close open menus on any press outside them too
  document.addEventListener("pointerdown", function (e) { if (!e.target.closest("[data-dropdown]")) closeDropdowns(); });

  /* Modals --------------------------------------------------------------- */
  var lastFocus = null;
  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    // Focus the first visible field or button (hidden file inputs are skipped), else the close button
    var vis = function (x) { return x.offsetParent !== null; };
    var f = $$("input:not([type=hidden]), select, textarea, button:not([data-modal-close]), [tabindex='0']", m).filter(vis)[0] || $$("[data-modal-close]", m).filter(vis)[0];
    if (f) setTimeout(function () { if (!m.contains(document.activeElement)) f.focus(); }, 30);
  }
  function closeModal(m) {
    m.classList.remove("open");
    if (!$(".modal.open")) document.body.style.overflow = "";
    // A menu item closes with its menu (or a button can be hidden by the form), so go back to a control that is still on screen
    var shown = function (x) { return x && x.isConnected && x.getClientRects().length > 0; };
    var back = lastFocus, dd = back && back.closest && back.closest("[data-dropdown]");
    if (dd && !shown(back)) back = $("[data-dropdown-toggle]", dd);
    if (shown(back)) back.focus();
  }
  // Delegated, so buttons drawn later by page scripts open their modals too
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-modal-open]");
    if (!b) return;
    closeDropdowns();
    // data-fill='{"key":"text"}' writes each value into [data-f="key"] inside the modal before it opens
    var m = document.getElementById(b.getAttribute("data-modal-open"));
    if (m && b.hasAttribute("data-fill")) {
      var f = {}; try { f = JSON.parse(b.getAttribute("data-fill")) || {}; } catch (err) { /* ignore */ }
      $$("[data-f]", m).forEach(function (el) { var k = el.getAttribute("data-f"); if (k in f) { if ("value" in el && el.tagName !== "BUTTON") el.value = f[k]; else el.textContent = f[k]; } });
      $$("[data-f-href]", m).forEach(function (el) { var k = el.getAttribute("data-f-href"); if (k in f) el.setAttribute("href", f[k]); });
      m.cdRow = b.closest("tr");
      // The row's status may have changed on this page: show it, and only the buttons that fit it
      var st = m.cdRow && rowStatus(m.cdRow);
      if (st) { $$('[data-f="status"]', m).forEach(function (el) { el.textContent = st; }); showFor(m, st); }
    }
    openModal(b.getAttribute("data-modal-open"));
  });
  $$("[data-modal-close]").forEach(function (b) { b.addEventListener("click", function () { closeModal(b.closest(".modal")); }); });
  $$(".modal-backdrop").forEach(function (b) { b.addEventListener("click", function () { closeModal(b.closest(".modal")); }); });
  // Pressing Enter inside a modal form runs the modal's main button instead of reloading the page
  $$(".modal form").forEach(function (f) {
    function run() { var b = $("[data-modal-submit]", f.closest(".modal")); if (b) b.click(); }
    // The footer button is the form's submit button (form="id"); its own click already ran, so only Enter needs run()
    f.addEventListener("submit", function (e) { e.preventDefault(); if (!(e.submitter && e.submitter.hasAttribute("data-modal-submit"))) run(); });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && !/checkbox|radio|file|button|submit/.test(e.target.type)) { e.preventDefault(); run(); }
    });
  });
  document.addEventListener("keydown", function (e) {
    var openM = $(".modal.open");
    if (e.key === "Tab" && openM) {
      // Keep keyboard focus inside the open modal
      var f = $$("a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])", openM).filter(function (x) { return x.offsetParent !== null; });
      if (f.length) {
        var first = f[0], last = f[f.length - 1];
        if (!openM.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    if (e.key === "Escape") {
      var openDd = $("[data-dropdown].open");
      $$(".modal.open").forEach(closeModal);
      closeDropdowns();
      if (openDd && openDd.contains(document.activeElement)) { var tg = $("[data-dropdown-toggle]", openDd); if (tg) tg.focus(); }
      closeDrawer();
    }
    var typing = /input|textarea|select/i.test((e.target.tagName || "")) || e.target.isContentEditable;
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
      // A page can mark its own main search box with data-primary-search
      var s = $("[data-primary-search]") || $(".search input");
      if (s && s.offsetParent !== null) { e.preventDefault(); s.focus(); s.select && s.select(); }
    }
  });

  /* Toasts --------------------------------------------------------------- */
  function toast(msg) {
    var wrap = $(".toasts");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toasts"; wrap.setAttribute("aria-live", "polite"); document.body.appendChild(wrap); }
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span></span>';
    t.querySelector("span").textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  window.cdToast = toast;
  window.cdOpenModal = openModal;
  window.cdCloseModal = closeModal;
  $$("[data-toast]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.closest(".menu")) closeDropdowns();
      var m = b.closest(".modal");
      if (m && b.hasAttribute("data-modal-submit")) {
        var form = $("form", m);
        if (form && !validate(form)) return;
        if (form && form.hasAttribute("data-add-to")) addFromForm(form);
        if (form && form.hasAttribute("data-set-text")) {
          var field = $("[name=value]", form);
          $$(form.getAttribute("data-set-text")).forEach(function (el) { el.textContent = field.value.trim(); });
          field.defaultValue = field.value.trim();
        }
        if (form) form.dispatchEvent(new CustomEvent("casedesk:submit", { bubbles: true }));
        if (form) form.reset();
        closeModal(m);
      }
      toast(b.getAttribute("data-toast"));
    });
  });

  /* Tabs ----------------------------------------------------------------- */
  $$("[data-tabs]").forEach(function (group) {
    var tabs = $$('[role="tab"]', group);
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var i = tabs.indexOf(tab);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); select(tabs[(i + 1) % tabs.length], true); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length], true); }
      });
    });
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute("aria-controls"));
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
      window.CaseDeskCharts && window.CaseDeskCharts.renderAll();
    }
    // settings.html#ps2 opens the tab whose panel has that id (also when only the # part changes)
    function fromHash() {
      var id = location.hash.slice(1), t = id && tabs.filter(function (x) { return x.getAttribute("aria-controls") === id; })[0];
      if (t) select(t);
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
  });
  $$(".segmented").forEach(function (seg) {
    $$("button", seg).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", seg).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        var target = seg.getAttribute("data-target");
        var data = b.getAttribute("data-set");
        if (target && data) {
          var chart = document.getElementById(target);
          chart.setAttribute("data-chart", data);
          window.CaseDeskCharts.render(chart);
        }
      });
    });
  });

  /* Data table: search, filter, sort, paginate ---------------------------- */
  $$("[data-table]").forEach(function (wrap) {
    var table = $("table", wrap), tbody = $("tbody", table);
    var rows = $$("tr", tbody);
    var perPage = parseInt(wrap.getAttribute("data-per-page") || "8", 10);
    var search = $("[data-table-search]", wrap), filters = $$("[data-table-filter]", wrap), filter = filters[0];
    var segs = $$("[data-table-seg]", wrap);
    var pager = $("[data-table-pager]", wrap), info = $("[data-table-info]", wrap);
    var page = 1, sortCol = -1, dir = 1, visible = rows;
    var empty = document.createElement("tr");
    empty.className = "empty-row";
    empty.innerHTML = '<td colspan="' + $$("th", table).length + '">No results match your search. Try a different word or clear the filter.</td>';

    function cellVal(tr, i) {
      var td = tr.children[i];
      // Use data-value when present (dates, money); otherwise numbers sort numerically, text alphabetically.
      var v = td.hasAttribute("data-value") ? td.getAttribute("data-value") : td.textContent.trim();
      if (/^[\s$€£\-+]*[\d.,]+\s*%?$/.test(v)) return parseFloat(v.replace(/[^0-9.\-]/g, ""));
      return v.toLowerCase();
    }
    function apply() {
      var q = search ? search.value.trim().toLowerCase() : "";
      // Each [data-table-filter="attr"] matches the row's data-attr (default data-status); a row can list several values separated by spaces
      var conds = filters.map(function (el) { return [el.getAttribute("data-table-filter") || "status", el.value]; });
      segs.forEach(function (sg) { var on = $("[aria-pressed=true]", sg); conds.push([sg.getAttribute("data-table-seg"), on ? on.getAttribute("data-value") : ""]); });
      visible = rows.filter(function (tr) {
        if (q && tr.textContent.toLowerCase().indexOf(q) === -1) return false;
        return conds.every(function (c) { return !c[1] || (" " + (tr.getAttribute("data-" + c[0]) || "") + " ").indexOf(" " + c[1] + " ") > -1; });
      });
      if (sortCol > -1) visible.sort(function (a, b) { var x = cellVal(a, sortCol), y = cellVal(b, sortCol); return x > y ? dir : x < y ? -dir : 0; });
      var pages = Math.max(1, Math.ceil(visible.length / perPage));
      page = Math.min(page, pages);
      tbody.innerHTML = "";
      var slice = visible.slice((page - 1) * perPage, page * perPage);
      slice.forEach(function (tr) { tbody.appendChild(tr); });
      if (!slice.length) tbody.appendChild(empty);
      if (info) info.textContent = visible.length ? "Showing " + ((page - 1) * perPage + 1) + "–" + ((page - 1) * perPage + slice.length) + " of " + visible.length : "No results";
      if (pager) {
        pager.innerHTML = "";
        var mk = function (label, p, dis, act, name) {
          var b = document.createElement("button");
          b.type = "button"; b.innerHTML = label; b.disabled = dis;
          if (act) { b.className = "active"; b.setAttribute("aria-current", "page"); }
          b.setAttribute("aria-label", name || "Page " + p);
          b.addEventListener("click", function () { page = p; apply(); });
          pager.appendChild(b);
        };
        mk("‹", page - 1, page === 1, false, "Previous page");
        // Many pages: show 1 … 4 5 6 … 11 so the pager fits on a phone
        var near = pages <= 7 ? null : [1, pages, page - 1, page, page + 1].concat(page <= 3 ? [2, 3, 4] : page >= pages - 2 ? [pages - 3, pages - 2, pages - 1] : []);
        for (var i = 1; i <= pages; i++) {
          if (!near || near.indexOf(i) > -1) mk(String(i), i, false, i === page);
          else if (near.indexOf(i - 1) > -1) { var gap = document.createElement("span"); gap.className = "pager-gap"; gap.textContent = "…"; gap.setAttribute("aria-hidden", "true"); pager.appendChild(gap); }
        }
        mk("›", page + 1, page === pages, false, "Next page");
      }
    }
    $$("th[data-sort]", table).forEach(function (th) {
      th.tabIndex = 0;
      var go = function () {
        var i = Array.prototype.indexOf.call(th.parentNode.children, th);
        dir = sortCol === i ? -dir : 1; sortCol = i;
        $$("th[data-sort]", table).forEach(function (t) { t.removeAttribute("data-dir"); t.removeAttribute("aria-sort"); });
        th.setAttribute("data-dir", dir === 1 ? "asc" : "desc");
        th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
        apply();
      };
      th.addEventListener("click", go);
      th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    if (search) search.addEventListener("input", function () { page = 1; apply(); });
    filters.forEach(function (fl) { fl.addEventListener("change", function () { page = 1; apply(); }); });
    segs.forEach(function (sg) { $$("button", sg).forEach(function (b) { b.addEventListener("click", function () { $$("button", sg).forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); page = 1; apply(); }); }); });
    // Small API so other features (add row, row actions, export) can work with this table
    wrap.cdTable = {
      add: function (tr) { rows.unshift(tr); page = 1; apply(); },
      remove: function (tr) { rows = rows.filter(function (r) { return r !== tr; }); apply(); },
      refresh: apply,
      visibleRows: function () { return visible.slice(); },
      allRows: function () { return rows.slice(); }
    };
    var all = $("[data-check-all]", table);
    if (all) all.addEventListener("change", function () { $$("tbody input[type=checkbox]", table).forEach(function (c) { c.checked = all.checked; }); });
    apply();
  });

  /* Tables that scroll sideways can be scrolled with the keyboard */
  function markScrollable() {
    $$(".table-wrap").forEach(function (w, i) {
      if (w.scrollWidth > w.clientWidth + 1) {
        w.setAttribute("tabindex", "0"); w.setAttribute("role", "region");
        // Give each scrollable table its own name (taken from the nearest heading) so screen readers can tell them apart
        var sec = w.closest("section, .card"), h = sec && $("h2, h3", sec);
        if (!w.hasAttribute("aria-label")) w.setAttribute("aria-label", (h ? h.textContent.trim() : "Table " + (i + 1)) + " (scrollable)");
      }
      else { w.removeAttribute("tabindex"); w.removeAttribute("role"); }
    });
  }
  markScrollable();
  var rsT; window.addEventListener("resize", function () { clearTimeout(rsT); rsT = setTimeout(markScrollable, 150); });

  /* Forms ---------------------------------------------------------------- */
  $$("[data-password-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var input = $("input", b.closest(".input-wrap"));
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      b.setAttribute("aria-label", show ? "Hide password" : "Show password");
      b.setAttribute("aria-pressed", show);
    });
  });
  // Numbers must fit the field's step (step="0.1" allows 2.5); without a step only whole numbers are allowed
  function stepBad(f, n) {
    var st = f.getAttribute("step");
    if (st === "any") return false;
    var size = Number(st) || 1, k = n / size;
    return Math.abs(k - Math.round(k)) > 1e-7;
  }
  function validate(form) {
    var ok = true;
    // Required fields must be filled in; optional fields are checked only when something was typed
    $$("input, select, textarea", form).filter(function (f) { return f.required || (f.value.trim() && (f.hasAttribute("pattern") || f.type === "email" || f.type === "number" || f.hasAttribute("data-not-before"))); }).forEach(function (f) {
      var v = f.value.trim(), n = Number(v);
      // data-not-before="opened": a date that must not be earlier than the form's "opened" date
      var nb = f.getAttribute("data-not-before"), other = nb && f.form && f.form.elements[nb];
      var bad = f.type === "checkbox" ? !f.checked : !v || (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || (f.minLength > 0 && f.value.length < f.minLength) ||
        (f.type === "number" && (!isFinite(n) || (f.min !== "" && n < Number(f.min)) || (f.max !== "" && n > Number(f.max)) || stepBad(f, n))) ||
        (f.hasAttribute("pattern") && !new RegExp("^(?:" + f.getAttribute("pattern") + ")$").test(v)) ||
        // data-amount: money from 0.01 to 999,999.99
        (f.hasAttribute("data-amount") && !(Number(v.replace(/,/g, "")) >= 0.01 && Number(v.replace(/,/g, "")) <= 999999.99)) ||
        (other && other.value && v < other.value);
      f.classList.toggle("is-invalid", bad);
      f.setAttribute("aria-invalid", bad);
      if (bad && ok) { f.focus(); ok = false; }
    });
    return ok;
  }
  $$("form[data-validate]").forEach(function (form) {
    form.setAttribute("novalidate", "");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate(form)) return;
      form.dispatchEvent(new CustomEvent("casedesk:submit", { bubbles: true }));
      var go = form.getAttribute("data-redirect");
      var msg = form.getAttribute("data-success");
      if (msg) toast(msg);
      var btn = $("[type=submit]", form), note = $("[data-saved-note]", form);
      if (btn && form.hasAttribute("data-saved-label")) {
        var orig = btn.innerHTML;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' + form.getAttribute("data-saved-label");
        btn.disabled = true;
        setTimeout(function () { btn.innerHTML = orig; btn.disabled = false; }, 2200);
      }
      if (note) { note.hidden = false; note.textContent = "Saved at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
      if (go) setTimeout(function () { location.href = go; }, 600);
    });
    $$("input, select, textarea", form).forEach(function (f) { f.addEventListener("input", function () { if (f.classList.contains("is-invalid")) { f.classList.remove("is-invalid"); f.removeAttribute("aria-invalid"); } }); });
  });
  /* Dependent select: <select data-depends-on="ni-client"> lists only the options whose data-client matches the chosen value */
  $$("[data-depends-on]").forEach(function (sel) {
    var parent = document.getElementById(sel.getAttribute("data-depends-on")); if (!parent) return;
    function update() {
      var want = parent.value;
      $$("option", sel).forEach(function (o) { if (!o.value) return; var ok = o.getAttribute("data-client") === want; o.hidden = !ok; o.disabled = !ok; });
      if (sel.selectedOptions[0] && sel.selectedOptions[0].disabled) sel.value = "";
      sel.disabled = !want;
    }
    parent.addEventListener("change", update);
    if (parent.form) parent.form.addEventListener("reset", function () { setTimeout(update, 0); });
    update();
  });
  $$(".dropzone").forEach(function (z) {
    // The file input sits next to the <button class="dropzone"> (or inside an older <div class="dropzone">)
    var input = $("input[type=file]", z) || (z.nextElementSibling && z.nextElementSibling.matches("input[type=file]") ? z.nextElementSibling : null), label = $("[data-dropzone-label]", z);
    if (!input) return;
    var show = function (files) { if (label && files.length) label.textContent = files.length === 1 ? files[0].name : files.length + " files selected"; };
    z.addEventListener("click", function (e) { if (e.target !== input) input.click(); });
    if (z.tagName !== "BUTTON") z.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", function () { show(input.files); });
    ["dragenter", "dragover"].forEach(function (t) { z.addEventListener(t, function (e) { e.preventDefault(); z.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (t) { z.addEventListener(t, function (e) { e.preventDefault(); z.classList.remove("is-over"); }); });
    z.addEventListener("drop", function (e) { show(e.dataTransfer.files); });
  });
  $$("[data-print]").forEach(function (b) { b.addEventListener("click", function () { window.print(); }); });
  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove(); toast(ok ? "Link copied to clipboard" : "Copy failed — select the address bar and copy it manually");
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast("Link copied to clipboard"); }, fallback);
    else fallback();
  }
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () { copyText(b.getAttribute("data-copy") || location.href); });
  });


  /* Add items from modal forms ----------------------------------------------
     <form data-add-to="#target" data-template="tpl-id"> + <template id="tpl-id">
     Inside the template, {field} is replaced with the value of the form field named "field". */
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function addFromForm(form) {
    var tpl = document.getElementById(form.getAttribute("data-template"));
    var target = $(form.getAttribute("data-add-to"));
    if (!tpl || !target) return;
    var vals = { today: shortDate(today), iso: today, id: String(Math.floor(4822 + Math.random() * 100)), me: "Eleanor Vance" };
    // {nextNo}: <form data-next-no="INV-2026-"> gives the next free number after the highest one already on the page
    var prefix = form.getAttribute("data-next-no");
    if (prefix) {
      var high = 0, re = new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)", "g"), mm, holderTable = target.closest("[data-table]") || target;
      var txt = (holderTable.cdTable ? holderTable.cdTable.allRows().map(function (r) { return r.textContent; }).join(" ") : holderTable.textContent);
      while ((mm = re.exec(txt))) high = Math.max(high, +mm[1]);
      vals.nextNo = prefix + ("0000" + (high + 1)).slice(-4);
    }
    $$("[name]", form).forEach(function (f) {
      var v = f.type === "checkbox" ? (f.checked ? "Yes" : "No") : f.value.trim();
      vals[f.name] = v;
      // {fieldTone} = data-tone of the chosen <option>; {fieldText} = a date field shown like {today}
      var opt = f.tagName === "SELECT" && f.options[f.selectedIndex];
      if (opt && opt.hasAttribute("data-tone")) vals[f.name + "Tone"] = opt.getAttribute("data-tone");
      if (opt) vals[f.name + "Text"] = opt.text;
      // Any other data-* of the chosen option: data-role → {fieldRole}, data-color → {fieldColor}, data-rate → {fieldRate}
      if (opt) Object.keys(opt.dataset).forEach(function (k) { if (k !== "tone") vals[f.name + k.charAt(0).toUpperCase() + k.slice(1)] = opt.dataset[k]; });
      if (f.type === "date" && v) vals[f.name + "Text"] = shortDate(v);
      if (f.name === "name" || f.name === "contact") {
        var parts = v.split(/\s+/);
        vals.initials = ((parts[0] || "?")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
      }
    });
    if (vals.amount) {
      var amt = Number(String(vals.amount).replace(/[^0-9.]/g, "") || 0), total = Math.round(amt * (100 + cfg.tax)) / 100;
      vals.money = fmt(amt); vals.amountRaw = amt.toFixed(2);
      // {totalMoney} / {totalRaw} = the amount plus tax at the firm's rate (Settings → Firm)
      vals.totalMoney = fmt(total); vals.totalRaw = total.toFixed(2);
    }
    // Time entries: the fee earner's rate (data-rate on the chosen <option>) × hours → {rateMoney}, {lineMoney}
    var rateOpt = $$("select", form).map(function (f) { return f.options[f.selectedIndex]; }).filter(function (o) { return o && o.hasAttribute("data-rate"); })[0];
    if (rateOpt && vals.hrs) {
      var rate = Number(rateOpt.getAttribute("data-rate")) || 0, hrs = Number(vals.hrs) || 0, line = Math.round(rate * hrs * 100) / 100;
      vals.hrs = hrs.toFixed(1); vals.rateRaw = String(rate); vals.rateMoney = fmt(rate, true); vals.lineRaw = line.toFixed(2); vals.lineMoney = fmt(line);
    }
    // {fieldMoney} = any decimal field (cost, price …) in the store currency, or "—" when left empty
    $$("input[inputmode=decimal][name]", form).forEach(function (f) {
      var raw = String(vals[f.name] || "").replace(/[^0-9.]/g, "");
      vals[f.name + "Money"] = raw ? fmt(Number(raw)) : "—";
    });
    var html = tpl.innerHTML.replace(/\{(\w+)\}/g, function (_, k) { return k in vals ? esc(vals[k]) : ""; });
    var holder = document.createElement(target.tagName === "TBODY" || target.hasAttribute("data-table") ? "tbody" : "div");
    holder.innerHTML = html.trim();
    var el = holder.firstElementChild;
    var table = target.closest("[data-table]") || (target.hasAttribute("data-table") ? target : null);
    if (table && table.cdTable) table.cdTable.add(el);
    else target.insertBefore(el, target.firstChild);
    bindWithin(el);
    syncRow(el);
  }
  /* Menu items with data-show-for="Sent|Overdue" are shown only while the row's status is one of those */
  function rowStatus(tr) { var b = $(".badge", $("[data-status-cell]", tr) || tr); return b ? b.textContent.trim() : tr.getAttribute("data-status") || ""; }
  function showFor(scope, st) { $$("[data-show-for]", scope).forEach(function (x) { x.hidden = x.getAttribute("data-show-for").split("|").indexOf(st) < 0; }); }
  function syncRow(tr) { if (tr && tr.querySelector && $("[data-show-for]", tr)) showFor(tr, rowStatus(tr)); }
  // Rows on later pages of a table are not in the page yet, so take them from the table too
  $$("[data-table]").reduce(function (all, w) { return w.cdTable ? all.concat(w.cdTable.allRows()) : all; }, $$("tr")).forEach(syncRow);
  // Re-bind dropdowns and toasts inside newly added rows, and show their prices in the store currency
  function bindWithin(el) {
    showMoney(el);
    $$("[data-dropdown]", el).forEach(function (dd) {
      var btn = $("[data-dropdown-toggle]", dd);
      btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function (e) { e.stopPropagation(); var open = !dd.classList.contains("open"); closeDropdowns(); dd.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); });
      dd.addEventListener("focusout", function (e) {
        if (e.relatedTarget && !dd.contains(e.relatedTarget) && dd.classList.contains("open")) { dd.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
      });
    });
    $$("[data-toast]", el).forEach(function (b) { b.addEventListener("click", function () { closeDropdowns(); toast(b.getAttribute("data-toast")); }); });
  }

  /* Row actions: data-row-action="status|Shipped|info" or "remove" ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-row-action]");
    if (!b) return;
    var tr = b.closest("tr"), wrap = b.closest("[data-table]");
    var parts = b.getAttribute("data-row-action").split("|");
    closeDropdowns();
    if (parts[0] === "remove") {
      if (wrap && wrap.cdTable) wrap.cdTable.remove(tr); else tr.remove();
      toast(b.getAttribute("data-done") || "Removed");
    } else if (parts[0] === "status") {
      var badge = $(".badge", tr.querySelector("[data-status-cell]") || tr);
      if (badge) { badge.className = "badge" + (parts[2] && parts[2] !== "plain" ? " badge-" + parts[2] : ""); badge.textContent = parts[1]; }
      // An invoice marked as paid has nothing left to pay: [data-balance-cell] shows 0.00
      var bal = parts[1] === "Paid" && $("[data-balance-cell]", tr);
      if (bal) { bal.setAttribute("data-value", "0.00"); bal.innerHTML = '<span data-money="0.00">' + fmt(0) + "</span>"; }
      // The row's data-status is what the table filter matches: change it only when the filter has that value
      var flt = wrap && $("[data-table-filter]", wrap);
      if (!flt || $$("option", flt).some(function (o) { return o.value === parts[1]; })) tr.setAttribute("data-status", parts[1]);
      syncRow(tr);
      if (wrap && wrap.cdTable) wrap.cdTable.refresh();
      // The clicked item may now be hidden, so keep keyboard focus on the row's menu button
      var tg = $("[data-dropdown-toggle]", tr); if (tg && tg.getClientRects().length) tg.focus();
      toast(b.getAttribute("data-done") || "Status changed to " + parts[1]);
    }
  });

  /* CSV export ------------------------------------------------------------
     data-export="file.csv" plus one of:
       data-export-table   → the table inside the nearest [data-table] (current search/filter applied)
       data-export-chart="#chartId" → labels + series from a chart
       data-export-items="selector" → elements with data-csv='{"Column":"value",...}' */
  function csvCell(v) {
    v = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    // Text starting with = + - @ would run as a formula in Excel (phone "+1 555 …"); plain negative numbers like -12.50 or -$12.50 stay as they are
    if (/^[=+\-@]/.test(v) && !/^-[$€£]?[\d,]*\.?\d+%?$/.test(v)) v = "'" + v;
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  // Text of a table cell with a space between its parts ("Shop rent" + "EX-612"), skipping hidden icons and initials
  function cellText(td) {
    var out = [], w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) if (!n.parentNode.closest("[aria-hidden=true], .sr-only, svg")) out.push(n.textContent);
    return out.join(" ").replace(/\s+/g, " ").trim();
  }
  function download(name, rowsArr) {
    var csv = rowsArr.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast("Downloaded " + name + " (" + (rowsArr.length - 1) + " rows)");
  }
  $$("[data-export]").forEach(function (b) {
    b.addEventListener("click", function () {
      var name = b.getAttribute("data-export"), out = [];
      if (b.hasAttribute("data-export-table")) {
        var wrap = b.closest("[data-table]"), table = $("table", wrap);
        var keep = $$("th", table).map(function (th, i) { return th.textContent.trim() && !$("input", th) && !$(".sr-only", th) ? i : -1; }).filter(function (i) { return i > -1; });
        out.push(keep.map(function (i) { return $$("th", table)[i].textContent.trim(); }));
        wrap.cdTable.visibleRows().forEach(function (tr) { out.push(keep.map(function (i) { var td = tr.children[i]; var b2 = $(".person b", td); var sm = $(".person small", td); return b2 ? b2.textContent + (sm && sm.textContent.indexOf("@") > -1 ? " <" + sm.textContent + ">" : "") : cellText(td); })); });
      } else if (b.hasAttribute("data-export-chart")) {
        var cfg = JSON.parse($(b.getAttribute("data-export-chart")).getAttribute("data-chart"));
        out.push(["Label"].concat(cfg.series.map(function (s) { return s.name + (cfg.suffix === "k" ? " (thousands)" : ""); })));
        cfg.labels.forEach(function (l, i) { out.push([l].concat(cfg.series.map(function (s) { return s.data[i]; }))); });
      } else if (b.hasAttribute("data-export-items")) {
        var items = $$(b.getAttribute("data-export-items")).filter(function (el) { return !el.hidden; }).map(function (el) { return JSON.parse(el.getAttribute("data-csv")); });
        if (items.length) { var cols = Object.keys(items[0]); out.push(cols); items.forEach(function (it) { out.push(cols.map(function (c) { return it[c]; })); }); }
      }
      if (out.length > 1) download(name, out); else toast("Nothing to export with the current filter");
    });
  });

  /* CSV import (demo: counts rows in the chosen file) ----------------------- */
  $$("[data-import]").forEach(function (b) {
    b.addEventListener("click", function () {
      var m = b.closest(".modal"), input = $("input[type=file]", m);
      var f = input && input.files[0];
      if (!f) { toast("Choose a CSV file first"); return; }
      var r = new FileReader();
      r.onload = function () {
        var n = String(r.result).split(/\r?\n/).filter(function (l) { return l.trim(); }).length - 1;
        closeModal(m);
        toast(Math.max(0, n) + " rows found in " + f.name + ". Connect your backend to import them.");
      };
      r.readAsText(f);
    });
  });

  /* Filterable card lists: [data-filter-list] with [data-filter-search] and [data-filter-tag] buttons */
  $$("[data-filter-list]").forEach(function (box) {
    var items = $$(box.getAttribute("data-filter-list")), q = $("[data-filter-search]", box), tag = "", empty = $("[data-filter-empty]", box.parentNode);
    function run() {
      var term = q ? q.value.trim().toLowerCase() : "", shown = 0;
      items.forEach(function (it) {
        var ok = (!term || it.textContent.toLowerCase().indexOf(term) > -1) && (!tag || it.getAttribute("data-tag") === tag);
        it.hidden = !ok; if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }
    if (q) q.addEventListener("input", run);
    $$("[data-filter-tag]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        tag = b.getAttribute("data-filter-tag");
        $$("[data-filter-tag]", box).forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        run();
      });
    });
  });

  /* Date range picker (dropdown options update the button label) */
  $$("[data-range]").forEach(function (dd) {
    $$("[data-range-option]", dd).forEach(function (o) {
      o.addEventListener("click", function () {
        $("[data-range-label]", dd).textContent = o.textContent;
        closeDropdowns();
        // Optional: data-range-chart="#id" + data-months="N" shows only the last N points of that chart
        var chart = dd.hasAttribute("data-range-chart") ? $(dd.getAttribute("data-range-chart")) : null, n = +o.getAttribute("data-months");
        if (chart && n && window.CaseDeskCharts) {
          if (!chart.hasAttribute("data-chart-full")) chart.setAttribute("data-chart-full", chart.getAttribute("data-chart"));
          var cfg = JSON.parse(chart.getAttribute("data-chart-full"));
          cfg.labels = cfg.labels.slice(-n);
          (cfg.series || []).forEach(function (s) { s.data = s.data.slice(-n); });
          chart.setAttribute("data-chart", JSON.stringify(cfg));
          window.CaseDeskCharts.render(chart);
          var note = $("[data-range-note]", chart.closest(".card"));
          if (note) note.textContent = o.textContent.toLowerCase();
        }
        toast("Showing " + o.textContent.toLowerCase());
      });
    });
  });

  /* Notifications: mark all as read */
  $$("[data-mark-read]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      $$(".topbar .dot").forEach(function (d) { d.remove(); });
      $$(".notif").forEach(function (n) { n.style.opacity = ".55"; });
      toast("All notifications marked as read");
    });
  });

  /* Global search: Enter opens Cases with the search filled in */
  var gs = $(".search input");
  if (gs) gs.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && gs.value.trim()) location.href = "cases.html?q=" + encodeURIComponent(gs.value.trim());
  });
  var qp = new URLSearchParams(location.search).get("q"), ts = $("[data-table-search]");
  if (qp && ts) { ts.value = qp; ts.dispatchEvent(new Event("input")); }

  /* Account details --------------------------------------------------------
     A [data-account-form] with [data-account-field="first|last|email"] keeps the values in this browser only
     (demo — connect your backend to really save them) and fills every [data-account="name|first|initials|email"]. */
  var account = null;
  try { account = JSON.parse(store.get("casedesk-account")); } catch (e) { /* ignore bad data */ }
  // Ignore stored data that is not a {first, last, email} object of strings (old or edited by hand)
  if (!account || typeof account !== "object" || typeof account.first !== "string" || !account.first.trim()) account = null;
  else ["last", "email"].forEach(function (k) { if (typeof account[k] !== "string") account[k] = ""; });
  // Never show more than the profile form allows (first/last name 40 characters, email 80)
  if (account) account = { first: account.first.trim().slice(0, 40), last: account.last.trim().slice(0, 40), email: account.email.trim().slice(0, 80) };
  function showAccount(a) {
    if (!a || !a.first) return;
    var last = a.last || "";
    var v = { first: a.first, name: (a.first + " " + last).trim(), initials: (a.first[0] + (last[0] || "")).toUpperCase(), email: a.email };
    $$("[data-account]").forEach(function (el) { var k = el.getAttribute("data-account"); if (v[k]) el.textContent = v[k]; });
  }
  showAccount(account);
  $$("[data-account-form]").forEach(function (form) {
    var fields = $$("[data-account-field]", form);
    // Show the stored values in the form, and make them what "Discard" goes back to
    if (account) fields.forEach(function (f) { var k = f.getAttribute("data-account-field"); if (account[k] != null) f.value = f.defaultValue = account[k]; });
    form.addEventListener("casedesk:submit", function () {
      var a = {};
      fields.forEach(function (f) { f.value = f.defaultValue = f.value.trim(); a[f.getAttribute("data-account-field")] = f.value; });
      account = a;
      store.set("casedesk-account", JSON.stringify(a));
      showAccount(a);
    });
  });



  /* Firm settings (settings.html): currency, tax and firm name are kept in this browser ("casedesk-firm") */
  $$("[data-firm-form]").forEach(function (form) {
    var cur = $("[name=currency]", form), tax = $("[name=tax]", form), firm = $("[name=firm]", form);
    var c = cfg.currency, o = $$("option", cur).filter(function (x) { return x.value === c.trim(); })[0];
    if (o) cur.value = cur.dataset.saved = o.value;
    tax.value = tax.defaultValue = cfg.tax;
    if (typeof cfg.firm === "string" && cfg.firm.trim()) firm.value = firm.defaultValue = cfg.firm.slice(0, 60);
    form.addEventListener("casedesk:submit", function () {
      var v = { currency: cur.value, tax: Math.round(Number(tax.value) * 10) / 10, firm: firm.value.trim() };
      store.set("casedesk-firm", JSON.stringify(v));
      cfg.currency = v.currency; cfg.tax = v.tax; cfg.firm = v.firm; showMoney(document);
      window.CaseDeskCharts && window.CaseDeskCharts.renderAll();
    });
    var rs = $("[data-firm-reset]", form);
    if (rs) rs.addEventListener("click", function () {
      try { localStorage.removeItem("casedesk-firm"); } catch (e) { /* storage unavailable */ }
      cfg.currency = "$"; cfg.tax = 10; cur.value = "$"; tax.value = 10; firm.value = "Marlowe & Vance LLP"; showMoney(document);
      toast("Firm settings reset to the demo values");
    });
  });
  if (typeof cfg.firm === "string" && cfg.firm.trim()) $$("[data-firm-name]").forEach(function (el) { el.textContent = cfg.firm.slice(0, 60); });

  /* One-field "add" forms (Settings → Practice areas, Courts) */
  $$("[data-inline-add]").forEach(function (b) {
    var form = b.closest("form");
    function go() { if (!validate(form)) return; addFromForm(form); toast("Added"); form.reset(); }
    // The Add button is the form's submit button, so a click and Enter both arrive here
    form.addEventListener("submit", function (e) { e.preventDefault(); go(); });
  });
  /* Switches that confirm their change */
  $$("[data-toast-toggle]").forEach(function (c) { c.addEventListener("change", function () { toast(c.getAttribute("data-toast-toggle") + (c.checked ? " turned on" : " turned off")); }); });

  /* Sign-in page: switch between "Sign in" and "Reset password" */
  $$("[data-auth-go]").forEach(function (b) {
    b.addEventListener("click", function () {
      var to = b.getAttribute("data-auth-go");
      $$("[data-auth-view]").forEach(function (v) { v.hidden = v.getAttribute("data-auth-view") !== to; });
      var f = $('[data-auth-view="' + to + '"] input'); if (f) f.focus();
    });
  });
  $$("[data-auth-done]").forEach(function (form) {
    form.addEventListener("casedesk:submit", function () { setTimeout(function () { form.reset(); var back = $('[data-auth-go="signin"]'); if (back) back.click(); }, 1600); });
  });

  /* Step-by-step form (new-case.html) ---------------------------------------
     <form data-stepper> with panels [data-step], buttons [data-step-next] / [data-step-back],
     progress items [data-step-dot]. Each step is checked before moving on. [data-review="field"] shows the answers. */
  $$("[data-stepper]").forEach(function (form) {
    var steps = $$("[data-step]", form), dots = $$("[data-step-dot]", form.closest("[data-stepper-wrap]") || form), at = 0;
    function show(i, focus) {
      at = i;
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      dots.forEach(function (d, k) { d.classList.toggle("is-done", k < i); d.classList.toggle("is-on", k === i); if (k === i) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current"); });
      if (i === steps.length - 1) review();
      if (focus) { var h = $("h2", steps[i]); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); } }
    }
    function review() {
      $$("[data-review]", form).forEach(function (el) {
        var names = el.getAttribute("data-review").split(","), out = [];
        names.forEach(function (n) {
          var f = form.elements[n]; if (!f) return;
          // Skip the client fields of the mode that is not chosen (Existing / New client)
          var mode = f.closest && f.closest("[data-mode-new], [data-mode-existing]"); if (mode && mode.hidden) return;
          var v = f.tagName === "SELECT" ? (f.value ? f.options[f.selectedIndex].text : "") : f.type === "checkbox" ? (f.checked ? "Yes" : "No") : f.value.trim();
          if (f.type === "date" && v) { var p = v.split("-"); v = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); }
          if (v) out.push(v);
        });
        el.textContent = out.join(" · ") || "—";
      });
    }
    $$("[data-step-next]", form).forEach(function (b) { b.addEventListener("click", function () { if (validate(steps[at])) show(at + 1, true); }); });
    $$("[data-step-back]", form).forEach(function (b) { b.addEventListener("click", function () { show(at - 1, true); }); });
    $$("[data-step-edit]", form).forEach(function (b) { b.addEventListener("click", function () { show(+b.getAttribute("data-step-edit"), true); }); });
    // Enter moves to the next step instead of sending the form early
    form.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && !/checkbox|radio|submit|button/.test(e.target.type) && at < steps.length - 1) { e.preventDefault(); if (validate(steps[at])) show(at + 1, true); }
    });
    // "Existing client" / "New client" switch
    $$("[data-client-mode]", form).forEach(function (r) {
      r.addEventListener("change", function () {
        var nw = form.elements.clientMode.value === "new";
        $$("[data-mode-new]", form).forEach(function (x) { x.hidden = !nw; $$("input, select", x).forEach(function (i) { i.required = nw && i.hasAttribute("data-req"); }); });
        $$("[data-mode-existing]", form).forEach(function (x) { x.hidden = nw; $$("select", x).forEach(function (i) { i.required = !nw; }); });
      });
    });
    var pre = new URLSearchParams(location.search).get("client");
    if (pre && form.elements.client) { var opt = $$("option", form.elements.client).filter(function (o) { return o.value === pre.toUpperCase(); })[0]; if (opt) form.elements.client.value = opt.value; }
    show(0);
  });

  /* Kanban board (tasks.html) ------------------------------------------------
     [data-board] > [data-col="To do"] > [data-col-list] > [data-card]. Drag a card, or use its "Move to" menu (keyboard and touch). */
  $$("[data-board]").forEach(function (board) {
    var dragged = null;
    function counts() {
      $$("[data-col]", board).forEach(function (col) {
        var n = $$("[data-card]:not([hidden])", col).length, c = $("[data-col-count]", col); if (c) c.textContent = n;
        var e = $("[data-col-empty]", col); if (e) e.hidden = n > 0;
      });
    }
    function move(card, colName, announce) {
      var col = $('[data-col="' + colName + '"] [data-col-list]', board); if (!col || !card) return;
      col.insertBefore(card, col.firstChild);
      card.setAttribute("data-status", colName);
      card.classList.toggle("is-done", colName === "Done");
      if (colName === "Done") { card.classList.remove("is-late"); var late = $("[data-late]", card); if (late) late.hidden = true; }
      $$("[data-move]", card).forEach(function (b) { b.hidden = b.getAttribute("data-move") === colName; });
      counts();
      if (announce) toast("Moved to " + colName);
    }
    board.addEventListener("dragstart", function (e) { var c = e.target.closest("[data-card]"); if (!c) return; dragged = c; c.classList.add("is-dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", c.id); } catch (err) {} });
    board.addEventListener("dragend", function () { if (dragged) dragged.classList.remove("is-dragging"); dragged = null; $$(".is-over", board).forEach(function (x) { x.classList.remove("is-over"); }); });
    $$("[data-col]", board).forEach(function (col) {
      col.addEventListener("dragover", function (e) { if (!dragged) return; e.preventDefault(); col.classList.add("is-over"); });
      col.addEventListener("dragleave", function (e) { if (!col.contains(e.relatedTarget)) col.classList.remove("is-over"); });
      col.addEventListener("drop", function (e) { e.preventDefault(); col.classList.remove("is-over"); if (dragged && dragged.getAttribute("data-status") !== col.getAttribute("data-col")) move(dragged, col.getAttribute("data-col"), true); });
    });
    board.addEventListener("click", function (e) {
      var b = e.target.closest("[data-move]"); if (!b) return;
      closeDropdowns();
      var card = b.closest("[data-card]"); move(card, b.getAttribute("data-move"), true);
      var t = $("[data-dropdown-toggle]", card); if (t) t.focus();
    });
    // Filter chips: [data-board-filter="who:EV" | "late" | "prio:High" | ""]
    var filter = "";
    function applyFilter() {
      var k = filter.split(":")[0], v = filter.split(":")[1];
      $$("[data-card]", board).forEach(function (c) {
        c.hidden = !(!filter || (k === "late" ? c.classList.contains("is-late") : c.getAttribute("data-" + k) === v));
      });
      counts();
    }
    $$("[data-board-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        $$("[data-board-filter]").forEach(function (x) { x.setAttribute("aria-pressed", x === chip); });
        filter = chip.getAttribute("data-board-filter"); applyFilter();
      });
    });
    board.cdMove = move; board.cdCounts = applyFilter;
    counts();
  });
  // Cards added from the "Add task" form get their menu buttons wired by the board's delegated click handler
  document.addEventListener("casedesk:submit", function (e) {
    var b = $("[data-board]"); if (b && b.cdCounts && e.target.hasAttribute("data-add-to")) setTimeout(b.cdCounts, 0);
  });

  /* Timer (time.html): [data-timer] with [data-timer-toggle], [data-timer-display], [data-timer-save] ---------- */
  $$("[data-timer]").forEach(function (box) {
    var disp = $("[data-timer-display]", box), btn = $("[data-timer-toggle]", box), save = $("[data-timer-save]", box), reset = $("[data-timer-reset]", box);
    var started = 0, spent = 0, tick = null, form = $(box.getAttribute("data-timer-form"));
    function now() { return spent + (started ? Date.now() - started : 0); }
    function show() { var t = Math.floor(now() / 1000), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60; disp.textContent = (h < 10 ? "0" : "") + h + ":" + ("0" + m).slice(-2) + ":" + ("0" + sec).slice(-2); }
    function setRunning(on) {
      box.classList.toggle("is-running", on);
      $("[data-timer-label]", btn).textContent = on ? "Pause" : (now() ? "Resume" : "Start");
      btn.setAttribute("aria-pressed", on);
      save.disabled = !now() && !on;
    }
    btn.addEventListener("click", function () {
      if (started) { spent = now(); started = 0; clearInterval(tick); setRunning(false); }
      else { started = Date.now(); tick = setInterval(show, 1000); setRunning(true); }
      show();
    });
    if (reset) reset.addEventListener("click", function () { started = 0; spent = 0; clearInterval(tick); show(); setRunning(false); save.disabled = true; });
    save.addEventListener("click", function () {
      var ms = now(); if (started) { spent = ms; started = 0; clearInterval(tick); }
      var hrs = Math.max(0.1, Math.round(ms / 360000) / 10);
      var m = form && form.closest(".modal");
      if (form) { var h = $("[name=hrs]", form); if (h) h.value = hrs.toFixed(1); var cs = $("[name=case]", form), tc = $("[data-timer-case]", box); if (cs && tc) cs.value = tc.value; var a = $("[name=act]", form), ta = $("[data-timer-act]", box); if (a && ta && ta.value.trim()) a.value = ta.value.trim(); }
      // The timer stays paused (not cleared) until the entry is saved, so Cancel keeps the time
      show(); setRunning(false);
      if (m) { box.cdPending = true; openModal(m.id); } else { spent = 0; show(); save.disabled = true; }
    });
    if (form) form.addEventListener("casedesk:submit", function () {
      if (!box.cdPending || started) return;
      box.cdPending = false; spent = 0; show(); setRunning(false); save.disabled = true;
    });
    show(); save.disabled = true;
  });

  /* Hearing details modal: "Mark completed" / "Adjourn" change the row that opened it */
  $$("[data-hearing-set]").forEach(function (b) {
    b.addEventListener("click", function () {
      var m = b.closest(".modal"), tr = m && m.cdRow, st = b.getAttribute("data-hearing-set");
      if (tr) {
        var badge = $(".badge", $("[data-status-cell]", tr) || tr);
        if (badge) { badge.className = "badge badge-" + (st === "Completed" ? "success" : "warning"); badge.textContent = st; }
        tr.setAttribute("data-status", st);
        syncRow(tr);
        var w = tr.closest("[data-table]"); if (w && w.cdTable) w.cdTable.refresh();
      }
      closeModal(m); toast("Hearing marked as " + st.toLowerCase());
    });
  });
  /* Current year in footers */
  $$("[data-year]").forEach(function (n) { n.textContent = new Date().getFullYear(); });
})();

