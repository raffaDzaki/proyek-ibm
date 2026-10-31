/**
 * script.js — Onboarding Buddy System
 *
 * Structure:
 *  1. Constants & initial seed data
 *  2. State management (load/save localStorage)
 *  3. Utility functions
 *  4. Toast notification
 *  5. Dashboard render
 *  6. Buddy CRUD + render
 *  7. Task CRUD + render
 *  8. Modal helpers
 *  9. Event handlers (delegated)
 * 10. Initialisation
 */

'use strict';

/* ============================================================
   1. CONSTANTS & SEED DATA
   ============================================================ */

const STORAGE_KEY_BUDDIES = 'obs_buddies';
const STORAGE_KEY_TASKS   = 'obs_tasks';

/** Category → badge CSS class mapping */
const CATEGORY_BADGE = {
  'Administrasi': 'badge-admin',
  'Teknis':       'badge-teknis',
  'Sosial':       'badge-sosial',
  'Budaya':       'badge-budaya',
};

/** Seed buddies shown on first load */
const SEED_BUDDIES = [
  {
    id: 'b1',
    name: 'Rina Kusuma',
    department: 'Human Resources',
    skills: 'Komunikasi, Orientasi Karyawan',
    status: 'Available',
  },
  {
    id: 'b2',
    name: 'Dito Pratama',
    department: 'Engineering',
    skills: 'JavaScript, System Design',
    status: 'Busy',
  },
  {
    id: 'b3',
    name: 'Sari Wulandari',
    department: 'Finance',
    skills: 'Akuntansi, SAP, Laporan Keuangan',
    status: 'Available',
  },
];

/** Seed tasks shown on first load */
const SEED_TASKS = [
  {
    id: 't1',
    title: 'Penandatanganan Kontrak',
    description: 'Menyelesaikan semua dokumen kontrak kerja dan NDA dengan HR.',
    category: 'Administrasi',
    buddyId: 'b1',
    completed: true,
  },
  {
    id: 't2',
    title: 'Setup Lingkungan Pengembangan',
    description: 'Instalasi tools, akses repo, dan konfigurasi VPN.',
    category: 'Teknis',
    buddyId: 'b2',
    completed: false,
  },
  {
    id: 't3',
    title: 'Kenalan dengan Tim',
    description: 'Sesi virtual/fisik untuk memperkenalkan diri ke seluruh tim.',
    category: 'Sosial',
    buddyId: 'b1',
    completed: false,
  },
  {
    id: 't4',
    title: 'Pahami Nilai & Budaya Perusahaan',
    description: 'Baca handbook perusahaan dan ikuti sesi culture briefing.',
    category: 'Budaya',
    buddyId: 'b3',
    completed: false,
  },
];

/* ============================================================
   2. STATE MANAGEMENT
   ============================================================ */

/** Application state */
const state = {
  buddies: [],   // Array<{id, name, department, skills, status}>
  tasks: [],     // Array<{id, title, description, category, buddyId, completed}>
  activeTab: 'dashboard',
  taskFilter: 'all',    // 'all' | 'active' | 'completed'
  buddySearch: '',
  taskSearch: '',
  editBuddyId: null,    // null or id of buddy being edited
  editTaskId: null,     // null or id of task being edited
};

/** Load data from localStorage (falls back to seed data on first visit) */
function loadState() {
  const rawBuddies = localStorage.getItem(STORAGE_KEY_BUDDIES);
  const rawTasks   = localStorage.getItem(STORAGE_KEY_TASKS);
  state.buddies = rawBuddies ? JSON.parse(rawBuddies) : [...SEED_BUDDIES];
  state.tasks   = rawTasks   ? JSON.parse(rawTasks)   : [...SEED_TASKS];
}

/** Persist current state to localStorage */
function saveState() {
  localStorage.setItem(STORAGE_KEY_BUDDIES, JSON.stringify(state.buddies));
  localStorage.setItem(STORAGE_KEY_TASKS,   JSON.stringify(state.tasks));
}

/* ============================================================
   3. UTILITY FUNCTIONS
   ============================================================ */

/**
 * Generate a lightweight unique ID.
 * @returns {string}
 */
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Get initials from a full name (up to 2 chars).
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Find a buddy by id; returns undefined if not found.
 * @param {string} buddyId
 * @returns {object|undefined}
 */
function findBuddy(buddyId) {
  return state.buddies.find(b => b.id === buddyId);
}

/**
 * Sanitise a string to avoid XSS when injecting into innerHTML.
 * Replaces <, >, &, " characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Return the badge CSS class for a given category.
 * @param {string} category
 * @returns {string}
 */
function getCategoryBadgeClass(category) {
  return CATEGORY_BADGE[category] ?? 'badge-lainnya';
}

/* ============================================================
   4. TOAST NOTIFICATION
   ============================================================ */

let toastTimer = null;

/**
 * Show a toast message for a given duration.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration  milliseconds
 */
function showToast(message, type = 'success', duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;

  // Clear any existing timer
  clearTimeout(toastTimer);
  el.className = `toast toast-${type}`;
  el.textContent = message;
  el.classList.remove('hidden');

  // Auto-hide
  toastTimer = setTimeout(() => {
    el.classList.add('toast-hide');
    // Remove after animation ends
    setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('toast-hide');
    }, 320);
  }, duration);
}

/* ============================================================
   5. DASHBOARD RENDER
   ============================================================ */

/** Re-render all dashboard summary cards, progress bar, and recent tasks. */
function renderDashboard() {
  const totalBuddies  = state.buddies.length;
  const totalTasks    = state.tasks.length;
  const completedTasks = state.tasks.filter(t => t.completed).length;
  const activeTasks   = totalTasks - completedTasks;
  const percent       = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ── Summary cards ──────────────────────────────────────
  const cardsContainer = document.getElementById('summary-cards');
  if (cardsContainer) {
    cardsContainer.innerHTML = buildSummaryCardHTML('👥', 'Total Buddy', totalBuddies, 'bg-blue-50')
      + buildSummaryCardHTML('✅', 'Task Selesai', completedTasks, 'bg-green-50')
      + buildSummaryCardHTML('⏳', 'Task Aktif', activeTasks, 'bg-orange-50')
      + buildSummaryCardHTML('📋', 'Total Task', totalTasks, 'bg-purple-50');
  }

  // ── Progress bar ──────────────────────────────────────
  const bar   = document.getElementById('progress-bar');
  const label = document.getElementById('progress-label');
  const sub   = document.getElementById('progress-sub');
  if (bar)   bar.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}%`;
  if (sub)   sub.textContent = totalTasks > 0
    ? `${completedTasks} dari ${totalTasks} task telah diselesaikan.`
    : 'Belum ada task yang ditambahkan.';

  // ── Recent tasks (last 5) ─────────────────────────────
  const listEl = document.getElementById('recent-tasks');
  if (!listEl) return;

  if (state.tasks.length === 0) {
    listEl.innerHTML = '<li class="text-slate-400 italic">Belum ada task.</li>';
    return;
  }

  const recent = [...state.tasks].slice(-5).reverse();
  listEl.innerHTML = recent.map(t => {
    const statusIcon = t.completed ? '✅' : '⏳';
    const buddy = findBuddy(t.buddyId);
    return `
      <li class="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
        <span class="text-base mt-0.5">${statusIcon}</span>
        <div>
          <p class="font-medium text-slate-700 ${t.completed ? 'line-through text-slate-400' : ''}">${escapeHtml(t.title)}</p>
          <p class="text-xs text-slate-400">${escapeHtml(t.category)} • ${buddy ? escapeHtml(buddy.name) : 'Tidak ada buddy'}</p>
        </div>
      </li>`;
  }).join('');
}

/**
 * Build the HTML for a single summary card.
 * @param {string} icon
 * @param {string} label
 * @param {number} value
 * @param {string} iconBg  Tailwind bg class
 * @returns {string}
 */
function buildSummaryCardHTML(icon, label, value, iconBg) {
  return `
    <div class="summary-card">
      <div class="card-icon ${iconBg}">${icon}</div>
      <div>
        <p class="card-value text-slate-800">${value}</p>
        <p class="card-label">${label}</p>
      </div>
    </div>`;
}

/* ============================================================
   6. BUDDY CRUD + RENDER
   ============================================================ */

/** Render buddy cards according to current search query. */
function renderBuddies() {
  const container = document.getElementById('buddy-list');
  if (!container) return;

  const query = state.buddySearch.toLowerCase().trim();

  // Filter by name or skills
  const filtered = state.buddies.filter(b =>
    b.name.toLowerCase().includes(query) ||
    b.skills.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state col-span-full">
        <div class="empty-icon">🔍</div>
        <p>${query ? 'Tidak ada buddy yang cocok.' : 'Belum ada buddy. Tambahkan buddy baru!'}</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(buddy => buildBuddyCardHTML(buddy)).join('');
}

/**
 * Build buddy card HTML.
 * @param {object} buddy
 * @returns {string}
 */
function buildBuddyCardHTML(buddy) {
  const statusClass = buddy.status === 'Available' ? 'badge-available' : 'badge-busy';
  const statusLabel = buddy.status === 'Available' ? '🟢 Available' : '🟡 Busy';
  const initials    = getInitials(buddy.name);

  return `
    <article class="buddy-card" data-buddy-id="${buddy.id}">
      <div class="flex items-center gap-3">
        <div class="buddy-avatar">${escapeHtml(initials)}</div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800 truncate">${escapeHtml(buddy.name)}</p>
          <p class="text-xs text-slate-500 truncate">${escapeHtml(buddy.department)}</p>
        </div>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <div>
        <p class="text-xs text-slate-500 font-medium mb-1">Keahlian</p>
        <p class="text-sm text-slate-700">${escapeHtml(buddy.skills)}</p>
      </div>
      <div class="flex gap-2 mt-1">
        <button class="btn-secondary btn-edit-buddy" data-id="${buddy.id}" aria-label="Edit ${escapeHtml(buddy.name)}">
          ✏️ Edit
        </button>
        <button class="btn-danger btn-delete-buddy" data-id="${buddy.id}" aria-label="Hapus ${escapeHtml(buddy.name)}">
          🗑️ Hapus
        </button>
      </div>
    </article>`;
}

/**
 * Add a new buddy to state.
 * @param {{name, department, skills, status}} data
 */
function addBuddy(data) {
  const buddy = { id: generateId(), ...data };
  state.buddies.push(buddy);
  saveState();
  renderBuddies();
  renderDashboard();
  showToast(`Buddy "${buddy.name}" berhasil ditambahkan.`, 'success');
}

/**
 * Update an existing buddy in state.
 * @param {string} id
 * @param {{name, department, skills, status}} data
 */
function updateBuddy(id, data) {
  const idx = state.buddies.findIndex(b => b.id === id);
  if (idx === -1) return;
  state.buddies[idx] = { ...state.buddies[idx], ...data };
  saveState();
  renderBuddies();
  renderDashboard();
  renderTasks(); // tasks display buddy name, so re-render them too
  showToast(`Buddy "${data.name}" berhasil diperbarui.`, 'success');
}

/**
 * Delete a buddy and unassign from related tasks.
 * @param {string} id
 */
function deleteBuddy(id) {
  const buddy = findBuddy(id);
  if (!buddy) return;

  const confirmed = window.confirm(`Hapus buddy "${buddy.name}"? Task yang terassign ke buddy ini akan kehilangan assignee.`);
  if (!confirmed) return;

  // Unassign buddy from tasks
  state.tasks = state.tasks.map(t => t.buddyId === id ? { ...t, buddyId: '' } : t);
  state.buddies = state.buddies.filter(b => b.id !== id);
  saveState();
  renderBuddies();
  renderTasks();
  renderDashboard();
  showToast(`Buddy "${buddy.name}" berhasil dihapus.`, 'info');
}

/* ============================================================
   7. TASK CRUD + RENDER
   ============================================================ */

/** Render task cards according to current filter and search query. */
function renderTasks() {
  const container = document.getElementById('task-list');
  if (!container) return;

  const query  = state.taskSearch.toLowerCase().trim();
  const filter = state.taskFilter;

  let filtered = state.tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(query);
    const matchesFilter =
      filter === 'all'       ? true :
      filter === 'active'    ? !t.completed :
      filter === 'completed' ? t.completed : true;
    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>${query ? 'Tidak ada task yang cocok.' : 'Belum ada task. Tambahkan task baru!'}</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(task => buildTaskCardHTML(task)).join('');
}

/**
 * Build task card HTML.
 * @param {object} task
 * @returns {string}
 */
function buildTaskCardHTML(task) {
  const buddy       = findBuddy(task.buddyId);
  const buddyName   = buddy ? escapeHtml(buddy.name) : '<em>Tidak ada buddy</em>';
  const catClass    = getCategoryBadgeClass(task.category);
  const checkClass  = task.completed ? 'checked' : '';
  const cardClass   = task.completed ? 'task-card completed' : 'task-card';

  return `
    <article class="${cardClass}" data-task-id="${task.id}">
      <!-- Toggle checkbox -->
      <button class="task-checkbox ${checkClass} btn-toggle-task"
        data-id="${task.id}"
        aria-label="${task.completed ? 'Tandai belum selesai' : 'Tandai selesai'}"
        title="${task.completed ? 'Klik untuk aktifkan kembali' : 'Klik untuk selesaikan'}">
      </button>

      <!-- Task info -->
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <p class="task-title font-semibold text-slate-800">${escapeHtml(task.title)}</p>
          <span class="badge ${catClass}">${escapeHtml(task.category)}</span>
        </div>
        <p class="text-sm text-slate-500 mb-2">${escapeHtml(task.description)}</p>
        <p class="text-xs text-slate-400">
          👤 <span class="font-medium text-slate-600">${buddyName}</span>
        </p>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-1.5 shrink-0">
        <button class="btn-secondary btn-edit-task" data-id="${task.id}" aria-label="Edit task">
          ✏️ Edit
        </button>
        <button class="btn-danger btn-delete-task" data-id="${task.id}" aria-label="Hapus task">
          🗑️ Hapus
        </button>
      </div>
    </article>`;
}

/**
 * Add a new task to state.
 * @param {{title, description, category, buddyId}} data
 */
function addTask(data) {
  const task = { id: generateId(), ...data, completed: false };
  state.tasks.push(task);
  saveState();
  renderTasks();
  renderDashboard();
  showToast(`Task "${task.title}" berhasil ditambahkan.`, 'success');
}

/**
 * Update an existing task in state.
 * @param {string} id
 * @param {{title, description, category, buddyId}} data
 */
function updateTask(id, data) {
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  state.tasks[idx] = { ...state.tasks[idx], ...data };
  saveState();
  renderTasks();
  renderDashboard();
  showToast(`Task "${data.title}" berhasil diperbarui.`, 'success');
}

/**
 * Toggle the completed status of a task.
 * @param {string} id
 */
function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveState();
  renderTasks();
  renderDashboard();
  showToast(
    task.completed ? `"${task.title}" ditandai selesai! 🎉` : `"${task.title}" diaktifkan kembali.`,
    task.completed ? 'success' : 'info'
  );
}

/**
 * Delete a task from state.
 * @param {string} id
 */
function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const confirmed = window.confirm(`Hapus task "${task.title}"?`);
  if (!confirmed) return;

  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  renderTasks();
  renderDashboard();
  showToast(`Task "${task.title}" berhasil dihapus.`, 'info');
}

/* ============================================================
   8. MODAL HELPERS
   ============================================================ */

/** Open the modal with a given title and body HTML. */
function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
  // Focus first input for accessibility
  setTimeout(() => {
    const firstInput = overlay.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }, 50);
}

/** Close the modal and reset edit state. */
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
  state.editBuddyId = null;
  state.editTaskId  = null;
}

/* ────────────────────────────────────────────────────────────
   BUDDY FORM
   ──────────────────────────────────────────────────────────── */

/**
 * Build the HTML for the buddy form.
 * @param {object|null} buddy  Existing buddy for edit mode, null for add mode.
 * @returns {string}
 */
function buildBuddyFormHTML(buddy = null) {
  const v = {
    name:       buddy?.name       ?? '',
    department: buddy?.department ?? '',
    skills:     buddy?.skills     ?? '',
    status:     buddy?.status     ?? 'Available',
  };

  return `
    <form id="buddy-form" novalidate>
      <div class="form-group" id="fg-name">
        <label for="f-name">Nama Buddy <span class="text-red-500">*</span></label>
        <input type="text" id="f-name" name="name" value="${escapeHtml(v.name)}" placeholder="Contoh: Rina Kusuma" />
        <span class="error-msg">Nama tidak boleh kosong.</span>
      </div>
      <div class="form-group" id="fg-department">
        <label for="f-department">Departemen <span class="text-red-500">*</span></label>
        <input type="text" id="f-department" name="department" value="${escapeHtml(v.department)}" placeholder="Contoh: Engineering" />
        <span class="error-msg">Departemen tidak boleh kosong.</span>
      </div>
      <div class="form-group" id="fg-skills">
        <label for="f-skills">Keahlian / Skill <span class="text-red-500">*</span></label>
        <input type="text" id="f-skills" name="skills" value="${escapeHtml(v.skills)}" placeholder="Contoh: JavaScript, Komunikasi" />
        <span class="error-msg">Keahlian tidak boleh kosong.</span>
      </div>
      <div class="form-group" id="fg-status">
        <label for="f-status">Status Ketersediaan</label>
        <select id="f-status" name="status">
          <option value="Available" ${v.status === 'Available' ? 'selected' : ''}>🟢 Available</option>
          <option value="Busy"      ${v.status === 'Busy'      ? 'selected' : ''}>🟡 Busy</option>
        </select>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" id="btn-modal-cancel" class="btn-secondary">Batal</button>
        <button type="submit" class="btn-primary">${buddy ? 'Simpan Perubahan' : 'Tambah Buddy'}</button>
      </div>
    </form>`;
}

/** Open the add-buddy modal. */
function openAddBuddyModal() {
  state.editBuddyId = null;
  openModal('Tambah Buddy Baru', buildBuddyFormHTML());
  attachBuddyFormHandler();
}

/**
 * Open the edit-buddy modal for a given id.
 * @param {string} id
 */
function openEditBuddyModal(id) {
  const buddy = findBuddy(id);
  if (!buddy) return;
  state.editBuddyId = id;
  openModal('Edit Buddy', buildBuddyFormHTML(buddy));
  attachBuddyFormHandler();
}

/** Attach submit handler to the buddy form inside the modal. */
function attachBuddyFormHandler() {
  const form = document.getElementById('buddy-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateBuddyForm(form)) return;

    const data = {
      name:       form.name.value.trim(),
      department: form.department.value.trim(),
      skills:     form.skills.value.trim(),
      status:     form.status.value,
    };

    if (state.editBuddyId) {
      updateBuddy(state.editBuddyId, data);
    } else {
      addBuddy(data);
    }
    closeModal();
  });

  // Cancel button inside form
  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeModal);
}

/**
 * Validate the buddy form; marks invalid fields with .has-error.
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateBuddyForm(form) {
  let valid = true;
  const required = [
    { id: 'fg-name',       field: form.name },
    { id: 'fg-department', field: form.department },
    { id: 'fg-skills',     field: form.skills },
  ];

  required.forEach(({ id, field }) => {
    const group = document.getElementById(id);
    if (!field.value.trim()) {
      group.classList.add('has-error');
      valid = false;
    } else {
      group.classList.remove('has-error');
    }
  });

  return valid;
}

/* ────────────────────────────────────────────────────────────
   TASK FORM
   ──────────────────────────────────────────────────────────── */

/**
 * Build the buddy <option> list for the task form.
 * @param {string} selectedId
 * @returns {string}
 */
function buildBuddyOptions(selectedId = '') {
  const opts = state.buddies.map(b =>
    `<option value="${b.id}" ${b.id === selectedId ? 'selected' : ''}>${escapeHtml(b.name)} — ${escapeHtml(b.department)}</option>`
  ).join('');
  return `<option value="">-- Pilih Buddy --</option>${opts}`;
}

/**
 * Build the HTML for the task form.
 * @param {object|null} task  Existing task for edit, null for add.
 * @returns {string}
 */
function buildTaskFormHTML(task = null) {
  const v = {
    title:       task?.title       ?? '',
    description: task?.description ?? '',
    category:    task?.category    ?? 'Administrasi',
    buddyId:     task?.buddyId     ?? '',
  };

  const categories = ['Administrasi', 'Teknis', 'Sosial', 'Budaya'];
  const catOptions = categories.map(c =>
    `<option value="${c}" ${v.category === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  return `
    <form id="task-form" novalidate>
      <div class="form-group" id="fg-title">
        <label for="f-title">Judul Task <span class="text-red-500">*</span></label>
        <input type="text" id="f-title" name="title" value="${escapeHtml(v.title)}" placeholder="Contoh: Setup akun email kantor" />
        <span class="error-msg">Judul tidak boleh kosong.</span>
      </div>
      <div class="form-group" id="fg-description">
        <label for="f-description">Deskripsi <span class="text-red-500">*</span></label>
        <textarea id="f-description" name="description" placeholder="Deskripsikan task ini secara singkat...">${escapeHtml(v.description)}</textarea>
        <span class="error-msg">Deskripsi tidak boleh kosong.</span>
      </div>
      <div class="form-group" id="fg-category">
        <label for="f-category">Kategori</label>
        <select id="f-category" name="category">${catOptions}</select>
      </div>
      <div class="form-group" id="fg-buddy">
        <label for="f-buddy">Assign Buddy</label>
        <select id="f-buddy" name="buddyId">${buildBuddyOptions(v.buddyId)}</select>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" id="btn-modal-cancel" class="btn-secondary">Batal</button>
        <button type="submit" class="btn-primary">${task ? 'Simpan Perubahan' : 'Tambah Task'}</button>
      </div>
    </form>`;
}

/** Open the add-task modal. */
function openAddTaskModal() {
  state.editTaskId = null;
  openModal('Tambah Task Baru', buildTaskFormHTML());
  attachTaskFormHandler();
}

/**
 * Open the edit-task modal for a given id.
 * @param {string} id
 */
function openEditTaskModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  state.editTaskId = id;
  openModal('Edit Task', buildTaskFormHTML(task));
  attachTaskFormHandler();
}

/** Attach submit handler to the task form inside the modal. */
function attachTaskFormHandler() {
  const form = document.getElementById('task-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateTaskForm(form)) return;

    const data = {
      title:       form.title.value.trim(),
      description: form.description.value.trim(),
      category:    form.category.value,
      buddyId:     form.buddyId.value,
    };

    if (state.editTaskId) {
      updateTask(state.editTaskId, data);
    } else {
      addTask(data);
    }
    closeModal();
  });

  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeModal);
}

/**
 * Validate the task form.
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateTaskForm(form) {
  let valid = true;
  const required = [
    { id: 'fg-title',       field: form.title },
    { id: 'fg-description', field: form.description },
  ];

  required.forEach(({ id, field }) => {
    const group = document.getElementById(id);
    if (!field.value.trim()) {
      group.classList.add('has-error');
      valid = false;
    } else {
      group.classList.remove('has-error');
    }
  });

  return valid;
}

/* ============================================================
   9. EVENT HANDLERS
   ============================================================ */

/** Switch visible tab and update nav styling. */
function switchTab(tabName) {
  // Update state
  state.activeTab = tabName;

  // Toggle tab content visibility
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('hidden', el.id !== `tab-${tabName}`);
  });

  // Update nav tab active style
  document.querySelectorAll('.nav-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active-tab', isActive);
  });
}

/** Bind all static (non-delegated) event listeners. */
function bindStaticEvents() {

  // ── Navigation tabs ──────────────────────────────────
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Add buttons ───────────────────────────────────────
  document.getElementById('btn-add-buddy')?.addEventListener('click', openAddBuddyModal);
  document.getElementById('btn-add-task')?.addEventListener('click', openAddTaskModal);

  // ── Modal close (overlay click / close button) ────────
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // ── Escape key closes modal ───────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ── Buddy search ──────────────────────────────────────
  document.getElementById('search-buddy')?.addEventListener('input', (e) => {
    state.buddySearch = e.target.value;
    renderBuddies();
  });

  // ── Task search ───────────────────────────────────────
  document.getElementById('search-task')?.addEventListener('input', (e) => {
    state.taskSearch = e.target.value;
    renderTasks();
  });

  // ── Task filter buttons ───────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.taskFilter = btn.dataset.filter;

      // Update active style
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active-filter', b.dataset.filter === state.taskFilter);
      });

      renderTasks();
    });
  });
}

/** Bind delegated event listeners for dynamic elements. */
function bindDelegatedEvents() {

  // ── Buddy list delegation ─────────────────────────────
  document.getElementById('buddy-list')?.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('.btn-edit-buddy');
    const deleteBtn = e.target.closest('.btn-delete-buddy');

    if (editBtn)   openEditBuddyModal(editBtn.dataset.id);
    if (deleteBtn) deleteBuddy(deleteBtn.dataset.id);
  });

  // ── Task list delegation ──────────────────────────────
  document.getElementById('task-list')?.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('.btn-toggle-task');
    const editBtn   = e.target.closest('.btn-edit-task');
    const deleteBtn = e.target.closest('.btn-delete-task');

    if (toggleBtn) toggleTask(toggleBtn.dataset.id);
    if (editBtn)   openEditTaskModal(editBtn.dataset.id);
    if (deleteBtn) deleteTask(deleteBtn.dataset.id);
  });
}

/* ============================================================
   10. INITIALISATION
   ============================================================ */

/** Bootstrap the application: load data, render, and bind events. */
function init() {
  loadState();
  renderDashboard();
  renderBuddies();
  renderTasks();
  bindStaticEvents();
  bindDelegatedEvents();

  // Show dashboard tab by default
  switchTab('dashboard');
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
