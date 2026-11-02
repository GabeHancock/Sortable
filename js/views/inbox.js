// Sortable.views.inbox: forwarding and drop strip, Simulate incoming, "Being read now",
// and the review queue with preview, Approve and Fix. Owner: Intake.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});
  Sortable.views = Sortable.views || {};

  var CREDENTIALS = ["license", "certification", "training"];
  var TYPES = ["invoice", "license", "certification", "training", "hr_form", "contract", "compliance", "medical", "other"];

  // View state kept across redraws (the router redraws after every store write).
  var fixOpen = null;   // id of the review row whose Fix choices are showing
  var previewId = null; // id of the document open in the details panel
  var current = null;   // { root, params } of the last render

  function S() { return Sortable.store; }
  function U() { return Sortable.util; }
  function ui() { return Sortable.ui; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(label, cls) {
    var b = el("button", cls || "btn", label);
    b.type = "button";
    return b;
  }

  function rerender() {
    if (current) render(current.root, current.params);
  }

  function sourceText(doc) {
    var from = doc.channel === "upload" ? "Uploaded" : (doc.channel === "fax" ? "Fax from " : "Email from ") + doc.sender;
    return from + " · " + U().formatDate(doc.receivedOn);
  }

  function confidenceTag(c) {
    var n = Number(c) || 0;
    var pct = Math.round(n * 100) + "% sure";
    var cls = n < 0.6 ? "tag tag-expired" : "tag tag-expiring";
    return el("span", cls, (n < 0.6 ? "Low · " : "Unsure · ") + pct);
  }

  function filedToast(doc) {
    if (!doc) return;
    var path = doc.folderId ? (S().pathOf(doc.folderId) || []).map(function (p) { return p.name; }).join(" › ") : "";
    ui().toast("Filed " + doc.name + (path ? " in " + path : ""));
  }

  // ---------- actions ----------

  function simulate() {
    var doc = S().nextIncoming();
    if (doc) ui().toast(doc.filename + " arrived. Sortable is reading it now.");
  }

  function approve(id) {
    fixOpen = null;
    var doc = S().approve(id);
    if (doc) filedToast(doc);
    else ui().toast("There’s no suggestion to approve. Use Fix to choose where it goes.");
  }

  function fileAs(id, result) {
    fixOpen = null;
    filedToast(S().correct(id, result));
  }

  function openPreview(id) {
    previewId = id;
    rerender();
  }

  // "Something else…": the details form in a modal, saved through store.editDetails.
  function somethingElse(doc) {
    var u = U(), s = S();
    var base = doc.suggested || {};
    var form = el("form", "details-form");

    function field(label, control) {
      var l = el("label", null, label);
      l.appendChild(control);
      return l;
    }

    var empSel = el("select");
    var none = el("option", null, "No employee");
    none.value = "";
    empSel.appendChild(none);
    s.employees().slice().sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; })
      .forEach(function (e) {
        var o = el("option", null, e.name);
        o.value = e.id;
        if (e.id === base.employeeId) o.selected = true;
        empSel.appendChild(o);
      });

    var typeSel = el("select");
    TYPES.forEach(function (t) {
      var o = el("option", null, u.typeLabel(t));
      o.value = t;
      if (t === (base.type || "other")) o.selected = true;
      typeSel.appendChild(o);
    });

    var dateIn = el("input");
    dateIn.type = "date";
    dateIn.value = doc.docDate || "";

    var expIn = el("input");
    expIn.type = "date";
    expIn.value = doc.expiresOn || "";
    var expLabel = field("Expiration date", expIn);
    function syncExp() { expLabel.hidden = CREDENTIALS.indexOf(typeSel.value) === -1; }
    typeSel.addEventListener("change", syncExp);
    syncExp();

    form.appendChild(el("p", "muted mono", doc.filename));
    form.appendChild(field("Employee", empSel));
    form.appendChild(field("Document type", typeSel));
    form.appendChild(field("Document date", dateIn));
    form.appendChild(expLabel);

    var close = null;
    function save() {
      var isCred = CREDENTIALS.indexOf(typeSel.value) !== -1;
      fixOpen = null;
      var out = s.editDetails(doc.id, {
        employeeId: empSel.value || null,
        type: typeSel.value,
        docDate: dateIn.value || doc.docDate,
        expiresOn: isCred ? expIn.value || null : null
      });
      filedToast(out);
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      save();
      if (close) close();
    });

    close = ui().modal({
      title: "Set the details",
      body: form,
      actions: [
        { label: "Cancel" },
        { label: "Save and file", primary: true, onClick: function () { save(); } }
      ]
    });
  }

  // ---------- render pieces ----------

  function renderHead(root) {
    var head = el("div", "inbox-head");
    var titles = el("div", "inbox-head-text");
    titles.appendChild(el("h1", "page-title", "Inbox"));
    var left = S().incomingCount();
    titles.appendChild(el("p", "muted", left
      ? left + (left === 1 ? " email or fax" : " emails and faxes") + " waiting to arrive."
      : "No more emails or faxes waiting."));
    head.appendChild(titles);
    var sim = button("Simulate incoming", "btn btn-primary inbox-simulate");
    sim.disabled = left === 0;
    sim.addEventListener("click", simulate);
    head.appendChild(sim);
    root.appendChild(head);
  }

  function renderReading(root) {
    var docs = S().received();
    if (!docs.length) return;
    var card = el("section", "card inbox-reading");
    card.setAttribute("aria-live", "polite");
    card.appendChild(el("h2", "section-label", "Being read now"));
    var list = el("ul", "inbox-reading-list");
    docs.forEach(function (doc) {
      var li = el("li", "inbox-reading-row");
      li.appendChild(ui().fileIcon(U().fileExt(doc.filename)));
      var txt = el("div", "inbox-reading-text");
      txt.appendChild(el("span", "mono", doc.filename));
      txt.appendChild(el("span", "inbox-shimmer", "Finding the employee, type, and dates…"));
      li.appendChild(txt);
      list.appendChild(li);
    });
    card.appendChild(list);
    root.appendChild(card);
  }

  function renderFix(doc) {
    var panel = el("div", "inbox-fix");
    var alts = (doc.alternatives || []).slice(0, 3);
    panel.appendChild(el("p", "muted", alts.length ? "File it in:" : "Sortable has no other ideas for this one."));
    var row = el("div", "inbox-alts");
    alts.forEach(function (alt) {
      var b = button(S().pathLabel(alt), "btn");
      b.addEventListener("click", function () { fileAs(doc.id, alt); });
      row.appendChild(b);
    });
    var other = button("Something else…", "btn-link");
    other.addEventListener("click", function () { somethingElse(doc); });
    row.appendChild(other);
    panel.appendChild(row);
    return panel;
  }

  function renderRow(doc) {
    var li = el("li", "inbox-row" + (previewId === doc.id ? " is-selected" : ""));
    li.setAttribute("data-doc-id", doc.id);

    var thumb = button("", "inbox-thumb");
    thumb.setAttribute("aria-label", "Preview " + doc.filename);
    thumb.appendChild(ui().docMock(doc, "card"));
    thumb.addEventListener("click", function () { openPreview(doc.id); });
    li.appendChild(thumb);

    var info = el("div", "inbox-info");
    info.appendChild(el("div", "mono inbox-filename", doc.filename));
    info.appendChild(el("div", "muted inbox-source", sourceText(doc)));
    var guess = el("div", "inbox-guess");
    if (doc.suggested) {
      guess.appendChild(el("span", "muted", "Suggested:"));
      guess.appendChild(el("strong", null, S().pathLabel(doc.suggested)));
    } else {
      guess.appendChild(el("strong", null, "No suggestion"));
    }
    guess.appendChild(confidenceTag(doc.confidence));
    info.appendChild(guess);
    var prev = button("Preview", "btn-link inbox-preview");
    prev.addEventListener("click", function () { openPreview(doc.id); });
    info.appendChild(prev);
    li.appendChild(info);

    var actions = el("div", "row-actions inbox-actions");
    var ok = button("Approve", "btn btn-primary");
    if (!doc.suggested) {
      ok.disabled = true;
      ok.title = "No suggestion to approve";
    }
    ok.addEventListener("click", function () { approve(doc.id); });
    var fix = button("Fix", "btn");
    fix.setAttribute("aria-expanded", fixOpen === doc.id ? "true" : "false");
    fix.addEventListener("click", function () {
      fixOpen = fixOpen === doc.id ? null : doc.id;
      rerender();
    });
    actions.appendChild(ok);
    actions.appendChild(fix);
    li.appendChild(actions);

    if (fixOpen === doc.id) li.appendChild(renderFix(doc));
    return li;
  }

  function renderQueue(parent) {
    var queue = S().reviewQueue();
    var section = el("section", "card inbox-queue");
    var head = el("div", "inbox-queue-head");
    head.appendChild(el("h2", "inbox-queue-title", "Needs review"));
    head.appendChild(el("span", queue.length ? "tag tag-info" : "tag tag-current", queue.length ? queue.length + " to check" : "None"));
    section.appendChild(head);

    if (!queue.length) {
      var empty = el("div", "empty");
      empty.appendChild(el("p", null, "All caught up. Nothing needs review."));
      empty.appendChild(el("p", null, "New documents that Sortable isn’t sure about will wait here."));
      section.appendChild(empty);
    } else {
      section.appendChild(el("p", "muted", "Sortable wasn’t sure where these go. Approve the suggestion, or Fix it."));
      var list = el("ul", "inbox-list");
      queue.forEach(function (doc) { list.appendChild(renderRow(doc)); });
      section.appendChild(list);
    }
    parent.appendChild(section);
  }

  // ---------- render ----------

  function render(root, params) {
    current = { root: root, params: params };
    var s = S();
    var ids = s.reviewQueue().map(function (d) { return d.id; });
    if (fixOpen && ids.indexOf(fixOpen) < 0) fixOpen = null;
    if (previewId && !s.document(previewId)) previewId = null;

    root.className = "page screen-inbox";
    root.innerHTML = "";
    renderHead(root);
    root.appendChild(ui().dropZone());
    renderReading(root);

    var layout = el("div", "inbox-layout" + (previewId ? " has-panel" : ""));
    renderQueue(layout);
    if (previewId) {
      layout.appendChild(ui().detailsPanel(previewId, {
        onClose: function () { previewId = null; rerender(); }
      }));
    }
    root.appendChild(layout);
  }

  Sortable.views.inbox = { render: render };
})();
