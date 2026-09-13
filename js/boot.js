/** Non-module bootstrap: sidebar toggle + works on file:// */
(function () {
  function toggleSidebar() {
    const main = document.getElementById("main-layout");
    if (!main) return;
    const willCollapse = !main.classList.contains("sidebar-collapsed");
    main.classList.toggle("sidebar-collapsed", willCollapse);
    const btn = document.getElementById("sidebar-toggle");
    if (btn) {
      btn.textContent = willCollapse ? "▶ Show panel" : "◀ Hide panel";
      btn.setAttribute("aria-expanded", willCollapse ? "false" : "true");
    }
  }

  window.toggleSidebar = toggleSidebar;
})();
