/*!
 * CaseDesk Charts — tiny dependency-free SVG charts.
 * Usage: <div class="chart" data-chart='{"type":"area","labels":[...],"series":[{"name":"Revenue","data":[...]}]}'></div>
 * Types: line, area, bar, stacked, donut, spark
 * Colors come from CSS variables (--c1 … --c5) so charts follow light/dark mode automatically.
 */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // Series colours are CSS variables, so charts follow light/dark mode and print with the light colours
  function color(i) { return "var(--c" + ((i % 5) + 1) + ")"; }
  // Round the axis maximum so 4 gridlines land on friendly numbers (0, 25, 50, 75, 100 …)
  function niceMax(v) {
    if (v <= 0) return 4;
    return niceStep(v / 4) * 4;
  }
  function niceStep(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    var steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) if (n <= steps[i] + 1e-9) return steps[i] * p;
    return 10 * p;
  }
  function fmt(v, cfg) {
    // "$" in a chart config follows the currency chosen in Settings (window.CASEDESK.currency)
    var pre = cfg.prefix === "$" && window.CaseDesk ? window.CaseDesk.symbol() : (cfg.prefix || ""), suf = cfg.suffix || "";
    var s;
    if (cfg.compact && Math.abs(v) >= 1000) {
      s = Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    } else {
      s = Number(v).toLocaleString("en-US");
    }
    return pre + s + suf;
  }

  function tooltip(box) {
    var t = box.querySelector(".chart-tip");
    if (!t) { t = document.createElement("div"); t.className = "chart-tip"; t.setAttribute("role", "status"); box.appendChild(t); }
    return t;
  }
  function showTip(box, cfg, idx, x, y) {
    var t = tooltip(box);
    var html = "<b>" + (cfg.labels[idx] || "") + "</b>";
    cfg.series.forEach(function (s, i) {
      html += '<div><i style="background:' + color(s.color != null ? s.color : i) + '"></i>' + s.name + "<span>" + fmt(s.data[idx], cfg) + "</span></div>";
    });
    t.innerHTML = html;
    t.classList.add("show");
    var bw = box.clientWidth, tw = t.offsetWidth;
    var left = Math.min(Math.max(x - tw / 2, 0), bw - tw);
    t.style.left = left + "px";
    t.style.top = Math.max(y - t.offsetHeight - 12, 0) + "px";
  }
  function hideTip(box) { var t = box.querySelector(".chart-tip"); if (t) t.classList.remove("show"); }

  function axes(svg, cfg, W, H, pad, max) {
    var g = el("g", { "class": "axis" }, svg);
    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var val = (max / ticks) * i;
      var y = pad.t + (H - pad.t - pad.b) * (1 - i / ticks);
      el("line", { x1: pad.l, x2: W - pad.r, y1: y, y2: y, "class": "gridline" }, g);
      var tx = el("text", { x: pad.l - 10, y: y + 4, "text-anchor": "end" }, g);
      tx.textContent = fmt(val, Object.assign({}, cfg, { compact: true }));
    }
    var n = cfg.labels.length, every = Math.ceil(n / Math.max(1, Math.floor((W - pad.l - pad.r) / 56)));
    cfg.labels.forEach(function (l, i) {
      if (i % every) return;
      var x = cfg.type === "bar" || cfg.type === "stacked"
        ? pad.l + ((W - pad.l - pad.r) / n) * (i + 0.5)
        : pad.l + ((W - pad.l - pad.r) / Math.max(1, n - 1)) * i;
      var t = el("text", { x: x, y: H - 6, "text-anchor": "middle" }, g);
      t.textContent = l;
    });
  }

  function lineChart(box, cfg) {
    var W = box.clientWidth, H = cfg.height || 280;
    var pad = { t: 12, r: 10, b: 28, l: 48 };
    var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": cfg.title || "Line chart" });
    box.appendChild(svg);
    var max = niceMax(Math.max.apply(null, cfg.series.reduce(function (a, s) { return a.concat(s.data); }, [])));
    axes(svg, cfg, W, H, pad, max);
    var n = cfg.labels.length, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    function X(i) { return pad.l + (iw / Math.max(1, n - 1)) * i; }
    function Y(v) { return pad.t + ih * (1 - v / max); }
    var defs = el("defs", {}, svg);
    cfg.series.forEach(function (s, si) {
      var c = color(s.color != null ? s.color : si);
      var pts = s.data.map(function (v, i) { return [X(i), Y(v)]; });
      var d = smooth(pts);
      if (cfg.type === "area" && !s.dashed) {
        var gid = "g" + Math.random().toString(36).slice(2, 8);
        var lg = el("linearGradient", { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
        el("stop", { offset: "0%", "stop-color": c, "stop-opacity": .22 }, lg);
        el("stop", { offset: "100%", "stop-color": c, "stop-opacity": 0 }, lg);
        el("path", { d: d + " L" + X(n - 1) + "," + (H - pad.b) + " L" + X(0) + "," + (H - pad.b) + " Z", fill: "url(#" + gid + ")" }, svg);
      }
      el("path", { d: d, fill: "none", stroke: c, "stroke-width": 2.25, "stroke-linecap": "round", "stroke-dasharray": s.dashed ? "5 5" : "none" }, svg);
    });
    var guide = el("line", { y1: pad.t, y2: H - pad.b, stroke: "var(--line-strong)", "stroke-width": 1, opacity: 0 }, svg);
    var dots = cfg.series.map(function (s, si) { return el("circle", { r: 4.5, fill: "var(--surface)", stroke: color(s.color != null ? s.color : si), "stroke-width": 2.5, opacity: 0 }, svg); });
    var hit = el("rect", { x: pad.l, y: pad.t, width: iw, height: ih, fill: "transparent" }, svg);
    function move(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      var i = Math.round(((px - pad.l) / iw) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      guide.setAttribute("x1", X(i)); guide.setAttribute("x2", X(i)); guide.setAttribute("opacity", 1);
      dots.forEach(function (d, si) { d.setAttribute("cx", X(i)); d.setAttribute("cy", Y(cfg.series[si].data[i])); d.setAttribute("opacity", 1); });
      showTip(box, cfg, i, X(i), Y(Math.max.apply(null, cfg.series.map(function (s) { return s.data[i]; }))));
    }
    function leave() { guide.setAttribute("opacity", 0); dots.forEach(function (d) { d.setAttribute("opacity", 0); }); hideTip(box); }
    hit.addEventListener("mousemove", move); hit.addEventListener("touchstart", move, { passive: true });
    hit.addEventListener("mouseleave", leave);
  }

  function smooth(pts) {
    if (pts.length < 2) return "";
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var t = 0.18;
      var c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
      var c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += " C" + c1x + "," + c1y + " " + c2x + "," + c2y + " " + p2[0] + "," + p2[1];
    }
    return d;
  }

  function barChart(box, cfg) {
    var W = box.clientWidth, H = cfg.height || 280;
    var pad = { t: 12, r: 10, b: 28, l: 48 };
    var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": cfg.title || "Bar chart" });
    box.appendChild(svg);
    var stacked = cfg.type === "stacked";
    var n = cfg.labels.length;
    var totals = cfg.labels.map(function (_, i) { return cfg.series.reduce(function (a, s) { return a + (stacked ? s.data[i] : 0); }, 0); });
    var max = niceMax(stacked ? Math.max.apply(null, totals) : Math.max.apply(null, cfg.series.reduce(function (a, s) { return a.concat(s.data); }, [])));
    axes(svg, cfg, W, H, pad, max);
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, slot = iw / n;
    var groupW = Math.min(slot * 0.62, stacked ? 30 : 22 * cfg.series.length + 6);
    var bars = [];
    cfg.labels.forEach(function (_, i) {
      var x0 = pad.l + slot * i + (slot - groupW) / 2, acc = 0;
      var g = el("g", {}, svg);
      cfg.series.forEach(function (s, si) {
        var v = s.data[i], h = (v / max) * ih;
        var c = color(s.color != null ? s.color : si);
        var bw = stacked ? groupW : (groupW - 4 * (cfg.series.length - 1)) / cfg.series.length;
        var x = stacked ? x0 : x0 + si * (bw + 4);
        var y = stacked ? pad.t + ih - acc - h : pad.t + ih - h;
        var r = Math.min(5, bw / 2, h);
        el("path", { d: roundTop(x, y, bw, h, (stacked && si < cfg.series.length - 1) ? 0 : r), fill: c }, g);
        acc += h;
      });
      var hit = el("rect", { x: pad.l + slot * i, y: pad.t, width: slot, height: ih, fill: "transparent" }, svg);
      bars.push(g);
      hit.addEventListener("mousemove", function () {
        bars.forEach(function (b, bi) { b.style.opacity = bi === i ? 1 : 0.45; });
        showTip(box, cfg, i, pad.l + slot * (i + 0.5), pad.t + ih - (stacked ? totals[i] : Math.max.apply(null, cfg.series.map(function (s) { return s.data[i]; }))) / max * ih);
      });
      hit.addEventListener("mouseleave", function () { bars.forEach(function (b) { b.style.opacity = 1; }); hideTip(box); });
    });
  }
  function roundTop(x, y, w, h, r) {
    if (h <= 0) return "";
    return "M" + x + "," + (y + h) + " V" + (y + r) + " Q" + x + "," + y + " " + (x + r) + "," + y +
      " H" + (x + w - r) + " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + " V" + (y + h) + " Z";
  }

  function donutChart(box, cfg) {
    var S = cfg.size || 170, R = S / 2, stroke = cfg.thickness || 22;
    var svg = el("svg", { width: S, height: S, viewBox: "0 0 " + S + " " + S, role: "img", "aria-label": cfg.title || "Donut chart" });
    box.appendChild(svg);
    var total = cfg.values.reduce(function (a, b) { return a + b; }, 0);
    var r = R - stroke / 2, C = 2 * Math.PI * r, off = 0, gap = cfg.values.length > 1 ? 3 : 0;
    el("circle", { cx: R, cy: R, r: r, fill: "none", stroke: "var(--line)", "stroke-width": stroke }, svg);
    cfg.values.forEach(function (v, i) {
      var len = (v / total) * C;
      var c = el("circle", {
        cx: R, cy: R, r: r, fill: "none", stroke: color(i), "stroke-width": stroke,
        "stroke-dasharray": Math.max(0, len - gap) + " " + (C - Math.max(0, len - gap)),
        "stroke-dashoffset": -off, transform: "rotate(-90 " + R + " " + R + ")"
      }, svg);
      c.addEventListener("mouseenter", function () { center(cfg.labels[i], fmt(v, cfg)); });
      c.addEventListener("mouseleave", function () { reset(); });
      off += len;
    });
    var t1 = el("text", { x: R, y: R - 2, "text-anchor": "middle", "class": "donut-center", "font-size": 24, "font-weight": 700, fill: "var(--ink)" }, svg);
    var t2 = el("text", { x: R, y: R + 18, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-3)" }, svg);
    function center(a, b) { t1.textContent = b; t2.textContent = a; }
    // A centerValue starting with "$" follows the currency too ("$5,377" → "€5,377")
    var cv = cfg.centerValue && window.CaseDesk ? String(cfg.centerValue).replace(/^\$/, window.CaseDesk.symbol()) : cfg.centerValue;
    var reset = function () { center(cfg.centerLabel || "Total", cv || fmt(total, cfg)); };
    reset();
  }

  function sparkChart(box, cfg) {
    var W = box.clientWidth, H = box.clientHeight || 34, d = cfg.data;
    var min = Math.min.apply(null, d), max = Math.max.apply(null, d), rng = max - min || 1;
    var pts = d.map(function (v, i) { return [(W / (d.length - 1)) * i, H - 3 - ((v - min) / rng) * (H - 6)]; });
    var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
    box.appendChild(svg);
    var c = color(cfg.color || 0);
    var gid = "s" + Math.random().toString(36).slice(2, 8);
    var lg = el("linearGradient", { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, el("defs", {}, svg));
    el("stop", { offset: "0%", "stop-color": c, "stop-opacity": .25 }, lg);
    el("stop", { offset: "100%", "stop-color": c, "stop-opacity": 0 }, lg);
    var p = smooth(pts);
    el("path", { d: p + " L" + W + "," + H + " L0," + H + " Z", fill: "url(#" + gid + ")" }, svg);
    el("path", { d: p, fill: "none", stroke: c, "stroke-width": 2, "stroke-linecap": "round" }, svg);
  }

  function render(box) {
    var cfg;
    try { cfg = JSON.parse(box.getAttribute("data-chart")); } catch (e) { return; }
    box.innerHTML = "";
    if (cfg.type === "donut") donutChart(box, cfg);
    else if (cfg.type === "spark") sparkChart(box, cfg);
    else if (cfg.type === "bar" || cfg.type === "stacked") barChart(box, cfg);
    else lineChart(box, cfg);
  }
  function renderAll(root) { (root || document).querySelectorAll("[data-chart]").forEach(render); }

  // Reserve each chart's height straight away, so the page does not jump when the charts are drawn
  document.querySelectorAll("[data-chart]").forEach(function (box) {
    try {
      var cfg = JSON.parse(box.getAttribute("data-chart"));
      if (cfg.type === "donut") box.style.minHeight = (cfg.size || 170) + "px";
      else if (cfg.type !== "spark") box.style.minHeight = (cfg.height || 280) + "px";
    } catch (e) { /* drawn as nothing */ }
  });

  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(renderAll, 150); });
  document.addEventListener("themechange", function () { renderAll(); });
  if (document.readyState !== "loading") renderAll(); else document.addEventListener("DOMContentLoaded", function () { renderAll(); });

  window.CaseDeskCharts = { render: render, renderAll: renderAll };
})();
