// Boot: init the store, then start the router. Owner: Shell.
document.addEventListener("DOMContentLoaded", function () {
  Sortable.store.init();
  Sortable.router.start();
});
