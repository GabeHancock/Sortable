// Sortable.util: small shared helpers. Owner: Shell.
// Dates are "YYYY-MM-DD" strings. All date math runs in UTC so DST never shifts a day.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});

  var MONTHS = ["january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"];
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TYPE_LABELS = {
    invoice: "Invoice",
    license: "License",
    certification: "Certification",
    training: "Training",
    hr_form: "HR form",
    contract: "Contract",
    compliance: "Compliance",
    medical: "Medical record",
    other: "Document"
  };
  // Default zero-padding when the list has no IDs with this prefix yet.
  var ID_WIDTH = { doc: 3 };

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  function toUTC(date) {
    var p = String(date).split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function fromUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1, 2) + "-" + pad(d.getUTCDate(), 2);
  }

  Sortable.util = {
    today: function () {
      return window.MOCK.today;
    },

    addDays: function (date, n) {
      return fromUTC(toUTC(date) + n * 86400000);
    },

    // b − a in whole days.
    daysBetween: function (a, b) {
      return Math.round((toUTC(b) - toUTC(a)) / 86400000);
    },

    // daysBetween(today(), date): positive in the future, negative in the past.
    daysFromToday: function (date) {
      return Sortable.util.daysBetween(Sortable.util.today(), date);
    },

    // "today", "tomorrow", "in N days", "yesterday" or "N days ago". Empty input gives "".
    relativeDays: function (date) {
      if (!date) return "";
      var n = Sortable.util.daysFromToday(date);
      if (n === 0) return "today";
      if (n === 1) return "tomorrow";
      if (n === -1) return "yesterday";
      return n > 0 ? "in " + n + " days" : -n + " days ago";
    },

    // 1–12 for "March" or "mar" (any case), otherwise null.
    monthIndex: function (word) {
      var w = String(word == null ? "" : word).toLowerCase();
      for (var i = 0; i < 12; i++) {
        if (w === MONTHS[i] || w === MONTHS[i].slice(0, 3)) return i + 1;
      }
      return null;
    },

    // "2026-03-12" → "Mar 12, 2026". Empty input gives "".
    formatDate: function (date) {
      if (!date) return "";
      var p = String(date).split("-");
      return MONTH_SHORT[+p[1] - 1] + " " + +p[2] + ", " + p[0];
    },

    // "2026-03-12" → { mon: "MAR", day: "12" }. The day has no leading zero ("5").
    monthDay: function (date) {
      if (!date) return { mon: "", day: "" };
      var p = String(date).split("-");
      return { mon: MONTH_SHORT[+p[1] - 1].toUpperCase(), day: String(+p[2]) };
    },

    // 123456 → "$1,234.56"
    formatMoney: function (cents) {
      var n = Math.round(Number(cents) || 0);
      var sign = n < 0 ? "-" : "";
      n = Math.abs(n);
      var dollars = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return sign + "$" + dollars + "." + pad(n % 100, 2);
    },

    esc: function (text) {
      if (text == null) return "";
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    // nextId("doc", docs) → "doc-048". list may hold objects with .id or plain ID strings.
    nextId: function (prefix, list) {
      var max = 0;
      var width = ID_WIDTH[prefix] || 2;
      var re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "-(\\d+)$");
      (list || []).forEach(function (item) {
        var id = item && typeof item === "object" ? item.id : item;
        var m = re.exec(String(id));
        if (m) {
          max = Math.max(max, parseInt(m[1], 10));
          width = Math.max(width, m[1].length);
        }
      });
      return prefix + "-" + pad(max + 1, width);
    },

    typeLabel: function (type) {
      return TYPE_LABELS[type] || "Document";
    },

    // "Scan.PDF" → "pdf". No extension gives "file".
    fileExt: function (filename) {
      var name = String(filename == null ? "" : filename).split(/[\\/]/).pop();
      var dot = name.lastIndexOf(".");
      if (dot <= 0 || dot === name.length - 1) return "file";
      return name.slice(dot + 1).toLowerCase();
    }
  };
})();
