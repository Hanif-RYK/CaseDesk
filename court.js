/*!
 * CaseDesk — calendar (calendar.html) and daily cause list (cause-list.html).
 * Both read their events from <script type="application/json"> in the page; replace it with data from your API.
 * calendar.html?date=2026-11-04 and cause-list.html?date=2026-11-04 open on that day.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var toast = window.cdToast || function () {};
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var KIND = { hearing: "Hearing", deadline: "Court deadline", task: "Task", meeting: "Meeting" };
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function read(id) { var el = document.getElementById(id); if (!el) return null; try { return JSON.parse(el.textContent); } catch (e) { return null; } }
  function pad(n) { return ("0" + n).slice(-2); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function validIso(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false; var d = parse(s); return !isNaN(d) && iso(d) === s && d.getFullYear() >= 2000 && d.getFullYear() <= 2100; }
  function longDate(s) { var d = parse(s); return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  var qDate = new URLSearchParams(location.search).get("date");

  /* -------------------------------------------------------------- Calendar */
  var cal = read("cal-data"), root = $("[data-calendar]");
  if (cal && root) {
    var today = cal.today, sel = validIso(qDate) ? qDate : today, cur = parse(sel), view = "month", shown = { hearing: 1, deadline: 1, task: 1, meeting: 1 };
    cur.setDate(1);
    var grid = $("[data-cal-grid]"), agenda = $("[data-cal-agenda]");
    var byDate = function (d) { return cal.events.filter(function (e) { return e.date === d && shown[e.type]; }).sort(function (a, b) { return (a.time || "99") < (b.time || "99") ? -1 : 1; }); };
    var evBtn = function (e, i, cls) {
      var idx = cal.events.indexOf(e);
      return '<button type="button" class="ev ev-' + e.type + (cls ? " " + cls : "") + '" data-ev-i="' + idx + '">' + (e.time ? '<span class="mono">' + esc(e.time) + "</span> " : "") + esc(e.title) + "</button>";
    };
    function render() {
      $("[data-cal-title]").textContent = MONTHS[cur.getMonth()] + " " + cur.getFullYear();
      grid.hidden = view !== "month"; agenda.hidden = view !== "agenda";
      if (view === "month") {
        var first = new Date(cur), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
        var html = '<div class="cal-row cal-head" role="row">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (d) { return '<div role="columnheader">' + d + "</div>"; }).join("") + "</div>";
        for (var w = 0; w < 6; w++) {
          html += '<div class="cal-row" role="row">';
          for (var k = 0; k < 7; k++) {
            var d = new Date(start); d.setDate(start.getDate() + w * 7 + k);
            var s = iso(d), evs = byDate(s), out = d.getMonth() !== cur.getMonth();
            html += '<div class="cal-cell' + (out ? " is-out" : "") + (s === today ? " is-today" : "") + (s === sel ? " is-sel" : "") + (k > 4 ? " is-wkend" : "") + '" role="gridcell">' +
              '<button type="button" class="cal-day-btn" data-day="' + s + '" aria-label="' + longDate(s) + ", " + evs.length + (evs.length === 1 ? " event" : " events") + '"' + (s === sel ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" + d.getDate() + "</button>" +
              '<div class="cal-evs">' + evs.slice(0, 3).map(function (e, i) { return evBtn(e, i); }).join("") + (evs.length > 3 ? '<button type="button" class="ev-more" data-day="' + s + '">+' + (evs.length - 3) + " more</button>" : "") + "</div>" +
              '<span class="cal-dots" aria-hidden="true">' + evs.slice(0, 4).map(function (e) { return '<i class="ev-' + e.type + '"></i>'; }).join("") + "</span></div>";
          }
          html += "</div>";
          // Stop after the week that holds the last day of the month
          var last = new Date(start); last.setDate(start.getDate() + w * 7 + 6);
          if (last.getMonth() !== cur.getMonth() && w >= 3) break;
        }
        grid.innerHTML = html;
      } else {
        var y = cur.getFullYear(), m = cur.getMonth(), days = [], n = new Date(y, m + 1, 0).getDate();
        for (var i = 1; i <= n; i++) { var s2 = iso(new Date(y, m, i)), e2 = byDate(s2); if (e2.length) days.push([s2, e2]); }
        agenda.innerHTML = days.length ? days.map(function (dd) {
          return '<section class="ag-day' + (dd[0] === today ? " is-today" : "") + '"><h3>' + longDate(dd[0]) + (dd[0] === today ? ' <span class="badge badge-primary">Today</span>' : "") + "</h3>" + dd[1].map(function (e) { return evBtn(e, 0, "ev-row"); }).join("") + "</section>";
        }).join("") : '<p class="empty-note">Nothing in ' + MONTHS[m] + " for the chosen types.</p>";
      }
      renderDay();
    }
    function renderDay() {
      var evs = byDate(sel), d = parse(sel);
      $("[data-day-dow]").textContent = sel === today ? "Today · " + DAYS[d.getDay()] : DAYS[d.getDay()];
      $("[data-day-title]").textContent = d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
      $("[data-day-list]").innerHTML = evs.length ? evs.map(function (e) {
        var p = cal.team[e.who];
        return '<li><button type="button" class="day-ev ev-' + e.type + '" data-ev-i="' + cal.events.indexOf(e) + '"><span class="day-time mono">' + (e.time || "All day") + '</span><span class="grow"><b>' + esc(e.title) + "</b><small>" + KIND[e.type] + (e.where ? " · " + esc(e.where) : "") + (p ? " · " + esc(p.name) : "") + "</small></span></button></li>";
      }).join("") : '<li class="muted">Nothing on this day.</li>';
      var f = $("[data-cal-form] [name=date]"); if (f) f.value = sel;
    }
    root.addEventListener("click", function (e) {
      var day = e.target.closest("[data-day]"), ev = e.target.closest("[data-ev-i]");
      if (ev) { openEvent(cal.events[+ev.getAttribute("data-ev-i")]); return; }
      if (day) {
        sel = day.getAttribute("data-day"); var dd = parse(sel);
        if (dd.getMonth() !== cur.getMonth()) { cur = new Date(dd.getFullYear(), dd.getMonth(), 1); render(); } else { $$(".cal-cell.is-sel", grid).forEach(function (c) { c.classList.remove("is-sel"); }); var b = $('[data-day="' + sel + '"].cal-day-btn', grid); if (b) { b.parentNode.classList.add("is-sel"); $$(".cal-day-btn", grid).forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); } renderDay(); }
        var again = $('.cal-day-btn[data-day="' + sel + '"]', grid); if (again && day.classList.contains("cal-day-btn")) again.focus();
        if (window.innerWidth < 960) { var p = $(".cal-day"); if (p) p.scrollIntoView({ behavior: "smooth", block: "start" }); }
      }
    });
    function openEvent(e) {
      var m = $("#event-view"), p = cal.team[e.who];
      var set = function (k, v) { var el = $('[data-ev="' + k + '"]', m); if (el) el.textContent = v; };
      set("kind", KIND[e.type] + (e.case ? " · " + e.case : "")); set("title", e.title); set("when", longDate(e.date) + (e.time ? ", " + e.time : " (all day)"));
      set("where", e.where); set("who", p ? p.name : ""); set("note", e.note);
      $('[data-ev-row="where"]', m).hidden = !e.where; $('[data-ev-row="note"]', m).hidden = !e.note;
      var a = $("[data-ev-case]", m); a.hidden = !e.case; if (e.case) a.href = "case-detail.html?id=" + encodeURIComponent(e.case);
      window.cdOpenModal && window.cdOpenModal("event-view");
    }
    $("[data-cal-prev]").addEventListener("click", function () { cur.setMonth(cur.getMonth() - 1); render(); });
    $("[data-cal-next]").addEventListener("click", function () { cur.setMonth(cur.getMonth() + 1); render(); });
    $("[data-cal-today]").addEventListener("click", function () { sel = today; cur = parse(today); cur.setDate(1); render(); });
    $$("[data-cal-view]").forEach(function (b) { b.addEventListener("click", function () { view = b.getAttribute("data-cal-view"); $$("[data-cal-view]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); render(); }); });
    $$("[data-cal-type]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-cal-type"), on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", on); shown[t] = on ? 1 : 0; render();
      });
    });
    document.addEventListener("casedesk:submit", function (e) {
      if (!e.target.hasAttribute("data-cal-form")) return;
      var v = {}; $$("[name]", e.target).forEach(function (f) { v[f.name] = f.value.trim(); });
      cal.events.push({ type: v.type, date: v.date, time: v.time, title: v.title, case: v.case || null, where: v.where, who: v.who, note: "Added in this page (not saved).", status: "" });
      sel = v.date; cur = parse(v.date); cur.setDate(1); shown[v.type] = 1;
      var chip = $('[data-cal-type="' + v.type + '"]'); if (chip) chip.setAttribute("aria-pressed", "true");
      render();
    });
    render();
  }

  /* ------------------------------------------------------------ Cause list */
  var cl = read("cl-data"), body = $("[data-cl-body]");
  if (cl && body) {
    var input = $("[data-cl-date]"), day = validIso(qDate) ? qDate : cl.today;
    var dates = cl.hearings.map(function (h) { return h.date; }).filter(function (d, i, a) { return a.indexOf(d) === i; }).sort();
    function draw() {
      input.value = day;
      $("[data-cl-title]").textContent = longDate(day);
      var hs = cl.hearings.filter(function (h) { return h.date === day; }).sort(function (a, b) { return a.court === b.court ? (a.time < b.time ? -1 : 1) : (a.court < b.court ? -1 : 1); });
      var courts = hs.map(function (h) { return h.court; }).filter(function (c, i, a) { return a.indexOf(c) === i; });
      var lawyers = hs.map(function (h) { return h.lawyer; }).filter(function (c, i, a) { return a.indexOf(c) === i; });
      $("[data-cl-n]").textContent = hs.length; $("[data-cl-courts]").textContent = courts.length; $("[data-cl-lawyers]").textContent = lawyers.length;
      $("[data-cl-sub]").textContent = hs.length ? "First call " + hs.slice().sort(function (a, b) { return a.time < b.time ? -1 : 1; })[0].time + (day === cl.today ? " · today" : "") : (day === cl.today ? "Today" : "");
      var n = 0;
      body.innerHTML = hs.length ? courts.map(function (c) {
        var rows = hs.filter(function (h) { return h.court === c; });
        return '<section class="cl-court"><h3>' + esc(c) + ' <small>' + esc(rows[0].judge) + "</small></h3>" +
          '<div class="table-wrap"><table class="table cl-table"><thead><tr><th scope="col" class="cl-no">No.</th><th scope="col">Time</th><th scope="col">Case</th><th scope="col">Purpose</th><th scope="col">Room</th><th scope="col">Counsel</th><th scope="col" class="no-print">Ready</th></tr></thead><tbody>' +
          rows.map(function (h) {
            n++; var p = cl.team[h.lawyer];
            return '<tr><td class="mono cl-no">' + n + '</td><td class="mono strong">' + esc(h.time) + '</td><td><a class="case-title" href="case-detail.html?id=' + esc(h.case) + '">' + esc(h.title) + '</a><small class="muted d-block"><span class="mono">' + esc(h.case) + "</span> · " + esc(h.ref) + "</small>" +
              '<small class="cl-prep d-block">Prepare: ' + esc(h.prep) + "</small></td><td>" + esc(h.purpose) + (h.status !== "Scheduled" ? ' <span class="badge">' + esc(h.status) + "</span>" : "") + "</td><td>" + esc(h.room) + "</td><td>" + esc(p.name) + '</td><td class="no-print"><label class="check"><input type="checkbox" data-cl-ready><span class="sr-only">Ready: ' + esc(h.case) + "</span></label></td></tr>";
          }).join("") + "</tbody></table></div></section>";
      }).join("") : '<div class="empty-note cl-empty"><p>No hearings are listed on this day.</p><button class="btn btn-sm" type="button" data-cl-jump>Go to the next day with hearings</button></div>';
      try { history.replaceState(null, "", "?date=" + day); } catch (e) { /* file:// in some browsers */ }
    }
    function step(dir) {
      var d = parse(day);
      do { d.setDate(d.getDate() + dir); } while (d.getDay() === 0 || d.getDay() === 6);
      day = iso(d); draw();
    }
    $("[data-cl-prev]").addEventListener("click", function () { step(-1); });
    $("[data-cl-next]").addEventListener("click", function () { step(1); });
    input.addEventListener("change", function () { if (validIso(input.value)) { day = input.value; draw(); } else input.value = day; });
    body.addEventListener("click", function (e) {
      if (!e.target.closest("[data-cl-jump]")) return;
      var nx = dates.filter(function (d) { return d > day; })[0] || dates[dates.length - 1]; day = nx; draw();
    });
    body.addEventListener("change", function (e) { if (e.target.matches("[data-cl-ready]")) { e.target.closest("tr").classList.toggle("is-ready", e.target.checked); toast(e.target.checked ? "Marked as ready" : "Marked as not ready"); } });
    draw();
  }
})();
