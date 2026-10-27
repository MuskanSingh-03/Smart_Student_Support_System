/**
 * SmartEdu API Client
 * Everything runs on http://localhost:5000 — no CORS issues!
 */

const API_BASE = '/api';

// Current logged-in user (stored in sessionStorage)
function getCurrentUser() {
  const raw = sessionStorage.getItem('smartedu_user');
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { sessionStorage.removeItem('smartedu_user'); return null; }
}

function setCurrentUser(user) {
  sessionStorage.setItem('smartedu_user', JSON.stringify(user));
}

function clearCurrentUser() {
  sessionStorage.removeItem('smartedu_user');
}

function escapeApiText(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}

// Generic fetch wrapper
async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : {};
    if (res.status === 401 && !endpoint.startsWith('/login')) {
      sessionStorage.removeItem('smartedu_user');
      window.location.href = 'login.html';
      throw new Error(data.error || 'Your session expired. Please sign in again.');
    }
    if (!res.ok) throw new Error(data.error || 'API error');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── AUTH ───────────────────────────────────────────────────────────
const Auth = {
  async login(identifier, password) {
    const r = await apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    if (r.ok) setCurrentUser(r.data.user);
    return r;
  },

  async register(data) {
    return apiCall('/register', { method: 'POST', body: JSON.stringify(data) });
  },

  async logout() {
    try { await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    clearCurrentUser();
    window.location.href = 'login.html';
  }
};

// ─── DASHBOARD ──────────────────────────────────────────────────────
const Dashboard = {
  async get(studentId) {
    return apiCall(`/dashboard/${studentId}`);
  }
};

// ─── ATTENDANCE ─────────────────────────────────────────────────────
const Attendance = {
  async getByStudent(studentId) {
    return apiCall(`/attendance/${studentId}`);
  },
  async getLog(studentId) {
    return apiCall(`/attendance/log/${studentId}`);
  },
  async mark(data) {
    return apiCall('/attendance/mark', { method: 'POST', body: JSON.stringify(data) });
  },
  async getAtRisk() {
    return apiCall('/attendance/at-risk');
  }
};

// ─── GRADES ─────────────────────────────────────────────────────────
const Grades = {
  async getByStudent(studentId) {
    return apiCall(`/grades/${studentId}`);
  },
  async getClassSummary() {
    return apiCall('/grades/class-summary');
  }
};

// ─── RESOURCES ──────────────────────────────────────────────────────
const Resources = {
  async getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiCall(`/resources?${qs}`);
  },
  async download(id) {
    return apiCall(`/resources/${id}/download`, { method: 'POST' });
  },
  async add(data) {
    return apiCall('/resources', { method: 'POST', body: JSON.stringify(data) });
  }
};

// ─── NOTICES ────────────────────────────────────────────────────────
const Notices = {
  async getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiCall(`/notices?${qs}`);
  },
  async post(data) {
    return apiCall('/notices', { method: 'POST', body: JSON.stringify(data) });
  }
};

// ─── ASSIGNMENTS ────────────────────────────────────────────────────
const Assignments = {
  async getAll(studentId) {
    return apiCall(`/assignments?student_id=${studentId}`);
  },
  async submit(data) {
    return apiCall('/assignments/submit', { method: 'POST', body: JSON.stringify(data) });
  }
};

// ─── FACULTY ────────────────────────────────────────────────────────
const Faculty = {
  async getDashboard(facultyId) {
    return apiCall(`/faculty/dashboard/${facultyId}`);
  }
};

// ─── CHAT ───────────────────────────────────────────────────────────
const Chat = {
  async save(userId, message, response) {
    return apiCall('/chat', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message, response })
    });
  },
  async getHistory(userId) {
    return apiCall(`/chat/${userId}`);
  },
  async clear(userId) {
    return apiCall(`/chat/${userId}`, { method: 'DELETE' });
  }
};

// ─── STATS ──────────────────────────────────────────────────────────
const Stats = {
  async get() {
    return apiCall('/stats');
  }
};

const Admin = {
  async getUsers() { return apiCall('/users'); },
  async createUser(data) { return apiCall('/users', { method: 'POST', body: JSON.stringify(data) }); }
};

// ─── UI HELPERS ─────────────────────────────────────────────────────

/** Show a loading spinner inside a container */
function showLoader(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="spinner"></div></div>';
}

/** Render attendance subject cards from API data */
function renderAttendanceSubjects(subjects, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!subjects.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No attendance data found.</p>'; return; }

  el.innerHTML = subjects.map(s => {
    const pct = parseFloat(s.percentage);
    const cls = pct >= 75 ? 'att-good' : pct >= 70 ? 'att-warn' : 'att-danger';
    const barCls = pct >= 75 ? 'pf-green' : pct >= 70 ? 'pf-orange' : 'pf-danger';
    return `
      <div class="subject-item" data-searchable>
        <div class="subj-row">
          <div>
            <div class="subj-name">${s.subject_name}</div>
            <div style="font-size:0.78rem;color:var(--text-dim);">${s.code}</div>
          </div>
          <span class="subj-percent ${cls}">${pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${barCls}" style="width:${pct}%"></div></div>
        <div class="subj-details">
          <span>✅ ${s.present} attended</span>
          <span>❌ ${s.absent} missed</span>
          <span>📋 ${s.total} total</span>
          ${pct < 75 ? '<span style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i> AT RISK</span>' : ''}
        </div>
      </div>`;
  }).join('');
}

/** Render notice cards */
function renderNotices(notices, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!notices.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No notices found.</p>'; return; }

  const icons = { urgent: 'fa-exclamation-circle', exam: 'fa-edit', event: 'fa-calendar-star', info: 'fa-info-circle', finance: 'fa-money-bill-wave' };
  const niCls = { urgent: 'ni-danger', exam: 'ni-warning', event: 'ni-success', info: 'ni-blue', finance: 'ni-blue' };
  const badgeCls = { urgent: 'nb-urgent', exam: 'nb-exam', event: 'nb-event', info: 'nb-info', finance: 'nb-info' };

  el.innerHTML = notices.map(n => `
      <div class="notice-card" data-type="${escapeApiText(n.category)}" data-searchable>
      <div class="notice-icon ${niCls[n.category] || 'ni-blue'}">
        <i class="fas ${icons[n.category] || 'fa-bell'}"></i>
      </div>
      <div class="notice-content">
        <div class="notice-title">${escapeApiText(n.title)}</div>
        <div class="notice-desc">${escapeApiText(n.description)}</div>
        <div class="notice-meta">
          <span><i class="fas fa-user"></i> ${escapeApiText(n.posted_by_name || 'Admin')}</span>
          <span><i class="fas fa-clock"></i> ${timeAgo(n.created_at)}</span>
          <span><i class="fas fa-eye"></i> ${n.views} views</span>
        </div>
      </div>
      <span class="notice-badge ${badgeCls[n.category] || 'nb-info'}">${escapeApiText(n.category)}</span>
    </div>`).join('');
}

/** Render resource cards */
function renderResources(resources, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!resources.length) { el.innerHTML = '<p style="color:var(--text-muted);">No resources found.</p>'; return; }

  const iconMap = { pdf: 'ri-pdf fa-file-pdf', video: 'ri-video fa-play-circle', paper: 'ri-zip fa-scroll', lab: 'ri-doc fa-flask' };
  el.innerHTML = resources.map(r => {
    const [cls, icon] = (iconMap[r.file_type] || 'ri-doc fa-file').split(' ');
    return `
      <div class="resource-card" data-resource-id="${r.id}" data-subject="${escapeApiText(r.code || r.subject_name)}" data-type="${escapeApiText(r.file_type)}" data-searchable>
        <div class="res-icon ${cls}"><i class="fas ${icon}"></i></div>
        <div class="res-name">${escapeApiText(r.title)}</div>
        <div class="res-meta">
          <span><i class="fas fa-book"></i> ${escapeApiText(r.code || r.subject_name || '—')}</span>
          <span><i class="fas fa-user"></i> ${escapeApiText(r.faculty_name || '—')}</span>
          <span>${r.file_size || '—'}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--text-dim);">Downloaded ${r.downloads} times</div>
        <div style="display:flex;gap:8px;">
          <button class="res-download-btn" onclick="downloadStudyPdf(this)">
            <i class="fas fa-${r.file_type === 'video' ? 'play' : 'download'}"></i>
            ${r.file_type === 'video' ? 'Watch Now' : 'Download'}
          </button>
          <button onclick="this.style.color='#f59e0b';showToast('Bookmarked!','success')"
            style="background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:8px;padding:8px;cursor:pointer;color:var(--text-muted);">
            <i class="fas fa-bookmark"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

async function handleDownload(id, title) {
  const result = await Resources.download(id);
  if (result.ok) showToast(`Downloaded: ${title}`, 'success');
  else showToast(result.error || 'Download failed.', 'error');
}

/** Time-ago helper */
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 3600)   return Math.floor(diff/60) + ' min ago';
  if (diff < 86400)  return Math.floor(diff/3600) + ' hours ago';
  if (diff < 604800) return Math.floor(diff/86400) + ' days ago';
  return d.toLocaleDateString('en-IN');
}

/** Show API status banner if backend is offline */
async function checkBackendStatus() {
  const r = await apiCall('/health');
  if (!r.ok) {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:70px;left:0;right:0;background:#f59e0b;color:#000;text-align:center;padding:8px;font-size:0.85rem;font-weight:600;z-index:9999;';
    banner.innerHTML = '⚠️ Could not reach backend. Make sure <b>python app.py</b> is running, then refresh.';
    document.body.appendChild(banner);
  } else {
    console.log('✅ SmartEdu API connected:', r.data);
  }
}

// Auto-check backend on every page load
document.addEventListener('DOMContentLoaded', checkBackendStatus);

// Expose globals
window.Auth = Auth;
window.Dashboard = Dashboard;
window.Attendance = Attendance;
window.Grades = Grades;
window.Resources = Resources;
window.Notices = Notices;
window.Assignments = Assignments;
window.Faculty = Faculty;
window.Chat = Chat;
window.Stats = Stats;
window.renderAttendanceSubjects = renderAttendanceSubjects;
window.renderNotices = renderNotices;
window.renderResources = renderResources;
window.escapeApiText = escapeApiText;
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.handleDownload = handleDownload;
window.timeAgo = timeAgo;
