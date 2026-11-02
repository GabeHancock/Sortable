// Sortable.router: hash routing, redirects, fresh root per render, active tab, Inbox badge. Owner: Shell.
(function () {
  var Sortable = (window.Sortable = window.Sortable || {});
  Sortable.views = Sortable.views || {};

  // First path segment → { view, tab, ok(rest) }. `rest` is the segments after the first.
  // A path whose shape doesn't fit is an unknown route. IDs inside a fitting shape are
  // passed through, and the view shows "Not found" for one that doesn't exist.
  function none(rest) { return rest.length === 0; }
  var ROUTES = {
    dashboard: { view: "dashboard", tab: "dashboard", ok: none },
    inbox: { view: "inbox", tab: "inbox", ok: none },
    library: {
      view: "library", tab: "library",
      ok: function (rest) {
        return rest.length === 0 || (rest.length === 2 && (rest[0] === "f" || rest[0] === "c"));
      }
    },
    doc: { view: "library", tab: "library", ok: function (rest) { return rest.length === 1; } },
    search: { view: "search", tab: null, ok: none },
    deadlines: {
      view: "deadlines", tab: "deadlines",
      ok: function (rest) { return rest.length === 0 || (rest.length === 1 && rest[0] === "calendar"); }
    },
    setup: { view: "setup", tab: "setup", ok: none }
  };

  var DEFAULT_HASH = "#/dashboard";
  var lastPath = null;
  var lastView = null;

  function decode(s) {
    try {
      return decodeURIComponent(s.replace(/\+/g, " "));
    } catch (e) {
      return s;
    }
  }

  // "#/search?q=henry" → { segments: ["search"], query: { q: "henry" } }
  function parse(hash) {
    var h = String(hash || "").replace(/^#/, "");
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var qs = qi >= 0 ? h.slice(qi + 1) : "";
    var segments = path.split("/").filter(Boolean).map(decode);
    var query = {};
    qs.split("&").forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf("=");
      var k = decode(eq >= 0 ? pair.slice(0, eq) : pair);
      query[k] = eq >= 0 ? decode(pair.slice(eq + 1)) : "";
    });
    return { segments: segments, query: query };
  }

  // The hash to replace the current one with, or null if the route is fine as is.
  function redirectFor(segments) {
    var first = segments[0];
    if (first === "employees") {
      if (segments.length === 1) return "#/library/f/fld-employees";
      if (segments.length === 2) return "#/library/f/fld-" + encodeURIComponent(segments[1]);
      return DEFAULT_HASH;
    }
    var route = ROUTES[first];
    if (!route || !route.ok(segments.slice(1))) return DEFAULT_HASH;
    return null;
  }

  function updateHeader(route) {
    var active = route.tab;
    var tabs = document.querySelectorAll("[data-tab]");
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute("data-tab") === active;
      tabs[i].classList.toggle("is-active", on);
      if (on) tabs[i].setAttribute("aria-current", "page");
      else tabs[i].removeAttribute("aria-current");
    }

    var badge = document.getElementById("inbox-badge");
    if (badge) {
      var n = 0;
      try { n = Sortable.store.reviewQueue().length; } catch (e) { if (window.console) console.error(e); }
      badge.textContent = String(n);
      badge.hidden = n === 0;
    }

    var box = document.getElementById("search-box");
    if (box && document.activeElement !== box) {
      box.value = route.view === "search" ? parse(location.hash).query.q || "" : "";
    }
  }

  function render() {
    var hash = location.hash;
    var params;

    if (!hash || hash === "#" || hash === "#/") {
      params = parse(DEFAULT_HASH);
    } else {
      params = parse(hash);
      var target = redirectFor(params.segments);
      if (target) {
        // replace() keeps Back working: the redirected entry never stays in history.
        // It fires hashchange, which renders the target.
        location.replace(target);
        return;
      }
    }

    var route = ROUTES[params.segments[0]];
    var main = document.getElementById("view");
    main.innerHTML = "";
    var root = document.createElement("div");
    main.appendChild(root);

    var view = Sortable.views[route.view];
    try {
      if (!view) throw new Error("View not loaded: " + route.view);
      view.render(root, params);
    } catch (err) {
      if (window.console) console.error(err);
      root.className = "page";
      root.innerHTML = '<p class="empty">Something went wrong showing this page.</p>';
    }

    updateHeader(route);

    // Scroll to the top only when the path changes, not on a store redraw
    // or a query-string change (view settings such as sort or grid).
    // Opening or closing a document's details panel in Files keeps the list
    // where it was, since the panel sits beside the same list.
    var path = params.segments.join("/");
    if (path !== lastPath) {
      var panelToggle = params.segments[0] === "doc" || /^doc\//.test(lastPath || "");
      var stayInFiles = route.view === "library" && lastView === "library";
      lastPath = path;
      if (!(panelToggle && stayInFiles) && window.scrollTo) window.scrollTo(0, 0);
    }
    lastView = route.view;
  }

  function onSearchKey(e) {
    if (e.key !== "Enter") return;
    var q = e.target.value.trim();
    location.hash = "#/search?q=" + encodeURIComponent(q);
  }

  function start() {
    window.addEventListener("hashchange", render);
    Sortable.store.subscribe(render);
    var box = document.getElementById("search-box");
    if (box) box.addEventListener("keydown", onSearchKey);
    render();
  }

  Sortable.router = { start: start, render: render, parse: parse, routes: ROUTES };
})();
