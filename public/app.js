const $ = s => document.querySelector(s), view = $('#app');
let token = localStorage.getItem('token'), user = JSON.parse(localStorage.getItem('user') || 'null');
let cat = '', tab = '', authRole = 'public', authMode = 'login';
const IMG = { Arctic: 'Himadri.jpeg', Antarctic: 'dakshin.jpeg', Himalaya: 'HimalayanGlaciers.jpeg', Ocean: 'Southern Ocean.jpeg', Climate: 'Ice Cores.jpeg' };
const CATS = ['Arctic', 'Antarctic', 'Himalaya', 'Ocean', 'Climate'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = a => `/img/${IMG[a.category] || 'glacier.svg'}`;
const date = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
function toast(m, err) { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); setTimeout(() => t.className = 'toast', 2800); }
async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && token) logout(true);
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
const go = h => location.hash = h;
function logout(silent) { token = null; user = null; localStorage.clear(); if (!silent) toast('Logged out'); go('#/'); render(); }

function nav() {
  $('#nav').innerHTML = `<a class="brand" href="#/"><img src="/img/polar-portal-logo.png" alt="Polar Portal" class="site-logo"></a><nav>
  <a href="#/">Explore</a>${user ? `<a href="#/dashboard">${user.role === 'admin' ? 'Admin dashboard' : user.role === 'scientist' ? 'Scientist dashboard' : 'My dashboard'}</a><button onclick="logout()">Log out (${esc(user.name.split(' ')[0])})</button>` : `<a class="btn sm" href="#/login">Log in</a>`}</nav>`;
}
function card(a) {
  return `<article class="card" tabindex="0" onclick="go('#/article/${a._id}')" onkeydown="if(event.key==='Enter')go('#/article/${a._id}')">
  <img src="${img(a)}" alt="${esc(a.category)} polar scene"><div class="bd"><div><span class="tag ${a.type === 'Research Paper' ? 'paper' : ''}">${esc(a.type)}</span> <span class="tag">${esc(a.category)}</span></div>
  <h3>${esc(a.title)}</h3><p>${esc(a.summary)}</p><div class="meta"><span>${esc(a.authorName)}</span><span>${date(a.createdAt)}</span><span>${a.views} views</span></div></div></article>`;
}
async function list(q) { return api(`/articles?q=${encodeURIComponent(q || '')}&category=${cat}`); }

/* ---------- HOME ---------- */
async function home() {
view.innerHTML = `<section class="hero">
<img src="/img/hero.jpeg" alt="Polar landscape" class="hero-image">
<div><h1>Stories and science from the ends of the Earth</h1>
  <p>Read expedition reports, glacier studies and ocean research from India's polar scientists, and join the conversation.</p>
  <form class="search" onsubmit="event.preventDefault();doSearch()"><input id="q" placeholder="Search articles, papers or authors" aria-label="Search"><button class="btn">Search</button></form>
  <div class="chips">${['', ...CATS].map(c => `<button class="chip ${cat === c ? 'on' : ''}" onclick="setCat('${c}')">${c || 'All regions'}</button>`).join('')}</div></div></section>
  <section class="blk" id="trendBlk"><h2>Trending now</h2><p class="sub">The most read articles and papers this season.</p><div class="trend" id="trend"></div></section>
  <section class="blk"><h2 id="listTitle">Latest from the poles</h2><p class="sub" id="listSub">Approved by the portal editors.</p><div class="grid" id="list"></div></section>`;
  const t = await api('/articles/trending'); $('#trend').innerHTML = t.map(card).join('') || '<p class="empty">Nothing trending yet.</p>';
  await doSearch(true);
}
async function doSearch(keep) {
  const q = keep ? '' : $('#q').value.trim(), items = await list(q);
  $('#listTitle').textContent = q ? `Results for "${q}"` : (cat || 'Latest from the poles');
  $('#list').innerHTML = items.map(card).join('') || '<p class="empty">No articles found. Try another word or region.</p>';
  if (q) $('#trendBlk').style.display = 'none'; else $('#trendBlk').style.display = '';
}
function setCat(c) { cat = c; home(); }

/* ---------- ARTICLE ---------- */
async function article(id) {
  const { article: a, comments } = await api('/articles/' + id).catch(e => { view.innerHTML = `<p class="empty">${esc(e.message)}</p>`; throw e; });
  const body = a.content.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join('');
  const inner = `<span class="tag ${a.type === 'Research Paper' ? 'paper' : ''}">${esc(a.type)}</span> <span class="tag">${esc(a.category)}</span>
  <h1>${esc(a.title)}</h1><div class="meta"><span>By ${esc(a.authorName)}</span><span>${date(a.createdAt)}</span><span>${a.views} views</span></div>
  <p class="lead">${esc(a.summary)}</p><div class="body">${body}</div>`;
  view.innerHTML = `<div class="read"><div class="cover" style="background-image:url(${img(a)})"></div>
  ${a.type === 'Research Paper' ? `<div class="paper-box">${inner}</div>` : inner}
  <h2 style="margin:40px 0 14px">Discussion (${comments.length})</h2>
  ${user ? `<div class="form" style="margin-bottom:20px"><textarea id="ct" placeholder="Share a question or comment for the author"></textarea><div><button class="btn" onclick="addComment('${a._id}')">Post comment</button></div></div>`
    : `<p class="panel">Log in to comment on this ${esc(a.type.toLowerCase())}. <a href="#/login">Log in</a></p>`}
  <div id="cmts">${comments.map(c => `<div class="cmt"><b>${esc(c.userName)}</b> <small>${date(c.createdAt)}</small><p>${esc(c.text)}</p></div>`).join('') || '<p class="empty">No comments yet. Be the first to ask a question.</p>'}</div></div>`;
  window.scrollTo(0, 0);
}
async function addComment(id) {
  try { await api(`/articles/${id}/comments`, 'POST', { text: $('#ct').value }); toast('Comment posted'); article(id); } catch (e) { toast(e.message, 1); }
}

/* ---------- AUTH ---------- */
function login() {
  const reg = authMode === 'register';
  view.innerHTML = `<div class="auth"><div class="panel"><h2>${reg ? 'Create your account' : 'Welcome back'}</h2>
  <div class="roles">${['public', 'scientist', 'admin'].filter(r => !(reg && r === 'admin')).map(r => `<button class="role ${authRole === r ? 'on' : ''}" onclick="authRole='${r}';login()">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div>
  <form class="form" onsubmit="event.preventDefault();submitAuth()">
  ${reg ? '<label>Full name<input id="n" required></label>' : ''}<label>Email<input id="e" type="email" required></label>
  ${reg && authRole === 'scientist' ? '<label>Institution<input id="i" placeholder="e.g. NCPOR, Goa"></label>' : ''}
  <label>Password<input id="p" type="password" minlength="6" required></label><button class="btn">${reg ? 'Create account' : 'Log in'}</button></form>
  ${authRole !== 'admin' ? `<p class="sub" style="margin:16px 0 0">${reg ? 'Already registered?' : 'New here?'} <a href="#" onclick="event.preventDefault();authMode='${reg ? 'login' : 'register'}';login()">${reg ? 'Log in' : 'Create an account'}</a></p>` : ''}
  </div></div>`;
}
async function submitAuth() {
  const reg = authMode === 'register';
  try {
    const d = await api('/auth/' + (reg ? 'register' : 'login'), 'POST', { name: $('#n')?.value, email: $('#e').value, password: $('#p').value, role: authRole, institution: $('#i')?.value });
    token = d.token; user = d.user; localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
    toast('Welcome, ' + user.name); tab = ''; go('#/dashboard');
  } catch (e) { toast(e.message, 1); }
}

/* ---------- DASHBOARDS ---------- */
const tabs = (items, cur) => `<div class="tabs">${items.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" onclick="tab='${k}';dashboard()">${l}</button>`).join('')}</div>`;
const status = a => `<span class="tag st-${a.status}">${a.status[0].toUpperCase() + a.status.slice(1)}</span>`;
async function dashboard() {
  if (!user) return go('#/login');
  const h = `<div class="dash"><h1>Hello, ${esc(user.name)}</h1>`;
  if (user.role === 'admin') return adminDash(h);
  if (user.role === 'scientist') return sciDash(h);
  tab = tab || 'trend';
  const my = await api('/me/comments'), t = await api('/articles/trending');
  view.innerHTML = h + `<p class="sub">Read, search and comment on polar research.</p><a class="btn" href="#/">Search articles</a>` + tabs([['trend', 'Trending'], ['cmt', 'My comments']], tab) +
    (tab === 'trend' ? `<div class="grid">${t.map(card).join('')}</div>` : my.map(c => `<div class="cmt"><b>${esc(c.article?.title || 'Removed article')}</b> <small>${date(c.createdAt)}</small><p>${esc(c.text)}</p></div>`).join('') || '<p class="empty">You have not commented yet.</p>') + '</div>';
}
async function sciDash(h) {
  tab = tab || 'mine';
  let body = '';
  if (tab === 'publish') body = `<div class="panel"><h2>Submit for review</h2><p class="sub">The admin must approve your work before it appears on the portal.</p>
  <form class="form" onsubmit="event.preventDefault();publish()"><label>Title<input id="t" required></label>
  <div class="row"><label style="flex:1">Type<select id="ty"><option>Article</option><option>Research Paper</option></select></label><label style="flex:1">Region<select id="c">${CATS.map(c => `<option>${c}</option>`).join('')}</select></label></div>
  <label>Short summary<input id="s" required maxlength="300"></label><label>Full content (blank line between paragraphs)<textarea id="ct" style="min-height:260px" required></textarea></label><div><button class="btn">Submit to admin</button></div></form></div>`;
  else if (tab === 'mine') { const m = await api('/my/articles'); body = m.map(a => `<div class="panel"><div class="row"><div><h3>${esc(a.title)}</h3><div class="meta"><span>${esc(a.type)}</span><span>${esc(a.category)}</span><span>${date(a.createdAt)}</span><span>${a.views} views</span><span>${a.commentCount} comments</span></div></div>${status(a)}</div>
    ${a.reviewNote ? `<p class="sub" style="margin:10px 0 0">Admin note: ${esc(a.reviewNote)}</p>` : ''}${a.status === 'approved' ? `<p style="margin-top:10px"><a href="#/article/${a._id}">Open published page</a></p>` : a.status === 'pending' ? '<p class="sub" style="margin:10px 0 0">Waiting for admin approval.</p>' : ''}</div>`).join('') || '<p class="empty">You have not submitted anything yet. Choose Publish new.</p>'; }
  else if (tab === 'feedback') { const c = await api('/my/comments'); body = c.map(x => `<div class="cmt"><b>${esc(x.userName)}</b> on <a href="#/article/${x.article?._id}">${esc(x.article?.title)}</a> <small>${date(x.createdAt)}</small><p>${esc(x.text)}</p></div>`).join('') || '<p class="empty">No public comments yet.</p>'; }
  else { const l = await list(''); body = `<div class="grid">${l.map(card).join('')}</div>`; }
  view.innerHTML = h + tabs([['mine', 'My submissions'], ['publish', 'Publish new'], ['feedback', 'Public feedback'], ['browse', 'Browse research']], tab) + body + '</div>';
}
async function publish() {
  try { await api('/my/articles', 'POST', { title: $('#t').value, type: $('#ty').value, category: $('#c').value, summary: $('#s').value, content: $('#ct').value }); toast('Submitted for admin approval'); tab = 'mine'; dashboard(); } catch (e) { toast(e.message, 1); }
}
async function adminDash(h) {
  tab = tab || 'overview'; let body = '';
  if (tab === 'overview') { const s = await api('/admin/stats'); body = `<div class="stats">${Object.entries({ 'Pending review': s.pending, 'Published': s.approved, 'Rejected': s.rejected, 'Scientists': s.scientists, 'Public users': s.users, 'Comments': s.comments, 'Total views': s.views }).map(([k, v]) => `<div class="stat"><b>${v}</b>${k}</div>`).join('')}</div>`; }
  if (tab === 'review' || tab === 'all') { const l = await api('/admin/articles' + (tab === 'review' ? '?status=pending' : '')); body = l.map(a => `<div class="panel"><div class="row"><div><h3>${esc(a.title)}</h3><div class="meta"><span>${esc(a.authorName)}</span><span>${esc(a.type)}</span><span>${esc(a.category)}</span><span>${date(a.createdAt)}</span></div></div>${status(a)}</div>
    <p style="margin:10px 0">${esc(a.summary)}</p><details><summary>Read full content</summary><p style="white-space:pre-wrap;margin-top:8px">${esc(a.content)}</p></details>
    <div class="row" style="margin-top:14px"><input id="n${a._id}" placeholder="Note to scientist (optional)" value="${esc(a.reviewNote || '')}" style="max-width:380px"><div style="display:flex;gap:8px">
    ${a.status !== 'approved' ? `<button class="btn sm" onclick="review('${a._id}','approved')">Approve</button>` : ''}${a.status !== 'rejected' ? `<button class="btn sm bad" onclick="review('${a._id}','rejected')">Reject</button>` : ''}<button class="btn sm ghost" onclick="delArticle('${a._id}')">Delete</button></div></div></div>`).join('') || '<p class="empty">Nothing here. All caught up.</p>'; }
  if (tab === 'users') { const u = await api('/admin/users'); body = `<div class="panel" style="overflow:auto"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr>${u.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${x.role}</td><td>${date(x.createdAt)}</td><td>${x.role === 'admin' ? '' : `<button class="btn sm ${x.active ? 'ghost' : ''}" onclick="toggleUser('${x._id}',${!x.active})">${x.active ? 'Disable' : 'Enable'}</button>`}</td></tr>`).join('')}</table></div>`; }
  if (tab === 'comments') { const c = await api('/admin/comments'); body = c.map(x => `<div class="cmt row"><div><b>${esc(x.userName)}</b> on ${esc(x.article?.title)} <small>${date(x.createdAt)}</small><p>${esc(x.text)}</p></div><button class="btn sm bad" onclick="delComment('${x._id}')">Remove</button></div>`).join('') || '<p class="empty">No comments.</p>'; }
  view.innerHTML = h + tabs([['overview', 'Overview'], ['review', 'Pending approvals'], ['all', 'All content'], ['users', 'Users'], ['comments', 'Comments']], tab) + body + '</div>';
}
const act = async (fn, msg) => { try { await fn(); toast(msg); dashboard(); } catch (e) { toast(e.message, 1); } };
const review = (id, st) => act(() => api('/admin/articles/' + id, 'PATCH', { status: st, reviewNote: $('#n' + id).value }), st === 'approved' ? 'Approved and published' : 'Rejected');
const delArticle = id => confirm('Delete this article and its comments?') && act(() => api('/admin/articles/' + id, 'DELETE'), 'Deleted');
const toggleUser = (id, a) => act(() => api('/admin/users/' + id, 'PATCH', { active: a }), a ? 'User enabled' : 'User disabled');
const delComment = id => act(() => api('/admin/comments/' + id, 'DELETE'), 'Comment removed');

/* ---------- ROUTER ---------- */
async function render() {
  nav(); const h = location.hash || '#/';
  try {
    if (h.startsWith('#/article/')) await article(h.split('/')[2]);
    else if (h === '#/login') login();
    else if (h === '#/dashboard') await dashboard();
    else await home();
  } catch (e) { if (!view.innerHTML) view.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
addEventListener('hashchange', () => { tab = h2(); render(); });
function h2() { return ''; }
render();
