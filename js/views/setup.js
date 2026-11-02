// Sortable.views.setup: Setup page (R11) and "Where files live". Owner: Intake.
// Shows the practice details, the forwarding email and e-fax number (each with Copy),
// and where files are stored, with a demo switch that simulates a connection problem.
// No real settings, no logins, no pricing.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});
  Sortable.views = Sortable.views || {};

  var STATUS = {
    connected: { cls: "is-connected", label: "Connected", help: "Everything is saving normally." },
    attention: { cls: "is-attention", label: "Needs attention", help: "New files are held safely and will save once the connection is back." },
    offline: { cls: "is-offline", label: "Offline", help: "Files can't be saved right now. They will save once the connection is back." }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function card(title, id) {
    var sec = el("section", "card setup-card");
    var h = el("h2", "setup-title", title);
    h.id = id;
    sec.setAttribute("aria-labelledby", id);
    sec.appendChild(h);
    return sec;
  }

  function detail(dl, label, value) {
    var row = el("div");
    row.appendChild(el("dt", null, label));
    row.appendChild(el("dd", null, value));
    dl.appendChild(row);
  }

  function channelCard(id, title, value, steps) {
    var sec = card(title, id + "-title");
    var line = el("div", "setup-copy");
    line.appendChild(el("span", "setup-value mono", value));
    var btn = el("button", "btn", "Copy");
    btn.type = "button";
    btn.setAttribute("aria-label", "Copy " + title.toLowerCase());
    btn.addEventListener("click", function () { Sortable.ui.copyText(value, btn); });
    line.appendChild(btn);
    sec.appendChild(line);
    var ol = el("ol", "setup-steps");
    steps.forEach(function (s) { ol.appendChild(el("li", null, s)); });
    sec.appendChild(ol);
    return sec;
  }

  function storageCard() {
    var s = Sortable.store.storage() || {};
    var st = STATUS[s.status] || STATUS.attention;
    var sec = card("Where files live", "setup-storage-title");

    var box = el("div", "setup-storage");
    var name = el("div", "setup-storage-name");
    name.appendChild(el("strong", null, s.name || ""));
    name.appendChild(el("span", "muted", s.sub || ""));
    box.appendChild(name);

    var status = el("div", "setup-status " + st.cls);
    status.setAttribute("role", "status");
    status.appendChild(el("span", "setup-dot"));
    status.appendChild(el("span", "setup-status-label", st.label));
    box.appendChild(status);
    sec.appendChild(box);
    sec.appendChild(el("p", "muted setup-help", st.help));

    var on = s.status !== "connected";
    var sw = el("button", "setup-switch" + (on ? " is-on" : ""));
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", on ? "true" : "false");
    sw.appendChild(el("span", "setup-switch-track"));
    sw.appendChild(el("span", "setup-switch-label", "Simulate a connection problem"));
    sw.addEventListener("click", function () {
      Sortable.store.setStorageStatus(on ? "connected" : "attention");
    });
    sec.appendChild(sw);
    sec.appendChild(el("p", "muted setup-note", "For the demo only. It shows the warning you'd see on Today and in Files."));
    return sec;
  }

  Sortable.views.setup = {
    render: function (root) {
      var p = Sortable.store.practice() || {};
      root.className = "page screen-setup";

      root.appendChild(el("h1", "page-title", "Setup"));

      var practice = card("Your practice", "setup-practice-title");
      var dl = el("dl", "setup-details");
      detail(dl, "Name", p.name || "");
      detail(dl, "Specialty", p.specialty || "");
      detail(dl, "Staff", (p.staffCount != null ? p.staffCount : "") + " people");
      detail(dl, "Location", (p.locations || []).join(", "));
      practice.appendChild(dl);
      root.appendChild(practice);

      var channels = el("div", "setup-channels");
      channels.appendChild(channelCard("setup-email", "Forwarding email", p.forwardEmail || "", [
        "Copy this address.",
        "In your email, forward any bill, license or form to it. You can also set up a rule that forwards them for you.",
        "Sortable names each document and files it in the right folder."
      ]));
      channels.appendChild(channelCard("setup-fax", "E-fax number", p.faxNumber || "", [
        "Copy this number.",
        "Ask your fax provider to send incoming faxes to it, or give it to vendors who fax you.",
        "Every fax that arrives is filed the same way as email."
      ]));
      root.appendChild(channels);

      root.appendChild(storageCard());

      var tip = el("p", "muted setup-uploads", "Have paper or scanned files? Drop them into the ");
      var a = el("a", null, "Inbox");
      a.href = "#/inbox";
      tip.appendChild(a);
      tip.appendChild(document.createTextNode("."));
      root.appendChild(tip);
    }
  };
})();
