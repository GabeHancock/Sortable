// Sortable.views.deadlines: deadline list (grouped) and month calendar. Owner: Deadlines.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});
  Sortable.views = Sortable.views || {};

  // Transient view state. Lives in memory only, survives store redraws, resets on reload.
  var shownMonth = null;      // { y, m } with m 1–12
  var lastGroup = "category"; // remembered so List / Calendar keep the grouping
  var doneOpen = false;       // whether the Done section is expanded

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var GROUPS = [
    { key: "category", label: "Category" },
    { key: "vendor", label: "Vendor" },
    { key: "due", label: "Due date" }
  ];

  var ACTIONS = {
    invoice: { label: "Mark as paid", fn: "markPaid" },
    credential: { label: "Mark as renewed", fn: "markRenewed" },
    compliance: { label: "Resolve", fn: "resolveCompliance" }
  };

  function U() { return Sortable.util; }
  function S() { return Sortable.store; }
  function UI() { return Sortable.ui; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function byDue(a, b) {
    if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  }

  // ---------- Per-deadline details ----------

  // Everything a row needs that isn't on the deadline object itself.
  function details(d, ctx) {
    var info = { kind: "", amount: null, href: null, doc: null, comp: null };
    if (d.kind === "compliance") {
      var c = ctx.compliance[d.refId];
      info.comp = c || null;
      info.kind = "Compliance" + (c && c.category ? " · " + c.category : "");
      return info;
    }
    var doc = ctx.docs[d.refId] || null;
    info.doc = doc;
    info.href = "#/doc/" + encodeURIComponent(d.refId);
    if (d.kind === "invoice") {
      info.kind = "Invoice";
      if (doc && doc.invoice && doc.invoice.amountCents != null) info.amount = U().formatMoney(doc.invoice.amountCents);
    } else {
      info.kind = doc ? U().typeLabel(doc.type) : "Credential";
    }
    return info;
  }

  // Status tag, always with its text label.
  function tagFor(d, info) {
    var ui = UI();
    if (d.kind === "invoice") {
      return ui.statusTag(d.status === "done" ? "paid" : d.status === "overdue" ? "overdue" : "unpaid");
    }
    if (d.kind === "credential") {
      if (d.status === "done") return ui.statusTag("renewed");
      if (d.status === "awaiting") return ui.statusTag("awaiting");
      var key = info.doc ? S().fileStatus(info.doc).key : (d.status === "overdue" ? "expired" : "current");
      return ui.statusTag(key);
    }
    // Compliance: same colors, compliance words.
    var t;
    if (d.status === "done") { t = ui.statusTag("current"); t.textContent = "Resolved"; }
    else if (d.status === "overdue") { t = ui.statusTag("overdue"); }
    else if (d.soon) { t = ui.statusTag("expiring"); t.textContent = "Due soon"; }
    else { t = ui.statusTag("current"); t.textContent = "Upcoming"; }
    return t;
  }

  function dateNode(d) {
    var wrap = el("span", "dl-date");
    if (d.kind === "credential") {
      wrap.appendChild(document.createTextNode(d.status === "overdue" ? "Expired " : "Expires "));
      wrap.appendChild(UI().expiryText(d.dueOn));
    } else {
      wrap.textContent = "Due " + U().formatDate(d.dueOn);
    }
    return wrap;
  }

  function rowNode(d, ctx) {
    var info = details(d, ctx);
    var li = el("li", "dl-row" + (d.status === "overdue" ? " is-overdue" : ""));

    var main = el("div", "dl-main");
    var title = info.href ? el("a", "dl-title", d.title) : el("span", "dl-title", d.title);
    if (info.href) title.href = info.href;
    main.appendChild(title);

    var meta = el("div", "dl-meta");
    meta.appendChild(el("span", "dl-kind muted", info.kind));
    meta.appendChild(dateNode(d));
    if (info.amount) meta.appendChild(el("span", "dl-amount", info.amount));
    main.appendChild(meta);
    li.appendChild(main);

    var side = el("div", "dl-side");
    if (d.status === "awaiting") {
      // The note doubles as the status, so no separate tag repeats "Needs new document".
      var note = el("span", "tag tag-expiring dl-awaiting",
        "Needs new document · requested " + U().formatDate(d.requestedOn));
      side.appendChild(note);
    } else {
      side.appendChild(tagFor(d, info));
    }
    if (d.status === "awaiting") {
      // No action: the item closes when the newer document is filed.
    } else if (d.status === "done") {
      if (d.closedOn) side.appendChild(el("span", "dl-note muted", "Closed " + U().formatDate(d.closedOn)));
    } else {
      var a = ACTIONS[d.kind];
      var btn = el("button", "btn", a.label);
      btn.type = "button";
      btn.addEventListener("click", function () { S()[a.fn](d.id); });
      side.appendChild(btn);
    }
    li.appendChild(side);
    return li;
  }

  // ---------- Grouping ----------

  function groupsFor(key, open, ctx) {
    var groups;
    if (key === "vendor") {
      var byVendor = {}, none = [];
      open.forEach(function (d) {
        if (d.kind === "invoice" && d.vendorId) (byVendor[d.vendorId] = byVendor[d.vendorId] || []).push(d);
        else none.push(d);
      });
      groups = Object.keys(byVendor).map(function (vid) {
        var v = ctx.vendors[vid];
        return { title: v ? v.name : "Unknown vendor", items: byVendor[vid] };
      }).sort(function (a, b) { return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; });
      groups.push({ title: "No vendor", items: none });
    } else if (key === "due") {
      var g = { overdue: [], week: [], month: [], later: [], awaiting: [] };
      open.forEach(function (d) {
        if (d.status === "awaiting") return g.awaiting.push(d);
        if (d.status === "overdue") return g.overdue.push(d);
        var n = U().daysFromToday(d.dueOn);
        if (n <= 7) g.week.push(d);
        else if (n <= 30) g.month.push(d);
        else g.later.push(d);
      });
      groups = [
        { title: "Overdue", items: g.overdue },
        { title: "This week", items: g.week },
        { title: "Next 30 days", items: g.month },
        { title: "Later", items: g.later },
        { title: "Needs new document", items: g.awaiting }
      ];
    } else {
      groups = [
        { title: "Invoices", items: open.filter(function (d) { return d.kind === "invoice"; }) },
        { title: "Credentials", items: open.filter(function (d) { return d.kind === "credential"; }) },
        { title: "Compliance", items: open.filter(function (d) { return d.kind === "compliance"; }) }
      ];
    }
    groups.forEach(function (gr) { gr.items.sort(byDue); });
    return groups;
  }

  function sectionNode(title, items, ctx, emptyText) {
    var sec = el("section", "dl-section");
    var h = el("h2", "dl-heading", title + " ");
    h.appendChild(el("span", "dl-count muted", "(" + items.length + ")"));
    sec.appendChild(h);
    if (items.length) {
      var ul = el("ul", "dl-list");
      items.forEach(function (d) { ul.appendChild(rowNode(d, ctx)); });
      sec.appendChild(ul);
    } else {
      sec.appendChild(el("p", "dl-none muted", emptyText));
    }
    return sec;
  }

  function renderList(root, all, ctx, groupKey) {
    var bar = el("div", "dl-groupbar");
    bar.appendChild(el("span", "section-label", "Group by"));
    var seg = el("nav", "segmented dl-group");
    seg.setAttribute("aria-label", "Group by");
    bar.appendChild(seg);
    GROUPS.forEach(function (g) {
      var a = el("a", g.key === groupKey ? "is-active" : "", g.label);
      a.href = "#/deadlines?group=" + g.key;
      if (g.key === groupKey) a.setAttribute("aria-current", "true");
      seg.appendChild(a);
    });
    root.appendChild(bar);

    var open = all.filter(function (d) { return d.status !== "done"; });
    groupsFor(groupKey, open, ctx).forEach(function (g) {
      root.appendChild(sectionNode(g.title, g.items, ctx, "Nothing here."));
    });

    var done = all.filter(function (d) { return d.status === "done"; })
      .sort(function (a, b) { return a.closedOn < b.closedOn ? 1 : a.closedOn > b.closedOn ? -1 : byDue(a, b); });
    var det = el("details", "dl-done");
    det.open = doneOpen;
    var sum = el("summary", "dl-heading", "Done ");
    sum.appendChild(el("span", "dl-count muted", "(" + done.length + ")"));
    det.appendChild(sum);
    if (done.length) {
      var ul = el("ul", "dl-list");
      done.forEach(function (d) { ul.appendChild(rowNode(d, ctx)); });
      det.appendChild(ul);
    } else {
      det.appendChild(el("p", "dl-none muted", "Nothing closed yet."));
    }
    det.addEventListener("toggle", function () { doneOpen = det.open; });
    root.appendChild(det);
  }

  // ---------- Calendar ----------

  function renderCalendar(root, all, ctx, params) {
    var u = U();
    var today = u.today();
    if (!shownMonth) shownMonth = { y: +today.slice(0, 4), m: +today.slice(5, 7) };
    var y = shownMonth.y, m = shownMonth.m;
    var prefix = y + "-" + pad2(m) + "-";
    var monthLabel = MONTH_NAMES[m - 1] + " " + y;

    var open = all.filter(function (d) { return d.status !== "done" && d.dueOn.indexOf(prefix) === 0; }).sort(byDue);
    var byDay = {};
    open.forEach(function (d) { (byDay[d.dueOn] = byDay[d.dueOn] || []).push(d); });

    var cal = el("div", "cal dl-cal");
    cal.setAttribute("aria-label", monthLabel);

    var head = el("div", "cal-head");
    var prev = el("button", "btn btn-icon dl-arrow", "‹");
    prev.type = "button";
    prev.setAttribute("aria-label", "Previous month");
    var next = el("button", "btn btn-icon dl-arrow", "›");
    next.type = "button";
    next.setAttribute("aria-label", "Next month");
    var h = el("h2", "dl-month", monthLabel);
    h.setAttribute("aria-live", "polite");
    head.appendChild(prev);
    head.appendChild(h);
    head.appendChild(next);
    cal.appendChild(head);

    DOW.forEach(function (w) {
      var c = el("div", "cal-dow", w.charAt(0));
      c.setAttribute("aria-hidden", "true");
      c.appendChild(el("span", "dl-dow-rest", w.slice(1)));
      cal.appendChild(c);
    });

    var first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    var daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var cells = Math.ceil((first + daysInMonth) / 7) * 7;
    for (var i = 0; i < cells; i++) {
      var day = i - first + 1;
      if (day < 1 || day > daysInMonth) { cal.appendChild(el("div", "cal-day is-blank")); continue; }
      var date = prefix + pad2(day);
      var items = byDay[date] || [];
      var cell = el("div", "cal-day" + (date === today ? " is-today" : ""));
      cell.appendChild(el("span", "dl-daynum", String(day)));
      items.forEach(function (d) {
        var info = details(d, ctx);
        var cls = "cal-item" + (d.status === "overdue" ? " is-overdue" : d.soon ? " is-soon" : "");
        var it = info.href ? el("a", cls, d.title) : el("span", cls, d.title);
        if (info.href) it.href = info.href;
        it.title = d.title + " (" + tagFor(d, info).textContent + ")";
        cell.appendChild(it);
      });
      if (items.length) {
        var worst = items.some(function (d) { return d.status === "overdue"; }) ? " is-overdue"
          : items.some(function (d) { return d.soon; }) ? " is-soon" : "";
        var dot = el("span", "dl-dot" + worst, String(items.length));
        dot.setAttribute("aria-label", items.length + (items.length === 1 ? " deadline" : " deadlines"));
        cell.appendChild(dot);
      }
      cal.appendChild(cell);
    }
    root.appendChild(cal);

    if (!open.length) root.appendChild(el("p", "dl-none muted", "No open deadlines this month."));

    // Month agenda: the readable list on phones, hidden on wider screens.
    var agenda = el("section", "dl-agenda");
    agenda.appendChild(el("h2", "dl-heading", monthLabel + " deadlines"));
    if (open.length) {
      var ul = el("ul", "dl-list");
      open.forEach(function (d) { ul.appendChild(rowNode(d, ctx)); });
      agenda.appendChild(ul);
    } else {
      agenda.appendChild(el("p", "dl-none muted", "No open deadlines this month."));
    }
    root.appendChild(agenda);

    function shift(delta) {
      var mm = shownMonth.m + delta;
      shownMonth = { y: shownMonth.y + Math.floor((mm - 1) / 12), m: ((mm - 1) % 12 + 12) % 12 + 1 };
      root.innerHTML = "";
      Sortable.views.deadlines.render(root, params);
    }
    prev.addEventListener("click", function () { shift(-1); });
    next.addEventListener("click", function () { shift(1); });
  }

  // ---------- Render ----------

  Sortable.views.deadlines = {
    render: function (root, params) {
      params = params || { segments: ["deadlines"], query: {} };
      var isCal = params.segments[1] === "calendar";
      var q = params.query || {};
      if (q.group && GROUPS.some(function (g) { return g.key === q.group; })) lastGroup = q.group;
      else if (!isCal) lastGroup = "category";
      var groupKey = lastGroup;

      root.className = "page screen-deadlines";

      var ctx = { docs: {}, compliance: {}, vendors: {} };
      S().documents({ status: "filed" }).forEach(function (d) { ctx.docs[d.id] = d; });
      S().compliance().forEach(function (c) { ctx.compliance[c.id] = c; });
      S().vendors().forEach(function (v) { ctx.vendors[v.id] = v; });
      var all = S().deadlines();

      var top = el("div", "dl-top");
      top.appendChild(el("h1", "page-title", "Deadlines"));
      var toggle = el("nav", "segmented dl-toggle");
      toggle.setAttribute("aria-label", "View");
      var list = el("a", isCal ? "" : "is-active", "List");
      list.href = "#/deadlines" + (groupKey !== "category" ? "?group=" + groupKey : "");
      var calLink = el("a", isCal ? "is-active" : "", "Calendar");
      calLink.href = "#/deadlines/calendar";
      (isCal ? calLink : list).setAttribute("aria-current", "page");
      toggle.appendChild(list);
      toggle.appendChild(calLink);
      top.appendChild(toggle);
      root.appendChild(top);

      if (isCal) renderCalendar(root, all, ctx, params);
      else renderList(root, all, ctx, groupKey);
    }
  };
})();
