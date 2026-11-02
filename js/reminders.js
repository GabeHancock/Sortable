/* Sortable.reminders: reminder schedule and outbox (hard rule 7). Owner: Deadlines.
   Everything here is worked out from Sortable.store.deadlines() and never stored.
   - invoices: 7 and 1 days before the due date
   - credentials and compliance items: 60, 30 and 7 days before
   - awaiting items (requestedOn set): weekly on requestedOn + 7, + 14, ...
   No before-due reminder is sent on or after the due date, or after requestedOn. */
(function () {
  "use strict";

  var S = (window.Sortable = window.Sortable || {});

  var OFFSETS = {
    invoice: [7, 1],
    credential: [60, 30, 7],
    compliance: [60, 30, 7]
  };

  function byDate(a, b) {
    if (a.sendOn !== b.sendOn) return a.sendOn < b.sendOn ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === "before" ? -1 : 1;
    return 0;
  }

  // The schedule for one deadline, earliest first:
  // [{ sendOn, kind: "before" | "weekly", offsetDays, week }].
  // Before-due rows carry offsetDays (week is null); weekly rows carry week (offsetDays is null).
  // Weekly rows run up to the first one after today, and stop at closedOn when the item is closed.
  function schedule(deadline) {
    if (!deadline || !deadline.dueOn) return [];
    var out = [];
    var requested = deadline.requestedOn || null;
    var closed = deadline.closedOn || null;

    (OFFSETS[deadline.kind] || []).forEach(function (n) {
      if (n <= 0) return;
      var sendOn = S.util.addDays(deadline.dueOn, -n);
      if (sendOn >= deadline.dueOn) return; // never on or after the due date
      if (requested && sendOn > requested) return; // before-due reminders stop on requestedOn
      out.push({ sendOn: sendOn, kind: "before", offsetDays: n, week: null });
    });

    if (requested) {
      var today = S.util.today();
      for (var k = 1; k < 1000; k++) {
        var on = S.util.addDays(requested, 7 * k);
        if (closed && on > closed) break;
        out.push({ sendOn: on, kind: "weekly", offsetDays: null, week: k });
        if (on > today) break; // the first one after today is the last
      }
    }

    return out.sort(byDate);
  }

  function row(d, r) {
    return { deadlineId: d.id, title: d.title, sendOn: r.sendOn, kind: r.kind, offsetDays: r.offsetDays, week: r.week };
  }

  // { sent, next }
  // sent: every reminder with sendOn <= today (and <= closedOn when closed), newest first.
  // next: the earliest reminder after today for each open item, soonest first.
  // Returns every row; the screen applies its own 20-row limit.
  function outbox() {
    var today = S.util.today();
    var sent = [];
    var next = [];
    S.store.deadlines().forEach(function (d) {
      var closed = d.closedOn || null;
      var upcoming = null;
      schedule(d).forEach(function (r) {
        if (r.sendOn <= today) {
          if (!closed || r.sendOn <= closed) sent.push(row(d, r));
        } else if (!closed && !upcoming) {
          upcoming = r;
        }
      });
      if (upcoming) next.push(row(d, upcoming));
    });
    function tie(a, b) {
      if (a.kind !== b.kind) return a.kind === "before" ? -1 : 1;
      var ao = a.kind === "before" ? a.offsetDays : a.week;
      var bo = b.kind === "before" ? b.offsetDays : b.week;
      if (ao !== bo) return ao - bo;
      return a.deadlineId < b.deadlineId ? -1 : a.deadlineId > b.deadlineId ? 1 : 0;
    }
    sent.sort(function (a, b) {
      if (a.sendOn !== b.sendOn) return a.sendOn < b.sendOn ? 1 : -1;
      return tie(a, b);
    });
    next.sort(function (a, b) {
      if (a.sendOn !== b.sendOn) return a.sendOn < b.sendOn ? -1 : 1;
      return tie(a, b);
    });
    return { sent: sent, next: next };
  }

  S.reminders = { schedule: schedule, outbox: outbox };
})();
