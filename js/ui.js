// Sortable.ui: shared components. Owner: Design.
// Reads data only through Sortable.store and Sortable.util. Styles live in css/styles.css.
// The only document listeners are the menu's and the modal's, and they are removed on close (MVP rule 14).
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});

  function U() { return Sortable.util; }
  function S() { return Sortable.store; }

  // Small element builder. Text goes in through textContent, so it never needs escaping.
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(label, cls) {
    var b = el("button", cls || "btn", label);
    b.type = "button";
    return b;
  }

  var PHOTO_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp"];
  var DOC_EXTS = ["doc", "docx", "rtf", "odt", "txt", "pages"];
  var CREDENTIALS = ["license", "certification", "training"];
  var TYPES = ["invoice", "license", "certification", "training", "hr_form", "contract", "compliance", "medical", "other"];

  function isPhoto(ext) { return PHOTO_EXTS.indexOf(ext) !== -1; }

  // ---------- fileIcon ----------

  var FOLDER_SVG =
    '<svg viewBox="0 0 22 18" aria-hidden="true"><path fill="currentColor" ' +
    'd="M2 1.5h6.2l2 2.2H20a1.5 1.5 0 0 1 1.5 1.5v10.3A1.5 1.5 0 0 1 20 17H2A1.5 1.5 0 0 1 .5 15.5v-12.5A1.5 1.5 0 0 1 2 1.5z"/></svg>';

  function fileIcon(ext) {
    ext = String(ext || "file").toLowerCase();
    var node = el("span", "file-icon");
    if (ext === "folder") {
      node.className += " is-folder";
      node.innerHTML = FOLDER_SVG; // static markup, no data
      return node;
    }
    if (ext === "pdf") node.className += " is-pdf";
    else if (isPhoto(ext)) node.className += " is-img";
    else if (DOC_EXTS.indexOf(ext) !== -1) node.className += " is-doc";
    node.textContent = ext.slice(0, 4);
    node.setAttribute("aria-label", ext.toUpperCase() + " file");
    return node;
  }

  // ---------- statusTag ----------

  var TAGS = {
    current: ["tag-current", "Current"],
    paid: ["tag-current", "Paid"],
    renewed: ["tag-current", "Renewed"],
    expiring: ["tag-expiring", "Expiring soon"],
    awaiting: ["tag-expiring", "Needs new document"],
    unpaid: ["tag-expiring", "Unpaid"],
    expired: ["tag-expired", "Expired"],
    overdue: ["tag-expired", "Overdue"],
    review: ["tag-info", "Needs review"],
    reading: ["tag-info", "Being read"]
  };

  function statusTag(statusKey) {
    var t = TAGS[statusKey] || ["tag-info", String(statusKey || "")];
    return el("span", "tag " + t[0], t[1]);
  }

  // ---------- Date colors ----------

  function dateColor(date) {
    var n = U().daysFromToday(date);
    if (n <= 10) return "red";
    if (n <= 30) return "amber";
    return "green";
  }

  function expiryText(date) {
    if (!date) return el("span", "expiry muted", "No expiration");
    var node = el("span", "expiry expiry-" + dateColor(date), U().formatDate(date));
    node.title = U().relativeDays(date);
    return node;
  }

  // ---------- calBlock ----------

  function calBlock(date) {
    var md = U().monthDay(date);
    var node = el("span", "cal-block");
    node.appendChild(el("span", "cal-block-mon", md.mon));
    node.appendChild(el("span", "cal-block-day", md.day));
    node.setAttribute("aria-label", U().formatDate(date));
    return node;
  }

  // ---------- ring ----------

  function ringColor(pct) {
    if (pct >= 90) return "var(--green)";
    if (pct >= 70) return "var(--amber)";
    if (pct >= 40) return "var(--orange)";
    return "var(--red)";
  }

  function clampPct(n) {
    n = Math.round(Number(n) || 0);
    return Math.max(0, Math.min(100, n));
  }

  function ring(labelPct, fillPct) {
    var label = clampPct(labelPct);
    var fill = clampPct(fillPct == null ? labelPct : fillPct);
    var node = el("span", "ring");
    // The one inline-style exception (MVP rule 12): the ring's custom properties.
    node.style.setProperty("--p", String(fill));
    node.style.setProperty("--fill", ringColor(fill));
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", label + "%");
    node.appendChild(el("span", "ring-label", label + "%"));
    return node;
  }

  // ---------- Positioning sheet ----------
  // Menus need pixel positions, but inline styles aren't allowed. A constructed stylesheet holds
  // the one rule for the open menu instead.

  var posSheet = null;
  var posStyleEl = null;
  function setPositionRule(css) {
    if (!posSheet && !posStyleEl) {
      try {
        posSheet = new CSSStyleSheet();
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat([posSheet]);
      } catch (e) {
        posSheet = null;
        posStyleEl = document.createElement("style");
        document.head.appendChild(posStyleEl);
      }
    }
    if (posSheet) posSheet.replaceSync(css);
    else posStyleEl.textContent = css;
  }

  // ---------- menu ----------

  var openMenu = null; // { node, close }

  function menu(items, x, y) {
    if (openMenu) openMenu.close();

    var node = el("div", "menu is-measuring");
    node.setAttribute("role", "menu");
    var buttons = [];

    (items || []).forEach(function (item) {
      if (item.divider) {
        var d = el("div", "menu-divider");
        d.setAttribute("role", "separator");
        node.appendChild(d);
        return;
      }
      var b = button(item.label, "menu-item" + (item.danger ? " is-danger" : ""));
      b.setAttribute("role", "menuitem");
      if (item.disabled) b.disabled = true;
      b.addEventListener("click", function () {
        if (item.disabled) return;
        close();
        if (item.onSelect) item.onSelect();
      });
      node.appendChild(b);
      if (!item.disabled) buttons.push(b);
    });

    var returnFocus = document.activeElement;

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        if (returnFocus && returnFocus.focus) returnFocus.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var i = buttons.indexOf(document.activeElement);
        var step = e.key === "ArrowDown" ? 1 : -1;
        var next = buttons[(i + step + buttons.length) % buttons.length];
        if (next) next.focus();
      }
    }
    function onPointer(e) {
      if (!node.contains(e.target)) close();
    }
    function onContext(e) {
      // A right-click elsewhere closes this menu; the view may then open a new one.
      if (!node.contains(e.target)) close();
    }

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("contextmenu", onContext, true);
      if (node.parentNode) node.parentNode.removeChild(node);
      setPositionRule("");
      if (openMenu && openMenu.node === node) openMenu = null;
    }

    document.body.appendChild(node);

    // Keep it inside the viewport, with an 8px margin.
    var m = 8;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = document.documentElement.clientHeight || window.innerHeight;
    var w = node.offsetWidth;
    var h = node.offsetHeight;
    var left = Math.round(Number(x) || 0);
    var top = Math.round(Number(y) || 0);
    if (left + w > vw - m) left = Math.max(m, vw - w - m);
    if (left < m) left = m;
    if (top + h > vh - m) top = top - h >= m ? top - h : Math.max(m, vh - h - m);
    if (top < m) top = m;
    setPositionRule(".menu.is-open { left: " + left + "px; top: " + top + "px; }");
    node.className = "menu is-open";

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("contextmenu", onContext, true);

    openMenu = { node: node, close: close };
    if (buttons[0]) buttons[0].focus();
  }

  // ---------- modal ----------

  function modal(opts) {
    opts = opts || {};
    var returnFocus = document.activeElement;

    var backdrop = el("div", "modal-backdrop");
    var box = el("div", "modal");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    var titleId = "modal-title-" + Math.random().toString(36).slice(2, 8);
    box.setAttribute("aria-labelledby", titleId);

    var head = el("div", "modal-head");
    var title = el("h2", "modal-title", opts.title || "");
    title.id = titleId;
    var x = button("×", "btn-icon");
    x.setAttribute("aria-label", "Close");
    head.appendChild(title);
    head.appendChild(x);

    var body = el("div", "modal-body");
    if (opts.body instanceof Node) body.appendChild(opts.body);
    else if (opts.body != null) body.appendChild(el("p", null, String(opts.body)));

    var actionsBar = el("div", "modal-actions");
    var actions = opts.actions && opts.actions.length ? opts.actions : [{ label: "Close" }];
    actions.forEach(function (a) {
      var cls = "btn" + (a.primary ? " btn-primary" : "") + (a.danger ? " btn-danger" : "");
      var b = button(a.label, cls);
      if (a.disabled) b.disabled = true;
      b.addEventListener("click", function () {
        var keep = a.onClick ? a.onClick(close) === false : false;
        if (!keep) close();
      });
      actionsBar.appendChild(b);
    });

    box.appendChild(head);
    box.appendChild(body);
    box.appendChild(actionsBar);
    backdrop.appendChild(box);

    function focusables() {
      return Array.prototype.slice.call(
        box.querySelectorAll("button:not(:disabled), input, select, textarea, a[href], iframe, [tabindex]:not([tabindex='-1'])")
      );
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey, true);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (opts.onClose) opts.onClose();
      if (returnFocus && returnFocus.focus && document.contains(returnFocus)) returnFocus.focus();
    }

    x.addEventListener("click", close);
    backdrop.addEventListener("mousedown", function (e) {
      if (e.target === backdrop) close();
    });

    if (openMenu) openMenu.close();
    document.body.appendChild(backdrop);
    document.addEventListener("keydown", onKey, true);

    var firstField = body.querySelector("input, select, textarea");
    var primary = actionsBar.querySelector(".btn-primary");
    (firstField || primary || x).focus();
    return close;
  }

  // ---------- toast ----------

  var toastStack = null;
  function toast(text) {
    if (!toastStack || !document.body.contains(toastStack)) {
      toastStack = el("div", "toast-stack");
      toastStack.setAttribute("role", "status");
      toastStack.setAttribute("aria-live", "polite");
      document.body.appendChild(toastStack);
    }
    var t = el("div", "toast", text);
    toastStack.appendChild(t);
    while (toastStack.children.length > 3) toastStack.removeChild(toastStack.firstChild);
    setTimeout(function () {
      t.className = "toast is-leaving";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }, 2600);
  }

  // ---------- copyText ----------

  function copyText(text, btn) {
    text = String(text == null ? "" : text);

    function feedback(label) {
      if (!btn) { toast(label); return; }
      if (!btn.hasAttribute("data-label")) btn.setAttribute("data-label", btn.textContent);
      btn.textContent = label;
      btn.classList.add("is-done");
      setTimeout(function () {
        btn.textContent = btn.getAttribute("data-label");
        btn.removeAttribute("data-label");
        btn.classList.remove("is-done");
      }, 1600);
    }

    // Fallback: show the text selected, so the person can press Cmd+C or Ctrl+C.
    function fallback() {
      var input = el("input", "copy-fallback");
      input.type = "text";
      input.readOnly = true;
      input.value = text;
      var wrap = el("div");
      wrap.appendChild(el("p", "muted", "Press ⌘C (Mac) or Ctrl+C (Windows) to copy."));
      wrap.appendChild(input);
      modal({ title: "Copy", body: wrap, actions: [{ label: "Done", primary: true }] });
      input.focus();
      input.select();
      feedback("Selected");
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        // Some browsers leave the promise pending (no permission on file://). Fall back after 1s.
        var settled = false;
        var timer = setTimeout(function () { if (!settled) { settled = true; fallback(); } }, 1000);
        navigator.clipboard.writeText(text).then(
          function () { if (!settled) { settled = true; clearTimeout(timer); feedback("Copied"); } },
          function () { if (!settled) { settled = true; clearTimeout(timer); fallback(); } }
        );
        return;
      }
    } catch (e) { /* fall through */ }
    fallback();
  }

  // ---------- download ----------

  function safeName(name) {
    return String(name || "document").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "document";
  }

  function summaryText(doc) {
    var u = U(), s = S();
    var emp = doc.employeeId ? s.employee(doc.employeeId) : null;
    var ven = doc.vendorId ? s.vendor(doc.vendorId) : null;
    var lines = [
      doc.name,
      "",
      "Document type: " + u.typeLabel(doc.type),
      "Original file: " + doc.filename
    ];
    if (emp) lines.push("Employee: " + emp.name);
    if (ven) lines.push("Vendor: " + ven.name);
    if (doc.docDate) lines.push("Document date: " + u.formatDate(doc.docDate));
    if (doc.invoice) {
      if (doc.invoice.amountCents != null) lines.push("Amount: " + u.formatMoney(doc.invoice.amountCents));
      lines.push("Due: " + (doc.invoice.dueDate ? u.formatDate(doc.invoice.dueDate) : "Due date missing"));
      if (doc.invoice.paidOn) lines.push("Paid: " + u.formatDate(doc.invoice.paidOn));
    }
    if (doc.expiresOn) lines.push("Expires: " + u.formatDate(doc.expiresOn));
    if (doc.folderId) lines.push("Folder: " + folderPath(doc.folderId));
    if (doc.receivedOn) lines.push("Received: " + u.formatDate(doc.receivedOn));
    if (doc.location) lines.push("Location: " + doc.location);
    if (doc.text) lines.push("", doc.text);
    lines.push("", "Sample document from the Sortable prototype. There is no original file.");
    return lines.join("\n");
  }

  function clickLink(href, filename) {
    var a = el("a");
    a.href = href;
    a.download = filename;
    a.className = "sr-only";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function download(docId) {
    var doc = S().document(docId);
    if (!doc) return;
    var url = S().fileUrl(docId);
    if (url) {
      clickLink(url, doc.filename || safeName(doc.name));
    } else {
      var blob = new Blob([summaryText(doc)], { type: "text/plain;charset=utf-8" });
      var blobUrl = URL.createObjectURL(blob);
      clickLink(blobUrl, safeName(doc.name) + ".txt");
      setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 4000);
    }
    toast("Downloading " + (doc.name || doc.filename));
  }

  // ---------- docMock ----------

  function docMock(doc, size) {
    size = size === "panel" || size === "full" ? size : "card";
    var u = U(), s = S();
    var node = el("div", "doc-mock doc-mock--" + size);
    if (!doc) return node;
    var ext = u.fileExt(doc.filename);
    var url = s.fileUrl(doc.id);

    if (url && ext === "pdf") {
      var frame = el("iframe", "doc-mock-frame");
      frame.src = url + (size === "full" ? "" : "#toolbar=0&navpanes=0&view=FitH");
      frame.title = "Preview of " + (doc.name || doc.filename);
      if (size === "card") frame.tabIndex = -1;
      node.appendChild(frame);
      return node;
    }
    if (url && isPhoto(ext)) {
      var img = el("img", "doc-mock-img");
      img.src = url;
      img.alt = "Preview of " + (doc.name || doc.filename);
      node.appendChild(img);
      return node;
    }
    if (isPhoto(ext)) {
      var ph = el("div", "doc-mock-photo", ext + " photo");
      ph.setAttribute("role", "img");
      ph.setAttribute("aria-label", "Photo placeholder");
      node.appendChild(ph);
      return node;
    }

    // Drawn mock from the document's fields.
    var practice = s.practice() || {};
    var emp = doc.employeeId ? s.employee(doc.employeeId) : null;
    var ven = doc.vendorId ? s.vendor(doc.vendorId) : null;
    var page = el("div", "doc-mock-page");
    page.setAttribute("aria-hidden", "true");
    page.appendChild(el("div", "doc-mock-practice", practice.name || ""));
    page.appendChild(el("div", "doc-mock-type", u.typeLabel(doc.type)));
    var who = emp ? emp.name : ven ? ven.name : practice.name || "Practice";
    page.appendChild(el("div", "doc-mock-who", who));
    var lines = el("div", "doc-mock-lines");
    for (var i = 0; i < 5; i++) lines.appendChild(el("span"));
    page.appendChild(lines);
    if (doc.text && size !== "card") page.appendChild(el("p", "doc-mock-text", doc.text));

    var foot = el("div", "doc-mock-foot");
    var left = el("span", null, doc.docDate ? u.formatDate(doc.docDate) : "");
    foot.appendChild(left);
    if (doc.expiresOn) {
      var right = el("span");
      right.appendChild(document.createTextNode("Expires "));
      right.appendChild(el("strong", null, u.formatDate(doc.expiresOn)));
      foot.appendChild(right);
    } else if (doc.invoice && doc.invoice.amountCents != null) {
      foot.appendChild(el("strong", null, u.formatMoney(doc.invoice.amountCents)));
    }
    page.appendChild(foot);
    node.appendChild(page);
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", "Sample " + u.typeLabel(doc.type).toLowerCase() + " for " + who);
    return node;
  }

  function openFullPreview(doc) {
    modal({
      title: doc.name || doc.filename,
      body: docMock(doc, "full"),
      actions: [
        { label: "Download", onClick: function () { download(doc.id); return false; } },
        { label: "Close", primary: true }
      ]
    });
  }

  // ---------- dropZone ----------

  function dropZone() {
    var practice = S().practice() || {};
    var email = practice.forwardEmail || "";
    var zone = el("div", "drop-zone");

    var text = el("div", "drop-zone-text");
    var fwd = el("div", "drop-zone-forward");
    fwd.appendChild(document.createTextNode("Forward to "));
    fwd.appendChild(el("span", "drop-zone-email", email));
    var copyBtn = button("Copy", "btn");
    copyBtn.addEventListener("click", function () { copyText(email, copyBtn); });
    fwd.appendChild(copyBtn);
    text.appendChild(fwd);
    text.appendChild(el("div", "drop-zone-hint", "or drop PDFs, scans, and Word files here"));
    zone.appendChild(text);

    var input = el("input", "drop-zone-input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("aria-label", "Choose files to upload");
    var choose = button("Choose files", "btn btn-primary");
    choose.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      send(input.files);
      input.value = "";
    });
    zone.appendChild(choose);
    zone.appendChild(input);

    var depth = 0;
    zone.addEventListener("dragenter", function (e) {
      e.preventDefault();
      depth++;
      zone.classList.add("is-over");
    });
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("dragleave", function () {
      depth = Math.max(0, depth - 1);
      if (!depth) zone.classList.remove("is-over");
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      depth = 0;
      zone.classList.remove("is-over");
      send(e.dataTransfer && e.dataTransfer.files);
    });

    // Files dropped while the bar is still playing wait in this queue and are
    // sent with the batch, so a second drop is never lost.
    var sending = false;
    var queued = [];
    function send(fileList) {
      var incoming = Array.prototype.slice.call(fileList || []);
      if (!incoming.length) return;
      queued = queued.concat(incoming);
      if (sending) return;
      sending = true;
      var bar = el("div", "drop-progress");
      bar.appendChild(el("div", "drop-progress-bar"));
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", "Sending files");
      zone.appendChild(bar);
      // Let the short bar play before the store write redraws the screen.
      setTimeout(function () {
        var files = queued;
        queued = [];
        files.forEach(function (file) {
          // Only the name is used to classify. The File is kept for preview and download (MVP rule 7).
          S().receive({
            channel: "upload",
            sender: "upload",
            filename: file.name,
            text: "",
            fields: { docDate: null, amountCents: null, dueDate: null, expiresOn: null },
            file: file
          });
        });
        if (bar.parentNode) bar.parentNode.removeChild(bar);
        sending = false;
        toast(files.length === 1
          ? "Sent " + files[0].name + ". Sortable is reading it now."
          : "Sent " + files.length + " files. Sortable is reading them now.");
      }, 700);
    }

    return zone;
  }

  // ---------- Folder helpers ----------

  function folderPath(folderId) {
    if (!folderId) return "";
    var path = S().pathOf(folderId) || [];
    return path.map(function (p) { return p.name; }).join(" › ");
  }

  // ---------- detailsPanel ----------

  var FILED_BY = { auto: "Automatically", reviewed: "After review", manual: "By you" };

  function detailsPanel(docId, opts) {
    opts = opts || {};
    var panel = el("aside", "details-panel");
    panel.setAttribute("aria-label", "Document details");
    var editing = false;

    function row(grid, label, value) {
      grid.appendChild(el("dt", null, label));
      var dd = el("dd");
      if (value instanceof Node) dd.appendChild(value);
      else dd.textContent = value == null || value === "" ? "—" : String(value);
      grid.appendChild(dd);
    }

    function draw() {
      var u = U(), s = S();
      var doc = s.document(docId);
      panel.innerHTML = "";

      var head = el("div", "details-head");
      var close = button("×", "btn-icon");
      close.setAttribute("aria-label", "Close details");
      close.addEventListener("click", function () { if (opts.onClose) opts.onClose(); });

      if (!doc) {
        head.appendChild(el("h2", "details-title", "Not found"));
        head.appendChild(close);
        panel.appendChild(head);
        panel.appendChild(el("p", "empty", "This document doesn’t exist."));
        return;
      }

      var isCredential = CREDENTIALS.indexOf(doc.type) !== -1;
      var status = s.fileStatus(doc) || {};

      head.appendChild(fileIcon(u.fileExt(doc.filename)));
      var title = el("h2", "details-title", doc.name || doc.filename);
      if (doc.name !== doc.filename) title.appendChild(el("div", "details-sub mono", doc.filename));
      head.appendChild(title);
      head.appendChild(close);
      panel.appendChild(head);

      // Preview: click to open full size.
      var open = button("", "doc-mock-open");
      open.setAttribute("aria-label", "Open full size");
      open.appendChild(docMock(doc, "panel"));
      open.addEventListener("click", function () { openFullPreview(doc); });
      panel.appendChild(open);

      var actions = el("div", "details-actions");
      var full = button("Open full size");
      full.addEventListener("click", function () { openFullPreview(doc); });
      var dl = button("Download");
      dl.addEventListener("click", function () { download(doc.id); });
      var edit = button(editing ? "Cancel editing" : "Edit details");
      edit.addEventListener("click", function () { editing = !editing; draw(); });
      actions.appendChild(full);
      actions.appendChild(dl);
      actions.appendChild(edit);
      if (isCredential && doc.status === "filed" && !doc.renewedOn && !doc.requestedOn && !doc.deletedOn) {
        var req = button("Request updated version");
        req.addEventListener("click", function () {
          s.requestUpdate(doc.id);
          toast("Asked for an updated " + u.typeLabel(doc.type).toLowerCase());
        });
        actions.appendChild(req);
      }
      panel.appendChild(actions);

      // Section header: "Sortable details" with the status tag beside it.
      var secHead = el("div", "details-head");
      secHead.appendChild(el("h3", "section-label", "Sortable details"));
      if (status.key) secHead.appendChild(statusTag(status.key));
      panel.appendChild(secHead);
      if (editing) {
        panel.appendChild(editForm(doc));
      } else {
        var emp = doc.employeeId ? s.employee(doc.employeeId) : null;
        var ven = doc.vendorId ? s.vendor(doc.vendorId) : null;
        var grid = el("dl", "details-grid");
        row(grid, "Employee", emp ? emp.name : "");
        if (ven) row(grid, "Vendor", ven.name);
        row(grid, "Document type", u.typeLabel(doc.type));
        row(grid, "Document date", u.formatDate(doc.docDate));
        if (doc.invoice) {
          row(grid, "Amount", doc.invoice.amountCents != null ? u.formatMoney(doc.invoice.amountCents) : "");
          row(grid, "Due", doc.invoice.dueDate ? u.formatDate(doc.invoice.dueDate) : "Due date missing");
        }
        row(grid, "Expires", doc.expiresOn ? expiryText(doc.expiresOn) : isCredential ? "No date found" : "");
        row(grid, "Label", el("span", "mono", doc.name || doc.filename));
        row(grid, "Filed", doc.status === "filed" ? (FILED_BY[doc.filedBy] || "Yes") : "Not yet");
        if (doc.folderId) row(grid, "Folder", folderPath(doc.folderId));
        row(grid, "Location", doc.location);
        panel.appendChild(grid);
      }

      var acts = (doc.activity || []).slice().reverse();
      if (acts.length) {
        panel.appendChild(el("h3", "section-label", "Activity"));
        var tl = el("ol", "timeline");
        acts.forEach(function (a) {
          var li = el("li", "timeline-item");
          li.appendChild(el("div", "timeline-what", a.what));
          if (a.detail) li.appendChild(el("div", "timeline-detail", a.detail));
          li.appendChild(el("div", "timeline-meta", (a.who || "") + (a.on ? " · " + u.formatDate(a.on) : "")));
          tl.appendChild(li);
        });
        panel.appendChild(tl);
      }
    }

    function field(label, control) {
      var l = el("label", null, label);
      l.appendChild(control);
      return l;
    }

    function editForm(doc) {
      var u = U(), s = S();
      var form = el("form", "details-form");

      var empSel = el("select");
      var none = el("option", null, "No employee");
      none.value = "";
      empSel.appendChild(none);
      (s.employees() || []).slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; })
        .forEach(function (e) {
          var o = el("option", null, e.name);
          o.value = e.id;
          if (e.id === doc.employeeId) o.selected = true;
          empSel.appendChild(o);
        });

      var typeSel = el("select");
      TYPES.forEach(function (t) {
        var o = el("option", null, u.typeLabel(t));
        o.value = t;
        if (t === doc.type) o.selected = true;
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

      form.appendChild(field("Employee", empSel));
      form.appendChild(field("Document type", typeSel));
      form.appendChild(field("Document date", dateIn));
      form.appendChild(expLabel);

      var bar = el("div", "details-form-actions");
      var cancel = button("Cancel");
      cancel.addEventListener("click", function () { editing = false; draw(); });
      var save = el("button", "btn btn-primary", "Save details");
      save.type = "submit";
      bar.appendChild(cancel);
      bar.appendChild(save);
      form.appendChild(bar);

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var isCred = CREDENTIALS.indexOf(typeSel.value) !== -1;
        editing = false;
        s.editDetails(doc.id, {
          employeeId: empSel.value || null,
          type: typeSel.value,
          docDate: dateIn.value || doc.docDate,
          expiresOn: isCred ? expIn.value || null : null
        });
        toast("Details saved");
        // The router usually redraws after the store write. Redraw here too in case it doesn't.
        if (panel.isConnected) draw();
      });
      return form;
    }

    draw();
    return panel;
  }

  // ---------- folderPicker ----------

  function folderPicker(onPick) {
    var s = S();
    var all = s.folders() || [];
    var byParent = {};
    all.forEach(function (f) {
      var key = f.parentId || "";
      (byParent[key] = byParent[key] || []).push(f);
    });

    var picker = el("div", "folder-picker");
    picker.setAttribute("role", "tree");
    picker.setAttribute("aria-label", "Folders");
    var selected = null;

    function branch(parentId, depth) {
      var ul = el("ul");
      if (depth) ul.setAttribute("role", "group");
      (byParent[parentId] || []).forEach(function (f) {
        var kids = byParent[f.id] || [];
        var li = el("li");
        li.setAttribute("role", "treeitem");
        var rowEl = el("div", "folder-row");

        var toggle = button("›", "folder-toggle" + (kids.length ? "" : " is-leaf"));
        toggle.setAttribute("aria-label", "Show folders inside " + f.name);
        var pick = button("", "folder-pick");
        pick.appendChild(fileIcon("folder"));
        pick.appendChild(el("span", "folder-pick-name", f.name));
        if (f.restricted) pick.appendChild(el("span", "folder-lock", "🔒"));
        if (!s.canOpen(f.id)) pick.disabled = true;
        pick.addEventListener("click", function () {
          if (selected) selected.classList.remove("is-selected");
          selected = pick;
          pick.classList.add("is-selected");
          if (onPick) onPick(f.id, f);
        });

        rowEl.appendChild(toggle);
        rowEl.appendChild(pick);
        li.appendChild(rowEl);

        if (kids.length) {
          var open = depth === 0;
          var sub = null;
          var setOpen = function (v) {
            open = v;
            li.setAttribute("aria-expanded", String(open));
            toggle.classList.toggle("is-open", open);
            if (open && !sub) { sub = branch(f.id, depth + 1); li.appendChild(sub); }
            if (sub) sub.hidden = !open;
          };
          toggle.addEventListener("click", function () { setOpen(!open); });
          setOpen(open);
        }
        ul.appendChild(li);
      });
      return ul;
    }

    picker.appendChild(branch("", 0));
    return picker;
  }

  Sortable.ui = {
    fileIcon: fileIcon,
    statusTag: statusTag,
    expiryText: expiryText,
    calBlock: calBlock,
    ring: ring,
    docMock: docMock,
    dropZone: dropZone,
    detailsPanel: detailsPanel,
    folderPicker: folderPicker,
    menu: menu,
    modal: modal,
    toast: toast,
    download: download,
    copyText: copyText
  };
})();
