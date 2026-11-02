/* Sortable.ai: scripted "AI" for intake. Owner: Intake.
   Rule matching, field filling, naming and learning keys. No real AI and no
   network: everything comes from the filing rules in the mock data.
   See CLAUDE.md "How classification works" and "Learning from corrections". */
(function () {
  "use strict";

  var S = (window.Sortable = window.Sortable || {});

  var NO_MATCH_CONFIDENCE = 0.40;
  var LEARNED_CONFIDENCE = 0.95;
  var MIN_KEY_LENGTH = 6;

  function copy(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function has(v) { return v !== null && v !== undefined && v !== ""; }

  // v2 result: { type, employeeId, vendorId, topic }. No folder: the store
  // works that out with folderFor(result). topic is kept for compliance only.
  function cleanResult(r) {
    r = r || {};
    var type = r.type || "other";
    return {
      type: type,
      employeeId: r.employeeId || null,
      vendorId: r.vendorId || null,
      topic: type === "compliance" ? r.topic || null : null
    };
  }

  // A valid "YYYY-MM-DD" from the filename ("2026-03-12" or "20260312"), otherwise null.
  function dateFromFilename(name) {
    var s = String(name || "");
    var m = /(\d{4})-(\d{2})-(\d{2})/.exec(s) || /(\d{4})(\d{2})(\d{2})/.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], da = +m[3];
    if (y < 1900 || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    var iso = m[1] + "-" + m[2] + "-" + m[3];
    // Reject impossible days such as 2026-02-31 (addDays round-trips real dates only).
    if (S.util.addDays(iso, 0) !== iso) return null;
    return iso;
  }

  function findRule(input, rules) {
    var text = (String(input.sender || "") + " " + String(input.filename || "")).toLowerCase();
    for (var i = 0; i < (rules || []).length; i++) {
      var match = String(rules[i].match || "").toLowerCase();
      if (match && text.indexOf(match) >= 0) return rules[i];
    }
    return null;
  }

  // classify(input, rules) -> { result, confidence, alternatives, fields }
  // result: { type, employeeId, vendorId, topic }.
  // fields: { docDate, amountCents, dueDate, expiresOn } (unknown values are null).
  // This is the only place that reads dates out of filenames; the store doesn't repeat it.
  function classify(input, rules) {
    input = input || {};
    var given = input.fields || {};
    var rule = findRule(input, rules);
    var rf = (rule && rule.fields) || {};

    var docDate = given.docDate || dateFromFilename(input.filename) || S.util.today();

    var amountCents = has(given.amountCents) ? given.amountCents
      : has(rf.amountCents) ? rf.amountCents : null;
    var dueDate = given.dueDate
      || (has(rf.dueInDays) ? S.util.addDays(docDate, rf.dueInDays) : null);
    var expiresOn = given.expiresOn
      || (has(rf.expiresInDays) ? S.util.addDays(docDate, rf.expiresInDays) : null);

    var fields = { docDate: docDate, amountCents: amountCents, dueDate: dueDate, expiresOn: expiresOn };

    if (!rule) {
      return {
        result: { type: "other", employeeId: null, vendorId: null, topic: null },
        confidence: NO_MATCH_CONFIDENCE,
        alternatives: [],
        fields: fields
      };
    }
    return {
      result: cleanResult(rule.result),
      confidence: typeof rule.confidence === "number" ? rule.confidence : NO_MATCH_CONFIDENCE,
      alternatives: (rule.alternatives || []).slice(0, 3).map(cleanResult),
      fields: fields
    };
  }

  // Email and fax: lowercased sender. Upload: filename, lowercased, extension removed,
  // cut at the first digit, trailing "_ - ." and spaces trimmed.
  function matchKey(input) {
    input = input || {};
    if (input.channel !== "upload") return String(input.sender || "").toLowerCase();
    var k = String(input.filename || "").toLowerCase().replace(/\.[^.]*$/, "");
    var d = k.search(/[0-9]/);
    if (d >= 0) k = k.slice(0, d);
    return k.replace(/[_\-. ]+$/, "");
  }

  // A learned rule from a Fix or Move, or null when the key is too short to be safe.
  function ruleFromCorrection(doc, result) {
    if (!doc || !result) return null;
    var key = has(doc.matchKey) ? String(doc.matchKey) : matchKey(doc);
    key = key.toLowerCase();
    if (key.length < MIN_KEY_LENGTH) return null;
    var rules = (S.store && S.store.rules) ? S.store.rules() : [];
    return {
      id: S.util.nextId("rule", rules),
      match: key,
      confidence: LEARNED_CONFIDENCE,
      result: cleanResult(copy(result)),
      alternatives: []
    };
  }

  function lookup(kind, id) {
    if (!id) return null;
    if (S.store && S.store[kind]) {
      var x = S.store[kind](id);
      if (x) return x;
    }
    var list = (window.MOCK && window.MOCK[kind + "s"]) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // "Type – Employee or Vendor – YYYY-MM-DD" (hard rule 3).
  // A name the user gave (doc.renamed) is kept as is.
  function nameFor(doc) {
    doc = doc || {};
    if (doc.renamed && has(doc.name)) return String(doc.name);
    var emp = lookup("employee", doc.employeeId);
    var ven = emp ? null : lookup("vendor", doc.vendorId);
    var middle = emp ? emp.name : ven ? ven.name : "Practice";
    return S.util.typeLabel(doc.type) + " – " + middle + " – " + (doc.docDate || S.util.today());
  }

  S.ai = {
    classify: classify,
    matchKey: matchKey,
    ruleFromCorrection: ruleFromCorrection,
    nameFor: nameFor
  };
})();
