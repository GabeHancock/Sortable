// Sortable.views.library: the Files screen. Owner: Files.
// Routes: #/library, #/library/f/:folderId, #/library/c/:collection, #/doc/:id.
// View settings live in the query string (view, sort, dir, employee, type, status, q, az).
// Transient state (selection, rename, drawer) lives in variables here, so a redraw keeps it.
// Reads and writes only through Sortable.store; shared components come from Sortable.ui.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});
  Sortable.views = Sortable.views || {};

  function U() { return Sortable.util; }
  function S() { return Sortable.store; }
  function UI() { return Sortable.ui; }

  var TYPES = ["invoice", "license", "certification", "training", "hr_form", "contract", "compliance", "medical", "other"];
  var CREDENTIAL = { license: true, certification: true, training: true };
  var STATUS_LABELS = {
    current: "Current", expiring: "Expiring soon", review: "Needs review", awaiting: "Needs new document",
    expired: "Expired", renewed: "Renewed", unpaid: "Unpaid", paid: "Paid", overdue: "Overdue"
  };
  var STATUS_FILTERS = ["current", "expiring", "expired", "awaiting", "renewed", "unpaid", "paid", "overdue"];
  // Default list order (Files screen): Current, Expiring soon, Needs review, Needs new document, Expired, then the rest.
  var STATUS_ORDER = { current: 0, expiring: 1, review: 2, awaiting: 3, expired: 4 };
  var COLLECTIONS = {
    recent: "Recent", starred: "Starred", expiring: "Expiring soon", review: "Needs review", trash: "Trash"
  };
  var SORTS = [
    { key: "", label: "Status" },
    { key: "name", label: "Name" },
    { key: "modified", label: "Last modified" },
    { key: "expires", label: "Expiration date" },
    { key: "type", label: "Document type" }
  ];
  var QUERY_KEYS = ["view", "sort", "dir", "employee", "type", "status", "q", "az"];

  // ---------- Transient view state ----------

  var selection = {};        // id -> true (documents and folders)
  var selectionCtx = null;   // context key the selection belongs to
  var renamingId = null;     // document or user folder being renamed inline
  var drawerOpen = false;    // phone sidebar drawer
  var dragIds = null;        // ids being dragged inside the app
  var searchFocus = null;    // { pos } when the toolbar search should get focus back after a redraw

  // ---------- Small helpers ----------

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
  function enc(s) { return encodeURIComponent(s); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }

  function qs(query, keep) {
    var parts = [];
    QUERY_KEYS.forEach(function (k) {
      if (keep && keep.indexOf(k) === -1) return;
      var v = query[k];
      if (v != null && v !== "") parts.push(k + "=" + enc(v));
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  function ctxPath(ctx) {
    if (!ctx || ctx.kind === "all") return "#/library";
    if (ctx.kind === "folder") return "#/library/f/" + enc(ctx.folderId);
    return "#/library/c/" + enc(ctx.name);
  }

  function go(hash, replace) {
    if (location.hash === hash) return;
    if (replace) location.replace(hash);
    else location.hash = hash;
  }

  // Opening a different place keeps the list/grid and sort settings, and drops search and filters.
  function openFolder(folderId, query) {
    drawerOpen = false;
    go((folderId ? "#/library/f/" + enc(folderId) : "#/library") + qs(query || {}, ["view", "sort", "dir"]));
  }
  function openCtx(ctx, query) {
    drawerOpen = false;
    go(ctxPath(ctx) + qs(query || {}, ["view", "sort", "dir"]));
  }

  // ---------- Route -> context ----------

  function resolve(params) {
    var seg = params.segments || [];
    var r = { ctx: null, docId: null, notFound: null };
    if (seg[0] === "doc") {
      var doc = S().document(seg[1]);
      if (!doc) { r.ctx = { kind: "all", folderId: null }; r.notFound = "document"; return r; }
      r.docId = doc.id;
      if (doc.deletedOn) r.ctx = { kind: "coll", name: "trash" };
      else if (doc.status === "filed" && doc.folderId && S().folder(doc.folderId)) r.ctx = { kind: "folder", folderId: doc.folderId };
      else if (doc.status === "review") r.ctx = { kind: "coll", name: "review" };
      else r.ctx = { kind: "coll", name: "recent" };
      return r;
    }
    if (seg.length === 1) { r.ctx = { kind: "all", folderId: null }; return r; }
    if (seg[1] === "f") {
      var f = S().folder(seg[2]);
      if (!f) { r.ctx = { kind: "all", folderId: null }; r.notFound = "folder"; return r; }
      r.ctx = { kind: "folder", folderId: f.id, folder: f };
      return r;
    }
    if (seg[1] === "c" && COLLECTIONS.hasOwnProperty(seg[2])) { r.ctx = { kind: "coll", name: seg[2] }; return r; }
    r.ctx = { kind: "all", folderId: null };
    r.notFound = "collection";
    return r;
  }

  function ctxKey(ctx) { return ctx.kind + ":" + (ctx.folderId || ctx.name || ""); }

  function ctxLabel(ctx) {
    if (ctx.kind === "all") return "All files";
    if (ctx.kind === "coll") return COLLECTIONS[ctx.name];
    var f = ctx.folder || S().folder(ctx.folderId);
    return f ? f.name : "Files";
  }

  function isRestrictedCtx(ctx) {
    if (ctx.kind !== "folder") return false;
    var path = S().pathOf(ctx.folderId);
    return path.length > 0 && path[0].id === "fld-confidential";
  }

  // ---------- Counts (worked out once per draw) ----------

  function buildCounts() {
    var parent = {};
    S().folders().forEach(function (f) { parent[f.id] = f.parentId; });
    var files = {}, attention = {};
    S().documents({ status: "filed" }).forEach(function (d) {
      var key = S().fileStatus(d).key;
      var needs = key === "expired" || key === "expiring" || key === "awaiting";
      var id = d.folderId, guard = 0;
      while (id && guard++ < 20) {
        files[id] = (files[id] || 0) + 1;
        if (needs) attention[id] = (attention[id] || 0) + 1;
        id = parent[id];
      }
    });
    return { files: files, attention: attention };
  }

  // ---------- Listing ----------

  function readFilters(query) {
    return { employeeId: query.employee || "", type: query.type || "", status: query.status || "" };
  }
  function hasFilters(f) { return !!(f.employeeId || f.type || f.status); }

  function passes(d, f) {
    if (f.employeeId && d.employeeId !== f.employeeId) return false;
    if (f.type && d.type !== f.type) return false;
    if (f.status && S().fileStatus(d).key !== f.status) return false;
    return true;
  }

  // Returns { folders, docs, groups, ranked }.
  function listing(r, query) {
    var ctx = r.ctx;
    var q = (query.q || "").trim();
    var f = readFilters(query);
    var filtering = hasFilters(f);
    var out = { folders: [], docs: [], groups: null, ranked: false };
    var searching = q && Sortable.search && Sortable.search.words(q).length > 0;

    if (ctx.kind === "coll") {
      var docs = S().collection(ctx.name);
      if (ctx.name === "starred" && !q && !filtering) {
        out.folders = S().folders().filter(function (x) { return x.starred; });
      }
      if (searching) {
        if (ctx.name === "review" || ctx.name === "trash") {
          var words = Sortable.search.words(q);
          docs = docs.filter(function (d) {
            var hay = (d.name + " " + d.filename + " " + (d.text || "")).toLowerCase();
            return words.every(function (w) { return hay.indexOf(w) !== -1; });
          });
        } else {
          var hits = {};
          Sortable.search.run(q, { minShare: 0.5 }).documents.forEach(function (d) { hits[d.id] = true; });
          docs = docs.filter(function (d) { return hits[d.id]; });
        }
      }
      out.docs = docs.filter(function (d) { return passes(d, f); });
      return out;
    }

    var folderId = ctx.kind === "folder" ? ctx.folderId : null;

    if (searching) {
      var opts = { minShare: 0.5, filters: { type: f.type, employeeId: f.employeeId, status: f.status } };
      if (folderId) opts.folderId = folderId;
      var res = Sortable.search.run(q, opts);
      out.folders = filtering ? [] : res.folders;
      out.docs = res.documents;
      out.ranked = true;
      return out;
    }

    if (filtering) {
      var filter = { status: "filed" };
      if (folderId) { filter.folderId = folderId; filter.recursive = true; }
      out.docs = S().documents(filter).filter(function (d) { return passes(d, f); });
      return out;
    }

    var kids = S().children(folderId);
    if (folderId === "fld-employees") {
      var people = [], groups = [], mine = [];
      kids.folders.forEach(function (dept) {
        if (dept.kind !== "department") { mine.push(dept); return; }
        var list = S().children(dept.id).folders;
        people = people.concat(list.filter(function (p) { return p.kind === "person"; }));
        groups.push({ label: dept.name, folderId: dept.id, folders: list });
      });
      if (query.az === "1") {
        people.sort(function (a, b) { return a.name.localeCompare(b.name); });
        groups = [{ label: "All employees, A–Z", folderId: null, folders: people }];
      }
      if (mine.length) groups.push({ label: "Your folders", folderId: null, folders: mine });
      out.groups = groups;
      out.docs = kids.documents; // credentials with no employee file here
      return out;
    }
    out.folders = kids.folders;
    out.docs = kids.documents;
    return out;
  }

  function sortDocs(docs, query, ranked) {
    var sort = query.sort || "";
    var dir = query.dir === "desc" ? -1 : query.dir === "asc" ? 1 : (sort === "modified" ? -1 : 1);
    if (!sort && ranked) return docs;
    var u = U();
    function name(d) { return String(d.name || d.filename || "").toLowerCase(); }
    var list = docs.slice();
    list.sort(function (a, b) {
      var c = 0;
      if (sort === "name") c = name(a).localeCompare(name(b));
      else if (sort === "modified") c = (a.modifiedOn || "") < (b.modifiedOn || "") ? -1 : (a.modifiedOn || "") > (b.modifiedOn || "") ? 1 : 0;
      else if (sort === "type") c = u.typeLabel(a.type).localeCompare(u.typeLabel(b.type));
      else if (sort === "expires") {
        if (!a.expiresOn !== !b.expiresOn) return a.expiresOn ? -1 : 1; // no date goes last either way
        c = (a.expiresOn || "") < (b.expiresOn || "") ? -1 : (a.expiresOn || "") > (b.expiresOn || "") ? 1 : 0;
      } else {
        var sa = STATUS_ORDER[S().fileStatus(a).key], sb = STATUS_ORDER[S().fileStatus(b).key];
        c = (sa == null ? 5 : sa) - (sb == null ? 5 : sb);
        if (!c) return name(a).localeCompare(name(b));
        return c;
      }
      if (!c) c = name(a).localeCompare(name(b));
      return c * dir;
    });
    return list;
  }

  function sortFolders(folders, query) {
    if (query.sort !== "name") return folders;
    var dir = query.dir === "desc" ? -1 : 1;
    return folders.slice().sort(function (a, b) { return a.name.localeCompare(b.name) * dir; });
  }

  // ---------- Lookups for rows ----------

  function makeLookups() {
    var emp = {}, ven = {};
    S().employees().forEach(function (e) { emp[e.id] = e; });
    S().vendors().forEach(function (v) { ven[v.id] = v; });
    return { emp: emp, ven: ven };
  }

  function personEmpId(f) {
    var m = /^fld-(emp-\d+)$/.exec(f.id);
    return m ? m[1] : null;
  }

  function folderSub(f, counts, lk) {
    var n = counts.files[f.id] || 0;
    var files = plural(n, "file");
    if (f.kind === "department") return plural(S().children(f.id).folders.length, "person", "people");
    var empId = personEmpId(f);
    if (empId && lk.emp[empId]) return lk.emp[empId].role + " · " + files;
    return files;
  }

  function docSub(d, showPath) {
    if (showPath && d.folderId) {
      return S().pathOf(d.folderId).map(function (p) { return p.name; }).join(" › ");
    }
    if (d.name !== d.filename) return d.filename;
    return U().typeLabel(d.type);
  }

  function statusTagFor(d) {
    var st = S().fileStatus(d) || {};
    var tag = UI().statusTag(st.key);
    if (st.label && tag.textContent !== st.label) tag.textContent = st.label;
    return tag;
  }

  // ---------- Selection ----------

  function selectedIds() { return Object.keys(selection); }
  function selectOnly(id) { selection = {}; selection[id] = true; }
  function toggleSelect(id, on) { if (on) selection[id] = true; else delete selection[id]; }

  // ---------- Actions ----------

  function isUserFolder(id) {
    var f = S().folder(id);
    return !!(f && !f.auto);
  }

  function doRename(id, name) {
    renamingId = null;
    var old = S().document(id) || S().folder(id);
    var res = S().rename(id, name);
    if (res && old && (old.name !== res.name)) UI().toast("Renamed to " + res.name);
  }

  function moveModal(ids) {
    ids = ids.filter(function (id) { return S().document(id) || isUserFolder(id); });
    if (!ids.length) { UI().toast("Only files and your own folders can be moved"); return; }
    var picked = null;
    var body = el("div", "lib-move");
    var hint = el("p", "muted", "Choose where to put " + (ids.length === 1 ? "it" : "them") + ".");
    body.appendChild(hint);
    body.appendChild(UI().folderPicker(function (folderId) { picked = folderId; hint.textContent = "Move to " + pathText(folderId); }));
    UI().modal({
      title: "Move " + plural(ids.length, "item"),
      body: body,
      actions: [
        { label: "Cancel" },
        {
          label: "Move", primary: true,
          onClick: function () {
            if (!picked) { hint.textContent = "Pick a folder first."; return false; }
            var n = S().move(ids, picked);
            selection = {};
            UI().toast(n ? "Moved " + plural(n, "item") + " to " + pathText(picked) : "Nothing was moved");
          }
        }
      ]
    });
  }

  function pathText(folderId) {
    return S().pathOf(folderId).map(function (p) { return p.name; }).join(" › ");
  }

  function trashDocs(ids) {
    var docs = ids.filter(function (id) { return S().document(id); });
    var folders = ids.filter(isUserFolder);
    var failed = 0;
    folders.forEach(function (id) { if (!S().deleteFolder(id)) failed++; });
    if (docs.length) S().trash(docs);
    selection = {};
    if (docs.length) UI().toast("Moved " + plural(docs.length, "file") + " to Trash");
    else if (folders.length && !failed) UI().toast("Folder deleted");
    if (failed) UI().toast("Only empty folders can be deleted");
  }

  function requestUpdates(ids) {
    var creds = ids.filter(function (id) { return canRequest(S().document(id)); });
    if (!creds.length) { UI().toast("Only current licenses, certifications and trainings can be requested"); return; }
    S().requestUpdate(creds);
    UI().toast("Asked for " + plural(creds.length, "updated version"));
  }

  function canRequest(d) {
    return !!(d && CREDENTIAL[d.type] && d.status === "filed" && !d.renewedOn && !d.requestedOn && !d.deletedOn);
  }

  function openPreview(d) {
    UI().modal({
      title: d.name || d.filename,
      body: UI().docMock(d, "full"),
      actions: [
        { label: "Download", onClick: function () { UI().download(d.id); return false; } },
        { label: "Close", primary: true }
      ]
    });
  }

  function quickPreview(d, query) {
    var body = el("div", "lib-preview");
    body.appendChild(UI().docMock(d, "panel"));
    UI().modal({
      title: d.name || d.filename,
      body: body,
      actions: [
        { label: "View details", onClick: function () { openDoc(d.id, query); } },
        { label: "Close", primary: true }
      ]
    });
  }

  function openDoc(id, query) {
    selectOnly(id);
    go("#/doc/" + enc(id) + qs(query || {}));
  }

  function newFolderModal(parentId) {
    var input = el("input");
    input.type = "text";
    input.value = "New folder";
    input.setAttribute("aria-label", "Folder name");
    var wrap = el("div", "lib-newfolder");
    var where = parentId ? pathText(parentId) : "All files";
    wrap.appendChild(el("p", "muted", "In " + where));
    wrap.appendChild(input);
    function save() {
      var f = S().newFolder(parentId, input.value);
      if (f) UI().toast("Created folder " + f.name);
      else UI().toast("Folders can't be added here");
    }
    var close = UI().modal({
      title: "New folder",
      body: wrap,
      actions: [{ label: "Cancel" }, { label: "Create", primary: true, onClick: save }]
    });
    input.select();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); save(); close(); }
    });
  }

  function uploadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f && f.name && f.name.charAt(0) !== ".";
    });
    if (!files.length) return;
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
    UI().toast(files.length === 1
      ? "Sent " + files[0].name + ". Sortable is reading it now."
      : "Sent " + files.length + " files. Sortable is reading them now.");
  }

  function manageAccess() {
    var body = el("div", "lib-access");
    body.appendChild(el("p", null, "Only these people can open Confidential Medical."));
    var list = el("ul", "lib-access-list");
    [["emp-16", "Office manager"], ["emp-01", "Medical director"]].forEach(function (p) {
      var e = S().employee(p[0]);
      var li = el("li", "lib-access-row");
      var who = el("div");
      who.appendChild(el("div", "lib-access-name", e ? e.name : p[0]));
      who.appendChild(el("div", "muted", p[1]));
      li.appendChild(who);
      li.appendChild(el("span", "tag tag-current", "Can open"));
      list.appendChild(li);
    });
    body.appendChild(list);
    var v = S().viewer() || {};
    body.appendChild(el("p", "muted", "You’re signed in as " + (v.label || "the office manager") + ". Changing who has access isn’t part of this prototype."));
    UI().modal({ title: "Manage access", body: body, actions: [{ label: "Done", primary: true }] });
  }

  // ---------- Menus ----------

  function docMenuItems(d, r, query) {
    if (d.deletedOn) {
      return [
        { label: "Restore", onSelect: function () { S().restore(d.id); delete selection[d.id]; UI().toast("Restored " + d.name); } },
        { label: "Delete forever", danger: true, onSelect: function () { S().deleteForever(d.id); delete selection[d.id]; UI().toast("Deleted forever"); } }
      ];
    }
    var filed = d.status === "filed";
    return [
      { label: "Open", onSelect: function () { openPreview(d); } },
      { label: "Preview", onSelect: function () { quickPreview(d, query); } },
      { label: "Download", onSelect: function () { UI().download(d.id); } },
      { divider: true },
      { label: "Rename", onSelect: function () { renamingId = d.id; Sortable.router.render(); } },
      { label: "Move", onSelect: function () { moveModal([d.id]); } },
      { label: "Make a copy", disabled: !filed, onSelect: function () { var c = S().copy(d.id); if (c) UI().toast("Made " + c.name); } },
      { label: d.starred ? "Remove star" : "Star", onSelect: function () { S().star(d.id, !d.starred); UI().toast(d.starred ? "Star removed" : "Starred"); } },
      { divider: true },
      { label: "Request updated version", disabled: !canRequest(d), onSelect: function () { requestUpdates([d.id]); } },
      { label: "View details", onSelect: function () { openDoc(d.id, query); } },
      { divider: true },
      { label: "Delete", danger: true, onSelect: function () { trashDocs([d.id]); } }
    ];
  }

  function folderMenuItems(f, query) {
    var user = !f.auto;
    return [
      { label: "Open", onSelect: function () { openFolder(f.id, query); } },
      { label: "Rename", disabled: !user, onSelect: function () { renamingId = f.id; Sortable.router.render(); } },
      { label: "Move", disabled: !user, onSelect: function () { moveModal([f.id]); } },
      { label: f.starred ? "Remove star" : "Star", onSelect: function () { S().star(f.id, !f.starred); UI().toast(f.starred ? "Star removed" : "Starred " + f.name); } },
      { divider: true },
      { label: "Delete", danger: true, disabled: !user, onSelect: function () { trashDocs([f.id]); } }
    ];
  }

  function openMenuAt(items, e, anchor) {
    if (e && e.type === "contextmenu") { UI().menu(items, e.clientX, e.clientY); return; }
    var rect = anchor.getBoundingClientRect();
    UI().menu(items, rect.right - 200, rect.bottom + 4);
  }

  // ---------- Rename input ----------

  function renameInput(id, current) {
    var input = el("input", "lib-rename");
    input.type = "text";
    input.value = current;
    input.setAttribute("aria-label", "New name");
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      if (save && input.value.trim() && input.value.trim() !== current) doRename(id, input.value);
      else { renamingId = null; Sortable.router.render(); }
    }
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", function () {
      // A redraw removes the field; that isn't the person leaving it.
      if (!input.isConnected) return;
      finish(true);
    });
    ["click", "dblclick", "mousedown"].forEach(function (t) {
      input.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    return input;
  }

  // ---------- Drag and drop ----------

  function dragIdsFor(id) {
    if (selection[id]) {
      return selectedIds().filter(function (x) { return S().document(x) || isUserFolder(x); });
    }
    return [id];
  }

  function makeDraggable(node, id) {
    node.draggable = true;
    node.addEventListener("dragstart", function (e) {
      dragIds = dragIdsFor(id);
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", dragIds.join(",")); } catch (err) { /* ignore */ }
      }
      node.classList.add("is-dragging");
    });
    node.addEventListener("dragend", function () {
      dragIds = null;
      node.classList.remove("is-dragging");
    });
  }

  function makeDropTarget(node, folderId) {
    if (!folderId) return;
    node.addEventListener("dragover", function (e) {
      if (!dragIds) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      node.classList.add("is-drop");
    });
    node.addEventListener("dragleave", function () { node.classList.remove("is-drop"); });
    node.addEventListener("drop", function (e) {
      if (!dragIds) return;
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove("is-drop");
      var ids = dragIds.filter(function (x) { return x !== folderId; });
      dragIds = null;
      if (!ids.length) return;
      var n = S().move(ids, folderId);
      UI().toast(n ? "Moved " + plural(n, "item") + " to " + pathText(folderId) : "Can’t move that there");
    });
  }

  // ---------- Sidebar ----------

  function sidebar(r, query) {
    var ctx = r.ctx;
    var side = el("aside", "lib-sidebar" + (drawerOpen ? " is-open" : ""));
    side.setAttribute("aria-label", "Files navigation");

    var head = el("div", "lib-side-head");
    var newBtn = button("+ New", "btn btn-primary lib-new");
    newBtn.setAttribute("aria-haspopup", "menu");

    var filesIn = el("input", "lib-file-input");
    filesIn.type = "file";
    filesIn.multiple = true;
    filesIn.setAttribute("aria-label", "Upload files");
    filesIn.tabIndex = -1;
    filesIn.addEventListener("change", function () { uploadFiles(filesIn.files); filesIn.value = ""; });

    var dirIn = el("input", "lib-file-input");
    dirIn.type = "file";
    dirIn.multiple = true;
    dirIn.setAttribute("webkitdirectory", "");
    dirIn.setAttribute("aria-label", "Upload folder");
    dirIn.tabIndex = -1;
    dirIn.addEventListener("change", function () { uploadFiles(dirIn.files); dirIn.value = ""; });

    var parentForNew = ctx.kind === "folder" && !isRestrictedCtx(ctx) ? ctx.folderId : null;
    newBtn.addEventListener("click", function () {
      var rect = newBtn.getBoundingClientRect();
      UI().menu([
        { label: "New folder", onSelect: function () { newFolderModal(parentForNew); } },
        { divider: true },
        { label: "Upload files", onSelect: function () { filesIn.click(); } },
        { label: "Upload folder", onSelect: function () { dirIn.click(); } },
        { divider: true },
        { label: "Copy forwarding email", onSelect: function () { UI().copyText((S().practice() || {}).forwardEmail || ""); } }
      ], rect.left, rect.bottom + 6);
    });
    head.appendChild(newBtn);
    var closeDrawer = button("×", "btn-icon lib-drawer-close");
    closeDrawer.setAttribute("aria-label", "Close folders");
    closeDrawer.addEventListener("click", function () { drawerOpen = false; Sortable.router.render(); });
    head.appendChild(closeDrawer);
    side.appendChild(head);
    side.appendChild(filesIn);
    side.appendChild(dirIn);

    var counts = S().collectionCounts() || {};
    var topId = null;
    if (ctx.kind === "folder") {
      var p = S().pathOf(ctx.folderId);
      topId = p.length ? p[0].id : null;
    }

    function item(label, target, opts) {
      opts = opts || {};
      var active = target.kind === "all" ? ctx.kind === "all" && !r.notFound
        : target.kind === "folder" ? topId === target.folderId
        : ctx.kind === "coll" && ctx.name === target.name;
      var b = button("", "lib-nav" + (active ? " is-active" : ""));
      if (active) b.setAttribute("aria-current", "page");
      b.appendChild(el("span", "lib-nav-icon", opts.icon || ""));
      b.appendChild(el("span", "lib-nav-label", label));
      if (opts.lock) b.appendChild(el("span", "lib-lock", "🔒"));
      if (opts.count) b.appendChild(el("span", "lib-nav-count", String(opts.count)));
      b.addEventListener("click", function () { openCtx(target, query); });
      if (target.kind === "folder") makeDropTarget(b, target.folderId);
      return b;
    }

    var nav1 = el("nav", "lib-nav-group");
    nav1.setAttribute("aria-label", "Folders");
    nav1.appendChild(item("All files", { kind: "all" }, { icon: "▤" }));
    nav1.appendChild(item("Employees", { kind: "folder", folderId: "fld-employees" }, { icon: "👥" }));
    nav1.appendChild(item("Practice documents", { kind: "folder", folderId: "fld-practice" }, { icon: "🗂" }));
    side.appendChild(nav1);

    var nav2 = el("nav", "lib-nav-group");
    nav2.setAttribute("aria-label", "Collections");
    nav2.appendChild(item("Recent", { kind: "coll", name: "recent" }, { icon: "🕘" }));
    nav2.appendChild(item("Starred", { kind: "coll", name: "starred" }, { icon: "★" }));
    nav2.appendChild(item("Expiring soon", { kind: "coll", name: "expiring" }, { icon: "⏳", count: counts.expiring }));
    nav2.appendChild(item("Needs review", { kind: "coll", name: "review" }, { icon: "◎", count: counts.review }));
    nav2.appendChild(item("Confidential Medical", { kind: "folder", folderId: "fld-confidential" }, { icon: "⚕", lock: true }));
    nav2.appendChild(item("Trash", { kind: "coll", name: "trash" }, { icon: "🗑" }));
    side.appendChild(nav2);

    var st = S().storage() || {};
    var where = el("a", "lib-where");
    where.href = "#/setup";
    where.appendChild(el("div", "section-label", "Where files live"));
    var line = el("div", "lib-where-line");
    var dotKey = st.status === "connected" ? "ok" : st.status === "offline" ? "bad" : "warn";
    line.appendChild(el("span", "lib-dot lib-dot-" + dotKey));
    line.appendChild(el("span", "lib-where-name", st.name || "Storage"));
    where.appendChild(line);
    where.appendChild(el("div", "muted lib-where-sub", st.status === "connected" ? (st.sub || "Connected")
      : st.status === "offline" ? "Offline. Files aren’t being saved." : "Needs attention. Open Setup."));
    side.appendChild(where);

    return side;
  }

  // ---------- Toolbar ----------

  function toolbar(r, query, lk) {
    var ctx = r.ctx;
    var bar = el("div", "lib-toolbar");

    // Row 1: drawer button + breadcrumbs
    var top = el("div", "lib-top");
    var drawerBtn = button("☰ Folders", "btn lib-drawer-btn");
    drawerBtn.setAttribute("aria-expanded", String(drawerOpen));
    drawerBtn.addEventListener("click", function () { drawerOpen = true; Sortable.router.render(); });
    top.appendChild(drawerBtn);
    top.appendChild(breadcrumbs(r, query));
    bar.appendChild(top);

    // Row 2: search
    var searchRow = el("div", "lib-search-row");
    var input = el("input", "search-field lib-search");
    input.type = "search";
    input.value = query.q || "";
    input.placeholder = "Search in " + ctxLabel(ctx);
    input.setAttribute("aria-label", "Search in " + ctxLabel(ctx));
    input.addEventListener("input", function () {
      searchFocus = { pos: input.selectionStart };
      var next = {};
      QUERY_KEYS.forEach(function (k) { next[k] = query[k]; });
      next.q = input.value;
      go(currentPath(r) + qs(next), true);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) { e.preventDefault(); setQuery(r, query, { q: "" }, true); }
    });
    searchRow.appendChild(input);
    if (query.q) {
      var clear = button("Clear", "btn-link lib-clear");
      clear.addEventListener("click", function () { setQuery(r, query, { q: "" }, true); });
      searchRow.appendChild(clear);
    }
    bar.appendChild(searchRow);
    if (searchFocus) {
      var pos = searchFocus.pos;
      searchFocus = null;
      afterMount.push(function () {
        input.focus();
        try { input.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
      });
    }

    // Row 3: filter pills, sort, view toggle
    var controls = el("div", "lib-controls");
    var f = readFilters(query);

    var empSel = pill("Employee", "employee", [{ v: "", t: "Employee" }].concat(
      Object.keys(lk.emp).map(function (id) { return lk.emp[id]; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); })
        .map(function (e) { return { v: e.id, t: e.name }; })), f.employeeId);
    var typeSel = pill("Document type", "type", [{ v: "", t: "Document type" }].concat(
      TYPES.map(function (t) { return { v: t, t: U().typeLabel(t) }; })), f.type);
    var statusSel = pill("Status", "status", [{ v: "", t: "Status" }].concat(
      STATUS_FILTERS.map(function (k) { return { v: k, t: STATUS_LABELS[k] }; })), f.status);
    function pill(label, key, opts, value) {
      var s = el("select", "pill-select" + (value ? " is-active" : ""));
      s.setAttribute("aria-label", label);
      opts.forEach(function (o) {
        var op = el("option", null, o.t);
        op.value = o.v;
        if (o.v === value) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () {
        var ch = {};
        ch[key] = s.value;
        setQuery(r, query, ch);
      });
      return s;
    }
    var pills = el("div", "lib-pills");
    pills.appendChild(empSel);
    pills.appendChild(typeSel);
    pills.appendChild(statusSel);
    // Location is hidden while the practice has one location (Decisions: Location).
    if (hasFilters(f)) {
      var clr = button("Clear filters", "btn-link");
      clr.addEventListener("click", function () { setQuery(r, query, { employee: "", type: "", status: "" }); });
      pills.appendChild(clr);
    }
    controls.appendChild(pills);

    var right = el("div", "lib-right");
    var sortSel = el("select", "pill-select");
    sortSel.setAttribute("aria-label", "Sort by");
    SORTS.forEach(function (s) {
      var op = el("option", null, "Sort: " + s.label);
      op.value = s.key;
      if ((query.sort || "") === s.key) op.selected = true;
      sortSel.appendChild(op);
    });
    sortSel.addEventListener("change", function () { setQuery(r, query, { sort: sortSel.value, dir: "" }); });
    right.appendChild(sortSel);

    if (ctx.kind === "folder" && ctx.folderId === "fld-employees" && !query.q && !hasFilters(f)) {
      var az = el("div", "segmented lib-az");
      az.setAttribute("role", "group");
      az.setAttribute("aria-label", "Group employees");
      [["", "By department"], ["1", "A–Z"]].forEach(function (o) {
        var b = button(o[1]);
        b.setAttribute("aria-pressed", String((query.az || "") === o[0]));
        b.addEventListener("click", function () { setQuery(r, query, { az: o[0] }); });
        az.appendChild(b);
      });
      right.appendChild(az);
    }

    var seg = el("div", "segmented lib-view-toggle");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Layout");
    [["list", "List"], ["grid", "Grid"]].forEach(function (o) {
      var b = button(o[1]);
      var on = (query.view === "grid" ? "grid" : "list") === o[0];
      b.setAttribute("aria-pressed", String(on));
      b.addEventListener("click", function () { setQuery(r, query, { view: o[0] === "list" ? "" : "grid" }); });
      seg.appendChild(b);
    });
    right.appendChild(seg);
    controls.appendChild(right);
    bar.appendChild(controls);

    return bar;
  }

  function currentPath(r) {
    return r.docId ? "#/doc/" + enc(r.docId) : r.notFound ? location.hash.split("?")[0] : ctxPath(r.ctx);
  }

  function setQuery(r, query, changes, replace) {
    var next = {};
    QUERY_KEYS.forEach(function (k) { next[k] = query[k]; });
    Object.keys(changes).forEach(function (k) { next[k] = changes[k]; });
    go(currentPath(r) + qs(next), replace);
  }

  function breadcrumbs(r, query) {
    var ol = el("ol", "breadcrumbs lib-crumbs");
    ol.setAttribute("aria-label", "You are here");
    function crumb(label, onClick, folderId, current) {
      var li = el("li");
      var b = button(label, current ? "is-current" : "");
      if (current) b.setAttribute("aria-current", "location");
      b.addEventListener("click", onClick);
      if (folderId) makeDropTarget(b, folderId);
      li.appendChild(b);
      ol.appendChild(li);
    }
    var ctx = r.ctx;
    if (r.notFound) {
      crumb("All files", function () { openFolder(null, query); });
      crumb("Not found", function () {}, null, true);
      return ol;
    }
    if (ctx.kind === "all") {
      crumb("All files", function () { openFolder(null, query); }, null, true);
      return ol;
    }
    crumb("All files", function () { openFolder(null, query); }, null, false);
    if (ctx.kind === "coll") {
      crumb(COLLECTIONS[ctx.name], function () { openCtx(ctx, query); }, null, true);
      return ol;
    }
    var path = S().pathOf(ctx.folderId);
    path.forEach(function (p, i) {
      crumb(p.name, function () { openFolder(p.id, query); }, p.id, i === path.length - 1);
    });
    return ol;
  }

  // ---------- Bulk bar ----------

  function bulkBar(r, query) {
    var ids = selectedIds();
    var bar = el("div", "bulk-bar lib-bulk");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Selected items");
    bar.appendChild(el("span", "lib-bulk-count", ids.length + " selected"));
    function act(label, fn, opts) {
      opts = opts || {};
      var b = button(label, "btn" + (opts.danger ? " btn-danger" : ""));
      if (opts.disabled) b.disabled = true;
      b.addEventListener("click", fn);
      bar.appendChild(b);
    }
    var docs = ids.map(function (id) { return S().document(id); }).filter(Boolean);
    var inTrash = r.ctx.kind === "coll" && r.ctx.name === "trash";
    if (inTrash) {
      act("Restore", function () { S().restore(ids); selection = {}; UI().toast("Restored " + plural(ids.length, "file")); });
      act("Delete forever", function () { S().deleteForever(ids); selection = {}; UI().toast("Deleted forever"); }, { danger: true });
    } else {
      act("Move", function () { moveModal(ids); });
      act("Download", function () { docs.forEach(function (d) { UI().download(d.id); }); }, { disabled: !docs.length });
      var one = ids.length === 1 && (docs.length === 1 || isUserFolder(ids[0]));
      act("Rename", function () { renamingId = ids[0]; Sortable.router.render(); }, { disabled: !one });
      act("Request updated versions", function () { requestUpdates(ids); }, { disabled: !docs.some(canRequest) });
      act("Delete", function () { trashDocs(ids); }, { danger: true });
    }
    act("Clear", function () { selection = {}; Sortable.router.render(); });
    return bar;
  }

  // ---------- List view ----------

  function listView(r, query, data, lk, counts) {
    var card = el("div", "card lib-list-card");
    var table = el("table", "table lib-table");
    var thead = el("thead");
    var hr = el("tr");
    var all = itemsOf(data);

    var thBox = el("th", "lib-col-check");
    var allBox = el("input");
    allBox.type = "checkbox";
    allBox.setAttribute("aria-label", "Select all");
    allBox.checked = all.length > 0 && all.every(function (x) { return selection[x]; });
    allBox.addEventListener("change", function () {
      all.forEach(function (id) { toggleSelect(id, allBox.checked); });
      Sortable.router.render();
    });
    thBox.appendChild(allBox);
    hr.appendChild(thBox);

    function sortTh(label, key, cls) {
      var th = el("th", cls || "");
      var b = button(label, "lib-th-btn");
      var active = (query.sort || "") === key;
      var dir = query.dir || (key === "modified" ? "desc" : "asc");
      if (active) {
        b.appendChild(el("span", "lib-sort-arrow", dir === "desc" ? " ▼" : " ▲"));
        th.setAttribute("aria-sort", dir === "desc" ? "descending" : "ascending");
      }
      b.addEventListener("click", function () {
        if (active) setQuery(r, query, { dir: dir === "desc" ? "asc" : "desc" });
        else setQuery(r, query, { sort: key, dir: "" });
      });
      th.appendChild(b);
      return th;
    }
    hr.appendChild(sortTh("Name", "name", "lib-col-name"));
    hr.appendChild(el("th", null, "Employee"));
    hr.appendChild(sortTh("Document type", "type"));
    hr.appendChild(sortTh("Last modified", "modified"));
    hr.appendChild(sortTh("Expiration date", "expires"));
    hr.appendChild(el("th", null, "Status"));
    var thMore = el("th", "lib-col-more");
    thMore.appendChild(el("span", "sr-only", "Actions"));
    hr.appendChild(thMore);
    thead.appendChild(hr);
    table.appendChild(thead);

    var showPath = r.ctx.kind === "coll" || !!query.q || hasFilters(readFilters(query));

    if (data.groups) {
      data.groups.forEach(function (g) {
        var tb = el("tbody", "lib-group");
        var gr = el("tr", "lib-group-row");
        var gth = el("th");
        gth.colSpan = 8;
        gth.scope = "colgroup";
        if (g.folderId) {
          var gb = button(g.label, "btn-link lib-group-link");
          gb.addEventListener("click", function () { openFolder(g.folderId, query); });
          gth.appendChild(gb);
        } else {
          gth.appendChild(el("span", "lib-group-label", g.label));
        }
        gth.appendChild(el("span", "lib-group-count", plural(g.folders.length, "person", "people")));
        gr.appendChild(gth);
        tb.appendChild(gr);
        g.folders.forEach(function (f) { tb.appendChild(folderRow(f, r, query, lk, counts)); });
        table.appendChild(tb);
      });
      if (data.docs.length) {
        var loose = el("tbody", "lib-group");
        var lr = el("tr", "lib-group-row");
        var lth = el("th");
        lth.colSpan = 8;
        lth.appendChild(el("span", "lib-group-label", "Files"));
        lr.appendChild(lth);
        loose.appendChild(lr);
        data.docs.forEach(function (d) { loose.appendChild(docRow(d, r, query, lk, false)); });
        table.appendChild(loose);
      }
    } else {
      var tbody = el("tbody");
      data.folders.forEach(function (f) { tbody.appendChild(folderRow(f, r, query, lk, counts)); });
      data.docs.forEach(function (d) { tbody.appendChild(docRow(d, r, query, lk, showPath)); });
      table.appendChild(tbody);
    }
    card.appendChild(table);
    return card;
  }

  function itemsOf(data) {
    var ids = [];
    if (data.groups) data.groups.forEach(function (g) { g.folders.forEach(function (f) { ids.push(f.id); }); });
    else data.folders.forEach(function (f) { ids.push(f.id); });
    data.docs.forEach(function (d) { ids.push(d.id); });
    return ids;
  }

  function checkbox(id, label) {
    var box = el("input", "lib-check");
    box.type = "checkbox";
    box.checked = !!selection[id];
    box.setAttribute("aria-label", "Select " + label);
    box.addEventListener("click", function (e) { e.stopPropagation(); });
    box.addEventListener("change", function () {
      toggleSelect(id, box.checked);
      Sortable.router.render();
    });
    return box;
  }

  function moreButton(label, itemsFn) {
    var more = button("⋯", "btn-icon lib-more");
    more.setAttribute("aria-label", "More actions for " + label);
    more.setAttribute("aria-haspopup", "menu");
    more.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenuAt(itemsFn(), e, more);
    });
    return more;
  }

  function nameBlock(icon, id, name, sub, opts) {
    opts = opts || {};
    var wrap = el("div", "lib-name");
    wrap.appendChild(icon);
    var text = el("div", "lib-name-text");
    if (renamingId === id) {
      var input = renameInput(id, name);
      text.appendChild(input);
      afterMount.push(function () { input.focus(); input.select(); });
    } else {
      var main = el("div", "lib-name-main");
      main.appendChild(el("span", "lib-name-label", name));
      if (opts.starred) {
        var star = el("span", "lib-star", "★");
        star.setAttribute("aria-label", "Starred");
        main.appendChild(star);
      }
      if (opts.lock) {
        var lock = el("span", "lib-lock", "🔒");
        lock.setAttribute("aria-label", "Restricted");
        main.appendChild(lock);
      }
      text.appendChild(main);
    }
    if (sub) text.appendChild(el("div", "lib-name-sub" + (opts.mono ? " mono" : ""), sub));
    wrap.appendChild(text);
    return wrap;
  }

  function wireItem(node, id, kind, onOpen, itemsFn) {
    node.tabIndex = 0;
    node.setAttribute("data-id", id);
    node.addEventListener("click", function (e) {
      if (renamingId === id) return;
      if (e.metaKey || e.ctrlKey) { toggleSelect(id, !selection[id]); Sortable.router.render(); return; }
      if (kind === "folder") {
        // Phones have no double-click: one tap opens the folder.
        if ((window.innerWidth || 1024) < 700) { onOpen(); return; }
        selectOnly(id);
        Sortable.router.render();
        return;
      }
      onOpen();
    });
    if (kind === "folder") node.addEventListener("dblclick", function () { onOpen(); });
    node.addEventListener("keydown", function (e) {
      if (e.target !== node) return;
      if (e.key === "Enter") { e.preventDefault(); onOpen(); }
      else if (e.key === " ") { e.preventDefault(); toggleSelect(id, !selection[id]); Sortable.router.render(); }
    });
    node.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      if (!selection[id]) { selectOnly(id); }
      UI().menu(itemsFn(), e.clientX, e.clientY);
    });
  }

  function folderRow(f, r, query, lk, counts) {
    var tr = el("tr", "lib-row lib-row-folder" + (selection[f.id] ? " is-selected" : ""));
    var td0 = el("td", "lib-col-check");
    td0.appendChild(checkbox(f.id, f.name));
    tr.appendChild(td0);
    var tdName = el("td", "lib-col-name");
    tdName.appendChild(nameBlock(UI().fileIcon("folder"), f.id, f.name, folderSub(f, counts, lk), { lock: f.restricted, starred: f.starred }));
    tr.appendChild(tdName);
    tr.appendChild(el("td", "muted", "—"));
    tr.appendChild(el("td", "muted", "Folder"));
    tr.appendChild(el("td", "muted", "—"));
    tr.appendChild(el("td", "muted", "—"));
    var tdSt = el("td");
    var att = counts.attention[f.id] || 0;
    if (att) tdSt.appendChild(el("span", "tag tag-expiring", plural(att, "needs attention", "need attention")));
    else tdSt.appendChild(el("span", "muted", "—"));
    tr.appendChild(tdSt);
    var tdMore = el("td", "row-actions lib-col-more");
    var items = function () { return folderMenuItems(f, query); };
    tdMore.appendChild(moreButton(f.name, items));
    tr.appendChild(tdMore);
    wireItem(tr, f.id, "folder", function () { openFolder(f.id, query); }, items);
    makeDropTarget(tr, f.id);
    if (!f.auto) makeDraggable(tr, f.id);
    return tr;
  }

  function docRow(d, r, query, lk, showPath) {
    var tr = el("tr", "lib-row" + (selection[d.id] ? " is-selected" : "") + (r.docId === d.id ? " is-open" : ""));
    var td0 = el("td", "lib-col-check");
    td0.appendChild(checkbox(d.id, d.name));
    tr.appendChild(td0);
    var tdName = el("td", "lib-col-name");
    tdName.appendChild(nameBlock(UI().fileIcon(U().fileExt(d.filename)), d.id, d.name, docSub(d, showPath),
      { starred: d.starred, lock: d.type === "medical", mono: !showPath && d.name !== d.filename }));
    tr.appendChild(tdName);
    var emp = d.employeeId ? lk.emp[d.employeeId] : null;
    var ven = d.vendorId ? lk.ven[d.vendorId] : null;
    tr.appendChild(el("td", emp ? "" : "muted", emp ? emp.name : ven ? ven.name : "—"));
    tr.appendChild(el("td", null, U().typeLabel(d.type)));
    tr.appendChild(el("td", null, U().formatDate(d.modifiedOn) || "—"));
    var tdExp = el("td");
    if (d.expiresOn) tdExp.appendChild(UI().expiryText(d.expiresOn));
    else tdExp.appendChild(el("span", "muted", "—"));
    tr.appendChild(tdExp);
    var tdSt = el("td");
    tdSt.appendChild(statusTagFor(d));
    tr.appendChild(tdSt);
    var tdMore = el("td", "row-actions lib-col-more");
    var items = function () { return docMenuItems(d, r, query); };
    tdMore.appendChild(moreButton(d.name, items));
    tr.appendChild(tdMore);
    wireItem(tr, d.id, "doc", function () { openDoc(d.id, query); }, items);
    if (!d.deletedOn) makeDraggable(tr, d.id);
    return tr;
  }

  // ---------- Grid view ----------

  function gridView(r, query, data, lk, counts) {
    var wrap = el("div", "lib-grid-wrap");
    function folderSection(label, folders, folderId) {
      var sec = el("section", "lib-grid-section");
      var h = el("h2", "section-label lib-grid-label");
      if (folderId) {
        var b = button(label, "btn-link lib-group-link");
        b.addEventListener("click", function () { openFolder(folderId, query); });
        h.appendChild(b);
      } else h.textContent = label;
      sec.appendChild(h);
      var grid = el("div", "lib-fgrid");
      folders.forEach(function (f) { grid.appendChild(folderCard(f, query, lk, counts)); });
      sec.appendChild(grid);
      wrap.appendChild(sec);
    }
    if (data.groups) {
      data.groups.forEach(function (g) { folderSection(g.label, g.folders, g.folderId); });
    } else if (data.folders.length) folderSection("Folders", data.folders, null);
    if (data.docs.length) {
      var sec = el("section", "lib-grid-section");
      sec.appendChild(el("h2", "section-label lib-grid-label", "Files"));
      var grid = el("div", "lib-dgrid");
      var showPath = r.ctx.kind === "coll" || !!query.q;
      data.docs.forEach(function (d) { grid.appendChild(docCard(d, r, query, lk, showPath)); });
      sec.appendChild(grid);
      wrap.appendChild(sec);
    }
    return wrap;
  }

  function folderCard(f, query, lk, counts) {
    var card = el("div", "lib-fcard" + (selection[f.id] ? " is-selected" : ""));
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", f.name);
    card.appendChild(nameBlock(UI().fileIcon("folder"), f.id, f.name, folderSub(f, counts, lk), { lock: f.restricted, starred: f.starred }));
    var att = counts.attention[f.id] || 0;
    if (att) card.appendChild(el("span", "tag tag-expiring lib-fcard-flag", String(att)));
    var items = function () { return folderMenuItems(f, query); };
    card.appendChild(moreButton(f.name, items));
    wireItem(card, f.id, "folder", function () { openFolder(f.id, query); }, items);
    makeDropTarget(card, f.id);
    if (!f.auto) makeDraggable(card, f.id);
    return card;
  }

  function docCard(d, r, query, lk, showPath) {
    var card = el("div", "lib-dcard" + (selection[d.id] ? " is-selected" : "") + (r.docId === d.id ? " is-open" : ""));
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", d.name);
    var thumb = el("div", "lib-dcard-thumb");
    thumb.appendChild(UI().docMock(d, "card"));
    var box = checkbox(d.id, d.name);
    box.className += " lib-dcard-check";
    thumb.appendChild(box);
    card.appendChild(thumb);

    var head = el("div", "lib-dcard-head");
    head.appendChild(nameBlock(UI().fileIcon(U().fileExt(d.filename)), d.id, d.name, showPath ? docSub(d, true) : null,
      { starred: d.starred, lock: d.type === "medical" }));
    var items = function () { return docMenuItems(d, r, query); };
    head.appendChild(moreButton(d.name, items));
    card.appendChild(head);

    var meta = el("div", "lib-dcard-meta");
    var emp = d.employeeId ? lk.emp[d.employeeId] : null;
    var ven = d.vendorId ? lk.ven[d.vendorId] : null;
    meta.appendChild(el("span", "muted lib-dcard-who", emp ? emp.name : ven ? ven.name : U().typeLabel(d.type)));
    meta.appendChild(statusTagFor(d));
    card.appendChild(meta);
    wireItem(card, d.id, "doc", function () { openDoc(d.id, query); }, items);
    if (!d.deletedOn) makeDraggable(card, d.id);
    return card;
  }

  // ---------- Empty and not-found states ----------

  function emptyState(r, query) {
    var box = el("div", "empty lib-empty");
    var ctx = r.ctx;
    function uploadButtons() {
      var row = el("div", "lib-empty-actions");
      var up = button("Upload files", "btn btn-primary");
      var input = el("input", "lib-file-input");
      input.type = "file";
      input.multiple = true;
      input.tabIndex = -1;
      input.setAttribute("aria-label", "Upload files");
      input.addEventListener("change", function () { uploadFiles(input.files); input.value = ""; });
      up.addEventListener("click", function () { input.click(); });
      var cp = button("Copy forwarding email");
      cp.addEventListener("click", function () { UI().copyText((S().practice() || {}).forwardEmail || "", cp); });
      row.appendChild(up);
      row.appendChild(cp);
      row.appendChild(input);
      return row;
    }
    if (r.notFound) {
      box.appendChild(el("h2", null, "Not found"));
      box.appendChild(el("p", null, r.notFound === "document" ? "This document doesn’t exist. It may have been deleted forever."
        : r.notFound === "folder" ? "This folder doesn’t exist." : "This page doesn’t exist."));
      var back = button("Go to All files", "btn");
      back.addEventListener("click", function () { openFolder(null, query); });
      box.appendChild(back);
      return box;
    }
    if (query.q || hasFilters(readFilters(query))) {
      box.appendChild(el("p", null, query.q
        ? "No documents match. Try a name, a document type, or a folder."
        : "No files match these filters."));
      var clr = button(query.q ? "Clear search" : "Clear filters", "btn");
      clr.addEventListener("click", function () { setQuery(r, query, { q: "", employee: "", type: "", status: "" }); });
      box.appendChild(clr);
      return box;
    }
    if (ctx.kind === "coll") {
      var msg = {
        recent: "Nothing changed in the last 14 days.",
        starred: "Nothing starred yet. Use ⋯ › Star to keep a file here.",
        expiring: "Nothing expires in the next 30 days.",
        review: "All caught up. Nothing needs review.",
        trash: "Trash is empty."
      }[ctx.name];
      box.appendChild(el("p", null, msg));
      if (ctx.name === "recent") box.appendChild(uploadButtons());
      return box;
    }
    box.appendChild(el("p", null, "This folder is empty."));
    box.appendChild(el("p", "muted", "Drop files here, or forward them to Sortable."));
    if (!isRestrictedCtx(ctx)) box.appendChild(uploadButtons());
    return box;
  }

  // ---------- Drop overlay (files from the computer) ----------

  function wireFileDrop(main, r) {
    var overlay = el("div", "lib-overlay");
    overlay.hidden = true;
    overlay.appendChild(el("div", "lib-overlay-title", "Drop to upload to " + ctxLabel(r.ctx)));
    overlay.appendChild(el("div", "lib-overlay-sub", "Sortable will read each file and file it in the right place"));
    main.appendChild(overlay);
    var depth = 0;
    function isFiles(e) {
      if (dragIds) return false;
      var types = e.dataTransfer && e.dataTransfer.types;
      if (!types) return false;
      for (var i = 0; i < types.length; i++) if (types[i] === "Files") return true;
      return false;
    }
    main.addEventListener("dragenter", function (e) {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth++;
      overlay.hidden = false;
    });
    main.addEventListener("dragover", function (e) {
      if (!isFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    main.addEventListener("dragleave", function (e) {
      if (!isFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) overlay.hidden = true;
    });
    main.addEventListener("drop", function (e) {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth = 0;
      overlay.hidden = true;
      uploadFiles(e.dataTransfer.files);
    });
  }

  // ---------- Render ----------

  var afterMount = [];

  function render(root, params) {
    root.className = "page screen-library";
    afterMount = [];
    var query = params.query || {};
    var r = resolve(params);

    var key = ctxKey(r.ctx) + (r.notFound ? ":nf" : "");
    if (key !== selectionCtx) {
      selectionCtx = key;
      selection = {};
      renamingId = null;
    }
    // Drop selected ids that no longer exist or are no longer listed (e.g. after a move).
    var lk = makeLookups();
    var data = r.notFound ? { folders: [], docs: [], groups: null } : listing(r, query);
    if (!data.groups) data.folders = sortFolders(data.folders, query);
    data.docs = sortDocs(data.docs, query, data.ranked);
    var visible = {};
    itemsOf(data).forEach(function (id) { visible[id] = true; });
    Object.keys(selection).forEach(function (id) { if (!visible[id]) delete selection[id]; });
    if (r.docId && visible[r.docId] && !Object.keys(selection).length) selection[r.docId] = true;
    if (renamingId && !visible[renamingId]) renamingId = null;

    var counts = buildCounts();
    var shell = el("div", "lib-shell" + (r.docId ? " has-panel" : ""));
    shell.appendChild(sidebar(r, query));

    if (drawerOpen) {
      var backdrop = el("div", "lib-backdrop");
      backdrop.addEventListener("click", function () { drawerOpen = false; Sortable.router.render(); });
      shell.appendChild(backdrop);
    }

    var main = el("section", "lib-main");
    main.setAttribute("aria-label", ctxLabel(r.ctx));
    main.appendChild(toolbar(r, query, lk));

    var st = S().storage() || {};
    if (st.status && st.status !== "connected") {
      var alert = el("a", "alert-strip lib-alert");
      alert.href = "#/setup";
      alert.textContent = st.status === "offline"
        ? (st.name || "Storage") + " is offline. New files aren’t being saved. Open Setup."
        : (st.name || "Storage") + " needs attention. Open Setup to check the connection.";
      main.appendChild(alert);
    }

    if (!r.notFound && isRestrictedCtx(r.ctx)) {
      var banner = el("div", "lib-restricted");
      banner.setAttribute("role", "note");
      var txt = el("div", "lib-restricted-text");
      txt.appendChild(el("strong", null, "🔒 Restricted folder"));
      txt.appendChild(el("span", null, "Only the office manager and the medical director can open these files."));
      banner.appendChild(txt);
      var ma = button("Manage access", "btn");
      ma.addEventListener("click", manageAccess);
      banner.appendChild(ma);
      main.appendChild(banner);
    }

    if (Object.keys(selection).length) main.appendChild(bulkBar(r, query));

    var empty = r.notFound || (!itemsOf(data).length);
    if (empty) main.appendChild(emptyState(r, query));
    else if (query.view === "grid") main.appendChild(gridView(r, query, data, lk, counts));
    else main.appendChild(listView(r, query, data, lk, counts));

    if (!r.notFound && !(r.ctx.kind === "coll" && r.ctx.name === "trash")) wireFileDrop(main, r);
    shell.appendChild(main);

    if (r.docId) {
      var panel = UI().detailsPanel(r.docId, {
        onClose: function () {
          selection = {};
          go(ctxPath(r.ctx) + qs(query));
        }
      });
      panel.className += " lib-panel";
      shell.appendChild(panel);
    }

    root.appendChild(shell);
    afterMount.forEach(function (fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } });
    afterMount = [];
  }

  Sortable.views.library = { render: render };
})();
