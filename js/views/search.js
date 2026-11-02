// Sortable.views.search: the Search page ("Find any document"). Owner: Search.
// Reads through Sortable.store and Sortable.search only. Typing updates the results in place
// and keeps the query in the hash with history.replaceState, so no full redraw happens per key.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});
  Sortable.views = Sortable.views || {};

  var CHIPS = ["Okafor's license", "Henry Schein March", "HIPAA training", "Medline invoice", "Priya's certification"];
  var MAX_DOCS = 6;

  // Transient state, kept across redraws (store writes re-render the whole view).
  var caret = null; // { q, start, end } from the last time the user typed or moved the caret

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function pathText(folderId) {
    if (!folderId) return "";
    return Sortable.store.pathOf(folderId).map(function (p) { return p.name; }).join(" › ");
  }

  function ownerName(doc) {
    var s = Sortable.store;
    var e = doc.employeeId ? s.employee(doc.employeeId) : null;
    if (e) return e.name;
    var v = doc.vendorId ? s.vendor(doc.vendorId) : null;
    if (v) return v.name;
    return "Practice";
  }

  function folderRow(folder) {
    var a = el("a", "search-folder");
    a.href = "#/library/f/" + encodeURIComponent(folder.id);
    a.appendChild(Sortable.ui.fileIcon("folder"));
    var body = el("span", "search-folder-body");
    body.appendChild(el("span", "search-folder-name", folder.name));
    var path = Sortable.store.pathOf(folder.id).slice(0, -1).map(function (p) { return p.name; }).join(" › ");
    body.appendChild(el("span", "search-folder-path muted", path || "All files"));
    a.appendChild(body);
    a.appendChild(el("span", "search-folder-go muted", "Open folder"));
    return a;
  }

  function docCard(doc, best) {
    var u = Sortable.util;
    var a = el("a", "search-card" + (best ? " is-best" : ""));
    a.href = "#/doc/" + encodeURIComponent(doc.id);

    var top = el("span", "search-card-top");
    top.appendChild(Sortable.ui.fileIcon(u.fileExt(doc.filename)));
    top.appendChild(el("span", "search-card-who", ownerName(doc) + " · " + u.typeLabel(doc.type)));
    if (best) top.appendChild(el("span", "search-best", "Best match"));
    a.appendChild(top);

    a.appendChild(el("span", "search-card-name mono", doc.name));

    var meta = el("span", "search-card-meta muted");
    meta.appendChild(el("span", "search-card-path", pathText(doc.folderId)));
    if (doc.expiresOn) {
      meta.appendChild(document.createTextNode(" · Expires "));
      meta.appendChild(Sortable.ui.expiryText(doc.expiresOn));
    }
    a.appendChild(meta);
    return a;
  }

  function drawResults(box, q) {
    box.innerHTML = "";
    var res = Sortable.search.run(q);
    var docs = res.documents.slice(0, MAX_DOCS);

    if (!res.folders.length && !docs.length) {
      if (q.trim().length > 2) {
        box.appendChild(el("p", "empty", "No documents match. Try a name, a document type, or a folder."));
      }
      return;
    }

    if (res.folders.length) {
      var fs = el("section", "search-section");
      fs.appendChild(el("h2", "section-label", "Folders"));
      var list = el("div", "search-folders");
      res.folders.forEach(function (f) { list.appendChild(folderRow(f)); });
      fs.appendChild(list);
      box.appendChild(fs);
    }

    if (docs.length) {
      var ds = el("section", "search-section");
      var label = res.documents.length > MAX_DOCS
        ? "Documents (top " + MAX_DOCS + " of " + res.documents.length + ")"
        : "Documents";
      ds.appendChild(el("h2", "section-label", label));
      var grid = el("div", "search-grid");
      docs.forEach(function (d, i) { grid.appendChild(docCard(d, i === 0)); });
      ds.appendChild(grid);
      box.appendChild(ds);
    }
  }

  function render(root, params) {
    root.className = "page screen-search";
    var q = (params && params.query && params.query.q) || "";

    root.appendChild(el("h1", "page-title", "Find any document"));

    var label = el("label", "sr-only", "Search documents");
    label.htmlFor = "search-page-input";
    root.appendChild(label);

    var input = el("input", "search-field search-big");
    input.id = "search-page-input";
    input.type = "search";
    input.placeholder = "Okafor's license";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = q;
    root.appendChild(input);

    var chips = el("div", "search-chips");
    chips.setAttribute("aria-label", "Try a search");
    CHIPS.forEach(function (text) {
      var b = el("button", "chip", text);
      b.type = "button";
      b.addEventListener("click", function () {
        input.value = text;
        update();
        input.focus();
        input.setSelectionRange(text.length, text.length);
        remember();
      });
      chips.appendChild(b);
    });
    root.appendChild(chips);

    var results = el("div", "search-results");
    results.setAttribute("aria-live", "polite");
    root.appendChild(results);
    drawResults(results, q);

    function remember() {
      caret = { q: input.value, start: input.selectionStart, end: input.selectionEnd };
    }

    function update() {
      var v = input.value;
      var hash = "#/search" + (v ? "?q=" + encodeURIComponent(v) : "");
      if (location.hash !== hash) history.replaceState(null, "", hash);
      drawResults(results, v);
      remember();
    }

    input.addEventListener("input", update);
    input.addEventListener("keyup", remember);
    input.addEventListener("select", remember);
    input.addEventListener("click", remember);

    // Autofocus, and put the caret back where it was if this is a redraw of the same query.
    input.focus({ preventScroll: true });
    var start = q.length, end = q.length;
    if (caret && caret.q === q && caret.start != null) { start = caret.start; end = caret.end; }
    try { input.setSelectionRange(start, end); } catch (e) { /* some input types disallow it */ }
  }

  Sortable.views.search = { render: render };
})();
