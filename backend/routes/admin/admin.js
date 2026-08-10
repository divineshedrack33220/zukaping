/* ZukaPing Admin Panel - Single Page Application */
"use strict";

const API_BASE = "/api/admin";
const STORAGE_KEY = "zukaping_admin_token";
const STORAGE_ADMIN = "zukaping_admin_me";

let charts = {};
let current = { route: null, params: {}, data: null };

/* ---------------- Utilities ---------------- */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  if (isNaN(d)) return "—";
  return d.toLocaleString();
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString();
}

function fmtMoney(v) {
  const n = Number(v);
  if (v == null || isNaN(n)) return "—";
  return "₦" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const ICONS = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
};

function icon(name, size) {
  const s = size || 16;
  return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ? parts[0][0] : "";
  const last = parts[1] ? parts[1][0] : "";
  return (first + (last || "")).toUpperCase() || "?";
}

function avatarFallback(name) {
  const s = initials(name);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#334155"/><text x="32" y="43" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="26" font-weight="600" fill="#e2e8f0" text-anchor="middle">' + s + "</text></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function pageInfo(total, count, state) {
  if (!total) return "0 total";
  const from = state.skip + 1;
  const to = Math.min(state.skip + count, total);
  return total + " total · showing " + from + "–" + to;
}

function emptyState(msg) {
  return '<div class="empty-state">' + icon("inbox", 26) + "<p>" + esc(msg) + "</p></div>";
}

function emptyRow(colspan, msg) {
  return '<tr><td colspan="' + colspan + '">' + emptyState(msg) + "</td></tr>";
}

function toast(msg, type) {
  const el = document.createElement("div");
  el.className = "toast " + (type || "success");
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showLoading(kind) {
  const el = document.getElementById("content");
  if (kind === "dashboard") { el.innerHTML = skeletonDashboard(); return; }
  if (kind === "user") { el.innerHTML = skeletonDetail(); return; }
  el.innerHTML = skeletonTable();
}

function skel(w, h) {
  return '<div class="skel" style="width:' + w + ';height:' + h + '"></div>';
}

function skeletonTable(cols) {
  const n = cols || 6;
  const head = Array.from({ length: n }, () => "<th></th>").join("");
  const cell = Array.from({ length: n }, (_, i) => "<td>" + (i === 0 ? '<div class="skel-cell">' + skel("34px", "34px") + '<div class="skel-lines">' + skel("90%", "11px") + skel("60%", "9px") + "</div></div>" : skel("80%", "11px")) + "</td>").join("");
  const rows = Array.from({ length: 6 }, () => "<tr>" + cell + "</tr>").join("");
  return `
    <div class="panel" aria-hidden="true">
      <div class="table-toolbar">${skel("200px", "34px")} ${skel("120px", "34px")} <span class="spacer"></span> ${skel("90px", "34px")}</div>
      <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="table-footer">${skel("160px", "16px")} <span class="spacer"></span> ${skel("120px", "30px")}</div>
    </div>`;
}

function skeletonDashboard() {
  const card = '<div class="stat-card">' + skel("50%", "12px") + "<br>" + skel("60px", "26px") + "<br>" + skel("70%", "11px") + "</div>";
  const chart = '<div class="chart-card"><h4>' + skel("90px", "12px") + "</h4><div class='chart-box'>" + skel("100%", "180px") + "</div></div>";
  return `
    <div class="cards" aria-hidden="true">${card}${card}${card}${card}${card}</div>
    <div class="cards" aria-hidden="true">${card}${card}${card}${card}${card}</div>
    <div class="section-title">${skel("140px", "12px")}</div>
    <div class="charts">${chart}${chart}${chart}${chart}</div>
    <div class="panel">${Array.from({ length: 4 }, () => '<div class="recent-item">' + skel("36px", "36px") + '<div class="recent-meta">' + skel("60%", "11px") + skel("40%", "9px") + "</div></div>").join("")}</div>`;
}

function skeletonDetail() {
  const item = '<div class="detail-item"><div class="k">' + skel("40%", "10px") + '</div><div class="v">' + skel("70%", "13px") + "</div></div>";
  return `
    <div class="panel" aria-hidden="true">
      <div class="modal-body" style="padding:20px">
        <div class="profile-head">${skel("64px", "64px")}<div>${skel("160px", "16px")}<br>${skel("200px", "12px")}</div></div>
        <div class="detail-grid">${item}${item}${item}${item}${item}${item}</div>
      </div>
    </div>`;
}

/* ---------------- Sortable columns ---------------- */

function setSort(field, stateName) {
  const st = {
    users: usersState, posts: postsState, chats: chatsState, messages: messagesState,
    rooms: roomsState, favorites: favoritesState, purchases: purchasesState,
    audit: auditState, reports: reportsState, announcements: announcementsState,
  }[stateName];
  if (!st) return;
  if (st.sort === field) st.order = st.order === "asc" ? "desc" : "asc";
  else { st.sort = field; st.order = "desc"; }
  st.skip = 0;
  navigate();
}

function sortSpec(label, field, state, defField) {
  const active = state.sort === field || (!state.sort && field === defField);
  const order = active ? (state.order || "desc") : "";
  const arrow = !active ? "↕" : (order === "asc" ? "▲" : "▼");
  return '<th class="th-sort' + (active ? " active " + order : "") + '">' +
    '<button type="button" class="th-btn" onclick="setSort(\'' + field + "','" + state.name + "')\">" +
    label + '<span class="th-arrow">' + arrow + "</span></button></th>";
}

function qSort(state) {
  const q = new URLSearchParams();
  if (state.sort) q.set("sort", state.sort);
  if (state.order) q.set("order", state.order);
  return q;
}

/* ---------------- Copy to clipboard ---------------- */

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast((label || "Copied") + " to clipboard", "success");
  } catch (e) {
    toast("Copy failed", "error");
  }
}

function copyBtn(text, label) {
  return '<button class="copy-btn" type="button" onclick="copyText(\'' + esc(text) + "','" + (label || "Copied") + '\')" title="Copy ' + (label || "value") + '" aria-label="Copy ' + (label || "value") + '">' + icon("copy", 12) + "</button>";
}

/* ---------------- Pending reports badge ---------------- */

let lastBadgeCheck = 0;

async function refreshReportBadge(force) {
  const el = document.getElementById("report-badge");
  if (!el) return;
  if (!force && Date.now() - lastBadgeCheck < 30000) return;
  lastBadgeCheck = Date.now();
  try {
    const data = await api("/reports?status=open&limit=1");
    const n = data.total || 0;
    el.textContent = n > 99 ? "99+" : String(n);
    // The `hidden` attribute alone is overridden by the `.nav-badge` display rule,
    // so we also set inline display to guarantee visibility toggling.
    el.hidden = n === 0;
    el.style.display = n === 0 ? "none" : "inline-flex";
  } catch (e) { /* keep previous state */ }
}

function badge(suspended, role) {
  const roleBadge = role === "admin" ? '<span class="badge badge-blue">admin</span> ' : "";
  const statusBadge = suspended
    ? '<span class="badge badge-red">suspended</span>'
    : '<span class="badge badge-green">active</span>';
  return roleBadge + statusBadge;
}

function completeBadge(complete) {
  return complete
    ? '<span class="badge badge-green">complete</span>'
    : '<span class="badge badge-gray">incomplete</span>';
}

const INTEREST_LABELS = { men: "Men", women: "Women", everyone: "Everyone", nonbinary: "Non-binary", all: "Everyone" };

function fmtInterested(arr) {
  if (!arr || !arr.length) return "—";
  return arr.map(v => INTEREST_LABELS[v] || esc(v)).join(", ");
}

let lastFocus = null;

function openModal(title, bodyHTML, footerHTML) {
  lastFocus = document.activeElement;
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHTML;
  wrapTables();
  document.getElementById("modal-footer").innerHTML = footerHTML || "";
  document.getElementById("modal-overlay").classList.add("open");
  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  lastFocus = null;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("modal-overlay").classList.contains("open")) {
    closeModal();
  }
});

function wrapTables() {
  const route = current ? current.route : "";
  document.querySelectorAll("#content table, .modal-body table").forEach(t => {
    if (t.parentElement && t.parentElement.classList.contains("table-wrap")) return;
    const w = document.createElement("div");
    w.className = "table-wrap";
    t.before(w);
    w.appendChild(t);
    if (t.closest("#content") && route) t.classList.add("t-" + route);
  });
  document.querySelectorAll(".table-wrap").forEach(w => {
    w.classList.toggle("can-scroll", w.scrollWidth > w.clientWidth + 1);
  });
}

/* ---------------- API ---------------- */

async function api(path, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers || {});
  if (!navigator.onLine) {
    throw new Error("You are offline");
  }
  const token = localStorage.getItem(STORAGE_KEY);
  if (token) opts.headers["Authorization"] = "Bearer " + token;
  if (opts.body && typeof opts.body !== "string") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(API_BASE + path, opts);
  if (res.status === 401) {
    logout(true);
    throw new Error("Session expired");
  }
  let data;
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) throw new Error((data && (data.error || data.message)) || ("Request failed (" + res.status + ")"));
  return data;
}

/* ---------------- Export ---------------- */

async function exportData(entity, format) {
  const token = localStorage.getItem(STORAGE_KEY);
  const res = await fetch(API_BASE + "/export/" + entity + "?format=" + format, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Export failed");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const m = disposition.match(/filename="?([^"]+)"?/);
  const name = m ? m[1] : entity + "." + format;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  toast("Export downloaded (" + name + ")", "success");
}

function exportButtons(entity) {
  return `
    <button class="btn btn-ghost btn-small" onclick="exportData('${entity}','csv')">${icon("download", 14)} CSV</button>
    <button class="btn btn-ghost btn-small" onclick="exportData('${entity}','json')">${icon("download", 14)} JSON</button>`;
}

/* ---------------- Auth ---------------- */

function setAdminMe(admin) {
  localStorage.setItem(STORAGE_ADMIN, JSON.stringify(admin || {}));
  if (admin) {
    document.getElementById("admin-name").textContent = admin.name || admin.email || "Admin";
    document.getElementById("admin-email").textContent = admin.email || "";
    const img = document.getElementById("admin-avatar");
    const fb = () => avatarFallback(admin.name || admin.email || "A");
    img.src = (admin.avatar && /^https?:\/\//.test(admin.avatar)) ? admin.avatar : fb();
    img.onerror = function () { this.onerror = null; this.src = fb(); };
  }
}

function requireAuth() {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    document.getElementById("login-view").style.display = "flex";
    document.getElementById("app-view").style.display = "none";
    return false;
  }
  document.getElementById("login-view").style.display = "none";
  document.getElementById("app-view").style.display = "block";
  try {
    const me = JSON.parse(localStorage.getItem(STORAGE_ADMIN) || "{}");
    if (me.email) setAdminMe(me);
  } catch (e) {}
  return true;
}

function logout(quiet) {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_ADMIN);
  requireAuth();
  if (!quiet) toast("Signed out", "success");
}

async function doLogin(email, password) {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Login failed");
  localStorage.setItem(STORAGE_KEY, data.token);
  setAdminMe(data.admin);
  requireAuth();
  window.location.hash = "#/dashboard";
  toast("Welcome back", "success");
  refreshReportBadge(true);
}

/* ---------------- Router ---------------- */

const routes = {
  "dashboard": { title: "Dashboard", render: renderDashboard },
  "users": { title: "Users", render: renderUsers },
  "reports": { title: "Reports", render: renderReports },
  "admins": { title: "Admins", render: renderAdmins },
  "announcements": { title: "Announcements", render: renderAnnouncements },
  "posts": { title: "Posts", render: renderPosts },
  "chats": { title: "Chats", render: renderChats },
  "messages": { title: "Messages", render: renderMessages },
  "rooms": { title: "Rooms", render: renderRooms },
  "favorites": { title: "Favorites", render: renderFavorites },
  "purchases": { title: "Purchases", render: renderPurchases },
  "audit": { title: "Audit Log", render: renderAudit },
  "user": { title: "User", render: renderUserDetail },
};

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  const route = parts[0] || "dashboard";
  const params = {};
  if (parts.length > 1) params.id = decodeURIComponent(parts[1]);
  return { route, params };
}

function renderNotFound(route) {
  document.getElementById("page-title").textContent = "Not found";
  document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
  current = { route: "notfound", params: {}, data: null };
  document.getElementById("content").innerHTML = `
    <div class="panel notfound">
      <div class="nf-code">404</div>
      <div class="section-title" style="justify-content:center">Page not found</div>
      <p class="text-muted" style="text-align:center;margin:4px 0 18px">We couldn't find <span class="mono">${esc(route)}</span>. It may have been moved or never existed.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary" href="#/dashboard">Go to Dashboard</a>
        <button class="btn btn-ghost" onclick="location.reload()">Reload</button>
      </div>
    </div>`;
  wrapTables();
}

async function navigate() {
  const { route, params } = parseHash();
  const def = routes[route];
  if (!def) { renderNotFound(route); return; }
  document.getElementById("page-title").textContent = def.title;
  document.querySelectorAll(".nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });
  const activeLink = document.querySelector(".nav a.active");
  if (activeLink) {
    const items = activeLink.closest(".nav-items");
    const group = items && items.previousElementSibling;
    if (group && group.classList && group.classList.contains("nav-group")) {
      group.classList.remove("collapsed");
      localStorage.setItem("zukaping_nav_" + group.dataset.group, "open");
    }
  }
  if (charts && Object.keys(charts).length) {
    Object.values(charts).forEach(ch => ch && ch.destroy());
    charts = {};
  }
  current = { route, params, data: null };
  try {
    await def.render(params);
  } catch (e) {
    document.getElementById("content").innerHTML = emptyState("Error: " + e.message);
  }
  wrapTables();
  refreshReportBadge();
}

/* ---------------- Dashboard ---------------- */

async function renderDashboard() {
  showLoading("dashboard");
  const dark = document.documentElement.dataset.theme === "dark";
  const tcol = (l, d) => dark ? d : l;
  const [overview, trends, latest] = await Promise.all([
    api("/stats/overview"),
    api("/stats/trends?days=7"),
    api("/users?limit=5"),
  ]);
  const u = overview.users, co = overview.content, en = overview.engagement, cm = overview.commerce;

  document.getElementById("content").innerHTML = `
    <div class="cards">
      <div class="stat-card primary"><div class="label">Total Users</div><div class="value">${u.total}</div><div class="hint">+${u.new7d} in 7 days</div><div class="spark">${sparkline(trends.signups, tcol("#026AFD", "#60a5fa"))}</div></div>
      <div class="stat-card green"><div class="label">Complete</div><div class="value">${u.complete}</div><div class="hint">${u.incomplete} incomplete</div></div>
      <div class="stat-card"><div class="label">Active Now</div><div class="value">${u.activeNow}</div><div class="hint">${u.activeToday} active today</div></div>
      <div class="stat-card red"><div class="label">Suspended</div><div class="value">${u.suspended}</div></div>
      <div class="stat-card"><div class="label">New Today</div><div class="value">${u.newToday}</div><div class="hint">${u.new30d} in 30 days</div></div>
    </div>
    <div class="cards">
      <div class="stat-card"><div class="label">Posts</div><div class="value">${co.posts}</div><div class="hint">${co.postsToday} today</div><div class="spark">${sparkline(trends.posts, tcol("#b45309", "#fbbf24"))}</div></div>
      <div class="stat-card green"><div class="label">Messages</div><div class="value">${co.messages}</div><div class="hint">${co.messagesToday} today</div><div class="spark">${sparkline(trends.messages, tcol("#15803d", "#4ade80"))}</div></div>
      <div class="stat-card"><div class="label">Favorites</div><div class="value">${en.favorites}</div><div class="hint">${en.favoritesToday} today</div><div class="spark">${sparkline(trends.favorites, tcol("#b91c1c", "#f87171"))}</div></div>
      <div class="stat-card"><div class="label">Chats</div><div class="value">${en.chats}</div><div class="hint">${en.rooms} rooms · ${en.roomMembers} members</div></div>
      <div class="stat-card amber"><div class="label">Revenue</div><div class="value">${fmtMoney(cm.revenue)}</div><div class="hint">${cm.completed} purchases</div></div>
    </div>
    <div class="section-title">Trends — last 7 days</div>
    <div class="charts">
      <div class="chart-card"><h4>Signups</h4><div class="chart-box"><canvas id="ch-signups"></canvas></div></div>
      <div class="chart-card"><h4>Messages</h4><div class="chart-box"><canvas id="ch-messages"></canvas></div></div>
      <div class="chart-card"><h4>Posts</h4><div class="chart-box"><canvas id="ch-posts"></canvas></div></div>
      <div class="chart-card"><h4>Favorites</h4><div class="chart-box"><canvas id="ch-favorites"></canvas></div></div>
    </div>
    <div class="section-title">Latest signups</div>
    <div class="panel">
      <div class="recent-list">
        ${(latest.users || []).map(u2 => `
          <a class="recent-item" href="#/user/${u2.id}">
            <img class="avatar" src="${esc(u2.avatar)}" onerror="this.onerror=null;this.src=avatarFallback('${esc(u2.name || u2.username)}')" />
            <div class="recent-meta">
              <div class="recent-name">${esc(u2.name || u2.username)}</div>
              <div class="recent-sub">${esc(u2.email)}</div>
            </div>
            <div class="recent-time">${fmtTime(u2.createdAt)}</div>
          </a>`).join("") || `<div class="empty">No signups yet</div>`}
      </div>
    </div>`;

  const labels = trends.signups.map((_, i) => {
    const d = new Date((trends.startDate + i * 86400) * 1000);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
  makeLineChart("ch-signups", labels, trends.signups, tcol("#026AFD", "#60a5fa"), "New users");
  makeLineChart("ch-messages", labels, trends.messages, tcol("#15803d", "#4ade80"), "Messages");
  makeLineChart("ch-posts", labels, trends.posts, tcol("#b45309", "#fbbf24"), "Posts");
  makeLineChart("ch-favorites", labels, trends.favorites, tcol("#b91c1c", "#f87171"), "Favorites");
}

function makeLineChart(id, labels, data, color, label) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (typeof Chart === "undefined") {
    ctx.parentElement.innerHTML = emptyState("Chart library not loaded");
    return;
  }
  const dark = document.documentElement.dataset.theme === "dark";
  charts[id] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label, data,
        borderColor: color,
        backgroundColor: color + "18",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: dark ? "#94a3b8" : "#64748b" }, grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: dark ? "#94a3b8" : "#64748b" },
          grid: { color: dark ? "rgba(148,163,184,.15)" : "rgba(100,116,139,.12)" },
        },
      },
    },
  });
}

function sparkline(data, stroke) {
  if (!data || data.length < 2) return "";
  const w = 96, h = 26;
  const max = Math.max.apply(null, data);
  const min = Math.min.apply(null, data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1) * w).toFixed(1);
    const y = (h - 2 - (v - min) / range * (h - 4)).toFixed(1);
    return x + "," + y;
  }).join(" ");
  return '<svg class="sparkline" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<polyline points="' + pts + '" fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

/* ---------------- Users ---------------- */

let usersState = { name: "users", search: "", complete: "", suspended: "", provider: "", role: "", sort: "", order: "", skip: 0, limit: 20, sel: new Set() };

async function renderUsers(params) {
  showLoading();
  if (params.id) { renderUserDetail(params); return; }
  const q = qSort(usersState);
  q.set("limit", usersState.limit);
  q.set("skip", usersState.skip);
  if (usersState.search) q.set("search", usersState.search);
  if (usersState.complete) q.set("complete", usersState.complete);
  if (usersState.suspended) q.set("suspended", usersState.suspended);
  if (usersState.provider) q.set("provider", usersState.provider);
  if (usersState.role) q.set("role", usersState.role);
  const data = await api("/users?" + q.toString());

  const rows = data.users.map(u => `
    <tr>
      <td><input type="checkbox" class="row-check" value="${u.id}" ${usersState.sel.has(u.id) ? "checked" : ""} onchange="toggleRow(this)" /></td>
        <td>
          <div class="user-cell">
            <img class="avatar" src="${esc(u.avatar)}" onerror="this.onerror=null;this.src=avatarFallback('${esc(u.name || u.username)}')" />
            <div>
              <div class="u-name">${esc(u.name || u.username)}</div>
              <div class="u-sub">${esc(u.email)} ${copyBtn(u.email, "email")}</div>
            </div>
          </div>
        </td>
        <td>${esc(u.username)}</td>
        <td>${completeBadge(u.complete)}</td>
        <td>${badge(u.isSuspended, u.role)}</td>
        <td>${esc(u.authProvider)}</td>
        <td>${fmtDate(u.createdAt)}</td>
        <td>${fmtDate(u.lastSeen)}</td>
      <td>
        <button class="action-link" onclick="location.hash='#/user/${u.id}'">View</button>
        ${u.role !== "admin" ? `
          <button class="action-link ${u.isSuspended ? "" : "danger"}" onclick="toggleSuspend('${u.id}','${esc(u.email)}',${u.isSuspended})">${u.isSuspended ? "Activate" : "Suspend"}</button>
        ` : ""}
        <button class="action-link danger" onclick="deleteUser('${u.id}','${esc(u.email)}')">Delete</button>
      </td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search email, username, name…" id="u-search" value="${esc(usersState.search)}" />
        <select id="u-complete">
          <option value="">Profile: all</option>
          <option value="true" ${usersState.complete === "true" ? "selected" : ""}>Complete</option>
          <option value="false" ${usersState.complete === "false" ? "selected" : ""}>Incomplete</option>
        </select>
        <select id="u-suspended">
          <option value="">Status: all</option>
          <option value="true" ${usersState.suspended === "true" ? "selected" : ""}>Suspended</option>
          <option value="false" ${usersState.suspended === "false" ? "selected" : ""}>Active</option>
        </select>
        <select id="u-role">
          <option value="">Role: all</option>
          <option value="user" ${usersState.role === "user" ? "selected" : ""}>User</option>
          <option value="admin" ${usersState.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
        <select id="u-provider">
          <option value="">Provider: all</option>
          <option value="email" ${usersState.provider === "email" ? "selected" : ""}>Email</option>
          <option value="google" ${usersState.provider === "google" ? "selected" : ""}>Google</option>
        </select>
        <span class="spacer"></span>
        <div class="bulk-bar">
          <span class="bulk-count" id="bulk-count"></span>
          <button class="btn btn-ghost btn-small" id="bulk-suspend" onclick="bulkStatus(true)">Suspend</button>
          <button class="btn btn-ghost btn-small" id="bulk-activate" onclick="bulkStatus(false)">Activate</button>
          <button class="btn btn-ghost btn-small danger" id="bulk-delete" onclick="bulkDelete()">Delete</button>
        </div>
        ${exportButtons("users")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th><input type="checkbox" id="check-all" onchange="toggleAll(this.checked)" /></th>
            <th>User</th>
            ${sortSpec("Username", "username", usersState, "")}
            <th>Profile</th><th>Status</th><th>Provider</th>
            ${sortSpec("Joined", "createdAt", usersState, "createdAt")}
            ${sortSpec("Last Seen", "lastSeen", usersState, "")}
            <th>Actions</th>
          </tr></thead>
          <tbody>${rows || emptyRow(9, "No users found")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, data.users.length, usersState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="usersPage(-1)" ${usersState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="usersPage(1)" ${usersState.skip + usersState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;

  bind("u-search", "search", usersState);
  bind("u-complete", "complete", usersState);
  bind("u-suspended", "suspended", usersState);
  bind("u-role", "role", usersState);
  bind("u-provider", "provider", usersState);
  updateBulkUI();
}

function usersPage(dir) {
  usersState.skip = Math.max(0, usersState.skip + dir * usersState.limit);
  navigate();
}

function toggleRow(cb) {
  const id = cb.value;
  if (cb.checked) usersState.sel.add(id);
  else usersState.sel.delete(id);
  updateBulkUI();
}

function toggleAll(checked) {
  document.querySelectorAll(".row-check").forEach(c => { c.checked = checked; });
  usersState.sel = new Set(checked ? Array.from(document.querySelectorAll(".row-check")).map(c => c.value) : []);
  updateBulkUI();
}

function updateBulkUI() {
  const count = usersState.sel.size;
  const el = document.getElementById("bulk-count");
  if (el) el.textContent = count ? count + " selected" : "";
  ["bulk-suspend", "bulk-activate", "bulk-delete"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = count === 0;
  });
}

async function bulkStatus(suspend) {
  const ids = Array.from(usersState.sel);
  if (!ids.length) return;
  const label = suspend ? "suspend" : "activate";
  openModal("Bulk " + label,
    `<p>Apply "<strong>${label}</strong>" to <strong>${ids.length}</strong> selected user${ids.length === 1 ? "" : "s"}?</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn ${suspend ? "btn-danger" : "btn-primary"}" id="confirm-bulk">${suspend ? "Suspend all" : "Activate all"}</button>`);
  document.getElementById("confirm-bulk").onclick = async () => {
    const btn = document.getElementById("confirm-bulk");
    btn.disabled = true;
    let ok = 0;
    for (const id of ids) {
      try { await api("/users/" + id + "/status", { method: "PATCH", body: { suspended: suspend } }); ok++; }
      catch (e) {}
    }
    usersState.sel = new Set();
    closeModal();
    const past = suspend ? "suspended" : "activated";
    toast(ok + " user" + (ok === 1 ? "" : "s") + " " + past + (ok === ids.length ? "" : " (some failed)"), ok === ids.length ? "success" : "error");
    navigate();
  };
}

async function bulkDelete() {
  const ids = Array.from(usersState.sel);
  if (!ids.length) return;
  openModal("Delete selected users?",
    `<p>Permanently delete <strong>${ids.length}</strong> selected user${ids.length === 1 ? "" : "s"} and all of their content?</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" id="confirm-bulk-del">Delete all</button>`);
  document.getElementById("confirm-bulk-del").onclick = async () => {
    const btn = document.getElementById("confirm-bulk-del");
    btn.disabled = true;
    let ok = 0;
    for (const id of ids) {
      try { await api("/users/" + id, { method: "DELETE" }); ok++; }
      catch (e) {}
    }
    usersState.sel = new Set();
    closeModal();
    toast(ok + " user" + (ok === 1 ? "" : "s") + " deleted", ok === ids.length ? "success" : "error");
    navigate();
  };
}

function bind(id, key, state) {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = () => {
    state[key] = el.value;
    state.skip = 0;
    navigate();
  };
  if (el.tagName === "SELECT") el.onchange = handler;
  else {
    let t;
    el.oninput = () => { clearTimeout(t); t = setTimeout(handler, 400); };
  }
}

async function toggleSuspend(id, email, currentlySuspended) {
  const action = currentlySuspended ? "activate" : "suspend";
  openModal(action === "suspend" ? "Suspend user?" : "Activate user?",
    `<p>Are you sure you want to <strong>${action}</strong> <strong>${esc(email)}</strong>?</p>` +
    (action === "suspend" ? "<p class='text-muted' style='margin-top:8px'>They will be logged out of the app and blocked immediately.</p>" : ""),
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn ${action === "suspend" ? "btn-danger" : "btn-primary"}" id="confirm-action">${action === "suspend" ? "Suspend" : "Activate"}</button>`);
  document.getElementById("confirm-action").onclick = async () => {
    try {
      await api("/users/" + id + "/status", { method: "PATCH", body: { suspended: !currentlySuspended } });
      closeModal();
      toast("User " + action + "d", "success");
      navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

async function deleteUser(id, email) {
  openModal("Delete user?", 
    `<p>This will permanently delete <strong>${esc(email)}</strong> and ALL of their posts, messages, favorites and purchases. This cannot be undone.</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" id="confirm-delete">Delete permanently</button>`);
  document.getElementById("confirm-delete").onclick = async () => {
    try {
      await api("/users/" + id, { method: "DELETE" });
      closeModal();
      toast("User deleted", "success");
      navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- User detail ---------------- */

async function renderUserDetail(params) {
  showLoading("user");
  const u = await api("/users/" + params.id);
  document.getElementById("page-title").textContent = "User: " + (u.name || u.username);
  const act = u.activity || {};
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="modal-body" style="padding:20px">
        <div class="profile-head">
          <img src="${esc(u.avatar)}" onerror="this.onerror=null;this.src=avatarFallback('${esc(u.name || u.username)}')" />
          <div>
            <div class="ph-name">${esc(u.name || u.username)} <span style="font-weight:400;color:var(--text-muted)">@${esc(u.username)}</span></div>
            <div class="ph-sub">${esc(u.email)} ${copyBtn(u.email, "email")}</div>
            <div style="margin-top:6px">${badge(u.isSuspended, u.role)} ${completeBadge(u.complete)}</div>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><div class="k">User ID</div><div class="v mono">${esc(u.id)} ${copyBtn(u.id, "user ID")}</div></div>
          <div class="detail-item"><div class="k">Bio</div><div class="v">${esc(u.bio) || "—"}</div></div>
          <div class="detail-item"><div class="k">Gender</div><div class="v">${esc(u.gender) || "—"}</div></div>
          <div class="detail-item"><div class="k">Provider</div><div class="v">${esc(u.authProvider)}</div></div>
          <div class="detail-item"><div class="k">Photos</div><div class="v">${u.photos}</div></div>
          <div class="detail-item"><div class="k">Joined</div><div class="v">${fmtTime(u.createdAt)}</div></div>
          <div class="detail-item"><div class="k">Last Seen</div><div class="v">${fmtTime(u.lastSeen)}</div></div>
          <div class="detail-item"><div class="k">Interested In</div><div class="v">${fmtInterested(u.interestedIn)}</div></div>
          <div class="detail-item"><div class="k">Referral Code</div><div class="v mono">${esc(u.referralCode) || "—"}</div></div>
        </div>
      </div>
      <div style="border-top:1px solid var(--border)">
        <div class="modal-body">
          <div class="section-title" style="margin-top:0">Activity</div>
          <div class="cards" style="margin-bottom:0">
            <div class="stat-card"><div class="label">Posts</div><div class="value">${act.posts}</div></div>
            <div class="stat-card"><div class="label">Messages</div><div class="value">${act.messagesSent}</div></div>
            <div class="stat-card"><div class="label">Favorites Given</div><div class="value">${act.favoritesSent}</div></div>
            <div class="stat-card"><div class="label">Favorites Received</div><div class="value">${act.favoritesReceived}</div></div>
            <div class="stat-card"><div class="label">Chats</div><div class="value">${act.chats}</div></div>
            <div class="stat-card"><div class="label">Purchases</div><div class="value">${act.purchasesBought} / ${act.purchasesSold}</div></div>
            <div class="stat-card"><div class="label">Room Memberships</div><div class="value">${act.activeRoomMemberships}</div></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="location.hash='#/users'">← Back</button>
        <button class="btn btn-ghost" onclick="openEditUser('${u.id}','${esc(u.name || "")}','${esc(u.username || "")}','${esc(u.bio || "")}','${esc(u.gender || "")}','${esc(u.status || "")}')">Edit user</button>
        ${u.role !== "admin" ? `
          <button class="btn ${u.isSuspended ? "btn-primary" : "btn-danger"}" onclick="toggleSuspend('${u.id}','${esc(u.email)}',${u.isSuspended})">${u.isSuspended ? "Activate account" : "Suspend account"}</button>
        ` : ""}
        ${u.role !== "admin" ? `
          <button class="btn btn-danger" onclick="deleteUser('${u.id}','${esc(u.email)}')">Delete user</button>
        ` : ""}
      </div>
    </div>`;
}

/* ---------------- Edit user ---------------- */

function openEditUser(id, name, username, bio, gender, status) {
  openModal("Edit user",
    `<div class="form-group"><label>Name</label><input id="e-name" value="${name}" /></div>
     <div class="form-group"><label>Username</label><input id="e-username" value="${username}" /></div>
     <div class="form-group"><label>Bio</label><textarea id="e-bio" rows="3">${bio}</textarea></div>
     <div class="form-row">
       <div class="form-group"><label>Gender</label>
         <select id="e-gender">
           <option value="">—</option>
           <option value="male" ${gender === "male" ? "selected" : ""}>Male</option>
           <option value="female" ${gender === "female" ? "selected" : ""}>Female</option>
         </select></div>
       <div class="form-group"><label>Status</label>
         <select id="e-status">
           <option value="">—</option>
           <option value="online" ${status === "online" ? "selected" : ""}>Online</option>
           <option value="offline" ${status === "offline" ? "selected" : ""}>Offline</option>
         </select></div>
     </div>
     <div class="form-group"><label>Reset password <span class="text-muted">(optional)</span></label><input id="e-password" type="password" placeholder="Leave empty to keep current" /></div>
     <div class="text-muted" style="font-size:12px">Fields left blank keep their current values (except password, which only changes if you type one).</div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-edit">Save changes</button>`);
  document.getElementById("save-edit").onclick = async () => {
    const body = {
      name: val("e-name"),
      username: val("e-username"),
      bio: val("e-bio"),
      gender: val("e-gender"),
      status: val("e-status"),
    };
    const pw = val("e-password");
    if (pw) body.password = pw;
    try {
      await api("/users/" + id, { method: "PATCH", body });
      closeModal();
      toast("User updated", "success");
      navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

/* ---------------- Posts ---------------- */

let postsState = { name: "posts", search: "", sort: "", order: "", skip: 0, limit: 20 };

async function renderPosts() {
  showLoading();
  const q = qSort(postsState);
  q.set("limit", postsState.limit);
  q.set("skip", postsState.skip);
  if (postsState.search) q.set("search", postsState.search);
  const data = await api("/posts?" + q.toString());

  const rows = data.posts.map(p => `
    <tr>
      <td>
        <div class="user-cell">
          <img class="avatar" src="${esc((p.user && p.user.avatar) || "")}" onerror="this.style.visibility='hidden'" />
          <div>
            <div class="u-name">${esc((p.user && (p.user.name || p.user.username)) || "deleted user")}</div>
            <div class="u-sub">${esc(p.user && p.user.email) || "—"}</div>
          </div>
        </div>
      </td>
      <td class="break-word">${esc(p.content)}</td>
      <td>${esc(p.category) || "—"}</td>
       <td>${(p.media && p.media.length) || 0}</td>
      <td>${fmtDate(p.createdAt)}</td>
      <td><button class="action-link danger" onclick="deletePost('${p.id}')">Delete</button></td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search post content…" id="p-search" value="${esc(postsState.search)}" />
        <span class="spacer"></span>
        ${exportButtons("posts")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Author</th><th>Content</th><th>Category</th><th>Media</th>${sortSpec("Created", "createdAt", postsState, "createdAt")}<th>Actions</th></tr></thead>
          <tbody>${rows || emptyRow(6, "No posts found")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, data.posts.length, postsState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="postsPage(-1)" ${postsState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="postsPage(1)" ${postsState.skip + postsState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;
  const s = document.getElementById("p-search");
  if (s) {
    let t;
    s.oninput = () => { clearTimeout(t); t = setTimeout(() => { postsState.search = s.value; postsState.skip = 0; navigate(); }, 400); };
  }
}

function postsPage(dir) {
  postsState.skip = Math.max(0, postsState.skip + dir * postsState.limit);
  navigate();
}

async function deletePost(id) {
  openModal("Delete post?", "<p>Are you sure you want to delete this post?</p>",
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" id="confirm-delete">Delete</button>`);
  document.getElementById("confirm-delete").onclick = async () => {
    try {
      await api("/posts/" + id, { method: "DELETE" });
      closeModal(); toast("Post deleted", "success"); navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- Chats ---------------- */

let chatsState = { name: "chats", sort: "", order: "", skip: 0, limit: 20 };

async function renderChats() {
  showLoading();
  const q = qSort(chatsState);
  q.set("limit", chatsState.limit);
  q.set("skip", chatsState.skip);
  const data = await api("/chats?" + q.toString());

  const rows = data.chats.map(ch => `
    <tr>
      <td>${ch.isGroup ? '<span class="badge badge-blue">group</span>' : '<span class="badge badge-green">direct</span>'}</td>
      <td><strong>${esc(ch.groupName || "(direct)")}</strong></td>
      <td>${ch.participantCount}</td>
      <td>${fmtDate(ch.lastMessageAt)}</td>
      <td><button class="action-link" onclick="openChatDetail('${ch.id}')">View</button></td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>Participants</th>${sortSpec("Last Message", "lastMessageAt", chatsState, "lastMessageAt")}<th>Actions</th></tr></thead>
          <tbody>${rows || emptyRow(5, "No chats found")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, data.chats.length, chatsState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="chatsPage(-1)" ${chatsState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="chatsPage(1)" ${chatsState.skip + chatsState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;
}

function chatsPage(dir) {
  chatsState.skip = Math.max(0, chatsState.skip + dir * chatsState.limit);
  navigate();
}

async function openChatDetail(id) {
  try {
    const data = await api("/chats/" + id);
    const ch = data.chat;
    const parts = (ch.participants || []).map(u =>
      `<li>${esc((u && (u.name || u.username)) || "deleted")} <span class="text-muted">(${esc(u && u.email) || "—"})</span></li>`).join("");
    const msgs = (data.messages || []).slice(0, 30).map(m => `
      <tr>
        <td>${esc((m.sender && (m.sender.name || m.sender.username)) || "deleted")}</td>
        <td class="break-word">${esc(m.content)}</td>
        <td>${esc(m.type)}</td>
        <td>${fmtTime(m.createdAt)}</td>
      </tr>`).join("");
    openModal(ch.groupName || "Chat",
      `<div class="section-title" style="margin-top:0;font-size:14px">Participants (${ch.participantCount})</div>
       <ul style="margin:0 0 16px 18px">${parts || "<li>None</li>"}</ul>
       <div class="section-title" style="font-size:14px">Recent messages (${(data.messages || []).length})</div>
       <table><thead><tr><th>Sender</th><th>Content</th><th>Type</th><th>Time</th></tr></thead>
       <tbody>${msgs || emptyRow(4, "No messages")}</tbody></table>`,
      `<button class="btn btn-ghost" onclick="closeModal()">Close</button>
       <button class="btn btn-danger" onclick="deleteChat('${id}')">Delete chat</button>`);
  } catch (e) { toast(e.message, "error"); }
}

async function deleteChat(id) {
  closeModal();
  openModal("Delete chat?", "<p>This deletes the chat and all its messages.</p>",
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" id="confirm-delete">Delete</button>`);
  document.getElementById("confirm-delete").onclick = async () => {
    try {
      await api("/chats/" + id, { method: "DELETE" });
      closeModal(); toast("Chat deleted", "success"); navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- Messages ---------------- */

let messagesState = { name: "messages", search: "", sort: "", order: "", skip: 0, limit: 20 };

async function renderMessages() {
  showLoading();
  const q = qSort(messagesState);
  q.set("limit", messagesState.limit);
  q.set("skip", messagesState.skip);
  if (messagesState.search) q.set("search", messagesState.search);
  const data = await api("/messages?" + q.toString());

  const rows = data.messages.map(m => `
    <tr>
      <td>
        <div class="user-cell">
          <img class="avatar" src="${esc((m.sender && m.sender.avatar) || "")}" onerror="this.style.visibility='hidden'" />
          <div>
            <div class="u-name">${esc((m.sender && (m.sender.name || m.sender.username)) || "deleted")}</div>
            <div class="u-sub">${esc(m.sender && m.sender.email) || "—"}</div>
          </div>
        </div>
      </td>
      <td class="break-word">${esc(m.content)}</td>
      <td>${esc(m.type)}</td>
      <td>${m.isRead ? '<span class="badge badge-green">read</span>' : '<span class="badge badge-gray">unread</span>'}</td>
      <td>${fmtTime(m.createdAt)}</td>
      <td><button class="action-link danger" onclick="deleteMessage('${m.id}')">Delete</button></td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search message content…" id="m-search" value="${esc(messagesState.search)}" />
        <span class="spacer"></span>
        ${exportButtons("messages")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Sender</th><th>Content</th><th>Type</th><th>Status</th>${sortSpec("Sent", "createdAt", messagesState, "createdAt")}<th>Actions</th></tr></thead>
          <tbody>${rows || emptyRow(6, "No messages found")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, data.messages.length, messagesState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="messagesPage(-1)" ${messagesState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="messagesPage(1)" ${messagesState.skip + messagesState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;
  const s = document.getElementById("m-search");
  if (s) {
    let t;
    s.oninput = () => { clearTimeout(t); t = setTimeout(() => { messagesState.search = s.value; messagesState.skip = 0; navigate(); }, 400); };
  }
}

function messagesPage(dir) {
  messagesState.skip = Math.max(0, messagesState.skip + dir * messagesState.limit);
  navigate();
}

async function deleteMessage(id) {
  openModal("Delete message?", "<p>Are you sure you want to delete this message?</p>",
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" id="confirm-delete">Delete</button>`);
  document.getElementById("confirm-delete").onclick = async () => {
    try {
      await api("/messages/" + id, { method: "DELETE" });
      closeModal(); toast("Message deleted", "success"); navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- Rooms ---------------- */

let roomsState = { name: "rooms", search: "", sort: "", order: "", skip: 0, limit: 25 };

async function renderRooms() {
  showLoading();
  const q = qSort(roomsState);
  q.set("limit", roomsState.limit);
  q.set("skip", roomsState.skip);
  if (roomsState.search) q.set("search", roomsState.search);
  const data = await api("/rooms?" + q.toString());
  const rows = (data.rooms || []).map(r => `
    <tr>
      <td><strong>${esc(r.name)}</strong></td>
      <td>${esc(r.description)}</td>
      <td><span class="badge badge-blue">${esc(r.category)}</span></td>
      <td>${r.currentMembers} / ${r.maxMembers}</td>
      <td>${r.isTrending ? '<span class="badge badge-amber">trending</span>' : "—"}</td>
      <td>${esc((r.tags || []).join(", "))}</td>
      <td>${fmtDate(r.createdAt)}</td>
      <td>
        <button class="action-link" onclick="openEditRoom('${r.id}','${esc(r.name)}','${esc(r.description || "")}','${esc(r.category)}','${esc((r.tags || []).join(","))}',${r.maxMembers},${r.isTrending})">Edit</button>
        <button class="action-link danger" onclick="deleteRoom('${r.id}','${esc(r.name)}')">Delete</button>
      </td>
    </tr>`).join("");
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search name, description, category, tags…" id="r-search" value="${esc(roomsState.search)}" />
        <span class="spacer"></span>
        ${exportButtons("rooms")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr>${sortSpec("Name", "name", roomsState, "")}<th>Description</th><th>Category</th>${sortSpec("Members", "current_members", roomsState, "current_members")}<th>Trending</th><th>Tags</th>${sortSpec("Created", "createdAt", roomsState, "")}<th>Actions</th></tr></thead>
          <tbody>${rows || emptyRow(8, "No rooms")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, (data.rooms || []).length, roomsState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="roomsPage(-1)" ${roomsState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="roomsPage(1)" ${roomsState.skip + roomsState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;
  bind("r-search", "search", roomsState);
}

function roomsPage(dir) {
  roomsState.skip = Math.max(0, roomsState.skip + dir * roomsState.limit);
  navigate();
}

function openEditRoom(id, name, description, category, tags, maxMembers, isTrending) {
  openModal("Edit room",
    `<div class="form-group"><label>Name</label><input id="r-name" value="${name}" /></div>
     <div class="form-group"><label>Description</label><textarea id="r-desc" rows="3">${description}</textarea></div>
     <div class="form-row">
       <div class="form-group"><label>Category</label><input id="r-cat" value="${category}" /></div>
       <div class="form-group"><label>Max members</label><input id="r-max" type="number" min="1" value="${maxMembers}" /></div>
     </div>
     <div class="form-group"><label>Tags (comma separated)</label><input id="r-tags" value="${tags}" /></div>
     <div class="form-group"><label><input type="checkbox" id="r-trending" ${isTrending ? "checked" : ""} /> Trending</label></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="save-room">Save changes</button>`);
  document.getElementById("save-room").onclick = async () => {
    const body = {
      name: val("r-name"),
      description: val("r-desc"),
      category: val("r-cat"),
      maxMembers: parseInt(val("r-max"), 10) || undefined,
      isTrending: document.getElementById("r-trending").checked,
      tags: val("r-tags").split(",").map(s => s.trim()).filter(Boolean),
    };
    try {
      await api("/rooms/" + id, { method: "PATCH", body });
      closeModal(); toast("Room updated", "success"); navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

async function deleteRoom(id, name) {
  openModal("Delete room?",
    `<p>This permanently deletes <strong>${esc(name)}</strong>, its memberships, mirror chat and all room messages.</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" id="confirm-delete">Delete room</button>`);
  document.getElementById("confirm-delete").onclick = async () => {
    try {
      await api("/rooms/" + id, { method: "DELETE" });
      closeModal(); toast("Room deleted", "success"); navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- Favorites ---------------- */

let favoritesState = { name: "favorites", sort: "", order: "", skip: 0, limit: 20 };

async function renderFavorites() {
  showLoading();
  const q = qSort(favoritesState);
  q.set("limit", favoritesState.limit);
  q.set("skip", favoritesState.skip);
  const data = await api("/favorites?" + q.toString());

  const rows = data.favorites.map(f => `
    <tr>
      <td><div class="user-cell"><img class="avatar" src="${esc(f.fromUser && f.fromUser.avatar)}" onerror="this.style.visibility='hidden'" /><div><div class="u-name">${esc((f.fromUser && (f.fromUser.name || f.fromUser.username)) || "deleted")}</div><div class="u-sub">${esc(f.fromUser && f.fromUser.email) || "—"}</div></div></div></td>
      <td>→</td>
      <td><div class="user-cell"><img class="avatar" src="${esc(f.toUser && f.toUser.avatar)}" onerror="this.style.visibility='hidden'" /><div><div class="u-name">${esc((f.toUser && (f.toUser.name || f.toUser.username)) || "deleted")}</div><div class="u-sub">${esc(f.toUser && f.toUser.email) || "—"}</div></div></div></td>
      <td>${fmtTime(f.createdAt)}</td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <span class="spacer"></span>
        ${exportButtons("favorites")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>From</th><th></th><th>To</th>${sortSpec("Time", "createdAt", favoritesState, "createdAt")}</tr></thead>
          <tbody>${rows || emptyRow(4, "No favorites yet")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, data.favorites.length, favoritesState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="favoritesPage(-1)" ${favoritesState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="favoritesPage(1)" ${favoritesState.skip + favoritesState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;
}

function favoritesPage(dir) {
  favoritesState.skip = Math.max(0, favoritesState.skip + dir * favoritesState.limit);
  navigate();
}

/* ---------------- Purchases ---------------- */

let purchasesState = { name: "purchases", status: "", sort: "", order: "", skip: 0, limit: 25 };

async function renderPurchases() {
  showLoading();
  const q = qSort(purchasesState);
  q.set("limit", purchasesState.limit);
  q.set("skip", purchasesState.skip);
  if (purchasesState.status) q.set("status", purchasesState.status);
  const data = await api("/purchases?" + q.toString());
  const rows = (data.purchases || []).map(p => `
    <tr>
      <td>${esc((p.buyer && (p.buyer.name || p.buyer.username)) || "deleted")}</td>
      <td>${esc((p.creator && (p.creator.name || p.creator.username)) || "deleted")}</td>
      <td>${fmtMoney(p.price)}${p.currency && p.currency !== "NGN" ? " " + esc(p.currency) : ""}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${fmtTime(p.createdAt)}</td>
    </tr>`).join("");
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <select id="p-status">
          <option value="">Status: all</option>
          <option value="completed" ${purchasesState.status === "completed" ? "selected" : ""}>Completed</option>
          <option value="pending" ${purchasesState.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="failed" ${purchasesState.status === "failed" ? "selected" : ""}>Failed</option>
        </select>
        <span class="spacer"></span>
        ${exportButtons("purchases")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Buyer</th><th>Creator</th>${sortSpec("Price", "price", purchasesState, "")}${sortSpec("Status", "status", purchasesState, "")}${sortSpec("Date", "created_at", purchasesState, "created_at")}</tr></thead>
          <tbody>${rows || emptyRow(5, "No purchases yet")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, (data.purchases || []).length, purchasesState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="purchasesPage(-1)" ${purchasesState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="purchasesPage(1)" ${purchasesState.skip + purchasesState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;
  bind("p-status", "status", purchasesState);
}

function purchasesPage(dir) {
  purchasesState.skip = Math.max(0, purchasesState.skip + dir * purchasesState.limit);
  navigate();
}

function statusBadge(status) {
  if (status === "completed") return '<span class="badge badge-green">completed</span>';
  if (status === "pending") return '<span class="badge badge-amber">pending</span>';
  if (status === "failed") return '<span class="badge badge-red">failed</span>';
  return '<span class="badge badge-gray">' + esc(status) + "</span>";
}

/* ---------------- Audit log ---------------- */

let auditState = { name: "audit", search: "", action: "", targetType: "", from: "", to: "", sort: "", order: "", skip: 0, limit: 50 };

async function renderAudit() {
  showLoading();
  const q = qSort(auditState);
  q.set("limit", auditState.limit);
  q.set("skip", auditState.skip);
  if (auditState.search) q.set("search", auditState.search);
  if (auditState.action) q.set("action", auditState.action);
  if (auditState.targetType) q.set("targetType", auditState.targetType);
  if (auditState.from) q.set("from", Math.floor(new Date(auditState.from).getTime() / 1000));
  if (auditState.to) q.set("to", Math.floor(new Date(auditState.to).getTime() / 1000));
  const data = await api("/audit-logs?" + q.toString());
  const rows = (data.logs || []).map(l => `
    <tr>
      <td><span class="badge badge-blue">${esc(l.action)}</span></td>
      <td>${esc(l.adminEmail)}</td>
      <td>${esc(l.targetType)} <span class="mono text-muted">${esc((l.targetId || "").slice(0, 12))}…</span></td>
      <td>${esc(l.details)}</td>
      <td>${esc(l.ipAddress)}</td>
      <td>${fmtTime(l.createdAt)}</td>
    </tr>`).join("");
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search admin, details, target…" id="a-search" value="${esc(auditState.search)}" />
        <select id="a-action">
          <option value="">Action: all</option>
          ${allAuditActions.map(a => `<option value="${a}" ${auditState.action === a ? "selected" : ""}>${a}</option>`).join("")}
        </select>
        <select id="a-type">
          <option value="">Target: all</option>
          <option value="user" ${auditState.targetType === "user" ? "selected" : ""}>user</option>
          <option value="post" ${auditState.targetType === "post" ? "selected" : ""}>post</option>
          <option value="chat" ${auditState.targetType === "chat" ? "selected" : ""}>chat</option>
          <option value="message" ${auditState.targetType === "message" ? "selected" : ""}>message</option>
          <option value="room" ${auditState.targetType === "room" ? "selected" : ""}>room</option>
          <option value="report" ${auditState.targetType === "report" ? "selected" : ""}>report</option>
          <option value="announcement" ${auditState.targetType === "announcement" ? "selected" : ""}>announcement</option>
        </select>
        <input type="date" id="a-from" value="${esc(auditState.from)}" title="From" />
        <input type="date" id="a-to" value="${esc(auditState.to)}" title="To" />
        <span class="spacer"></span>
        ${exportButtons("audit-logs")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Action</th><th>Admin</th><th>Target</th><th>Details</th><th>IP</th>${sortSpec("Time", "createdAt", auditState, "createdAt")}</tr></thead>
          <tbody>${rows || emptyRow(6, "No audit records match")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, (data.logs || []).length, auditState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="auditPage(-1)" ${auditState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="auditPage(1)" ${auditState.skip + auditState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;

  const bindAudit = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = () => { auditState[key] = el.value; auditState.skip = 0; navigate(); };
    if (el.tagName === "SELECT" || el.type === "date") el.onchange = handler;
    else { let t; el.oninput = () => { clearTimeout(t); t = setTimeout(handler, 400); }; }
  };
  bindAudit("a-search", "search");
  bindAudit("a-action", "action");
  bindAudit("a-type", "targetType");
  bindAudit("a-from", "from");
  bindAudit("a-to", "to");
}

const allAuditActions = [
  "suspend_user", "activate_user", "update_role", "update_user", "delete_user",
  "create_admin", "remove_admin", "delete_post", "delete_message", "delete_chat",
  "update_room", "delete_room", "resolved_report", "dismissed_report", "send_announcement",
];

function auditPage(dir) {
  auditState.skip = Math.max(0, auditState.skip + dir * auditState.limit);
  navigate();
}

/* ---------------- Reports ---------------- */

let reportsState = { name: "reports", search: "", status: "", targetType: "", sort: "", order: "", skip: 0, limit: 20 };

async function renderReports() {
  showLoading();
  const q = qSort(reportsState);
  q.set("limit", reportsState.limit);
  q.set("skip", reportsState.skip);
  if (reportsState.search) q.set("search", reportsState.search);
  if (reportsState.status) q.set("status", reportsState.status);
  if (reportsState.targetType) q.set("targetType", reportsState.targetType);
  const data = await api("/reports?" + q.toString());

  const rows = (data.reports || []).map(r => `
    <tr>
      <td><span class="badge ${r.status === "open" ? "badge-red" : r.status === "resolved" ? "badge-green" : "badge-gray"}">${esc(r.status)}</span></td>
      <td><div class="user-cell"><img class="avatar" src="${esc((r.reporter && r.reporter.avatar) || "")}" onerror="this.style.visibility='hidden'" /><div><div class="u-name">${esc((r.reporter && (r.reporter.name || r.reporter.username)) || "deleted")}</div><div class="u-sub">${esc(r.reporter && r.reporter.email) || "—"}</div></div></div></td>
      <td><span class="badge badge-blue">${esc(r.targetType)}</span> <span class="mono text-muted">${esc((r.targetId || "").slice(0, 10))}…</span></td>
      <td class="break-word">${esc(r.reason)}</td>
      <td class="break-word text-muted">${esc(r.details) || "—"}</td>
      <td>${fmtTime(r.createdAt)}</td>
      <td>
        ${r.status === "open" ? `
          <button class="action-link" onclick="openResolveReport('${r.id}','${esc(r.reason)}')">Resolve</button>
          <button class="action-link" onclick="updateReport('${r.id}','dismissed')">Dismiss</button>
        ` : `<span class="text-muted">${esc(r.resolution) || "—"}</span>`}
      </td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search reason or details…" id="r-search" value="${esc(reportsState.search)}" />
        <select id="r-status">
          <option value="">Status: all</option>
          <option value="open" ${reportsState.status === "open" ? "selected" : ""}>Open</option>
          <option value="resolved" ${reportsState.status === "resolved" ? "selected" : ""}>Resolved</option>
          <option value="dismissed" ${reportsState.status === "dismissed" ? "selected" : ""}>Dismissed</option>
        </select>
        <select id="r-type">
          <option value="">Target: all</option>
          <option value="user" ${reportsState.targetType === "user" ? "selected" : ""}>User</option>
          <option value="post" ${reportsState.targetType === "post" ? "selected" : ""}>Post</option>
          <option value="message" ${reportsState.targetType === "message" ? "selected" : ""}>Message</option>
          <option value="chat" ${reportsState.targetType === "chat" ? "selected" : ""}>Chat</option>
          <option value="room" ${reportsState.targetType === "room" ? "selected" : ""}>Room</option>
        </select>
        <span class="spacer"></span>
        ${exportButtons("reports")}
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Status</th><th>Reported by</th><th>Target</th><th>Reason</th><th>Details</th>${sortSpec("Date", "createdAt", reportsState, "createdAt")}<th>Actions</th></tr></thead>
          <tbody>${rows || emptyRow(7, "No reports")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, (data.reports || []).length, reportsState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="reportsPage(-1)" ${reportsState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="reportsPage(1)" ${reportsState.skip + reportsState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;
  bind("r-status", "status", reportsState);
  bind("r-type", "targetType", reportsState);
  bind("r-search", "search", reportsState);
}

function reportsPage(dir) {
  reportsState.skip = Math.max(0, reportsState.skip + dir * reportsState.limit);
  navigate();
}

function openResolveReport(id, reason) {
  openModal("Resolve report",
    `<p>Mark this report (${esc(reason)}) as resolved?</p>
     <div class="form-group"><label>Resolution note</label><textarea id="res-note" rows="3" placeholder="e.g. Content removed, user warned"></textarea></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="confirm-resolve">Mark resolved</button>`);
  document.getElementById("confirm-resolve").onclick = async () => {
    try {
      await api("/reports/" + id, { method: "PATCH", body: { status: "resolved", resolution: val("res-note") } });
      closeModal(); toast("Report resolved", "success"); navigate(); refreshReportBadge(true);
    } catch (e) { toast(e.message, "error"); }
  };
}

async function updateReport(id, status) {
  try {
    await api("/reports/" + id, { method: "PATCH", body: { status, resolution: "" } });
    toast(status === "dismissed" ? "Report dismissed" : "Report updated", "success");
    navigate(); refreshReportBadge(true);
  } catch (e) { toast(e.message, "error"); }
}

/* ---------------- Admins ---------------- */

async function renderAdmins() {
  showLoading();
  const data = await api("/users?role=admin&limit=100&sort=createdAt");
  const me = JSON.parse(localStorage.getItem(STORAGE_ADMIN) || "{}");

  const rows = (data.users || []).map(u => `
    <tr>
      <td>
        <div class="user-cell">
          <img class="avatar" src="${esc(u.avatar)}" onerror="this.onerror=null;this.src=avatarFallback('${esc(u.name || u.username)}')" />
          <div>
            <div class="u-name">${esc(u.name || u.username)} ${u.email === me.email ? '<span class="badge badge-blue">you</span>' : ""}</div>
            <div class="u-sub">${esc(u.email)} ${copyBtn(u.email, "email")}</div>
          </div>
        </div>
      </td>
      <td>${esc(u.username)}</td>
      <td>${fmtDate(u.createdAt)}</td>
      <td>
        <button class="action-link" onclick="location.hash='#/user/${u.id}'">View</button>
        ${u.email !== me.email ? `<button class="action-link danger" onclick="removeAdmin('${u.id}','${esc(u.email)}')">Remove</button>` : ""}
      </td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <span class="spacer"></span>
        <button class="btn btn-primary" id="open-create-admin">Create admin</button>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Admin</th><th>Username</th><th>Since</th><th>Actions</th></tr></thead>
          <tbody>${rows || emptyRow(4, "No admins found")}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("open-create-admin").onclick = openCreateAdmin;
}

function openCreateAdmin() {
  openModal("Create admin account",
    `<div class="form-group"><label>Email</label><input id="a-email" type="email" placeholder="admin2@zukaping.app" /></div>
     <div class="form-group"><label>Name</label><input id="a-name" placeholder="Full name" /></div>
     <div class="form-group"><label>Password</label><input id="a-pass" type="password" placeholder="min 8 chars" /></div>
     <div class="text-muted" style="font-size:12px">The new admin can sign in at the admin panel with these credentials.</div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="confirm-create-admin">Create admin</button>`);
  const emailEl = document.getElementById("a-email");
  if (emailEl) emailEl.focus();
  document.getElementById("confirm-create-admin").onclick = async () => {
    const email = val("a-email"), name = val("a-name"), password = val("a-pass");
    if (!email || !name || !password) { toast("Email, name and password are required", "error"); return; }
    try {
      await api("/admins", { method: "POST", body: { email, name, password } });
      closeModal();
      toast("Admin created", "success");
      navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

async function removeAdmin(id, email) {
  openModal("Remove admin access?", 
    `<p>This will demote <strong>${esc(email)}</strong> to a regular user. They will lose admin panel access immediately.</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" id="confirm-remove">Remove admin</button>`);
  document.getElementById("confirm-remove").onclick = async () => {
    try {
      await api("/admins/" + id, { method: "DELETE" });
      closeModal(); toast("Admin access removed", "success"); navigate();
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- Announcements ---------------- */

let announcementsState = { name: "announcements", search: "", sort: "", order: "", skip: 0, limit: 25 };

async function renderAnnouncements() {
  showLoading();
  const q = qSort(announcementsState);
  q.set("limit", announcementsState.limit);
  q.set("skip", announcementsState.skip);
  if (announcementsState.search) q.set("search", announcementsState.search);
  const data = await api("/announcements?" + q.toString());

  const rows = (data.announcements || []).map(a => `
    <tr>
      <td><strong>${esc(a.title)}</strong></td>
      <td class="break-word">${esc(a.body)}</td>
      <td><span class="badge badge-blue">${esc(a.audience)}</span></td>
      <td>${a.sentCount} notified</td>
      <td>${fmtTime(a.createdAt)}</td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel form-panel" style="margin-bottom:16px">
      <div class="section-title" style="margin-top:0">Send announcement</div>
      <div class="form-group"><label>Title</label><input id="ann-title" placeholder="e.g. New feature live!" /></div>
      <div class="form-group"><label>Message</label><textarea id="ann-body" rows="3" placeholder="Push notification text"></textarea></div>
      <button class="btn btn-primary" id="send-announcement">Send to all users</button>
      <div class="text-muted" style="font-size:12px;margin-top:8px">Sent as a push notification to every user who has push enabled.</div>
    </div>
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search title or message…" id="ann-search" value="${esc(announcementsState.search)}" />
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr>${sortSpec("Title", "title", announcementsState, "")}<th>Message</th><th>Audience</th><th>Reached</th>${sortSpec("Sent", "createdAt", announcementsState, "createdAt")}</tr></thead>
          <tbody>${rows || emptyRow(5, "No announcements sent yet")}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${pageInfo(data.total, (data.announcements || []).length, announcementsState)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="announcementsPage(-1)" ${announcementsState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="announcementsPage(1)" ${announcementsState.skip + announcementsState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;

  document.getElementById("send-announcement").onclick = async () => {
    const title = val("ann-title"), body = val("ann-body");
    if (!title || !body) { toast("Title and message are required", "error"); return; }
    try {
      await api("/announcements", { method: "POST", body: { title, body } });
      toast("Announcement sent", "success");
      navigate();
    } catch (e) { toast(e.message, "error"); }
  };
  bind("ann-search", "search", announcementsState);
}

function announcementsPage(dir) {
  announcementsState.skip = Math.max(0, announcementsState.skip + dir * announcementsState.limit);
  navigate();
}

/* ---------------- PWA install prompt ---------------- */

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener("appinstalled", () => { deferredPrompt = null; });

function showInstallBanner() {
  if (!deferredPrompt) return;
  if (localStorage.getItem("zukaping_install_dismissed") === "1") return;
  let b = document.getElementById("install-banner");
  if (b) return;
  b = document.createElement("div");
  b.id = "install-banner";
  b.innerHTML = '<span class="ib-text">Install ZukaPing Admin</span><button class="btn btn-ghost btn-small" onclick="dismissInstall()">Later</button><button class="btn btn-primary btn-small" onclick="doInstall()">Install</button>';
  document.body.appendChild(b);
}
function dismissInstall() {
  const b = document.getElementById("install-banner");
  if (b) b.remove();
  localStorage.setItem("zukaping_install_dismissed", "1");
  deferredPrompt = null;
}
function doInstall() {
  if (!deferredPrompt) { dismissInstall(); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((c) => {
    if (c.outcome === "accepted") console.log("admin installed");
    dismissInstall();
  });
}

/* ---------------- Init ---------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById("theme-btn");
  if (btn) btn.innerHTML = theme === "dark" ? icon("sun", 16) : icon("moon", 16);
}

(function initTheme() {
  const saved = localStorage.getItem("zukaping_admin_theme") || "light";
  applyTheme(saved);
})();

function toggleSidebar(force) {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const open = typeof force === "boolean" ? force : !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", open);
  backdrop.classList.toggle("open", open);
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  document.getElementById("login-error").style.display = "none";
  try {
    await doLogin(document.getElementById("email").value, document.getElementById("password").value);
  } catch (err) {
    const el = document.getElementById("login-error");
    el.textContent = err.message;
    el.style.display = "block";
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => logout(false));
document.getElementById("refresh-btn").addEventListener("click", () => navigate());
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});
document.getElementById("theme-btn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("zukaping_admin_theme", next);
});
document.getElementById("hamburger").addEventListener("click", () => toggleSidebar());
document.getElementById("sidebar-backdrop").addEventListener("click", () => toggleSidebar(false));
document.querySelectorAll(".nav a").forEach(a => a.addEventListener("click", () => toggleSidebar(false)));
document.querySelectorAll(".nav-group").forEach(g => {
  const key = "zukaping_nav_" + g.dataset.group;
  if (localStorage.getItem(key) === "collapsed") g.classList.add("collapsed");
  g.addEventListener("click", () => {
    g.classList.toggle("collapsed");
    localStorage.setItem(key, g.classList.contains("collapsed") ? "collapsed" : "open");
  });
});

window.addEventListener("hashchange", navigate);

if (requireAuth()) {
  navigate();
  setInterval(refreshReportBadge, 60000);
  setTimeout(showInstallBanner, 1500);
}
