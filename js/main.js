// Warm pink, butter and lilac theme with a saved dark-mode preference.
(function initTheme() {
  let dark = false;
  try {
    dark = localStorage.getItem('smartedu_theme') === 'dark';
  } catch (_) {}
  document.documentElement.classList.toggle('theme-dark', dark);

  document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.toggle('theme-dark', dark);
    const navActions = document.querySelector('.nav-actions');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle' + (navActions ? '' : ' theme-toggle-floating');
    button.innerHTML = '<i aria-hidden="true"></i><span class="theme-toggle-label"></span>';
    button.addEventListener('click', function() {
      dark = !document.documentElement.classList.contains('theme-dark');
      document.documentElement.classList.toggle('theme-dark', dark);
      document.body.classList.toggle('theme-dark', dark);
      try { localStorage.setItem('smartedu_theme', dark ? 'dark' : 'light'); } catch (_) {}
      updateThemeToggle(button, dark);
    });
    updateThemeToggle(button, document.documentElement.classList.contains('theme-dark'));
    if (navActions) navActions.insertBefore(button, navActions.firstChild);
    else document.body.appendChild(button);
  });
})();

function updateThemeToggle(button, dark) {
  const icon = button.querySelector('i');
  const label = button.querySelector('.theme-toggle-label');
  icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
  label.textContent = dark ? 'Light' : 'Dark';
  button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  button.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
}

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
  if (user) {
    if (page === 'admin.html' && user.role !== 'admin') {
      window.location.href = user.role === 'faculty' ? 'faculty.html' : 'dashboard.html';
      return;
    }
    if (page === 'faculty.html' && !['faculty', 'admin'].includes(user.role)) {
      window.location.href = 'dashboard.html';
      return;
    }
    if (user.role === 'admin' && !['admin.html', 'login.html', 'index.html', ''].includes(page)) {
      window.location.href = 'admin.html';
      return;
    }
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

async function doLogout() {
  try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
  sessionStorage.removeItem('smartedu_user');
  window.location.href = 'login.html';
}

function downloadStudyPdf(button) {
  const card = button.closest('.resource-card');
  if (!card) return;
  const title = card.querySelector('.res-name')?.textContent.trim() || 'Study Notes';
  const subject = card.dataset.subject || 'General';
  const faculty = card.querySelector('.res-meta span:nth-child(2)')?.textContent.trim() || '';
  const notes = studyNotesFor(subject, title);
  const lines = [
    `Subject: ${subject}`,
    faculty.startsWith('Prof.') ? `Prepared by: ${faculty}` : '',
    '',
    ...notes
  ].filter((line, index) => line || index > 1);
  const pdf = makeStudyPdf(title, lines);
  const blobUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 72) || 'study_notes'}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

  const resourceId = card.dataset.resourceId;
  if (resourceId && typeof Resources !== 'undefined') Resources.download(resourceId).catch(() => {});
  if (typeof showToast === 'function') showToast('Your PDF study sheet is downloading.', 'success');
}

function downloadPageReport(title, source = document.querySelector('.main-content')) {
  if (!source) return;
  const lines = [];
  source.querySelectorAll('.page-header h1, .page-header p, .stat-card, .data-table tr, .subject-item, .alert-banner')
    .forEach(element => {
      const value = element.innerText.replace(/\s+/g, ' ').trim();
      if (value) lines.push(value);
    });
  if (!lines.length) lines.push('No report data is currently available.');
  const pdf = makeStudyPdf(title, lines.slice(0, 31));
  const blobUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  showToast(`${title} PDF downloaded.`, 'success');
}

function studyNotesFor(subject, title) {
  const key = (subject + ' ' + title).toLowerCase();
  if (/paper|question/.test(key)) return [
    'Previous Year Paper Revision Plan',
    '- Attempt one paper under timed conditions before checking the solutions.',
    '- Mark each question by topic and note which concepts need another review.',
    '- Rework incorrect answers without looking at the solution, then compare your steps.',
    '- Review formulas, definitions, and common problem patterns from the relevant subject.',
    '- Leave time to check units, assumptions, and the final answer.'
  ];
  if (/dsa|tree|graph/.test(key)) return [
    'Trees and Graphs',
    '- A tree is a connected structure with no cycles. A binary tree gives each node at most two children.',
    '- Common traversals are preorder (root-left-right), inorder (left-root-right), and postorder (left-right-root).',
    '- A binary search tree keeps smaller keys on the left and larger keys on the right; balanced trees keep operations efficient.',
    '- A graph models vertices and edges. Store it as an adjacency list for sparse graphs or a matrix for dense graphs.',
    '- BFS explores level by level with a queue. DFS explores a path with a stack or recursion.',
    '- Dijkstra finds shortest paths when edge weights are non-negative; use a visited set to avoid repeated work.'
  ];
  if (/dbms/.test(key) && /normal|functional|dependenc/.test(key)) return [
    'Normalization and Functional Dependencies',
    '- A functional dependency X -> Y means each value of X determines exactly one value of Y.',
    '- 1NF requires atomic values. 2NF removes partial dependency on part of a composite key.',
    '- 3NF removes transitive dependencies on a key; BCNF requires every determinant to be a candidate key.',
    '- Normalization reduces duplicate data and insert, update, and delete anomalies.',
    '- Identify candidate keys and dependencies first, then decompose while preserving information and dependencies.'
  ];
  if (/dbms|sql/.test(key)) return [
    'SQL Queries and Stored Procedures',
    '- SELECT chooses columns; WHERE filters rows; GROUP BY forms groups; HAVING filters grouped results.',
    '- JOIN combines related tables. Use explicit join conditions and select only the columns needed.',
    '- Aggregate functions include COUNT, SUM, AVG, MIN, and MAX.',
    '- A transaction groups changes: COMMIT saves them and ROLLBACK undoes uncommitted work.',
    '- Indexes can speed up lookups, while adding overhead to inserts and updates.',
    '- Stored procedures keep reusable SQL logic on the database server.'
  ];
  if (/cn|network|tcp|subnet|osi/.test(key)) return [
    'Computer Networks: OSI, TCP/IP, and Subnetting',
    '- The OSI layers are Physical, Data Link, Network, Transport, Session, Presentation, and Application.',
    '- TCP/IP groups networking into Link, Internet, Transport, and Application layers.',
    '- Routers forward IP packets; switches forward frames within a local network.',
    '- TCP provides ordered, reliable delivery. UDP has lower overhead and does not guarantee delivery.',
    '- For an IPv4 subnet with h host bits, the usual usable host count is 2^h - 2.',
    '- Subnet masks separate network bits from host bits; CIDR notation gives the prefix length.'
  ];
  if (/operating system|(^|[^a-z])os([^a-z]|$)|shell|system call/.test(key)) return [
    'Operating Systems: Processes and Memory',
    '- A process moves through states such as ready, running, waiting, and terminated.',
    '- FCFS, shortest-job-first, priority, and round-robin are common CPU scheduling methods.',
    '- Round-robin assigns each ready process a time quantum; a shorter quantum improves response but increases context switches.',
    '- Paging divides memory into fixed-size pages and frames. A page fault loads a missing page from storage.',
    '- Virtual memory lets programs use an address space larger than physical memory.',
    '- Shell scripts automate commands; quote variables to preserve spaces and special characters.'
  ];
  if (/software engineering|(^|[^a-z])se([^a-z]|$)|agile|scrum|sdlc|uml/.test(key)) return [
    'Software Engineering: Agile and SDLC',
    '- A typical SDLC includes requirements, design, implementation, testing, deployment, and maintenance.',
    '- Agile delivers work in small increments and uses feedback to adjust priorities.',
    '- Scrum roles include Product Owner, Scrum Master, and Developers.',
    '- A sprint is a time-boxed iteration. Planning, daily scrum, review, and retrospective support the cycle.',
    '- The product backlog lists work; the sprint backlog holds the team\'s selected sprint work.',
    '- UML diagrams communicate structure and behavior before or during implementation.'
  ];
  return [
    'Focused Revision',
    '- Review the core ideas covered by ' + title + '.',
    '- Write key terms in your own words and connect each one to an example.',
    '- Practice a question without notes, then check your reasoning.',
    '- Record unclear points to revisit with your instructor or study group.'
  ];
}
function makeStudyPdf(title, lines) {
  const clean = value => String(value).normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrap = (text, width) => {
    const words = clean(text).split(/\s+/);
    const rows = [];
    let row = '';
    words.forEach(word => {
      if (row && `${row} ${word}`.length > width) { rows.push(row); row = word; }
      else row = row ? `${row} ${word}` : word;
    });
    if (row) rows.push(row);
    return rows;
  };
  const titleRows = wrap(title, 48);
  const contentRows = lines.flatMap(line => line ? wrap(line, 88) : ['']).slice(0, 31);
  let commands = `BT /F1 18 Tf 54 748 Td (${titleRows[0] || 'Study Notes'}) Tj`;
  titleRows.slice(1).forEach(row => { commands += ` 0 -24 Td (${row}) Tj`; });
  commands += ` ET\n0.7 w 54 700 m 558 700 l S\nBT /F1 10 Tf 54 682 Td (SmartEdu - ${clean('Study Notes')}) Tj ET`;
  let y = 650;
  commands += '\nBT /F1 11 Tf';
  contentRows.forEach(row => {
    commands += ` 1 0 0 1 54 ${y} Tm (${row}) Tj`;
    y -= 17;
  });
  commands += ` ET\n0.5 w 54 48 m 558 48 l S\nBT /F1 9 Tf 54 32 Td (SmartEdu Study Sheet) Tj ET`;

  const stream = `${commands}\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

document.addEventListener('click', function(event) {
  const button = event.target.closest('.resource-card .res-download-btn');
  if (!button || button.closest('.resource-card')?.dataset.type === 'video') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  downloadStudyPdf(button);
}, true);

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
window.downloadStudyPdf = downloadStudyPdf;
window.downloadPageReport = downloadPageReport;
