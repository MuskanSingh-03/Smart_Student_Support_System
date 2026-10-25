// ===== AUTH GUARD & USERNAME =====
(function() {
  const publicPages = ['index.html', 'login.html', 'register.html', ''];
  const page = window.location.pathname.split('/').pop();

  // Get user from sessionStorage
  const raw = sessionStorage.getItem('smartedu_user');
  let user = null;
  if (raw) {
    try { user = JSON.parse(raw); }
    catch { sessionStorage.removeItem('smartedu_user'); }
  }

  // Redirect to login if accessing protected page without login
  if (!publicPages.includes(page) && !user) {
    window.location.href = 'login.html';
    return;
  }

  // After DOM loads, inject username into navbar
  document.addEventListener('DOMContentLoaded', function() {
    if (!user) return;

    const safeName = String(user.name || 'Student');
    const firstName = safeName.trim().split(/\s+/)[0];
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = safeName; });
    document.querySelectorAll('[data-user-first-name]').forEach(el => { el.textContent = firstName; });

    // Update navbar user button
    const userBtn = document.getElementById('navUserBtn');
    if (userBtn) {
      const initials = safeName.split(' ').map(n => n[0]).join('').toUpperCase();
      userBtn.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;cursor:pointer;position:relative;" onclick="toggleUserMenu()">
          <div style="width:32px;height:32px;background:var(--gradient);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;color:#fff;flex-shrink:0;">${escapeUserText(initials)}</div>
          <span style="font-size:0.88rem;font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeUserText(firstName)}</span>
          <i class="fas fa-chevron-down" style="font-size:0.7rem;color:var(--text-muted);"></i>
        </div>
        <div id="userDropdown" style="display:none;position:absolute;top:52px;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:8px;min-width:200px;box-shadow:var(--shadow);z-index:999;">
          <div style="padding:10px 12px;border-bottom:1px solid var(--border);margin-bottom:6px;">
            <div style="font-weight:700;font-size:0.9rem;">${escapeUserText(safeName)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${escapeUserText(user.email || '')}</div>
            <div style="font-size:0.75rem;color:var(--primary);margin-top:2px;text-transform:capitalize;">${user.role} ${user.roll_no ? '· ' + user.roll_no : ''}</div>
          </div>
          <a href="dashboard.html" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;color:var(--text-muted);font-size:0.87rem;transition:var(--transition);" onmouseover="this.style.background='rgba(99,102,241,0.1)'" onmouseout="this.style.background='none'"><i class="fas fa-home" style="width:16px;"></i> Dashboard</a>
          <a href="#" onclick="doLogout()" style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;color:#f87171;font-size:0.87rem;transition:var(--transition);" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='none'"><i class="fas fa-sign-out-alt" style="width:16px;"></i> Logout</a>
        </div>`;
      userBtn.style.position = 'relative';
    }
  });
})();

function escapeUserText(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}

function toggleUserMenu() {
  const d = document.getElementById('userDropdown');
  if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
}

function doLogout() {
  sessionStorage.removeItem('smartedu_user');
  showToast('Logged out successfully!', 'info');
  setTimeout(() => window.location.href = 'login.html', 800);
}

// Close dropdown on outside click
document.addEventListener('click', function(e) {
  const dd = document.getElementById('userDropdown');
  const btn = document.getElementById('navUserBtn');
  if (dd && btn && !btn.contains(e.target)) dd.style.display = 'none';
});


const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ===== HAMBURGER MENU =====
function toggleMenu() {
  const links = document.getElementById('navLinks');
  const sidebar = document.querySelector('.sidebar');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // On mobile: toggle full-screen nav links
    if (links) links.classList.toggle('open');
    // Also toggle hamburger X animation
    const ham = document.getElementById('hamburger');
    if (ham) ham.classList.toggle('open');
  } else {
    // On tablet: toggle sidebar with overlay
    if (sidebar) {
      sidebar.classList.toggle('open');
      toggleOverlay(sidebar.classList.contains('open'));
    }
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  toggleOverlay(sidebar.classList.contains('open'));
}

function toggleOverlay(show) {
  let overlay = document.getElementById('sidebarOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = () => { toggleSidebar(); };
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active', show);
}

// Close nav on outside click (mobile)
document.addEventListener('click', function(e) {
  const links = document.getElementById('navLinks');
  const ham = document.getElementById('hamburger');
  if (links && links.classList.contains('open')) {
    if (!links.contains(e.target) && ham && !ham.contains(e.target)) {
      links.classList.remove('open');
      if (ham) ham.classList.remove('open');
    }
  }
});

// ===== COUNTER ANIMATION =====
function animateCounter(el) {
  const target = +el.dataset.target;
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString();
    if (current >= target) clearInterval(timer);
  }, 16);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-num').forEach(el => counterObserver.observe(el));

// ===== SCROLL ANIMATIONS =====
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .step, .testimonial-card, .sdg-ico').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'all 0.6s cubic-bezier(0.4,0,0.2,1)';
  fadeObserver.observe(el);
});

// ===== ACTIVE NAV LINK =====
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-link').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage) link.classList.add('active');
});

// ===== PROGRESS BAR ANIMATION =====
const progObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const fill = e.target;
      const target = fill.dataset.width;
      fill.style.width = target + '%';
      progObserver.unobserve(fill);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.progress-fill').forEach(el => {
  const w = parseInt(el.style.width) || 0;
  el.dataset.width = w;
  el.style.width = '0%';
  progObserver.observe(el);
});

// ===== MINI CALENDAR =====
function renderCalendar(containerId) {
  const cal = document.getElementById(containerId);
  if (!cal) return;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let date = new Date();
  let year = date.getFullYear();
  let month = date.getMonth();
  const events = [3, 7, 12, 15, 20, 25];

  function render() {
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    cal.innerHTML = `
      <div class="cal-header">
        <button class="cal-nav" id="prevMonth"><i class="fas fa-chevron-left"></i></button>
        <span class="cal-month">${monthNames[month]} ${year}</span>
        <button class="cal-nav" id="nextMonth"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="cal-grid">
        ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div class="cal-day-header">${d}</div>`).join('')}
        ${Array(first).fill('<div class="cal-day empty">.</div>').join('')}
        ${Array.from({length: days}, (_,i) => {
          const d = i + 1;
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasEv = events.includes(d);
          return `<div class="cal-day ${isToday ? 'today' : ''} ${hasEv && !isToday ? 'has-event' : ''}">${d}</div>`;
        }).join('')}
      </div>`;
    document.getElementById('prevMonth')?.addEventListener('click', () => { month--; if(month<0){month=11;year--;} render(); });
    document.getElementById('nextMonth')?.addEventListener('click', () => { month++; if(month>11){month=0;year++;} render(); });
  }
  render();
}

renderCalendar('miniCalendar');

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const parent = tab.closest('.tabs');
    parent?.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// ===== TOAST NOTIFICATION =====
function showToast(msg, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  const colors = { success: '#10b981', error: '#ef4444', info: '#6366f1', warning: '#f59e0b' };
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-circle' };
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:${colors[type]};color:#fff;padding:14px 20px;border-radius:12px;font-size:0.9rem;font-weight:500;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.4);max-width:320px;display:flex;align-items:center;gap:10px;animation:toastIn 0.3s ease;`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`;
  const style = document.createElement('style');
  style.textContent = '@keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
  document.head.appendChild(style);
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateX(100%)'; toast.style.transition='all 0.3s'; setTimeout(()=>toast.remove(),300); }, 4000);
}

// ===== SEARCH FILTER =====
const searchInput = document.querySelector('.search-bar input');
if (searchInput) {
  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    document.querySelectorAll('[data-searchable]').forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
  });
}

// ===== HAMBURGER ANIMATION CSS =====
const hamStyle = document.createElement('style');
hamStyle.textContent = `
  .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
  .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
  .hamburger span { transition: all 0.3s ease; }
`;
document.head.appendChild(hamStyle);

// ===== INJECT MOBILE BOTTOM NAV (inner pages only) =====
document.addEventListener('DOMContentLoaded', function() {
  const hasSidebar = document.querySelector('.sidebar');
  if (!hasSidebar) return; // only on inner pages

  const currentHref = window.location.pathname.split('/').pop();
  const navItems = [
    { href: 'dashboard.html',  icon: 'fa-home',           label: 'Home'      },
    { href: 'chatbot.html',    icon: 'fa-robot',          label: 'AI Chat'   },
    { href: 'attendance.html', icon: 'fa-calendar-check', label: 'Attendance'},
    { href: 'resources.html',  icon: 'fa-book-open',      label: 'Resources' },
    { href: 'notices.html',    icon: 'fa-bell',           label: 'Notices'   },
  ];

  const nav = document.createElement('nav');
  nav.className = 'mobile-nav';
  nav.innerHTML = '<div class="mobile-nav-inner">' +
    navItems.map(item => `
      <a href="${item.href}" class="mobile-nav-item ${item.href === currentHref ? 'active' : ''}">
        <i class="fas ${item.icon}"></i>
        <span>${item.label}</span>
      </a>`).join('') +
  '</div>';
  document.body.appendChild(nav);

  // Add sidebar toggle button to hamburger area on tablet
  const ham = document.getElementById('hamburger');
  if (ham) {
    ham.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

// Expose globals
window.showToast    = showToast;
window.toggleMenu   = toggleMenu;
window.toggleSidebar = toggleSidebar;
window.doLogout     = doLogout;
window.toggleUserMenu = toggleUserMenu;
