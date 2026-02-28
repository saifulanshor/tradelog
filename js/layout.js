// layout.js
// Helper for loading common page components (sidebar, header, footer)

async function loadPartial(path, elementId) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    const html = await res.text();
    document.getElementById(elementId).innerHTML = html;
  } catch (err) {
    console.error('loadPartial error', err);
  }
}

// call this from each page after DOM ready
async function applyLayout() {
  await loadPartial('../partials/sidebar.html', 'sidebar-container');
  // mark active nav item based on current filename
  try {
    const current = window.location.pathname.split('/').pop();
    const link = document.querySelector(`.sidebar .nav-item[href$="${current}"]`);
    if (link) link.classList.add('active');
  } catch (e) {
    console.warn('could not set active nav', e);
  }
  // add a mobile toggle button (hamburger) that shows/hides sidebar
  setupMobileMenu();
}

function setupMobileMenu() {
  if (document.getElementById('mobile-menu-btn')) return; // only once
  const btn = document.createElement('button');
  btn.id = 'mobile-menu-btn';
  btn.className = 'mobile-menu-btn';
  btn.textContent = '☰';
  btn.addEventListener('click', () => {
    const sb = document.querySelector('.sidebar');
    if (sb) sb.classList.toggle('open');
  });
  document.body.appendChild(btn);

  // close sidebar when a link is tapped (mobile)
  document.addEventListener('click', e => {
    if (!e.target.matches('.sidebar .nav-item')) return;
    const sb = document.querySelector('.sidebar');
    if (sb && sb.classList.contains('open')) sb.classList.remove('open');
  });
}
