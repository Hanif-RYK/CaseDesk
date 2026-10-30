/*!
 * CaseDesk — case and client pages (case-detail.html, client-detail.html).
 * Both pages are drawn from the JSON in <script type="application/json" id="cd-data"> / id="cl-data">.
 * To use your own backend, fetch the same shape from your API and call CaseDeskMatters.renderCase(data).
 * case-detail.html?id=CD-2026-0151 shows that case; client-detail.html?id=CL-102 shows that client.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CD = window.CaseDesk || { fmt: function (v) { return "$" + Number(v).toFixed(2); } };
  var toast = window.cdToast || function () {};
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function parse(iso) { var p = String(iso).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dateText(iso, year) { if (!iso) return "—"; var d = parse(iso); return MONTHS[d.getMonth()] + " " + ("0" + d.getDate()).slice(-2) + (year === false ? "" : ", " + d.getFullYear()); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  function size(kb) { return kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB"; }
  function read(id) { var el = document.getElementById(id); if (!el) return null; try { return JSON.parse(el.textContent); } catch (e) { return null; } }
  var TONES = { Active: "success", Pending: "warning", Closed: "info", Scheduled: "info", Completed: "success", Adjourned: "warning", High: "warning", Medium: "info",
    Paid: "success", "Partly paid": "warning", Sent: "info", Overdue: "danger", "To do": "", "In progress": "info", Done: "success", Billed: "success", Unbilled: "warning",
    Won: "success", Settled: "info", Lost: "danger", Withdrawn: "" };
  function hname(p) { return /hearing$/i.test(p) ? p : p + " hearing"; }
  function badge(t, tone) { tone = tone != null ? tone : (TONES[t] || ""); return '<span class="badge' + (tone ? " badge-" + tone : "") + '">' + esc(t) + "</span>"; }

  /* ---------------------------------------------------------------- Case page */
  var data = read("cd-data");
  if (data && $("[data-case-view]")) {
    var param = new URLSearchParams(location.search).get("id");
    var want = (param || data.featured).trim().toUpperCase();
    var c = data.cases.filter(function (x) { return x.id === want; })[0];
    if (!c) {
      $("[data-case-view]").hidden = true;
      var miss = $("[data-case-missing]"); miss.hidden = false;
      $("[data-missing-text]", miss).textContent = /^[A-Z]{2}-\d{4}-\d{3,4}$/.test(want) ? "There is no case " + want + " in this demo." : "That is not a case number. Case numbers look like CD-2026-0148.";
      document.title = "Case not found · CaseDesk";
      $$(".modal").forEach(function (m) { m.remove(); });
    } else {
      renderCase(c);
    }
  }

  function renderCase(c) {
    var I = data.icons, TEAM = data.team, CLIENTS = data.clients, TODAY = data.today;
    var av = function (p, cls) { return '<span class="avatar ' + (cls || "avatar-sm") + '" style="background:' + esc(p.color) + '" aria-hidden="true">' + esc(p.initials) + "</span>"; };
    var person = function (p, sub, href) { return '<div class="person">' + av(p) + "<div><b>" + (href ? '<a href="' + href + '">' + esc(p.name) + "</a>" : esc(p.name)) + "</b><small>" + esc(sub) + "</small></div></div>"; };
    var cl = CLIENTS[c.client], law = TEAM[c.lawyer], sup = TEAM[c.support];
    document.title = c.id + " · " + c.title + " · CaseDesk";
    var upcoming = c.hearings.filter(function (h) { return h.date >= TODAY && h.status === "Scheduled"; });
    var next = upcoming[0];
    var inDays = function (iso) { var n = daysBetween(TODAY, iso); return n === 0 ? "today" : n === 1 ? "tomorrow" : n < 0 ? Math.abs(n) + " days ago" : "in " + n + " days"; };
    var view = Object.assign({}, c, {
      openedText: dateText(c.opened),
      docSummary: c.docs.length + " documents in the file"
    });
    $$("[data-c]").forEach(function (el) { var k = el.getAttribute("data-c"); if (view[k] != null) el.textContent = view[k]; });
    $("[data-c-icon]").innerHTML = I[c.areaIcon] || I.scale;
    var html = {
      client: person(cl, cl.contact, "client-detail.html?id=" + encodeURIComponent(c.client)),
      lawyer: person(law, law.role),
      nextShort: next ? "<b>" + dateText(next.date) + "</b><small>" + esc(next.time) + " · " + esc(next.purpose) + " · " + inDays(next.date) + "</small>" : '<span class="muted">Not listed</span>'
    };
    $$("[data-c-html]").forEach(function (el) { el.innerHTML = html[el.getAttribute("data-c-html")] || ""; });
    var closed = c.status === "Closed";
    $("[data-c-badges]").innerHTML = badge(c.status) + badge(c.priority + " priority", TONES[c.priority]) + badge("Stage: " + c.stage, "primary");
    var cb = $("[data-close-btn]"); if (cb) cb.hidden = closed;

    var list = function (name, inner) { $$('[data-c-list="' + name + '"]').forEach(function (el) { el.innerHTML = inner; }); };
    var count = function (name, n) { var el = $('[data-c-count="' + name + '"]'); if (el) el.textContent = n ? n : ""; };

    // Next hearing
    list("next", next ? '<div class="next-hearing"><div class="nh-date"><small>' + DAYS[parse(next.date).getDay()] + "</small><b>" + parse(next.date).getDate() + "</b><small>" + MONTHS[parse(next.date).getMonth()] + " " + parse(next.date).getFullYear() + "</small></div>" +
      '<div class="nh-main"><span class="eyebrow">Next hearing · ' + inDays(next.date) + "</span><h2>" + esc(hname(next.purpose)) + "</h2>" +
      '<dl class="nh-facts"><div><dt>Time</dt><dd class="mono">' + esc(next.time) + "</dd></div><div><dt>Court</dt><dd>" + esc(c.court) + "</dd></div><div><dt>Room</dt><dd>" + esc(c.room) + "</dd></div><div><dt>Before</dt><dd>" + esc(c.judge) + "</dd></div></dl>" +
      '<p class="nh-prep">' + I.check + "<span><b>Prepare:</b> " + esc(next.next) + "</span></p>" +
      '<div class="flex gap-8 wrap"><a class="btn btn-sm" href="calendar.html?date=' + next.date + '">' + I.calendar + 'Open in calendar</a><a class="btn btn-sm" href="cause-list.html?date=' + next.date + '">' + I.list + "Cause list</a></div></div></div>"
      : '<div class="card-body empty-note">' + I.calendar + "<p>No hearing is listed for this case.</p>" + (closed ? "" : '<button class="btn btn-sm" type="button" data-modal-open="add-hearing">Add hearing</button>') + "</div>");

    // Tasks
    var taskRow = function (t) {
      var done = t.status === "Done";
      var due = t.overdue ? badge("Overdue", "danger") : done ? badge("Done") : badge(t.due === TODAY ? "Due today" : "Due " + dateText(t.due, false), t.kind === "deadline" ? "warning" : "");
      return '<li class="task' + (done ? " is-done" : "") + '" data-task="' + esc(t.id) + '"><label class="check"><input type="checkbox"' + (done ? " checked" : "") + '><span class="sr-only">Mark done: </span></label>' +
        '<div class="grow"><b class="strong">' + esc(t.title) + "</b><small class=\"muted\">" + (t.kind === "deadline" ? "Court deadline · " : "") + esc(TEAM[t.who].name) + " · " + esc(t.priority) + " priority</small></div>" + due + "</li>";
    };
    var openT = c.tasks.filter(function (t) { return t.status !== "Done"; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    list("tasksOpen", openT.length ? openT.slice(0, 5).map(taskRow).join("") : '<li class="muted">No open tasks.</li>');
    list("tasks", c.tasks.length ? openT.concat(c.tasks.filter(function (t) { return t.status === "Done"; })).map(taskRow).join("") : '<li class="muted">No tasks yet.</li>');
    count("tasks", openT.length);

    // Notes
    var noteHtml = function (n) { var w = TEAM[n.who]; return '<article class="note">' + av(w) + '<div><div class="note-head"><b>' + esc(w.name) + "</b><small>" + dateText(n.date) + "</small></div><p>" + esc(n.text) + "</p></div></article>"; };
    list("notesLatest", c.notes.length ? c.notes.slice(0, 2).map(noteHtml).join("") : '<p class="muted">No notes yet.</p>');
    list("notes", c.notes.length ? c.notes.map(noteHtml).join("") : '<p class="muted">No notes yet.</p>');
    count("notes", c.notes.length);

    // Billing summary
    var kv = [["Hours recorded", c.hours.toFixed(1) + " h"], ["Unbilled time", CD.fmt(c.unbilled)], ["Expenses", CD.fmt(c.expenses)], ["Invoiced", CD.fmt(c.invoiced)], ["Outstanding", CD.fmt(c.outstanding)]];
    list("billingKv", kv.map(function (r, i) { return "<div" + (i === 4 && c.outstanding > 0 ? ' class="is-due"' : "") + "><dt>" + r[0] + "</dt><dd class=\"mono\">" + r[1] + "</dd></div>"; }).join(""));
    list("billingStats", [["timer", c.hours.toFixed(1) + " h", "Hours recorded", "primary"], ["clock", CD.fmt(c.unbilled), "Unbilled time", "warning"], ["invoice", CD.fmt(c.invoiced), "Invoiced", "info"], ["alert", CD.fmt(c.outstanding), "Outstanding", c.outstanding > 0 ? "warning" : "success"]]
      .map(function (s) { return '<div class="card card-body stat"><span class="ic bg-' + s[3] + '-soft">' + I[s[0]] + "</span><div><b>" + s[1] + "</b><span>" + s[2] + "</span></div></div>"; }).join(""));
    list("time", c.time.length ? c.time.map(function (t) {
      var st = !t.billable ? badge("Non-billable", "") : t.billed ? badge("Billed") : badge("Unbilled");
      return '<tr><td data-value="' + t.date + '">' + dateText(t.date) + "</td><td>" + person(TEAM[t.who], TEAM[t.who].role) + "</td><td>" + esc(t.act) + '</td><td class="right mono">' + Number(t.hrs).toFixed(1) + '</td><td class="right mono">' + (t.billable ? CD.fmt(t.amount) : "—") + "</td><td>" + st + "</td></tr>";
    }).join("") : '<tr class="empty-row"><td colspan="6">No time recorded yet.</td></tr>');
    list("invoices", c.invoices.length ? c.invoices.map(function (i) {
      return '<li><div class="grow"><a class="strong mono" href="invoice.html?no=' + i.no + '">' + i.no + '</a><small class="muted d-block">Issued ' + dateText(i.issued, false) + " · due " + dateText(i.due, false) + '</small></div><div class="text-right"><b class="mono">' + CD.fmt(i.total) + "</b>" + badge(i.balance > 0 && i.due < TODAY && i.status !== "Draft" ? "Overdue" : i.status) + "</div></li>";
    }).join("") : '<li class="muted">No invoices yet.</li>');

    // People
    list("people", "<li>" + person(cl, cl.contact + " · client", "client-detail.html?id=" + encodeURIComponent(c.client)) + '<a class="icon-btn" href="mailto:' + esc(cl.email) + '" aria-label="Email ' + esc(cl.contact) + '">' + I.mail + "</a></li>" +
      "<li>" + person(law, law.role + " · lead") + '<span class="badge">Lead</span></li><li>' + person(sup, sup.role + " · support") + "</li>");

    // Documents
    var docRow = function (x, compact) {
      return '<li class="doc-row" data-cat="' + esc(x.cat) + '">' + docIc(x.ext) + '<div class="grow"><b>' + esc(x.name) + '</b><small class="muted">' + esc(x.cat) + " · " + dateText(x.date, !compact) + (compact ? "" : " · " + esc(TEAM[x.who] ? TEAM[x.who].name : x.who)) + " · " + size(x.kb) + "</small></div>" +
        (compact ? "" : '<button class="icon-btn" type="button" data-doc-open="' + esc(x.name) + '" aria-label="Preview ' + esc(x.name) + '">' + I.eye + '</button>') + '<button class="icon-btn" type="button" data-doc-get="' + esc(x.name) + '" aria-label="Download ' + esc(x.name) + '">' + I.download + "</button></li>";
    };
    list("docsLatest", c.docs.length ? c.docs.slice(0, 4).map(function (x) { return docRow(x, true); }).join("") : '<li class="muted">No documents yet.</li>');
    list("docs", c.docs.map(function (x) { return docRow(x); }).join(""));
    count("docs", c.docs.length);
    filterDocs();

    // Hearings
    list("hearings", c.hearings.length ? c.hearings.map(function (h) {
      var past = h.date < TODAY;
      return '<tr><td data-value="' + h.date + '"><b class="strong">' + dateText(h.date) + "</b></td><td class=\"mono\">" + esc(h.time) + "</td><td>" + esc(h.purpose) + "</td><td>" + badge(h.status) + "</td><td>" + (past ? esc(h.outcome) : '<span class="muted">Prepare: </span>' + esc(h.next)) + "</td></tr>";
    }).join("") : '<tr class="empty-row"><td colspan="5">No hearings yet.</td></tr>');
    count("hearings", upcoming.length);

    // Timeline
    list("timeline", c.timeline.map(function (e) {
      return '<li class="tl-item is-' + e.state + '"><span class="tl-dot">' + (I[e.icon] || I.flag) + '</span><div class="tl-body"><small class="mono">' + dateText(e.date) + (e.state === "next" ? " · next" : "") + "</small><b>" + esc(e.title) + "</b><p>" + esc(e.text) + "</p></div></li>";
    }).join(""));

    // Activity: a feed built from the case's documents, tasks, hearings, notes and time
    var feed = [];
    c.docs.forEach(function (x) { feed.push([x.date, x.who, "uploaded <b>" + esc(x.name) + "</b>", "upload"]); });
    c.tasks.filter(function (t) { return t.status === "Done"; }).forEach(function (t) { feed.push([t.due, t.who, "completed the task <b>" + esc(t.title) + "</b>", "check"]); });
    c.hearings.filter(function (h) { return h.date < TODAY; }).forEach(function (h) { feed.push([h.date, c.lawyer, "attended the <b>" + esc(hname(h.purpose).toLowerCase()) + "</b> — " + esc(h.outcome.toLowerCase()), "gavel"]); });
    c.notes.forEach(function (n) { feed.push([n.date, n.who, "added a note", "note"]); });
    c.time.slice(0, 6).forEach(function (t) { feed.push([t.date, t.who, "recorded " + Number(t.hrs).toFixed(1) + " h — " + esc(t.act.toLowerCase()), "timer"]); });
    feed.push([c.opened, c.lawyer, "opened the case", "folder"]);
    feed.sort(function (a, b) { return a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0; });
    list("activity", feed.slice(0, 18).map(function (f) {
      var w = TEAM[f[1]];
      return '<li><span class="feed-ic">' + I[f[3]] + "</span><p><b>" + esc(w.name) + "</b> " + f[2] + '</p><small class="muted">' + dateText(f[0]) + "</small></li>";
    }).join(""));

  }

  function docIc(ext) {
    var t = { pdf: ["#b3382b", "#fbe5e1"], docx: ["#2b6386", "#e1edf5"], xlsx: ["#1d7a46", "#e2f3e8"], zip: ["#87591a", "#fbefd8"] }[ext] || ["#454b57", "#eeece6"];
    return '<span class="doc-ic" style="--tb:' + t[1] + ";--ti:" + t[0] + '" aria-hidden="true">' + esc(String(ext).toUpperCase()) + "</span>";
  }

  // Document filter (category chips + search)
  var docCat = "";
  function filterDocs() {
    var q = $("[data-doc-search]"), term = q ? q.value.trim().toLowerCase() : "", shown = 0;
    $$('[data-c-list="docs"] .doc-row').forEach(function (r) {
      var ok = (!docCat || r.getAttribute("data-cat") === docCat) && (!term || r.textContent.toLowerCase().indexOf(term) > -1);
      r.hidden = !ok; if (ok) shown++;
    });
    var e = $("[data-doc-empty]"); if (e) e.hidden = shown > 0;
  }
  $$("[data-doc-cat]").forEach(function (b) {
    b.addEventListener("click", function () {
      docCat = b.getAttribute("data-doc-cat");
      $$("[data-doc-cat]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      filterDocs();
    });
  });
  var ds = $("[data-doc-search]"); if (ds) ds.addEventListener("input", filterDocs);
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-doc-open]"), g = e.target.closest("[data-doc-get]"), go = e.target.closest("[data-tab-go]");
    if (o) toast("Preview of " + o.getAttribute("data-doc-open") + " — connect your file storage to show it");
    if (g) toast("Download of " + g.getAttribute("data-doc-get") + " — connect your file storage to serve it");
    if (go) { var tab = document.getElementById(go.getAttribute("data-tab-go") + "-tab"); if (tab) { tab.click(); tab.focus(); tab.scrollIntoView({ block: "nearest" }); } }
  });
  // Ticking a task marks it done (in this page only)
  document.addEventListener("change", function (e) {
    var cb = e.target.closest("[data-task] input[type=checkbox]");
    if (!cb || !data) return;
    var id = cb.closest("[data-task]").getAttribute("data-task");
    var c = currentCase(); if (!c) return;
    c.tasks.forEach(function (t) { if (t.id === id) { t.status = cb.checked ? "Done" : "To do"; t.overdue = !cb.checked && t.due < data.today; } });
    renderCase(c);
    var again = $('[data-c-list="tasks"] [data-task="' + id + '"] input') || $('[data-task="' + id + '"] input'); if (again) again.focus();
    toast(cb.checked ? "Task marked as done" : "Task reopened");
  });
  function currentCase() {
    if (!data) return null;
    var want = (new URLSearchParams(location.search).get("id") || data.featured).trim().toUpperCase();
    return data.cases.filter(function (x) { return x.id === want; })[0];
  }

  // Forms in the case modals add to the case shown (kept in this page only)
  document.addEventListener("casedesk:submit", function (e) {
    var form = e.target, kind = form.getAttribute("data-case-form");
    if (kind && data) {
      var c = currentCase(); if (!c) return;
      var v = {}; $$("[name]", form).forEach(function (f) { v[f.name] = f.type === "file" ? (f.files[0] ? f.files[0].name : "") : f.value.trim(); });
      if (kind === "note") c.notes.unshift({ date: data.today, who: "EV", text: v.text });
      if (kind === "doc") { var ext = (v.file.split(".").pop() || "pdf").toLowerCase(); if (!/^(pdf|docx|xlsx|zip)$/.test(ext)) ext = "pdf"; c.docs.unshift({ id: "DOC-new", name: v.name + "." + ext, cat: v.cat, date: data.today, who: "EV", kb: 120, ext: ext }); }
      if (kind === "hearing") { c.hearings.push({ id: "H-new", date: v.date, time: v.time, purpose: v.purpose, status: "Scheduled", outcome: "", next: v.next || "To be confirmed" }); c.hearings.sort(function (a, b) { return a.date + a.time < b.date + b.time ? -1 : 1; }); c.timeline.push({ date: v.date, title: hname(v.purpose), text: c.room + ", " + v.time + " before " + c.judge + ".", icon: "calendar", state: "future" }); c.timeline.sort(function (a, b) { return a.date < b.date ? -1 : 1; }); fixTimeline(c); }
      if (kind === "task") c.tasks.unshift({ id: "T-" + Date.now(), title: v.title, who: v.who, due: v.due, priority: v.priority, status: "To do", kind: v.kind, overdue: v.due < data.today });
      if (kind === "time") { var h = Math.round(Number(v.hrs) * 10) / 10, rate = { EV: 420, DO: 380, PR: 290, MH: 240, SM: 230, JW: 220, AB: 120, KM: 110 }[v.who] || 200; c.time.unshift({ date: data.today, who: v.who, act: v.act, hrs: h, amount: Math.round(h * rate * 100) / 100, billable: true, billed: false }); c.hours = Math.round((c.hours + h) * 10) / 10; c.unbilled = Math.round((c.unbilled + h * rate) * 100) / 100; }
      if (kind === "close") { c.status = "Closed"; c.stage = v.outcome; c.timeline.push({ date: data.today, title: "Case closed — " + v.outcome.toLowerCase(), text: "Closed by Eleanor Vance.", icon: "flag", state: "done" }); }
      renderCase(c);
    }
    var ck = form.getAttribute("data-client-form");
    if (ck && cdata) {
      var k = currentClient(); if (!k) return;
      var w = {}; $$("[name]", form).forEach(function (f) { w[f.name] = f.value.trim(); });
      cdata.clientData[k].contacts.unshift({ date: cdata.today, type: w.type, who: w.who, text: w.text });
      renderClient(k);
    }
  });
  function fixTimeline(c) {
    var seenNext = false;
    c.timeline.forEach(function (e) { if (e.date >= data.today && e.state !== "done") { e.state = seenNext ? "future" : "next"; seenNext = true; } });
  }

  /* -------------------------------------------------------------- Client page */
  var cdata = read("cl-data");
  function currentClient() {
    var want = (new URLSearchParams(location.search).get("id") || cdata.featured).trim().toUpperCase();
    return cdata.clients[want] ? want : null;
  }
  if (cdata && $("[data-client-view]")) {
    var kid = currentClient();
    if (!kid) {
      var raw = (new URLSearchParams(location.search).get("id") || "").trim().toUpperCase();
      $("[data-client-view]").hidden = true;
      var m2 = $("[data-client-missing]"); m2.hidden = false;
      $("[data-missing-text]", m2).textContent = /^CL-\d{3}$/.test(raw) ? "There is no client " + raw + " in this demo." : "That is not a client number. Client numbers look like CL-101.";
      document.title = "Client not found · CaseDesk";
      $$(".modal").forEach(function (m) { m.remove(); });
    } else renderClient(kid);
  }
  function renderClient(id) {
    var I = cdata.icons, TEAM = cdata.team, k = cdata.clients[id], d = cdata.clientData[id], TODAY = cdata.today;
    var av = function (p) { return '<span class="avatar avatar-sm" style="background:' + esc(p.color) + '" aria-hidden="true">' + esc(p.initials) + "</span>"; };
    document.title = k.name + " · Clients · CaseDesk";
    var open = d.cases.filter(function (c) { return c.status !== "Closed"; }).length;
    var billed = d.invoices.filter(function (i) { return i.status !== "Draft"; }).reduce(function (a, i) { return a + i.total; }, 0);
    var due = d.invoices.filter(function (i) { return i.status !== "Draft"; }).reduce(function (a, i) { return a + i.balance; }, 0);
    var lastPay = d.payments.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
    var v = Object.assign({ id: id }, k, { sinceText: dateText(k.since), openCases: open + " of " + d.cases.length, billedText: CD.fmt(billed), lastPayText: lastPay ? CD.fmt(lastPay.amount) + " on " + dateText(lastPay.date, false) : "None yet" });
    $$("[data-k]").forEach(function (el) { var f = el.getAttribute("data-k"); if (v[f] != null) el.textContent = v[f]; });
    $$("[data-k-html]").forEach(function (el) { el.innerHTML = due > 0 ? '<b class="strong">' + CD.fmt(due) + "</b>" : CD.fmt(0); });
    var a = $("[data-k-avatar]"); a.textContent = k.initials; a.style.background = k.color;
    $("[data-k-mail]").href = "mailto:" + k.email;
    $("[data-k-newcase]").href = "new-case.html?client=" + encodeURIComponent(id);
    var list = function (n, h) { var el = $('[data-k-list="' + n + '"]'); if (el) el.innerHTML = h; };
    var count = function (n, x) { var el = $('[data-k-count="' + n + '"]'); if (el) el.textContent = x || ""; };
    list("cases", d.cases.length ? d.cases.map(function (c) {
      return '<tr><td><div class="case-cell"><a class="case-title" href="case-detail.html?id=' + c.id + '">' + esc(c.title) + '</a><small><span class="mono">' + c.id + "</span> · " + esc(c.kind) + "</small></div></td><td>" + esc(c.area) + "</td><td>" + esc(c.court) + "</td><td>" +
        '<div class="person">' + av(TEAM[c.lawyer]) + "<div><b>" + esc(TEAM[c.lawyer].name) + "</b><small>" + esc(TEAM[c.lawyer].role) + "</small></div></div></td><td>" + (c.next ? dateText(c.next) : '<span class="muted">Not set</span>') + "</td><td>" + badge(c.status) + "</td></tr>";
    }).join("") : '<tr class="empty-row"><td colspan="6">No cases yet.</td></tr>');
    count("cases", d.cases.length);
    list("invoices", d.invoices.length ? d.invoices.map(function (i) {
      var st = i.balance > 0 && i.due < TODAY && i.status !== "Draft" ? "Overdue" : i.status;
      return '<tr><td><a class="mono strong" href="invoice.html?no=' + i.no + '">' + i.no + '</a></td><td><a class="mono" href="case-detail.html?id=' + i.case + '">' + i.case + "</a></td><td>" + dateText(i.issued) + "</td><td>" + dateText(i.due) + '</td><td class="right mono">' + CD.fmt(i.total) + '</td><td class="right mono">' + CD.fmt(i.balance) + "</td><td>" + badge(st) + "</td></tr>";
    }).join("") : '<tr class="empty-row"><td colspan="7">No invoices yet.</td></tr>');
    list("payments", d.payments.length ? d.payments.map(function (p) {
      return '<li><div class="grow"><b class="strong mono">' + CD.fmt(p.amount) + '</b><small class="muted d-block">' + esc(p.method) + " · " + p.invoice + '</small></div><span class="muted small">' + dateText(p.date) + "</span></li>";
    }).join("") : '<li class="muted">No payments yet.</li>');
    count("billing", d.invoices.length);
    list("docs", d.docs.length ? d.docs.map(function (x) {
      return '<li class="doc-row">' + docIc(x.ext) + '<div class="grow"><b>' + esc(x.name) + '</b><small class="muted"><a class="mono" href="case-detail.html?id=' + x.case + '">' + x.case + "</a> · " + esc(x.cat) + " · " + dateText(x.date) + " · " + size(x.kb) + "</small></div>" +
        '<button class="icon-btn" type="button" data-doc-get="' + esc(x.name) + '" aria-label="Download ' + esc(x.name) + '">' + I.download + "</button></li>";
    }).join("") : '<li class="muted">No documents yet.</li>');
    count("docs", d.docs.length);
    var tic = { "Phone call": "phone", Meeting: "users", Email: "mail", "Video call": "eye" };
    list("contacts", d.contacts.length ? d.contacts.map(function (x) {
      return '<li><span class="feed-ic">' + I[tic[x.type] || "phone"] + "</span><p><b>" + esc(x.type) + "</b> with " + esc(TEAM[x.who].name) + " — " + esc(x.text) + '</p><small class="muted">' + dateText(x.date) + "</small></li>";
    }).join("") : '<li class="muted">Nothing logged yet.</li>');
    count("contacts", d.contacts.length);
  }


  /* ------------------------------------------------------------- Invoice page */
  var idata = read("inv-data");
  if (idata && $("[data-invoice]")) {
    var qs = new URLSearchParams(location.search), no = (qs.get("no") || idata.featured).trim().toUpperCase().replace(/^#/, "");
    var iv = idata.invoices[no];
    if (!iv) {
      $("[data-invoice]").hidden = true; $$(".page-head .actions .btn:not([href])").forEach(function (b) { b.hidden = true; });
      var mi = $("[data-invoice-missing]"); mi.hidden = false;
      $("[data-missing-text]", mi).textContent = /^INV-\d{4}-\d{4}$/.test(no) ? "There is no invoice " + no + " in this demo." : "That is not an invoice number. Invoice numbers look like INV-2026-0142.";
      $$('[data-iv="no"]').forEach(function (e) { e.textContent = "—"; });
      // The "not found" card has the page's only heading
      $$(".page-head h1, .page-head [data-iv-sub]").forEach(function (e) { e.hidden = true; });
      document.title = "Invoice not found · CaseDesk";
    } else {
      document.title = iv.no + " · Invoice · CaseDesk";
      var v = Object.assign({}, iv, { issuedText: dateText(iv.issued), dueText: dateText(iv.due) });
      $$("[data-iv]").forEach(function (el) { var k = el.getAttribute("data-iv"); if (v[k] != null) el.textContent = v[k]; });
      $("[data-iv-sub]").textContent = iv.client + " · " + iv.caseTitle;
      $("[data-iv-status]").innerHTML = badge(iv.status);
      $("[data-iv-qty-h]").textContent = iv.hourly ? "Hours" : "Qty";
      var rows = iv.lines.map(function (l) {
        return "<tr><td class=\"nowrap\">" + dateText(l.date, false) + "</td><td>" + esc(l.desc) + "</td><td>" + esc(l.who) + '</td><td class="right mono">' + (iv.hourly ? Number(l.qty).toFixed(1) : l.qty) + '</td><td class="right mono">' + CD.fmt(l.rate) + '</td><td class="right mono">' + CD.fmt(l.amount) + "</td></tr>";
      });
      if (iv.expenses.length) {
        rows.push('<tr class="inv-sub"><td colspan="6">Disbursements</td></tr>');
        iv.expenses.forEach(function (x) { rows.push('<tr><td></td><td>' + esc(x.desc) + '</td><td></td><td class="right mono">1</td><td class="right mono">' + CD.fmt(x.amount) + '</td><td class="right mono">' + CD.fmt(x.amount) + "</td></tr>"); });
      }
      $("[data-iv-lines]").innerHTML = rows.join("");
      var exp = iv.expenses.reduce(function (a, x) { return a + x.amount; }, 0);
      var t = [["Professional fees", iv.fees]];
      if (exp) t.push(["Disbursements", exp]);
      t.push(["Tax (" + idata.taxRate + "% on fees)", iv.tax]);
      var html = t.map(function (r) { return "<div><span>" + r[0] + "</span><span>" + CD.fmt(r[1]) + "</span></div>"; }).join("") + '<div class="grand"><span>Total</span><span>' + CD.fmt(iv.total) + "</span></div>";
      iv.payments.forEach(function (p) { html += '<div><span>Paid ' + dateText(p.date, false) + " · " + esc(p.method) + "</span><span>-" + CD.fmt(p.amount) + "</span></div>"; });
      html += '<div class="due' + (iv.balance > 0 ? "" : " is-paid") + '"><span>' + (iv.balance > 0 ? "Balance due" : "Paid in full") + "</span><span>" + CD.fmt(iv.balance) + "</span></div>";
      $("[data-iv-totals]").innerHTML = html;
      if (qs.get("print") === "1") setTimeout(function () { window.print(); }, 400);
    }
  }

  // Drawn: show the parts that waited for this script (see [data-pending] in style.css)
  $$("[data-pending]").forEach(function (el) { el.removeAttribute("data-pending"); });

  window.CaseDeskMatters = { renderCase: function (c) { if (data) { data.cases.push(c); } renderCase(c); } };
})();
