/* Sortable.store: the only code that changes state.
   Owner: Data. Deep-copies window.MOCK on init(), so the seed is never changed.
   Builds the automatic folder tree, runs the reading -> settle flow, logs activity,
   and works out every derived value (statuses, deadlines, metrics, collections).
   Calls Sortable.util and Sortable.ai at runtime only (they may load later). */
(function () {
  "use strict";

  var S = (window.Sortable = window.Sortable || {});

  var CREDENTIAL = { license: true, certification: true, training: true };
  var SOON_DAYS = { invoice: 7, credential: 60, compliance: 60 };
  var REVIEW_THRESHOLD = 0.85;
  var SETTLE_MS = 1500;
  var TOPICS = ["OSHA", "HIPAA", "Inspection", "Renewal"];
  var STORAGE_STATUSES = { connected: true, attention: true, offline: true };

  // A person's type folders: suffix, name and the document type they hold.
  var TYPE_FOLDERS = [
    { suffix: "licenses", name: "Licenses", type: "license" },
    { suffix: "certifications", name: "Certifications", type: "certification" },
    { suffix: "trainings", name: "Trainings", type: "training" },
    { suffix: "hr", name: "HR forms", type: "hr_form" }
  ];
  var TOP = [
    { id: "fld-employees", name: "Employees" },
    { id: "fld-practice", name: "Practice documents" },
    { id: "fld-confidential", name: "Confidential Medical" }
  ];
  var GROUPS = [
    { id: "fld-invoices", name: "Invoices" },
    { id: "fld-vendors", name: "Vendors" },
    { id: "fld-compliance", name: "Compliance" }
  ];

  var state = null;       // deep copy of MOCK
  var learned = [];       // learned rules, newest first
  var incomingPos = 0;    // index of the next MOCK.incoming item
  var extracted = {};     // doc id -> { amountCents, dueDate, expiresOn } kept while a type may change
  var pending = {};       // doc id -> classify output, while the document is "reading"
  var timers = {};        // doc id -> setTimeout handle
  var created = {};       // on-demand automatic folder id -> true once it exists
  var folderStars = {};   // automatic folder id -> true when starred
  var filedOn = {};       // doc id -> { on, seq } when it last became filed
  var fileUrls = {};      // doc id -> object URL of a dropped file (outside state)
  var seq = 0;
  var listeners = [];

  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function today() { return S.util.today(); }
  function isCredential(type) { return !!CREDENTIAL[type]; }
  function ensure() { if (!state) init(); }
  function asList(ids) { return (Array.isArray(ids) ? ids : [ids]).filter(function (x) { return x != null; }); }
  function findIn(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  // Accepts "doc-012" or a deadline id such as "invoice:doc-012".
  function bareId(id) {
    id = String(id == null ? "" : id);
    var i = id.indexOf(":");
    return i >= 0 ? id.slice(i + 1) : id;
  }
  function rawDoc(id) { ensure(); return findIn(state.documents, bareId(id)); }
  function rawEmp(id) { return id ? findIn(state.employees, id) : null; }
  function rawVen(id) { return id ? findIn(state.vendors, id) : null; }

  function notify() {
    listeners.slice().forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.error(e); }
    });
  }

  function canMakeUrls() { return typeof URL !== "undefined" && !!URL.createObjectURL; }
  function revokeUrl(url) {
    if (url && typeof URL !== "undefined" && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    }
  }

  // ---------- Activity ----------

  function log(d, what, detail, who) {
    d.activity = d.activity || [];
    d.activity.push({ on: today(), what: what, detail: detail || "", who: who || "You" });
    d.modifiedOn = today();
  }

  function arrivalDetail(d) {
    if (d.channel === "email") return "By email from " + d.sender;
    if (d.channel === "fax") return "By fax from " + d.sender;
    return "Uploaded";
  }

  function reviewReason(d) {
    if (!d.suggested) return "Couldn't tell what this is";
    return "Not sure (" + Math.round((d.confidence || 0) * 100) + "% confident)";
  }

  // Starting events for the seed documents, oldest first.
  function seedActivity(d) {
    if (d.activity && d.activity.length) return;
    var ev = [];
    function add(on, what, detail, who) { if (on) ev.push({ on: on, what: what, detail: detail, who: who }); }
    add(d.receivedOn, "Received", arrivalDetail(d), d.channel === "upload" ? "You" : "Sortable");
    if (d.status === "review") add(d.receivedOn, "Sent to review", reviewReason(d), "Sortable");
    else add(d.receivedOn, "Filed", "Named and filed in " + pathText(d.folderId), "Sortable");
    if (d.invoice && d.invoice.paidOn) add(d.invoice.paidOn, "Marked as paid", "", "You");
    if (d.requestedOn) add(d.requestedOn, "Asked for an updated version", "", "You");
    if (d.renewedOn) add(d.renewedOn, "Replaced", "Replaced by a newer document", "Sortable");
    if (d.deletedOn) add(d.deletedOn, "Moved to trash", "", "You");
    ev.sort(function (a, b) { return a.on < b.on ? -1 : a.on > b.on ? 1 : 0; });
    d.activity = ev;
  }

  // ---------- Folders ----------

  function deptSuffix(deptId) { return String(deptId || "").replace(/^dept-/, ""); }
  function lastFirst(name) {
    var parts = String(name || "").trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || "";
    var last = parts.pop();
    return last + ", " + parts.join(" ");
  }

  function rec(id, name, parentId, kind, order) {
    return { id: id, name: name, parentId: parentId, kind: kind, restricted: false,
      starred: !!folderStars[id], auto: true, order: order };
  }

  // The record for any valid automatic folder ID, whether or not it exists yet.
  function autoRecord(id) {
    var i, m, r = null;
    for (i = 0; i < TOP.length; i++) if (TOP[i].id === id) r = rec(id, TOP[i].name, null, "section", i);
    for (i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) r = rec(id, GROUPS[i].name, "fld-practice", "group", i);
    if (!r && (m = /^fld-dept-(\w+)$/.exec(id))) {
      for (i = 0; i < state.departments.length; i++) {
        if (deptSuffix(state.departments[i].id) === m[1]) r = rec(id, state.departments[i].name, "fld-employees", "department", i);
      }
    }
    if (!r && (m = /^fld-(emp-\d+)$/.exec(id))) {
      var e = rawEmp(m[1]);
      if (e) r = rec(id, lastFirst(e.name), "fld-dept-" + deptSuffix(e.departmentId), "person", 0);
    }
    if (!r && (m = /^fld-(emp-\d+)-(\w+)$/.exec(id)) && rawEmp(m[1])) {
      for (i = 0; i < TYPE_FOLDERS.length; i++) {
        if (TYPE_FOLDERS[i].suffix === m[2]) r = rec(id, TYPE_FOLDERS[i].name, "fld-" + m[1], "doctype", i);
      }
    }
    if (!r && (m = /^fld-(inv|ven)-(ven-\d+)$/.exec(id))) {
      var v = rawVen(m[2]);
      if (v) r = rec(id, v.name, m[1] === "inv" ? "fld-invoices" : "fld-vendors", "vendor", 0);
    }
    if (!r && (m = /^fld-cmp-(\w+)$/.exec(id))) {
      for (i = 0; i < TOPICS.length; i++) {
        if (TOPICS[i].toLowerCase() === m[1]) r = rec(id, TOPICS[i], "fld-compliance", "topic", i);
      }
    }
    if (!r && (m = /^fld-conf-(emp-\d+)$/.exec(id))) {
      var ce = rawEmp(m[1]);
      if (ce) r = rec(id, lastFirst(ce.name), "fld-confidential", "person", 0);
    }
    if (r && (r.id === "fld-confidential" || /^fld-conf-/.test(r.id))) r.restricted = true;
    return r;
  }

  function alwaysThere(id) {
    return /^fld-(employees|practice|confidential|invoices|vendors|compliance)$/.test(id) ||
      /^fld-dept-\w+$/.test(id) || /^fld-emp-\d+$/.test(id);
  }

  function userFolder(id) { return id ? findIn(state.folders, id) : null; }

  // The live folder record (user or automatic), or null if it doesn't exist.
  function folderRec(id) {
    if (!id) return null;
    var u = userFolder(id);
    if (u) return u;
    var r = autoRecord(id);
    if (!r) return null;
    return (alwaysThere(id) || created[id]) ? r : null;
  }

  // A record for any folder id, including automatic folders that don't exist yet.
  function anyRec(id) { return userFolder(id) || autoRecord(id); }

  function ensureFolder(id) {
    var r = autoRecord(id);
    if (!r) return;
    created[id] = true;
    if (r.parentId) ensureFolder(r.parentId);
  }

  function publicFolder(r) {
    return { id: r.id, name: r.name, parentId: r.parentId || null, kind: r.kind,
      restricted: !!r.restricted, starred: !!r.starred, auto: !!r.auto };
  }

  function pathRecs(id) {
    var out = [], guard = 0, r = anyRec(id);
    while (r && guard++ < 20) { out.unshift(r); r = r.parentId ? anyRec(r.parentId) : null; }
    return out;
  }
  function pathText(id) { return pathRecs(id).map(function (r) { return r.name; }).join(" › "); }

  function isInside(folderId, ancestorId) {
    var r = anyRec(folderId), guard = 0;
    while (r && guard++ < 20) {
      if (r.id === ancestorId) return true;
      r = r.parentId ? anyRec(r.parentId) : null;
    }
    return false;
  }

  function childFolderRecs(parentId) {
    var list = [];
    var pid = parentId || null;
    if (pid === null) TOP.forEach(function (t) { list.push(autoRecord(t.id)); });
    else if (pid === "fld-practice") GROUPS.forEach(function (g) { list.push(autoRecord(g.id)); });
    else if (pid === "fld-employees") state.departments.forEach(function (d) { list.push(autoRecord("fld-dept-" + deptSuffix(d.id))); });
    else if (/^fld-dept-/.test(pid)) {
      state.employees.forEach(function (e) {
        if ("fld-dept-" + deptSuffix(e.departmentId) === pid) list.push(autoRecord("fld-" + e.id));
      });
    }
    Object.keys(created).forEach(function (id) {
      var r = autoRecord(id);
      if (r && r.parentId === pid && !alwaysThere(id)) list.push(r);
    });
    state.folders.forEach(function (u) { if ((u.parentId || null) === pid) list.push(u); });
    return list.filter(Boolean).sort(function (a, b) {
      if (!!a.auto !== !!b.auto) return a.auto ? -1 : 1;
      if (a.auto && a.order !== b.order) return a.order - b.order;
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0;
    });
  }

  // ---------- Classification -> folder ----------

  function cleanResult(r) {
    r = r || {};
    return { type: r.type || "other", employeeId: r.employeeId || null, vendorId: r.vendorId || null,
      topic: r.type === "compliance" ? r.topic || null : null };
  }
  function resultOf(d) { return cleanResult({ type: d.type, employeeId: d.employeeId, vendorId: d.vendorId, topic: d.topic }); }
  function isEmptyResult(r) { return !r || (r.type === "other" && !r.employeeId && !r.vendorId && !r.topic); }
  function sameResult(a, b) {
    a = cleanResult(a); b = cleanResult(b);
    return a.type === b.type && a.employeeId === b.employeeId && a.vendorId === b.vendorId && a.topic === b.topic;
  }

  function folderFor(result) {
    ensure();
    var r = cleanResult(result);
    var emp = r.employeeId, ven = r.vendorId;
    for (var i = 0; i < TYPE_FOLDERS.length; i++) {
      if (TYPE_FOLDERS[i].type === r.type) return emp ? "fld-" + emp + "-" + TYPE_FOLDERS[i].suffix : "fld-employees";
    }
    if (r.type === "invoice") return ven ? "fld-inv-" + ven : "fld-invoices";
    if (r.type === "contract") return ven ? "fld-ven-" + ven : "fld-vendors";
    if (r.type === "compliance") return r.topic ? "fld-cmp-" + String(r.topic).toLowerCase() : "fld-compliance";
    if (r.type === "medical") return emp ? "fld-conf-" + emp : "fld-confidential";
    if (emp) return "fld-" + emp;
    if (ven) return "fld-ven-" + ven;
    return "fld-practice";
  }

  // The classification a document gets when it is moved into an automatic folder,
  // or null when the folder isn't a place documents are filed (Employees, a department).
  function resultForFolder(folderId, d) {
    var m;
    if ((m = /^fld-(emp-\d+)-(\w+)$/.exec(folderId))) {
      for (var i = 0; i < TYPE_FOLDERS.length; i++) {
        if (TYPE_FOLDERS[i].suffix === m[2]) return cleanResult({ type: TYPE_FOLDERS[i].type, employeeId: m[1] });
      }
      return null;
    }
    if ((m = /^fld-(emp-\d+)$/.exec(folderId))) return cleanResult({ type: "other", employeeId: m[1] });
    if ((m = /^fld-inv-(ven-\d+)$/.exec(folderId))) return cleanResult({ type: "invoice", vendorId: m[1] });
    if ((m = /^fld-ven-(ven-\d+)$/.exec(folderId))) return cleanResult({ type: d.type === "other" ? "other" : "contract", vendorId: m[1] });
    if ((m = /^fld-cmp-(\w+)$/.exec(folderId))) {
      var rr = autoRecord(folderId);
      return rr ? cleanResult({ type: "compliance", topic: rr.name }) : null;
    }
    if ((m = /^fld-conf-(emp-\d+)$/.exec(folderId))) return cleanResult({ type: "medical", employeeId: m[1] });
    if (folderId === "fld-invoices") return cleanResult({ type: "invoice" });
    if (folderId === "fld-vendors") return cleanResult({ type: "contract" });
    if (folderId === "fld-compliance") return cleanResult({ type: "compliance" });
    if (folderId === "fld-confidential") return cleanResult({ type: "medical" });
    if (folderId === "fld-practice") return cleanResult({ type: "other" });
    return null;
  }

  function pathLabel(result) {
    ensure();
    var recs = pathRecs(folderFor(result));
    if (recs.length > 1 && (recs[0].id === "fld-practice" || recs[0].id === "fld-employees")) recs = recs.slice(1);
    return recs.map(function (r) { return r.name; }).join(" › ");
  }

  function categoryOf(d) {
    if (d.type === "invoice") return "Invoices";
    if (isCredential(d.type)) return "Licenses";
    if (d.type === "hr_form") return "HR";
    if (d.type === "contract") return "Vendors";
    if (d.type === "compliance") return "Compliance";
    if (d.type === "medical") return "Confidential";
    if (d.type === "other" && d.vendorId) return "Vendors";
    return "Practice";
  }

  function out(d) {
    if (!d) return null;
    var c = clone(d);
    c.category = categoryOf(d);
    return c;
  }

  // ---------- Init ----------

  function init() {
    Object.keys(timers).forEach(function (k) {
      if (typeof clearTimeout === "function") clearTimeout(timers[k]);
    });
    Object.keys(fileUrls).forEach(function (k) { revokeUrl(fileUrls[k]); });
    state = clone(window.MOCK);
    state.folders = state.folders || [];
    learned = [];
    incomingPos = 0;
    extracted = {};
    pending = {};
    timers = {};
    created = {};
    folderStars = {};
    filedOn = {};
    fileUrls = {};
    seq = 0;
    state.documents.forEach(function (d) {
      extracted[d.id] = {
        amountCents: d.invoice ? d.invoice.amountCents : null,
        dueDate: d.invoice ? d.invoice.dueDate : null,
        expiresOn: d.expiresOn || null
      };
      if (d.status === "filed") {
        if (!d.folderId) d.folderId = folderFor(resultOf(d));
        if (!userFolder(d.folderId)) ensureFolder(d.folderId);
        filedOn[d.id] = { on: d.receivedOn, seq: ++seq };
      } else {
        d.folderId = null;
      }
      seedActivity(d);
    });
  }

  // ---------- Reads: practice and people ----------

  function practice() { ensure(); return clone(state.practice); }
  function viewer() { ensure(); return clone(state.viewer); }
  function storage() { ensure(); return clone(state.storage); }
  function departments() { ensure(); return clone(state.departments); }
  function employees() { ensure(); return clone(state.employees); }
  function employee(id) { ensure(); return clone(rawEmp(id)); }
  function vendors() { ensure(); return clone(state.vendors); }
  function vendor(id) { ensure(); return clone(rawVen(id)); }

  // ---------- Reads: documents ----------

  function byNewest(a, b) {
    if (a.docDate !== b.docDate) return a.docDate < b.docDate ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  }
  function live(d) { return !d.deletedOn; }

  function documents(filter) {
    ensure();
    var f = filter || {};
    return state.documents.filter(function (d) {
      if (f.trashed ? !d.deletedOn : d.deletedOn) return false;
      if (f.status && d.status !== f.status) return false;
      if (f.category && categoryOf(d) !== f.category) return false;
      if (f.type && d.type !== f.type) return false;
      if (f.employeeId && d.employeeId !== f.employeeId) return false;
      if (f.vendorId && d.vendorId !== f.vendorId) return false;
      if (f.folderId) {
        if (!d.folderId) return false;
        if (f.recursive ? !isInside(d.folderId, f.folderId) : d.folderId !== f.folderId) return false;
      }
      if (f.starred && !d.starred) return false;
      return true;
    }).sort(byNewest).map(out);
  }
  function document(id) { return out(rawDoc(id)); }

  // ---------- Reads: folders ----------

  function folders() {
    ensure();
    var list = [];
    (function walk(pid) {
      childFolderRecs(pid).forEach(function (r) { list.push(publicFolder(r)); walk(r.id); });
    })(null);
    return list;
  }
  function folder(id) { ensure(); var r = folderRec(id); return r ? publicFolder(r) : null; }

  function children(folderId) {
    ensure();
    var pid = folderId || null;
    return {
      folders: childFolderRecs(pid).map(publicFolder),
      documents: pid === null ? [] : state.documents.filter(function (d) {
        return live(d) && d.status === "filed" && d.folderId === pid;
      }).sort(byNewest).map(out)
    };
  }

  function pathOf(folderId) {
    ensure();
    return pathRecs(folderId).map(function (r) { return { id: r.id, name: r.name }; });
  }

  function canOpen(folderId) { return true; }

  // ---------- Status ----------

  function invoiceStatus(doc) {
    if (!doc || !doc.invoice) return null;
    if (doc.invoice.paidOn) return "paid";
    if (doc.invoice.dueDate && doc.invoice.dueDate < today()) return "overdue";
    return "unpaid";
  }

  function fileStatus(doc) {
    ensure();
    var d = typeof doc === "string" ? rawDoc(doc) : doc;
    if (!d) return null;
    if (d.status === "reading") return { key: "reading", label: "Being read" };
    if (d.status === "review") return { key: "review", label: "Needs review" };
    if (isCredential(d.type)) {
      if (d.renewedOn) return { key: "renewed", label: "Renewed" };
      if (d.requestedOn) return { key: "awaiting", label: "Needs new document" };
      if (d.expiresOn) {
        var days = S.util.daysBetween(today(), d.expiresOn);
        if (days < 0) return { key: "expired", label: "Expired" };
        if (days <= 30) return { key: "expiring", label: "Expiring soon" };
      }
      return { key: "current", label: "Current" };
    }
    if (d.type === "invoice" && d.invoice) {
      var s = invoiceStatus(d);
      if (s === "paid") return { key: "paid", label: "Paid" };
      if (s === "overdue") return { key: "overdue", label: "Overdue" };
      return { key: "unpaid", label: d.invoice.dueDate ? "Unpaid" : "Due date missing" };
    }
    return { key: "current", label: "Current" };
  }

  // Filed, live, not a copy: the documents that can create deadlines.
  function tracks(d) { return d.status === "filed" && live(d) && !d.copyOf; }
  function openCredential(d) { return tracks(d) && isCredential(d.type) && !d.renewedOn; }
  function isAwaiting(d) { return openCredential(d) && !!d.requestedOn; }

  function deadlineStatus(dueOn, requestedOn, closedOn) {
    if (closedOn) return "done";
    if (requestedOn) return "awaiting";
    return dueOn < today() ? "overdue" : "upcoming";
  }

  function makeDeadline(kind, refId, title, dueOn, requestedOn, closedOn, employeeId, vendorId) {
    var status = deadlineStatus(dueOn, requestedOn, closedOn);
    var soon = status === "upcoming" && S.util.daysBetween(today(), dueOn) <= SOON_DAYS[kind];
    return {
      id: kind + ":" + refId, kind: kind, title: title, dueOn: dueOn, status: status, soon: soon,
      refId: refId, employeeId: employeeId || null, vendorId: vendorId || null,
      requestedOn: requestedOn || null, closedOn: closedOn || null
    };
  }

  function deadlines() {
    ensure();
    var list = [];
    state.documents.forEach(function (d) {
      if (!tracks(d)) return;
      if (d.type === "invoice" && d.invoice && d.invoice.dueDate) {
        list.push(makeDeadline("invoice", d.id, d.name, d.invoice.dueDate, null, d.invoice.paidOn, d.employeeId, d.vendorId));
      } else if (isCredential(d.type) && d.expiresOn) {
        list.push(makeDeadline("credential", d.id, d.name, d.expiresOn, d.requestedOn, d.renewedOn, d.employeeId, d.vendorId));
      }
    });
    state.compliance.forEach(function (c) {
      list.push(makeDeadline("compliance", c.id, c.title, c.dueOn, null, c.resolvedOn, null, null));
    });
    return list.sort(function (a, b) {
      if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  }

  function pct(part, whole) { return whole ? Math.round((part / whole) * 100) : 100; }

  // Credentials that need attention by date: open, not awaiting, expiresOn set.
  function datedCredentials() {
    return state.documents.filter(function (d) { return openCredential(d) && d.expiresOn; });
  }
  function within30List() {
    return datedCredentials().filter(function (d) {
      if (d.requestedOn) return false;
      var days = S.util.daysBetween(today(), d.expiresOn);
      return days >= 0 && days <= 30;
    }).sort(function (a, b) { return a.expiresOn < b.expiresOn ? -1 : a.expiresOn > b.expiresOn ? 1 : a.id < b.id ? -1 : 1; });
  }

  function metrics() {
    ensure();
    var docs = state.documents.filter(live);
    var total = docs.length;
    var filedCount = docs.filter(function (d) { return d.status === "filed"; }).length;
    var review = docs.filter(function (d) { return d.status === "review"; }).length;
    var pendingCount = state.documents.filter(isAwaiting).length;
    var openCount = review + pendingCount;
    var openPct = pct(openCount, total);

    var tracked = datedCredentials();
    var expired = tracked.filter(function (d) { return !d.requestedOn && d.expiresOn < today(); }).length;
    var soonList = within30List();
    var attention = expired + soonList.length;

    var worst = "green";
    if (soonList.length) {
      worst = soonList.some(function (d) { return S.util.daysBetween(today(), d.expiresOn) <= 10; }) ? "red" : "amber";
    }
    return {
      filed: { count: filedCount, total: total, pct: pct(filedCount, total) },
      open: { review: review, pending: pendingCount, count: openCount, total: total,
        openPct: openPct, completionPct: total ? 100 - openPct : 100 },
      expirations: { expired: expired, within30: soonList.length, attention: attention, tracked: tracked.length,
        completionPct: pct(tracked.length - attention, tracked.length) },
      expiring30: {
        count: soonList.length, worst: worst,
        next: soonList.slice(0, 3).map(function (d) {
          return { docId: d.id, employeeId: d.employeeId, type: d.type, expiresOn: d.expiresOn,
            days: S.util.daysBetween(today(), d.expiresOn) };
        })
      }
    };
  }

  // ---------- Collections and queues ----------

  function reviewQueue() {
    ensure();
    return state.documents.filter(function (d) { return live(d) && d.status === "review"; })
      .sort(function (a, b) {
        if (a.receivedOn !== b.receivedOn) return a.receivedOn < b.receivedOn ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      }).map(out);
  }

  function collectionRaw(name) {
    var t = today();
    if (name === "recent") {
      var since = S.util.addDays(t, -14);
      return state.documents.filter(function (d) {
        return live(d) && d.status !== "reading" && d.modifiedOn >= since && d.modifiedOn <= t;
      }).sort(function (a, b) {
        if (a.modifiedOn !== b.modifiedOn) return a.modifiedOn < b.modifiedOn ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
    }
    if (name === "starred") return state.documents.filter(function (d) { return live(d) && d.starred; }).sort(byNewest);
    if (name === "expiring") return within30List();
    if (name === "review") return state.documents.filter(function (d) { return live(d) && d.status === "review"; })
      .sort(function (a, b) { return a.receivedOn !== b.receivedOn ? (a.receivedOn < b.receivedOn ? 1 : -1) : (a.id < b.id ? 1 : -1); });
    if (name === "trash") return state.documents.filter(function (d) { return !!d.deletedOn; })
      .sort(function (a, b) { return a.deletedOn !== b.deletedOn ? (a.deletedOn < b.deletedOn ? 1 : -1) : (a.id < b.id ? 1 : -1); });
    return [];
  }
  function collection(name) { ensure(); return collectionRaw(name).map(out); }
  function collectionCounts() {
    ensure();
    var c = {};
    ["recent", "starred", "expiring", "review", "trash"].forEach(function (n) { c[n] = collectionRaw(n).length; });
    return c;
  }

  function received() {
    ensure();
    return state.documents.filter(function (d) { return live(d) && d.status === "reading"; }).map(out);
  }

  function filedToday() {
    ensure();
    return state.documents.filter(function (d) {
      return live(d) && d.status === "filed" && filedOn[d.id] && filedOn[d.id].on === today();
    }).sort(function (a, b) { return filedOn[b.id].seq - filedOn[a.id].seq; }).map(out);
  }

  function needsYou() {
    ensure();
    var list = reviewQueue().map(function (d) { return { docId: d.id, filename: d.filename, reason: reviewReason(d) }; });
    state.documents.filter(isAwaiting).sort(byNewest).forEach(function (d) {
      list.push({ docId: d.id, filename: d.filename, reason: "Needs new document" });
    });
    return list;
  }

  function compliance() {
    ensure();
    return clone(state.compliance.slice().sort(function (a, b) { return a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0; }));
  }
  function rules() { ensure(); return clone(learned.concat(state.filingRules)); }
  function incomingCount() { ensure(); return Math.max(0, state.incoming.length - incomingPos); }
  function fileUrl(id) { ensure(); return fileUrls[bareId(id)] || null; }

  // ---------- Internal helpers for writes ----------

  // Sets type-specific fields (topic / invoice / expiresOn / renewedOn / requestedOn) to match doc.type.
  function shapeFields(d) {
    var x = extracted[d.id] || {};
    if (d.type === "invoice") {
      if (!d.invoice) d.invoice = { amountCents: x.amountCents == null ? null : x.amountCents, dueDate: x.dueDate || null, paidOn: null };
    } else {
      if (d.invoice) { x.amountCents = d.invoice.amountCents; x.dueDate = d.invoice.dueDate; }
      d.invoice = null;
    }
    if (isCredential(d.type)) {
      if (!d.expiresOn) d.expiresOn = x.expiresOn || null;
      if (d.renewedOn === undefined) d.renewedOn = null;
      if (d.requestedOn === undefined) d.requestedOn = null;
    } else {
      if (d.expiresOn) x.expiresOn = d.expiresOn;
      d.expiresOn = null;
      d.renewedOn = null;
      d.requestedOn = null;
    }
    if (d.type !== "compliance") d.topic = null;
    extracted[d.id] = x;
  }

  function applyResult(d, result) {
    var r = cleanResult(result);
    d.type = r.type;
    d.employeeId = r.employeeId;
    d.vendorId = r.vendorId;
    d.topic = r.topic;
    shapeFields(d);
  }

  function refreshName(d) {
    if (d.status === "filed" && !d.renamed) d.name = S.ai.nameFor(clone(d));
  }

  // Hard rule 8 (automatic): a newer filed credential replaces older open ones.
  function applyRenewal(d) {
    if (!tracks(d) || !isCredential(d.type) || !d.employeeId || !d.expiresOn) return;
    state.documents.forEach(function (o) {
      if (o.id === d.id || !tracks(o) || o.type !== d.type) return;
      if (o.employeeId !== d.employeeId || o.renewedOn || !o.expiresOn) return;
      if (o.expiresOn < d.expiresOn) {
        o.renewedOn = today();
        log(o, "Replaced", "Replaced by " + d.name, "Sortable");
      }
    });
  }

  // Puts a document into a folder as filed. Creates automatic folders on demand.
  function placeIn(d, folderId, filedBy) {
    var wasFiled = d.status === "filed";
    d.status = "filed";
    d.folderId = folderId;
    d.alternatives = [];
    d.suggested = null;
    if (!wasFiled) {
      d.filedBy = filedBy;
      filedOn[d.id] = { on: today(), seq: ++seq };
    }
    if (!userFolder(folderId)) ensureFolder(folderId);
    refreshName(d);
    applyRenewal(d);
  }

  function learn(d, result) {
    var rule = S.ai.ruleFromCorrection(clone(d), cleanResult(result));
    if (!rule) return null;
    var all = learned.concat(state.filingRules);
    if (!rule.id || findIn(all, rule.id)) rule.id = S.util.nextId("rule", all);
    learned.unshift(rule);
    return rule;
  }

  function cancelTimer(id) {
    if (timers[id] != null && typeof clearTimeout === "function") clearTimeout(timers[id]);
    delete timers[id];
  }

  // Finishes one "reading" document: files it, or sends it to review.
  function settleOne(d) {
    if (!d || d.status !== "reading") return false;
    var c = pending[d.id] || {};
    delete pending[d.id];
    cancelTimer(d.id);
    var result = cleanResult(c.result);
    var f = c.fields || {};
    if (f.docDate) d.docDate = f.docDate;
    extracted[d.id] = {
      amountCents: f.amountCents != null ? f.amountCents : null,
      dueDate: f.dueDate || null,
      expiresOn: f.expiresOn || null
    };
    d.confidence = typeof c.confidence === "number" ? c.confidence : 0.40;
    applyResult(d, result);
    if (d.confidence >= REVIEW_THRESHOLD && !isEmptyResult(result)) {
      placeIn(d, folderFor(result), "auto");
      log(d, "Filed", "Named and filed in " + pathText(d.folderId), "Sortable");
    } else {
      d.status = "review";
      d.folderId = null;
      d.suggested = isEmptyResult(result) ? null : result;
      d.alternatives = (c.alternatives || []).slice(0, 3).map(cleanResult);
      if (!d.renamed) d.name = d.filename;
      log(d, "Sent to review", reviewReason(d), "Sortable");
    }
    return true;
  }

  function settleIfReading(d) { if (d && d.status === "reading") settleOne(d); }

  // ---------- Writes: intake and review ----------

  function receive(input) {
    ensure();
    input = input || {};
    var file = input.file || null;
    var inp = clone({ channel: input.channel, sender: input.sender, filename: input.filename, text: input.text, fields: input.fields }) || {};
    inp.channel = inp.channel || "upload";
    inp.sender = inp.sender || (inp.channel === "upload" ? "upload" : "");
    inp.filename = inp.filename || (file && file.name) || "document";
    inp.fields = inp.fields || {};
    var c = S.ai.classify(inp, rules()) || {};
    var f = c.fields || {};

    var d = {
      id: S.util.nextId("doc", state.documents),
      filename: inp.filename,
      name: inp.filename,
      renamed: false,
      type: "other",
      topic: null,
      folderId: null,
      status: "reading",
      confidence: null,
      alternatives: [],
      suggested: null,
      matchKey: S.ai.matchKey(inp),
      channel: inp.channel,
      sender: inp.sender,
      receivedOn: today(),
      modifiedOn: today(),
      docDate: f.docDate || today(),
      employeeId: null,
      vendorId: null,
      text: inp.text || "",
      invoice: null,
      expiresOn: null,
      renewedOn: null,
      requestedOn: null,
      filedBy: null,
      location: (state.practice.locations && state.practice.locations[0]) || "Main office",
      starred: false,
      deletedOn: null,
      copyOf: null,
      hasFile: false,
      activity: []
    };
    if (file && canMakeUrls()) {
      try { fileUrls[d.id] = URL.createObjectURL(file); d.hasFile = true; } catch (e) { d.hasFile = false; }
    }
    pending[d.id] = clone(c);
    state.documents.push(d);
    log(d, "Received", arrivalDetail(d), d.channel === "upload" ? "You" : "Sortable");

    if (typeof setTimeout === "function") {
      var id = d.id, st = state;
      timers[id] = setTimeout(function () {
        delete timers[id];
        if (st !== state) return;              // init() ran since
        if (settleOne(rawDoc(id))) notify();
      }, SETTLE_MS);
    }
    notify();
    return out(d);
  }

  function nextIncoming() {
    ensure();
    if (incomingPos >= state.incoming.length) return null;
    var item = state.incoming[incomingPos];
    incomingPos += 1;
    return receive({ channel: item.channel, sender: item.sender, filename: item.filename, text: item.text, fields: item.fields });
  }

  function settleAll() {
    ensure();
    var any = false;
    state.documents.forEach(function (d) { if (settleOne(d)) any = true; });
    if (any) notify();
    return any;
  }

  // Files a review document as suggested. Returns null (and changes nothing) when
  // there is no suggestion (a no-match document: use Fix or Something else).
  function approve(id) {
    var d = rawDoc(id);
    if (!d || d.status !== "review" || d.deletedOn || isEmptyResult(d.suggested)) return null;
    var r = cleanResult(d.suggested);
    applyResult(d, r);
    placeIn(d, folderFor(r), "reviewed");
    log(d, "Approved", "Filed in " + pathText(d.folderId));
    notify();
    return out(d);
  }

  // Reclassifies, moves to folderFor(result) and learns a rule.
  function correct(id, result) {
    var d = rawDoc(id);
    if (!d || !result) return null;
    settleIfReading(d);
    var r = cleanResult(result);
    var fromReview = d.status !== "filed";
    learn(d, r);
    applyResult(d, r);
    placeIn(d, folderFor(r), fromReview ? "reviewed" : "manual");
    log(d, "Corrected", "Filed in " + pathText(d.folderId));
    notify();
    return out(d);
  }

  // patch: { employeeId, type, docDate, expiresOn }. Missing keys keep their value.
  function editDetails(id, patch) {
    var d = rawDoc(id);
    if (!d) return null;
    settleIfReading(d);
    patch = patch || {};
    var base = d.status === "review" && d.suggested ? d.suggested : resultOf(d);
    var r = cleanResult({
      type: patch.type !== undefined ? patch.type : (d.status === "review" ? base.type : d.type),
      employeeId: patch.employeeId !== undefined ? patch.employeeId : (d.status === "review" ? base.employeeId : d.employeeId),
      vendorId: d.status === "review" ? base.vendorId : d.vendorId,
      topic: d.status === "review" ? base.topic : d.topic
    });
    if (patch.docDate) d.docDate = patch.docDate;
    if (patch.expiresOn !== undefined) {
      extracted[d.id] = extracted[d.id] || {};
      extracted[d.id].expiresOn = patch.expiresOn || null;
      d.expiresOn = null;           // shapeFields refills it from extracted for credentials
    }
    var wasReview = d.status === "review";
    var keepFolder = d.status === "filed" && userFolder(d.folderId) ? d.folderId : null;
    if (wasReview) learn(d, r);
    applyResult(d, r);
    if (isCredential(d.type) && patch.expiresOn !== undefined) d.expiresOn = patch.expiresOn || null;
    placeIn(d, keepFolder || folderFor(r), wasReview ? "reviewed" : "manual");
    log(d, "Details edited", "Filed in " + pathText(d.folderId));
    notify();
    return out(d);
  }

  // ---------- Writes: organizing ----------

  function move(ids, folderId) {
    ensure();
    var target = folderRec(folderId) || (autoRecord(folderId) && resultForFolder(folderId, {}) ? autoRecord(folderId) : null);
    if (!target) return 0;
    var moved = 0;
    asList(ids).forEach(function (id) {
      var uf = userFolder(id);
      if (uf) {
        if (target.restricted || uf.id === target.id || isInside(target.id, uf.id)) return;
        uf.parentId = target.id;
        moved++;
        return;
      }
      var d = rawDoc(id);
      if (!d || d.deletedOn) return;
      settleIfReading(d);
      if (!target.auto) {
        if (d.folderId === target.id && d.status === "filed") return;
        placeIn(d, target.id, "manual");
        log(d, "Moved", "To " + pathText(target.id));
        moved++;
        return;
      }
      var r = resultForFolder(target.id, d);
      if (!r) return;
      if (d.status === "filed" && d.folderId === target.id && sameResult(r, resultOf(d))) return;
      var fromReview = d.status !== "filed";
      learn(d, r);
      applyResult(d, r);
      placeIn(d, folderFor(r), fromReview ? "reviewed" : "manual");
      log(d, "Moved", "To " + pathText(d.folderId));
      moved++;
    });
    notify();
    return moved;
  }

  function rename(id, name) {
    ensure();
    name = String(name == null ? "" : name).trim();
    if (!name) return null;
    var uf = userFolder(id);
    if (uf) { uf.name = name; notify(); return publicFolder(uf); }
    var d = rawDoc(id);
    if (!d) return null;
    if (d.name !== name) {
      var old = d.name;
      d.name = name;
      d.renamed = true;
      log(d, "Renamed", "From " + old + " to " + name);
    }
    notify();
    return out(d);
  }

  function copyDoc(id) {
    var src = rawDoc(id);
    if (!src || src.status !== "filed" || src.deletedOn) return null;
    var d = clone(src);
    d.id = S.util.nextId("doc", state.documents);
    d.name = "Copy of " + src.name;
    d.renamed = true;
    d.copyOf = src.id;
    d.starred = false;
    d.receivedOn = today();
    d.activity = [];
    extracted[d.id] = clone(extracted[src.id] || {});
    if (fileUrls[src.id]) fileUrls[d.id] = fileUrls[src.id];
    state.documents.push(d);
    filedOn[d.id] = { on: today(), seq: ++seq };
    log(d, "Copied", "Copy of " + src.name);
    log(src, "Copy made", d.name);
    notify();
    return out(d);
  }

  function star(ids, on) {
    ensure();
    var flag = on !== false;
    asList(ids).forEach(function (id) {
      var uf = userFolder(id);
      if (uf) { uf.starred = flag; return; }
      if (folderRec(id)) { if (flag) folderStars[id] = true; else delete folderStars[id]; return; }
      var d = rawDoc(id);
      if (!d || !!d.starred === flag) return;
      d.starred = flag;
      log(d, flag ? "Starred" : "Unstarred", "");
    });
    notify();
  }

  function newFolder(parentId, name) {
    ensure();
    var pid = parentId || null;
    if (pid !== null) {
      var p = folderRec(pid);
      if (!p || p.restricted) return null;
    }
    var f = {
      id: S.util.nextId("fld-u", state.folders),
      name: String(name == null ? "" : name).trim() || "New folder",
      parentId: pid, kind: "user", restricted: false, starred: false, auto: false
    };
    state.folders.push(f);
    notify();
    return publicFolder(f);
  }

  function deleteFolder(id) {
    ensure();
    var f = userFolder(id);
    if (!f) return false;
    var hasFolders = state.folders.some(function (o) { return o.parentId === f.id; });
    var hasDocs = state.documents.some(function (d) { return live(d) && d.folderId === f.id; });
    if (hasFolders || hasDocs) return false;
    state.folders.splice(state.folders.indexOf(f), 1);
    notify();
    return true;
  }

  // ---------- Writes: trash ----------

  function trash(ids) {
    ensure();
    asList(ids).forEach(function (id) {
      var d = rawDoc(id);
      if (!d || d.deletedOn) return;
      settleIfReading(d);
      d.deletedOn = today();
      log(d, "Moved to trash", "");
    });
    notify();
  }

  function restore(ids) {
    ensure();
    asList(ids).forEach(function (id) {
      var d = rawDoc(id);
      if (!d || !d.deletedOn) return;
      d.deletedOn = null;
      if (d.status === "filed" && !folderRec(d.folderId)) {
        d.folderId = folderFor(resultOf(d));
        ensureFolder(d.folderId);
      }
      log(d, "Restored", d.status === "filed" ? "To " + pathText(d.folderId) : "");
    });
    notify();
  }

  function deleteForever(ids) {
    ensure();
    asList(ids).forEach(function (id) {
      var d = rawDoc(id);
      if (!d || !d.deletedOn) return;
      var url = fileUrls[d.id];
      delete fileUrls[d.id];
      if (url) {
        var shared = Object.keys(fileUrls).some(function (k) { return fileUrls[k] === url; });
        if (!shared) revokeUrl(url);
      }
      delete extracted[d.id];
      delete filedOn[d.id];
      state.documents.splice(state.documents.indexOf(d), 1);
    });
    notify();
  }

  // ---------- Writes: deadlines ----------

  function markPaid(id) {
    var d = rawDoc(id);
    if (d && d.invoice && !d.invoice.paidOn) {
      d.invoice.paidOn = today();
      log(d, "Marked as paid", "");
    }
    notify();
    return out(d);
  }

  // Hard rule 8 (by hand): sets requestedOn; the item closes when a newer document is filed.
  function requestOne(id) {
    var d = rawDoc(id);
    if (d && isCredential(d.type) && d.status === "filed" && !d.renewedOn && !d.requestedOn) {
      d.requestedOn = today();
      log(d, "Asked for an updated version", "");
    }
    return d;
  }
  function markRenewed(id) { ensure(); var d = requestOne(id); notify(); return out(d); }
  function requestUpdate(ids) { ensure(); asList(ids).forEach(requestOne); notify(); }

  function resolveCompliance(id) {
    ensure();
    var c = findIn(state.compliance, bareId(id));
    if (c && !c.resolvedOn) {
      c.resolvedOn = today();
      var d = c.documentId ? findIn(state.documents, c.documentId) : null;
      if (d) log(d, "Resolved", c.title);
    }
    notify();
    return clone(c);
  }

  // ---------- Other ----------

  function setStorageStatus(status) {
    ensure();
    if (STORAGE_STATUSES[status]) state.storage.status = status;
    notify();
    return clone(state.storage);
  }

  function subscribe(fn) {
    if (typeof fn === "function") listeners.push(fn);
    return function unsubscribe() {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  S.store = {
    init: init,
    // practice and people
    practice: practice, viewer: viewer, storage: storage, departments: departments,
    employees: employees, employee: employee, vendors: vendors, vendor: vendor,
    // documents and folders
    documents: documents, document: document,
    folders: folders, folder: folder, children: children, pathOf: pathOf,
    folderFor: function (result) { return folderFor(result); },
    pathLabel: pathLabel, canOpen: canOpen,
    // collections and queues
    collection: collection, collectionCounts: collectionCounts, reviewQueue: reviewQueue,
    received: received, filedToday: filedToday, needsYou: needsYou,
    // status, deadlines and metrics
    compliance: compliance, rules: rules, incomingCount: incomingCount,
    invoiceStatus: invoiceStatus, fileStatus: fileStatus, deadlines: deadlines, metrics: metrics,
    fileUrl: fileUrl,
    // writes
    receive: receive, nextIncoming: nextIncoming, settleAll: settleAll,
    approve: approve, correct: correct, editDetails: editDetails,
    move: move, rename: rename, copy: copyDoc, star: star, newFolder: newFolder, deleteFolder: deleteFolder,
    trash: trash, restore: restore, deleteForever: deleteForever,
    markPaid: markPaid, markRenewed: markRenewed, requestUpdate: requestUpdate, resolveCompliance: resolveCompliance,
    setStorageStatus: setStorageStatus,
    subscribe: subscribe
  };
})();
