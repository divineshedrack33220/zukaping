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
  return v == null ? "—" : "$" + Number(v).toFixed(2);
}

function toast(msg, type) {
  const el = document.createElement("div");
  el.className = "toast " + (type || "success");
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showLoading() {
  document.getElementById("content").innerHTML =
    '<div class="loading"><div class="spinner"></div>Loading...</div>';
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

function openModal(title, bodyHTML, footerHTML) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHTML;
  document.getElementById("modal-footer").innerHTML = footerHTML || "";
  document.getElementById("modal-overlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

/* ---------------- API ---------------- */

async function api(path, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers || {});
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

/* ---------------- Auth ---------------- */

function setAdminMe(admin) {
  localStorage.setItem(STORAGE_ADMIN, JSON.stringify(admin || {}));
  if (admin) {
    document.getElementById("admin-name").textContent = admin.name || admin.email || "Admin";
    document.getElementById("admin-email").textContent = admin.email || "";
    document.getElementById("admin-avatar").src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(admin.name || "A") + "&background=026AFD&color=fff";
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
}

/* ---------------- Router ---------------- */

const routes = {
  "dashboard": { title: "Dashboard", render: renderDashboard },
  "users": { title: "Users", render: renderUsers },
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

async function navigate() {
  const { route, params } = parseHash();
  const def = routes[route] || routes.dashboard;
  document.getElementById("page-title").textContent = def.title;
  document.querySelectorAll(".nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.route === route);
  });
  if (charts && Object.keys(charts).length) {
    Object.values(charts).forEach(ch => ch && ch.destroy());
    charts = {};
  }
  current = { route, params, data: null };
  try {
    await def.render(params);
  } catch (e) {
    document.getElementById("content").innerHTML =
      '<div class="empty">Error: ' + esc(e.message) + "</div>";
  }
}

/* ---------------- Dashboard ---------------- */

async function renderDashboard() {
  showLoading();
  const [overview, trends] = await Promise.all([
    api("/stats/overview"),
    api("/stats/trends?days=7"),
  ]);
  const u = overview.users, co = overview.content, en = overview.engagement, cm = overview.commerce;

  document.getElementById("content").innerHTML = `
    <div class="cards">
      <div class="stat-card primary"><div class="label">Total Users</div><div class="value">${u.total}</div><div class="hint">+${u.new7d} in 7 days</div></div>
      <div class="stat-card green"><div class="label">Complete</div><div class="value">${u.complete}</div><div class="hint">${u.incomplete} incomplete</div></div>
      <div class="stat-card"><div class="label">Active Now</div><div class="value">${u.activeNow}</div><div class="hint">${u.activeToday} active today</div></div>
      <div class="stat-card red"><div class="label">Suspended</div><div class="value">${u.suspended}</div></div>
      <div class="stat-card"><div class="label">New Today</div><div class="value">${u.newToday}</div><div class="hint">${u.new30d} in 30 days</div></div>
    </div>
    <div class="cards">
      <div class="stat-card"><div class="label">Posts</div><div class="value">${co.posts}</div><div class="hint">${co.postsToday} today</div></div>
      <div class="stat-card"><div class="label">Messages</div><div class="value">${co.messages}</div><div class="hint">${co.messagesToday} today</div></div>
      <div class="stat-card"><div class="label">Favorites</div><div class="value">${en.favorites}</div><div class="hint">${en.favoritesToday} today</div></div>
      <div class="stat-card"><div class="label">Chats</div><div class="value">${en.chats}</div><div class="hint">${en.rooms} rooms · ${en.roomMembers} members</div></div>
      <div class="stat-card amber"><div class="label">Revenue</div><div class="value">${fmtMoney(cm.revenue)}</div><div class="hint">${cm.completed} purchases</div></div>
    </div>
    <div class="section-title">Trends — last 7 days</div>
    <div class="charts">
      <div class="chart-card"><h4>Signups</h4><div class="chart-box"><canvas id="ch-signups"></canvas></div></div>
      <div class="chart-card"><h4>Messages</h4><div class="chart-box"><canvas id="ch-messages"></canvas></div></div>
      <div class="chart-card"><h4>Posts</h4><div class="chart-box"><canvas id="ch-posts"></canvas></div></div>
      <div class="chart-card"><h4>Favorites</h4><div class="chart-box"><canvas id="ch-favorites"></canvas></div></div>
    </div>`;

  const labels = trends.signups.map((_, i) => {
    const d = new Date((trends.startDate + i * 86400) * 1000);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
  makeLineChart("ch-signups", labels, trends.signups, "#026AFD", "New users");
  makeLineChart("ch-messages", labels, trends.messages, "#16a34a", "Messages");
  makeLineChart("ch-posts", labels, trends.posts, "#d97706", "Posts");
  makeLineChart("ch-favorites", labels, trends.favorites, "#dc2626", "Favorites");
}

function makeLineChart(id, labels, data, color, label) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (typeof Chart === "undefined") {
    ctx.parentElement.innerHTML = '<div class="empty">Chart library not loaded</div>';
    return;
  }
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
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

/* ---------------- Users ---------------- */

let usersState = { search: "", complete: "", suspended: "", provider: "", role: "", skip: 0, limit: 20 };

async function renderUsers(params) {
  showLoading();
  if (params.id) { renderUserDetail(params); return; }
  const q = new URLSearchParams();
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
      <td>
        <div class="user-cell">
          <img class="avatar" src="${esc(u.avatar)}" onerror="this.src='https://ui-avatars.com/api/?name=${esc(u.username)}&background=e2e8f0&color=64748b'" />
          <div>
            <div class="u-name">${esc(u.name || u.username)}</div>
            <div class="u-sub">${esc(u.email)}</div>
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
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th>User</th><th>Username</th><th>Profile</th><th>Status</th><th>Provider</th>
            <th>Joined</th><th>Last Seen</th><th>Actions</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="empty">No users found</td></tr>'}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${data.total} total · showing ${usersState.skip + 1}–${Math.min(usersState.skip + data.users.length, data.total)}</div>
        <div class="pager">
          <button class="btn btn-ghost btn-small" onclick="usersPage(-1)" ${usersState.skip === 0 ? "disabled" : ""}>← Prev</button>
          <button class="btn btn-ghost btn-small" onclick="usersPage(1)" ${usersState.skip + usersState.limit >= data.total ? "disabled" : ""}>Next →</button>
        </div>
      </div>
    </div>`;

  bind("u-search", "search", "users");
  bind("u-complete", "complete", "users");
  bind("u-suspended", "suspended", "users");
  bind("u-role", "role", "users");
  bind("u-provider", "provider", "users");
}

function usersPage(dir) {
  usersState.skip = Math.max(0, usersState.skip + dir * usersState.limit);
  navigate();
}

function bind(id, key, route) {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = () => {
    usersState[key] = el.value;
    usersState.skip = 0;
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
  showLoading();
  const u = await api("/users/" + params.id);
  document.getElementById("page-title").textContent = "User: " + (u.name || u.username);
  const act = u.activity || {};
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="modal-body" style="padding:20px">
        <div class="profile-head">
          <img src="${esc(u.avatar)}" onerror="this.src='https://ui-avatars.com/api/?name=${esc(u.username)}&background=e2e8f0&color=64748b'" />
          <div>
            <div class="ph-name">${esc(u.name || u.username)} <span style="font-weight:400;color:var(--text-muted)">@${esc(u.username)}</span></div>
            <div class="ph-sub">${esc(u.email)}</div>
            <div style="margin-top:6px">${badge(u.isSuspended, u.role)} ${completeBadge(u.complete)}</div>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><div class="k">Bio</div><div class="v">${esc(u.bio) || "—"}</div></div>
          <div class="detail-item"><div class="k">Gender</div><div class="v">${esc(u.gender) || "—"}</div></div>
          <div class="detail-item"><div class="k">Provider</div><div class="v">${esc(u.authProvider)}</div></div>
          <div class="detail-item"><div class="k">Photos</div><div class="v">${u.photos}</div></div>
          <div class="detail-item"><div class="k">Joined</div><div class="v">${fmtTime(u.createdAt)}</div></div>
          <div class="detail-item"><div class="k">Last Seen</div><div class="v">${fmtTime(u.lastSeen)}</div></div>
          <div class="detail-item"><div class="k">Interested In</div><div class="v">${esc((u.interestedIn || []).join(", ")) || "—"}</div></div>
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
        ${u.role !== "admin" ? `
          <button class="btn ${u.isSuspended ? "btn-primary" : "btn-danger"}" onclick="toggleSuspend('${u.id}','${esc(u.email)}',${u.isSuspended})">${u.isSuspended ? "Activate account" : "Suspend account"}</button>
        ` : ""}
        <button class="btn btn-danger" onclick="deleteUser('${u.id}','${esc(u.email)}')">Delete user</button>
      </div>
    </div>`;
}

/* ---------------- Posts ---------------- */

let postsState = { search: "", skip: 0, limit: 20 };

async function renderPosts() {
  showLoading();
  const q = new URLSearchParams({ limit: postsState.limit, skip: postsState.skip });
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
      <td>${p.media.length}</td>
      <td>${fmtDate(p.createdAt)}</td>
      <td><button class="action-link danger" onclick="deletePost('${p.id}')">Delete</button></td>
    </tr>`).join("");

  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div class="table-toolbar">
        <input class="search" placeholder="Search post content…" id="p-search" value="${esc(postsState.search)}" />
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Author</th><th>Content</th><th>Category</th><th>Media</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No posts found</td></tr>'}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${data.total} total</div>
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

let chatsState = { skip: 0, limit: 20 };

async function renderChats() {
  showLoading();
  const q = new URLSearchParams({ limit: chatsState.limit, skip: chatsState.skip });
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
          <thead><tr><th>Type</th><th>Name</th><th>Participants</th><th>Last Message</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty">No chats found</td></tr>'}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${data.total} total</div>
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
       <tbody>${msgs || '<tr><td colspan="4" class="empty">No messages</td></tr>'}</tbody></table>`,
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

let messagesState = { search: "", skip: 0, limit: 20 };

async function renderMessages() {
  showLoading();
  const q = new URLSearchParams({ limit: messagesState.limit, skip: messagesState.skip });
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
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Sender</th><th>Content</th><th>Type</th><th>Status</th><th>Sent</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No messages found</td></tr>'}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${data.total} total</div>
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

async function renderRooms() {
  showLoading();
  const data = await api("/rooms?limit=100");
  const rows = (data.rooms || []).map(r => `
    <tr>
      <td><strong>${esc(r.name)}</strong></td>
      <td>${esc(r.description)}</td>
      <td><span class="badge badge-blue">${esc(r.category)}</span></td>
      <td>${r.currentMembers} / ${r.maxMembers}</td>
      <td>${r.isTrending ? '<span class="badge badge-amber">trending</span>' : "—"}</td>
      <td>${esc((r.tags || []).join(", "))}</td>
      <td>${fmtDate(r.createdAt)}</td>
    </tr>`).join("");
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Category</th><th>Members</th><th>Trending</th><th>Tags</th><th>Created</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="empty">No rooms</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------------- Favorites ---------------- */

let favoritesState = { skip: 0, limit: 20 };

async function renderFavorites() {
  showLoading();
  const q = new URLSearchParams({ limit: favoritesState.limit, skip: favoritesState.skip });
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
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>From</th><th></th><th>To</th><th>Time</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty">No favorites yet</td></tr>'}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <div class="page-info">${data.total} total</div>
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

async function renderPurchases() {
  showLoading();
  const data = await api("/purchases?limit=100");
  const rows = (data.purchases || []).map(p => `
    <tr>
      <td>${esc((p.buyer && (p.buyer.name || p.buyer.username)) || "deleted")}</td>
      <td>${esc((p.creator && (p.creator.name || p.creator.username)) || "deleted")}</td>
      <td>${fmtMoney(p.price)} ${esc(p.currency || "")}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${fmtTime(p.createdAt)}</td>
    </tr>`).join("");
  document.getElementById("content").innerHTML = `
    <div class="panel">
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Buyer</th><th>Creator</th><th>Price</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty">No purchases yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function statusBadge(status) {
  if (status === "completed") return '<span class="badge badge-green">completed</span>';
  if (status === "pending") return '<span class="badge badge-amber">pending</span>';
  if (status === "failed") return '<span class="badge badge-red">failed</span>';
  return '<span class="badge badge-gray">' + esc(status) + "</span>";
}

/* ---------------- Audit log ---------------- */

async function renderAudit() {
  showLoading();
  const data = await api("/audit-logs?limit=100");
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
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Action</th><th>Admin</th><th>Target</th><th>Details</th><th>IP</th><th>Time</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No audit records yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------------- Init ---------------- */

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

window.addEventListener("hashchange", navigate);

requireAuth();
navigate();
