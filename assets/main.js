/* Legacy Life Inc. — site behaviour: menu, scroll reveal, Business Health Check, contact form. */
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  var CONTACT_EMAIL = "director@legacylifeinc.com";
  var CONTACT_PHONE = "443-752-8886";

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var navLinks = document.getElementById("nav-links");
  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", function () {
      var open = menuBtn.getAttribute("aria-expanded") === "true";
      menuBtn.setAttribute("aria-expanded", String(!open));
      menuBtn.querySelector(".label").textContent = open ? "Menu" : "Close";
      navLinks.classList.toggle("open", !open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navLinks.classList.contains("open")) { menuBtn.click(); menuBtn.focus(); }
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Gentle reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Safe storage helpers ---------- */
  function store(key, val) { try { sessionStorage.setItem(key, val); } catch (e) {} }
  function recall(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }

  /* ======================================================
     Business Health Check
     ====================================================== */
  var tool = document.getElementById("health-check");
  if (tool) initHealthCheck(tool);

  function money(n) {
    var neg = n < 0; n = Math.abs(Math.round(n));
    var s = n >= 1000000 ? "$" + (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M" : "$" + n.toLocaleString("en-US");
    return (neg ? "−" : "") + s;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function colorFor(score) { return score >= 75 ? "#5FB38A" : score >= 50 ? "#D9A441" : "#E07B5A"; }

  function initHealthCheck(root) {
    // Link every slider to its typed-number box
    root.querySelectorAll("[data-slider]").forEach(function (wrap) {
      var range = wrap.querySelector('input[type="range"]');
      var num = wrap.querySelector('input[type="number"]');
      function paint() {
        var pct = ((range.value - range.min) / (range.max - range.min)) * 100;
        range.style.setProperty("--pct", pct + "%");
      }
      range.addEventListener("input", function () { num.value = range.value; paint(); update(); });
      num.addEventListener("input", function () {
        var v = parseFloat(num.value);
        if (!isNaN(v)) { range.value = clamp(v, +range.min, +range.max); paint(); update(); }
      });
      num.addEventListener("blur", function () {
        var v = parseFloat(num.value);
        if (isNaN(v)) v = +range.value;
        v = clamp(v, +num.min, +num.max);
        num.value = Math.round(v);
        update();
      });
      paint();
    });
    root.querySelectorAll('input[type="radio"], input[type="checkbox"], select').forEach(function (el) {
      el.addEventListener("change", update);
    });

    var arc = root.querySelector(".gauge .arc");
    var CIRC = 2 * Math.PI * 88;
    if (arc) { arc.style.strokeDasharray = CIRC; arc.style.strokeDashoffset = CIRC; }

    function val(name) {
      var el = root.querySelector('[name="' + name + '"]');
      return el ? parseFloat(el.value) || 0 : 0;
    }

    function update() {
      var revenue = val("revenue");
      var expenses = val("expenses");
      var credit = clamp(val("credit"), 300, 850);
      var debt = val("debt");
      var yearsEl = root.querySelector('[name="years"]');
      var years = yearsEl ? yearsEl.value : "1-2";
      var entityEl = root.querySelector('[name="entity"]:checked');
      var entity = entityEl ? entityEl.value : "llc";
      var checks = Array.prototype.slice.call(root.querySelectorAll('[name="habit"]'));
      var missing = checks.filter(function (c) { return !c.checked; }).map(function (c) { return c.dataset.label; });
      var done = checks.length - missing.length;

      // 1. Cash flow — based on profit margin
      var profit = revenue - expenses;
      var margin = revenue > 0 ? profit / revenue : (expenses > 0 ? -1 : 0);
      var cash = revenue > 0 ? clamp(50 + margin * 250, 0, 100) : 0;

      // 2. Credit & funding readiness
      var annual = revenue * 12;
      var ratio = annual > 0 ? debt / annual : (debt > 0 ? 9 : 0);
      var creditPart = ((credit - 300) / 550) * 100;
      var debtPart = ratio <= 0.25 ? 100 : ratio <= 0.5 ? 100 - (ratio - 0.25) * 100 : ratio <= 1 ? 75 - (ratio - 0.5) * 70 : clamp(40 - (ratio - 1) * 40, 0, 40);
      var timePart = { "0": 10, "lt1": 35, "1-2": 60, "2-5": 85, "5+": 100 }[years] || 50;
      var funding = clamp(creditPart * 0.5 + debtPart * 0.3 + timePart * 0.2, 0, 100);

      // 3. Compliance & structure
      var entityPart = { none: 0, sole: 45, llc: 100, scorp: 100, ccorp: 100, nonprofit: 100 }[entity];
      var habitPart = checks.length ? (done / checks.length) * 100 : 0;
      var comp = clamp(entityPart * 0.3 + habitPart * 0.7, 0, 100);

      var overall = Math.round((cash + funding + comp) / 3);

      // ---- Paint results ----
      setText("score", overall);
      setText("score-float-num", overall);
      if (arc) {
        arc.style.strokeDashoffset = CIRC * (1 - overall / 100);
        arc.style.stroke = colorFor(overall);
      }
      var verdict = overall >= 80 ? "Strong footing" : overall >= 60 ? "Solid, with room to grow" : overall >= 40 ? "A few cracks worth fixing" : "Let’s build your foundation";
      setText("verdict", verdict);
      bar("cash", cash); bar("funding", funding); bar("comp", comp);

      setText("stat-profit", money(profit));
      setText("stat-margin", revenue > 0 ? Math.round(margin * 100) + "%" : "—");
      setText("stat-ratio", annual > 0 ? Math.round(ratio * 100) + "%" : (debt > 0 ? "High" : "0%"));
      setText("stat-checks", done + " of " + checks.length);

      // Friendly next steps — weakest areas first
      var tips = [];
      var areas = [["cash", cash], ["funding", funding], ["comp", comp]].sort(function (a, b) { return a[1] - b[1]; });
      areas.forEach(function (a) {
        if (a[0] === "cash") {
          if (revenue <= 0) tips.push("Add your average monthly revenue so we can look at your cash flow.");
          else if (margin < 0) tips.push("You’re spending about " + money(-profit) + " more than you bring in each month. A cash-flow plan can find where to trim first.");
          else if (margin < 0.1) tips.push("Your margin is thin (" + Math.round(margin * 100) + "%). Small pricing or cost changes could add real breathing room.");
          else if (a[1] < 90) tips.push("Healthy margin. A monthly cash-flow forecast helps you plan for slow months and big purchases.");
        }
        if (a[0] === "funding") {
          if (credit < 650) tips.push("A credit score under 650 can limit loan options. We can map out steps to strengthen personal and business credit.");
          else if (ratio > 0.5) tips.push("Your debt is about " + Math.round(ratio * 100) + "% of a year’s revenue. Lenders like to see that number lower.");
          else if (years === "0" || years === "lt1") tips.push("Many lenders want 2+ years in business. Building business credit now puts you ahead later.");
          else if (a[1] < 85) tips.push("You’re close to funding-ready. Clean, current financial statements are the next step lenders will ask for.");
        }
        if (a[0] === "comp") {
          if (entity === "none") tips.push("Forming a business entity (like an LLC) separates your personal and business finances.");
          else if (entity === "sole") tips.push("As a sole proprietor, your personal assets aren’t separated from the business. It may be worth reviewing an LLC or corporation.");
          if (missing.length) tips.push("Still to do: " + missing.slice(0, 3).join(", ").toLowerCase() + (missing.length > 3 ? ", and more" : "") + ".");
        }
      });
      if (!tips.length) tips.push("You’re in great shape. A yearly check-in keeps it that way as rules and goals change.");
      var list = root.querySelector("#tips");
      if (list) {
        list.innerHTML = "";
        tips.slice(0, 3).forEach(function (t) { var li = document.createElement("li"); li.textContent = t; list.appendChild(li); });
      }

      store("ll-health", JSON.stringify({ score: overall, verdict: verdict, cash: Math.round(cash), funding: Math.round(funding), comp: Math.round(comp) }));
    }

    function setText(id, t) { var el = root.querySelector("#" + id); if (el) el.textContent = t; }
    function bar(id, v) {
      var fill = root.querySelector("#bar-" + id);
      var lbl = root.querySelector("#val-" + id);
      if (fill) { fill.style.width = Math.round(v) + "%"; fill.style.background = colorFor(v); }
      if (lbl) lbl.textContent = Math.round(v) + " / 100";
    }

    var reset = root.querySelector("[data-reset]");
    if (reset) reset.addEventListener("click", function () {
      setTimeout(function () {
        root.querySelectorAll("[data-slider]").forEach(function (w) {
          var r = w.querySelector('input[type="range"]'); w.querySelector('input[type="number"]').value = r.value;
          r.style.setProperty("--pct", ((r.value - r.min) / (r.max - r.min)) * 100 + "%");
        });
        update();
      }, 0);
    });

    update();

    // Floating score bar on phones: show while the results panel is off screen
    var floatBar = root.querySelector("#score-float");
    var results = root.querySelector("#results");
    if (floatBar && results && "IntersectionObserver" in window) {
      var started = false;
      root.addEventListener("input", function () { started = true; });
      root.addEventListener("change", function () { started = true; });
      var visible = false;
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }).observe(results);
      var panel = root.querySelector(".tool-panel"), inPanel = false;
      new IntersectionObserver(function (en) { inPanel = en[0].isIntersecting; sync(); }).observe(panel);
      root.addEventListener("input", sync); root.addEventListener("change", sync);
      function sync() { floatBar.classList.toggle("show", inPanel && !visible); }
    }
  }

  /* ======================================================
     Contact form — opens the visitor's email app with the message ready
     ====================================================== */
  var form = document.getElementById("contact-form");
  if (form) {
    var saved = recall("ll-health");
    if (saved) {
      try {
        var h = JSON.parse(saved);
        var note = document.getElementById("prefill-note");
        var msg = form.querySelector('[name="message"]');
        var topic = form.querySelector('[name="topic"]');
        if (note) { note.textContent = "Thanks for taking the Business Health Check! We added your score (" + h.score + "/100) to your message so we can prepare."; note.classList.add("show"); }
        if (msg && !msg.value) msg.value = "I took the free Business Health Check and scored " + h.score + "/100 (" + h.verdict + "). Cash flow " + h.cash + ", credit & funding " + h.funding + ", compliance " + h.comp + ". I'd like to talk through the results.";
        if (topic) topic.value = "Free consultation";
      } catch (e) {}
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (el) {
        var field = el.closest(".field");
        var bad = !el.value.trim() || (el.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim()));
        if (field) field.classList.toggle("invalid", bad);
        if (bad && ok) { el.focus(); ok = false; }
      });
      if (!ok) return;

      var d = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ""; };
      var subject = "Consultation request — " + (d("topic") || "General") + (d("business") ? " (" + d("business") + ")" : "");
      var body = [
        "Name: " + d("name"),
        "Email: " + d("email"),
        "Phone: " + (d("phone") || "—"),
        "Business: " + (d("business") || "—"),
        "Interested in: " + (d("topic") || "—"),
        "Best way to reach me: " + (d("prefer") || "—"),
        "",
        d("message")
      ].join("\n");
      window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var status = document.getElementById("form-status");
      if (status) {
        status.innerHTML = "Your email app should open with your message ready — just press <strong>Send</strong>. If nothing opened, email us at <a href=\"mailto:" + CONTACT_EMAIL + "\">" + CONTACT_EMAIL + "</a> or call <a href=\"tel:+14437528886\">" + CONTACT_PHONE + "</a>.";
        status.classList.add("show");
      }
    });
    form.querySelectorAll("[required]").forEach(function (el) {
      el.addEventListener("input", function () { var f = el.closest(".field"); if (f) f.classList.remove("invalid"); });
    });
  }
})();
