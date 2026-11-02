// Sortable.views.dashboard: the Today page. Owner: Today.
// Top to bottom (CLAUDE.md "Today page"): heading with Send a test document, alert strip,
// forwarding strip, three ring cards, Expiring in 30 days, the Received / Filed / Needs you
// lanes, and the reminder outbox. Reads only through Sortable.store; writes only through
// store.nextIncoming(). Builds DOM with textContent, so no data goes into innerHTML.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});
  Sortable.views = Sortable.views || {};

  var SENT_LIMIT = 20;
  var FILED_BY = { auto: "Filed automatically", reviewed: "Filed after review", manual: "Filed by you" };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function link(href, cls, text) {
    var a = el("a", cls, text);
    a.href = href;
    return a;
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function go(hash) { window.location.hash = hash; }

  function docHref(id) { return "#/doc/" + encodeURIComponent(id); }

  // Folder path without the "All files" root, e.g. "Practice documents › Invoices › Henry Schein".
  function folderPath(folderId) {
    if (!folderId) return "";
    return (Sortable.store.pathOf(folderId) || []).map(function (p) { return p.name; }).join(" › ");
  }

  // ---------- 1. Heading ----------

  function heading() {
    var u = Sortable.util, store = Sortable.store;
    var head = el("div", "dash-head");
    var titles = el("div", "dash-titles");
    titles.appendChild(el("p", "dash-date muted", u.formatDate(u.today())));
    titles.appendChild(el("h1", "page-title", "Today"));
    head.appendChild(titles);

    var send = el("button", "btn btn-primary", "Send a test document");
    send.type = "button";
    var left = store.incomingCount();
    if (!left) {
      send.disabled = true;
      send.title = "No test documents left. Reload to start over.";
    }
    send.addEventListener("click", function () {
      var doc = store.nextIncoming();
      if (doc && Sortable.ui) Sortable.ui.toast("Sent " + doc.filename + ". Sortable is reading it now.");
    });
    head.appendChild(send);
    return head;
  }

  // ---------- 2. Alert strip ----------

  function alertStrip() {
    var st = Sortable.store.storage() || {};
    if (!st.status || st.status === "connected") return null;
    var text = st.status === "offline"
      ? (st.name || "Storage") + " is offline. New documents can’t be saved. Open Setup to check."
      : (st.name || "Storage") + " needs attention. Open Setup to check the connection.";
    var a = link("#/setup", "alert-strip", text);
    a.setAttribute("role", "alert");
    return a;
  }

  // ---------- 4. Ring cards ----------

  function legend(items) {
    var ul = el("ul", "dash-legend");
    items.forEach(function (it) {
      var li = el("li", "dash-legend-item");
      li.appendChild(el("span", "dash-dot dash-dot-" + it.tone));
      li.appendChild(document.createTextNode(it.label + ": " + it.value));
      ul.appendChild(li);
    });
    return ul;
  }

  function ringCard(opts) {
    var b = el("button", "card dash-ring-card");
    b.type = "button";
    b.setAttribute("data-ring", opts.key);
    b.appendChild(Sortable.ui.ring(opts.labelPct, opts.fillPct));
    var body = el("span", "dash-ring-body");
    body.appendChild(el("span", "dash-ring-title", opts.title));
    body.appendChild(el("span", "dash-ring-text muted", opts.text));
    if (opts.legend) body.appendChild(legend(opts.legend));
    b.appendChild(body);
    b.addEventListener("click", function () { go(opts.href); });
    return b;
  }

  function ringCards(m) {
    var wrap = [];
    wrap.push(ringCard({
      key: "filed", title: "Filed and complete",
      labelPct: m.filed.pct, fillPct: m.filed.pct,
      text: m.filed.count + " of " + plural(m.filed.total, "document", "documents") + " filed",
      href: "#/library"
    }));
    wrap.push(ringCard({
      key: "open", title: "To review or pending",
      labelPct: m.open.openPct, fillPct: m.open.completionPct,
      text: plural(m.open.count, "document is", "documents are") + " still open",
      legend: [
        { tone: "info", label: "To review", value: m.open.review },
        { tone: "amber", label: "Pending", value: m.open.pending }
      ],
      href: "#/inbox"
    }));
    wrap.push(ringCard({
      key: "expirations", title: "Expirations to attend to",
      labelPct: m.expirations.completionPct, fillPct: m.expirations.completionPct,
      text: m.expirations.attention + " of " + m.expirations.tracked + " tracked dates need attention",
      legend: [
        { tone: "red", label: "Expired", value: m.expirations.expired },
        { tone: "amber", label: "Within 30 days", value: m.expirations.within30 }
      ],
      href: "#/library/c/expiring"
    }));
    return wrap;
  }

  // ---------- 5. Expiring in 30 days ----------

  function expiringCard(m) {
    var u = Sortable.util, store = Sortable.store, ui = Sortable.ui;
    var e = m.expiring30;
    var card = el("section", "card dash-expiring");
    var top = el("div", "dash-expiring-top");
    var title = el("div");
    title.appendChild(el("h2", "section-label", "Expiring in 30 days"));
    title.appendChild(el("p", "dash-big is-" + e.worst, String(e.count)));
    top.appendChild(title);
    top.appendChild(link("#/library/c/expiring", "btn-link dash-see-all", "See all expirations"));
    card.appendChild(top);

    if (!e.next.length) {
      card.appendChild(el("p", "muted", "Nothing expires in the next 30 days."));
      return card;
    }
    var ul = el("ul", "dash-exp-list");
    e.next.forEach(function (n) {
      var emp = n.employeeId ? store.employee(n.employeeId) : null;
      var li = el("li");
      var a = link(docHref(n.docId), "dash-exp-row");
      a.appendChild(ui.calBlock(n.expiresOn));
      var txt = el("span", "dash-exp-text");
      txt.appendChild(el("span", "dash-exp-name", emp ? emp.name : "No employee"));
      var sub = el("span", "dash-exp-sub muted");
      sub.appendChild(document.createTextNode(u.typeLabel(n.type) + " · "));
      var when = ui.expiryText(n.expiresOn); // keeps the date color
      when.textContent = u.relativeDays(n.expiresOn);
      when.title = u.formatDate(n.expiresOn);
      sub.appendChild(when);
      txt.appendChild(sub);
      a.appendChild(txt);
      li.appendChild(a);
      ul.appendChild(li);
    });
    card.appendChild(ul);
    return card;
  }

  // ---------- 6. Lanes ----------

  function lane(key, title, note, count) {
    var sec = el("section", "card dash-lane dash-lane-" + key);
    var head = el("div", "dash-lane-head");
    head.appendChild(el("h2", "section-label", title));
    head.appendChild(el("span", "dash-lane-count", String(count)));
    sec.appendChild(head);
    if (note) sec.appendChild(el("p", "dash-lane-note muted", note));
    return sec;
  }

  function laneEmpty(text) { return el("p", "dash-lane-empty muted", text); }

  function receivedLane() {
    var u = Sortable.util, ui = Sortable.ui;
    var docs = Sortable.store.received();
    var sec = lane("received", "Received", "Being read now", docs.length);
    if (!docs.length) { sec.appendChild(laneEmpty("Nothing arriving right now")); return sec; }
    var ul = el("ul", "dash-lane-list");
    docs.forEach(function (d) {
      var li = el("li", "dash-lane-row");
      li.appendChild(ui.fileIcon(u.fileExt(d.filename)));
      var txt = el("span", "dash-lane-text");
      txt.appendChild(el("span", "dash-lane-name mono", d.filename));
      txt.appendChild(el("span", "dash-shimmer", "Finding the employee, type, and dates…"));
      li.appendChild(txt);
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    return sec;
  }

  function filedLane() {
    var u = Sortable.util, ui = Sortable.ui;
    var docs = Sortable.store.filedToday();
    var sec = lane("filed", "Filed", "Named and put away. Nothing to do.", docs.length);
    if (!docs.length) { sec.appendChild(laneEmpty("Nothing filed yet today")); return sec; }
    var ul = el("ul", "dash-lane-list");
    docs.forEach(function (d) {
      var li = el("li");
      var a = link(docHref(d.id), "dash-lane-row");
      a.appendChild(ui.fileIcon(u.fileExt(d.filename)));
      var txt = el("span", "dash-lane-text");
      txt.appendChild(el("span", "dash-lane-name", d.name));
      txt.appendChild(el("span", "dash-lane-sub muted", folderPath(d.folderId)));
      txt.appendChild(el("span", "dash-lane-sub muted", FILED_BY[d.filedBy] || "Filed"));
      a.appendChild(txt);
      li.appendChild(a);
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    return sec;
  }

  function needsYouLane() {
    var items = Sortable.store.needsYou();
    var sec = lane("needs", "Needs you", null, items.length);
    if (!items.length) { sec.appendChild(laneEmpty("All caught up")); return sec; }
    var ul = el("ul", "dash-lane-list");
    items.forEach(function (it) {
      var li = el("li");
      var a = link("#/inbox", "dash-lane-row");
      var txt = el("span", "dash-lane-text");
      txt.appendChild(el("strong", "dash-lane-reason", it.reason));
      txt.appendChild(el("span", "dash-lane-name mono", it.filename));
      a.appendChild(txt);
      li.appendChild(a);
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    return sec;
  }

  // ---------- 7. Reminder outbox ----------

  function kindOf(deadlineId) {
    var s = String(deadlineId), i = s.indexOf(":");
    return { kind: i >= 0 ? s.slice(0, i) : "", refId: i >= 0 ? s.slice(i + 1) : s };
  }

  function reminderLabel(r, kind) {
    if (r.kind === "weekly") return "Weekly reminder " + r.week + " · new document requested";
    return r.offsetDays + "-day " + (kind === "invoice" ? "reminder" : "alert");
  }

  function outboxRow(r, sent) {
    var u = Sortable.util;
    var k = kindOf(r.deadlineId);
    var li = el("li", "outbox-row");
    var main = el("span", "dash-out-main");
    main.appendChild(link(k.kind === "compliance" ? "#/deadlines" : docHref(k.refId), "dash-out-title", r.title));
    main.appendChild(el("span", "muted", reminderLabel(r, k.kind)));
    li.appendChild(main);
    var meta = el("span", "dash-out-meta");
    meta.appendChild(el("span", "tag " + (sent ? "tag-current" : "tag-info"), sent ? "Sent" : "Scheduled"));
    meta.appendChild(el("span", "dash-out-date", u.formatDate(r.sendOn)));
    li.appendChild(meta);
    return li;
  }

  function outboxCard() {
    var box = Sortable.reminders.outbox();
    var sec = el("section", "card dash-outbox");
    sec.appendChild(el("h2", "section-label", "Reminder outbox"));
    sec.appendChild(el("p", "muted dash-out-note", "Reminders Sortable sends to the practice. No real email is sent."));

    var cols = el("div", "dash-out-cols");
    var sentCol = el("div", "dash-out-col");
    sentCol.appendChild(el("h3", "dash-out-head", "Sent"));
    var sent = box.sent.slice(0, SENT_LIMIT);
    if (sent.length) {
      var ul = el("ul", "outbox dash-out-sent");
      sent.forEach(function (r) { ul.appendChild(outboxRow(r, true)); });
      sentCol.appendChild(ul);
      if (box.sent.length > SENT_LIMIT) {
        sentCol.appendChild(el("p", "muted dash-out-note", "Showing the newest " + SENT_LIMIT + " of " + box.sent.length + "."));
      }
    } else {
      sentCol.appendChild(laneEmpty("No reminders sent yet"));
    }

    var nextCol = el("div", "dash-out-col");
    nextCol.appendChild(el("h3", "dash-out-head", "Next reminders"));
    if (box.next.length) {
      var ul2 = el("ul", "outbox dash-out-next");
      box.next.forEach(function (r) { ul2.appendChild(outboxRow(r, false)); });
      nextCol.appendChild(ul2);
    } else {
      nextCol.appendChild(laneEmpty("Nothing scheduled"));
    }
    cols.appendChild(sentCol);
    cols.appendChild(nextCol);
    sec.appendChild(cols);
    return sec;
  }

  // ---------- Render ----------

  Sortable.views.dashboard = {
    render: function (root) {
      root.className = "page screen-dashboard";
      var m = Sortable.store.metrics();

      root.appendChild(heading());
      var alert = alertStrip();
      if (alert) root.appendChild(alert);
      root.appendChild(Sortable.ui.dropZone());

      var stats = el("div", "dash-stats");
      ringCards(m).forEach(function (c) { stats.appendChild(c); });
      stats.appendChild(expiringCard(m));
      root.appendChild(stats);

      var lanes = el("div", "dash-lanes");
      lanes.appendChild(receivedLane());
      lanes.appendChild(filedLane());
      lanes.appendChild(needsYouLane());
      root.appendChild(lanes);

      root.appendChild(outboxCard());
    }
  };
})();
