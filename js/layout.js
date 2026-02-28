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
}
