(function(){
    const btn = document.getElementById('mobile-menu-btn');
    const backdrop = document.getElementById('sidebar-backdrop');
    const sidebar = document.querySelector('.sidebar');
    function openSidebar() {
        document.body.classList.add('sidebar-open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (backdrop) backdrop.setAttribute('aria-hidden', 'false');
        if (sidebar) sidebar.setAttribute('aria-hidden', 'false');
        // focus first nav link for keyboard users
        const first = document.querySelector('.nav-link');
        if (first) first.focus();
    }
    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
        if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
        if (btn) btn.focus();
    }
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', 'sidebar');
        btn.addEventListener('click', () => { if (document.body.classList.contains('sidebar-open')) closeSidebar(); else openSidebar(); });
    }
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
    // close after clicking a nav link to reveal main content
    document.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', () => { closeSidebar(); }));
    // set initial aria-hidden on sidebar
    if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
})();
