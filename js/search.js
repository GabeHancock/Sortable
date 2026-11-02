/* Sortable.search: forgiving offline search over filed documents and folders
   (hard rule 9, R5, "How search works"). Owner: Search.
   Reads data only through Sortable.store. No real AI. */
(function () {
  "use strict";

  var S = (window.Sortable = window.Sortable || {});

  var STOP = {};
  ("the a an of for my our to in on and or with from by at is me show find all").split(" ")
    .forEach(function (w) { STOP[w] = true; });

  // Two-way groups: every word in a group matches every other.
  var GROUPS = [
    ["cpr", "bls"],
    ["license", "licence"],
    ["invoice", "bill", "statement"],
    ["insurance", "malpractice"],
    ["tax", "w4", "w9"],
    ["vaccine", "vaccination", "immunization"],
    ["flu", "influenza"]
  ];
  // One-way: the word on the left also matches the words on the right.
  var ONE_WAY = { dea: ["registration"], handbook: ["policy"], fire: ["inspection"] };

  var MONTHS = ["january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november", "december"];

  // Lowercase, drop 's, turn anything not a letter or digit into a space, split.
  function tokens(text) {
    return String(text == null ? "" : text).toLowerCase()
      .replace(/['’]s\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(function (w) { return w.length > 0; });
  }

  // The cleaned query words: tokens without 1-character words or stop words, no repeats.
  function words(query) {
    var seen = {};
    return tokens(query).filter(function (w) {
      if (w.length < 2 || STOP[w] || seen[w]) return false;
      seen[w] = true;
      return true;
    });
  }

  // The word plus its synonyms.
  function forms(word) {
    var list = [word];
    GROUPS.forEach(function (g) {
      if (g.indexOf(word) >= 0) g.forEach(function (s) { if (list.indexOf(s) < 0) list.push(s); });
    });
    (ONE_WAY[word] || []).forEach(function (s) { if (list.indexOf(s) < 0) list.push(s); });
    return list;
  }

  // True when any form is the start of any word in the list.
  function hits(fs, list) {
    for (var i = 0; i < list.length; i++) {
      for (var j = 0; j < fs.length; j++) {
        if (list[i].lastIndexOf(fs[j], 0) === 0) return true;
      }
    }
    return false;
  }

  function pathNames(folderId) {
    return folderId ? S.store.pathOf(folderId).map(function (p) { return p.name; }) : [];
  }

  function dateWords(docDate) {
    var m = /^(\d{4})-(\d{2})/.exec(docDate || "");
    if (!m) return [];
    var name = MONTHS[+m[2] - 1];
    return name ? [name, name.slice(0, 3), m[1]] : [m[1]];
  }

  function docWords(d, lookups) {
    var emp = d.employeeId ? lookups.employee(d.employeeId) : null;
    var ven = d.vendorId ? lookups.vendor(d.vendorId) : null;
    var dept = emp && emp.departmentId ? lookups.dept[emp.departmentId] || "" : "";
    var strong = [d.name, emp ? emp.name : "", ven ? ven.name : ""].concat(lookups.path(d.folderId));
    var weak = [d.filename, S.util.typeLabel(d.type), d.category, d.topic, dept, d.text];
    return {
      strong: tokens(strong.join(" ")),
      weak: tokens(weak.join(" ")).concat(dateWords(d.docDate))
    };
  }

  function passesFilters(d, f) {
    if (f.type && d.type !== f.type) return false;
    if (f.employeeId && d.employeeId !== f.employeeId) return false;
    if (f.vendorId && d.vendorId !== f.vendorId) return false;
    if (f.status) {
      var st = S.store.fileStatus(d);
      if (!st || st.key !== f.status) return false;
    }
    if (f.from && (!d.docDate || d.docDate < f.from)) return false;
    if (f.to && (!d.docDate || d.docDate > f.to)) return false;
    return true;
  }

  // run(query, { filters: { type, employeeId, vendorId, status, from, to }, folderId, minShare })
  // -> { documents, folders }, both ranked. A query with no words returns nothing.
  function run(query, opts) {
    var o = opts || {};
    var f = o.filters || {};
    var ws = words(query);
    if (!ws.length) return { documents: [], folders: [] };
    var wf = ws.map(forms);
    var share = +o.minShare || 0;
    var needed = Math.max(1, Math.ceil(share * ws.length));

    // Small caches so each person, vendor and folder path is looked up once per search.
    var empCache = {}, venCache = {}, pathCache = {}, dept = {};
    S.store.departments().forEach(function (dp) { dept[dp.id] = dp.name; });
    var lookups = {
      dept: dept,
      employee: function (id) { return id in empCache ? empCache[id] : (empCache[id] = S.store.employee(id)); },
      vendor: function (id) { return id in venCache ? venCache[id] : (venCache[id] = S.store.vendor(id)); },
      path: function (id) { return id in pathCache ? pathCache[id] : (pathCache[id] = pathNames(id)); }
    };

    // Documents: filed and not trashed only (never reading, review or trash).
    var docFilter = { status: "filed" };
    if (o.folderId) { docFilter.folderId = o.folderId; docFilter.recursive = true; }
    var ranked = [];
    S.store.documents(docFilter).forEach(function (d) {
      if (d.status !== "filed" || d.deletedOn || !passesFilters(d, f)) return;
      var dw = docWords(d, lookups);
      var matched = 0, score = 0;
      wf.forEach(function (fs) {
        if (hits(fs, dw.strong)) { matched++; score += 2; }
        else if (hits(fs, dw.weak)) { matched++; score += 1; }
      });
      if (matched >= needed) ranked.push({ doc: d, matched: matched, score: score });
    });
    ranked.sort(function (a, b) {
      if (a.matched !== b.matched) return b.matched - a.matched;
      if (a.score !== b.score) return b.score - a.score;
      var ad = a.doc.docDate || "", bd = b.doc.docDate || "";
      if (ad !== bd) return ad < bd ? 1 : -1;
      return a.doc.id < b.doc.id ? 1 : a.doc.id > b.doc.id ? -1 : 0;
    });

    // Folders: every query word must match the folder's path names. Deepest first, at most 4.
    var found = [];
    S.store.folders().forEach(function (fd, order) {
      var path = S.store.pathOf(fd.id);
      if (o.folderId) {
        var below = false;
        for (var i = 0; i < path.length - 1; i++) if (path[i].id === o.folderId) below = true;
        if (!below) return;
      }
      var pw = tokens(path.map(function (p) { return p.name; }).join(" "));
      for (var k = 0; k < wf.length; k++) if (!hits(wf[k], pw)) return;
      found.push({ folder: fd, depth: path.length, order: order });
    });
    found.sort(function (a, b) { return b.depth - a.depth || a.order - b.order; });

    return {
      documents: ranked.map(function (r) { return r.doc; }),
      folders: found.slice(0, 4).map(function (r) { return r.folder; })
    };
  }

  S.search = { run: run, words: words };
})();
