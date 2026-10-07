require('dotenv').config();
const express = require('express'), mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'), cors = require('cors');
const app = express();
app.use(cors(), express.json());
app.use(express.static('public'));
const SECRET = process.env.JWT_SECRET || 'dev_secret';
const oid = mongoose.Schema.Types.ObjectId;

/* ---------- MODELS ---------- */
const User = mongoose.model('User', new mongoose.Schema({
  name: String, email: { type: String, unique: true, lowercase: true },
  password: String, role: { type: String, enum: ['public', 'scientist', 'admin'], default: 'public' },
  institution: String, active: { type: Boolean, default: true }
}, { timestamps: true }));
const Article = mongoose.model('Article', new mongoose.Schema({
  title: String, summary: String, content: String,
  category: { type: String, default: 'Arctic' },            // Arctic, Antarctic, Himalaya, Ocean, Climate
  type: { type: String, default: 'Article' },               // Article | Research Paper
  author: { type: oid, ref: 'User' }, authorName: String,
  status: { type: String, default: 'pending' },             // pending | approved | rejected
  reviewNote: String, views: { type: Number, default: 0 }
}, { timestamps: true }));
const Comment = mongoose.model('Comment', new mongoose.Schema({
  article: { type: oid, ref: 'Article' }, user: { type: oid, ref: 'User' },
  userName: String, text: String
}, { timestamps: true }));

/* ---------- AUTH ---------- */
const sign = u => jwt.sign({ id: u._id, role: u.role, name: u.name }, SECRET, { expiresIn: '7d' });
const auth = (...roles) => async (req, res, next) => {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const p = jwt.verify(t, SECRET);
    const u = await User.findById(p.id);
    if (!u || !u.active) return res.status(403).json({ error: 'Account disabled or not found' });
    if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'Not allowed' });
    req.user = u; next();
  } catch { res.status(401).json({ error: 'Please log in' }); }
};
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(500).json({ error: e.message }));

app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, role, institution } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ error: 'Email already registered' });
  const u = await User.create({ name, email, institution, role: role === 'scientist' ? 'scientist' : 'public', password: await bcrypt.hash(password, 10) });
  res.json({ token: sign(u), user: { name: u.name, role: u.role } });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password, role } = req.body;
  const u = await User.findOne({ email: (email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(password || '', u.password))) return res.status(400).json({ error: 'Wrong email or password' });
  if (!u.active) return res.status(403).json({ error: 'This account has been disabled by the admin' });
  if (role && u.role !== role) return res.status(403).json({ error: `This account is a ${u.role} account. Choose the ${u.role} login.` });
  res.json({ token: sign(u), user: { name: u.name, role: u.role } });
}));

/* ---------- PUBLIC ARTICLES ---------- */
app.get('/api/articles', wrap(async (req, res) => {
  const { q, category, type } = req.query, f = { status: 'approved' };
  if (category) f.category = category;
  if (type) f.type = type;
  if (q) { const r = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ title: r }, { summary: r }, { content: r }, { authorName: r }]; }
  res.json(await Article.find(f).select('-content').sort('-createdAt'));
}));
app.get('/api/articles/trending', wrap(async (req, res) => {
  res.json(await Article.find({ status: 'approved' }).select('-content').sort('-views').limit(5));
}));
app.get('/api/articles/:id', wrap(async (req, res) => {
  const a = await Article.findOneAndUpdate({ _id: req.params.id, status: 'approved' }, { $inc: { views: 1 } }, { new: true });
  if (!a) return res.status(404).json({ error: 'Article not found' });
  res.json({ article: a, comments: await Comment.find({ article: a._id }).sort('-createdAt') });
}));
app.post('/api/articles/:id/comments', auth(), wrap(async (req, res) => {
  if (!req.body.text || !req.body.text.trim()) return res.status(400).json({ error: 'Write a comment first' });
  const a = await Article.findOne({ _id: req.params.id, status: 'approved' });
  if (!a) return res.status(404).json({ error: 'Article not found' });
  res.json(await Comment.create({ article: a._id, user: req.user._id, userName: req.user.name, text: req.body.text.trim() }));
}));

/* ---------- PUBLIC USER ---------- */
app.get('/api/me/comments', auth(), wrap(async (req, res) => {
  res.json(await Comment.find({ user: req.user._id }).populate('article', 'title').sort('-createdAt'));
}));

/* ---------- SCIENTIST ---------- */
app.post('/api/my/articles', auth('scientist'), wrap(async (req, res) => {
  const { title, summary, content, category, type } = req.body;
  if (!title || !summary || !content) return res.status(400).json({ error: 'Title, summary and content are required' });
  res.json(await Article.create({ title, summary, content, category, type, author: req.user._id, authorName: req.user.name, status: 'pending' }));
}));
app.get('/api/my/articles', auth('scientist'), wrap(async (req, res) => {
  const list = await Article.find({ author: req.user._id }).sort('-createdAt').lean();
  for (const a of list) a.commentCount = await Comment.countDocuments({ article: a._id });
  res.json(list);
}));
app.get('/api/my/comments', auth('scientist'), wrap(async (req, res) => {
  const ids = (await Article.find({ author: req.user._id }).select('_id')).map(a => a._id);
  res.json(await Comment.find({ article: { $in: ids } }).populate('article', 'title').sort('-createdAt'));
}));

/* ---------- ADMIN ---------- */
app.get('/api/admin/stats', auth('admin'), wrap(async (req, res) => {
  const [users, scientists, approved, pending, rejected, comments, v] = await Promise.all([
    User.countDocuments({ role: 'public' }), User.countDocuments({ role: 'scientist' }),
    Article.countDocuments({ status: 'approved' }), Article.countDocuments({ status: 'pending' }),
    Article.countDocuments({ status: 'rejected' }), Comment.countDocuments(),
    Article.aggregate([{ $group: { _id: null, t: { $sum: '$views' } } }])]);
  res.json({ users, scientists, approved, pending, rejected, comments, views: v[0]?.t || 0 });
}));
app.get('/api/admin/articles', auth('admin'), wrap(async (req, res) => {
  res.json(await Article.find(req.query.status ? { status: req.query.status } : {}).sort('-createdAt'));
}));
app.patch('/api/admin/articles/:id', auth('admin'), wrap(async (req, res) => {
  const { status, reviewNote } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  res.json(await Article.findByIdAndUpdate(req.params.id, { status, reviewNote }, { new: true }));
}));
app.delete('/api/admin/articles/:id', auth('admin'), wrap(async (req, res) => {
  await Article.findByIdAndDelete(req.params.id); await Comment.deleteMany({ article: req.params.id }); res.json({ ok: true });
}));
app.get('/api/admin/users', auth('admin'), wrap(async (req, res) => res.json(await User.find().select('-password').sort('-createdAt'))));
app.patch('/api/admin/users/:id', auth('admin'), wrap(async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ error: 'You cannot disable your own account' });
  res.json(await User.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true }).select('-password'));
}));
app.get('/api/admin/comments', auth('admin'), wrap(async (req, res) => res.json(await Comment.find().populate('article', 'title').sort('-createdAt').limit(100))));
app.delete('/api/admin/comments/:id', auth('admin'), wrap(async (req, res) => { await Comment.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

/* ---------- SEED + START ---------- */
async function seed() {
  const hash = p => bcrypt.hash(p, 10);
  if (!(await User.findOne({ role: 'admin' })))
    await User.create({ name: 'Portal Admin', email: process.env.ADMIN_EMAIL || 'admin@polar.in', password: await hash(process.env.ADMIN_PASSWORD || 'Admin@123'), role: 'admin' });
  if (await Article.countDocuments()) return;
  const sci = await User.create({ name: 'Dr. Asha Menon', email: 'scientist@polar.in', institution: 'NCPOR, Goa', password: await hash('Sci@12345'), role: 'scientist' });
  await User.create({ name: 'Demo Reader', email: 'public@polar.in', password: await hash('Public@123'), role: 'public' });
  const A = (title, category, type, summary, content, views) => ({ title, category, type, summary, content, views, status: 'approved', author: sci._id, authorName: sci.name });
  await Article.insertMany([
    A('India in Antarctica: Four Decades of Dakshin Gangotri to Bharati', 'Antarctic', 'Article', 'How India built its polar presence from a 1981 expedition to the Bharati and Maitri research stations.', 'India launched its first Antarctic expedition in December 1981.\n\nDakshin Gangotri, the first station, was set up in 1983-84 on the ice shelf. It was later buried by snow and replaced by Maitri in 1989 on the Schirmacher Oasis.\n\nBharati, commissioned in 2012 on the Larsemann Hills, gave India a modern year-round station. Each austral summer, scientists study glaciology, atmospheric science, geology and marine biology here.', 980),
    A('Himadri: Studying Arctic Fjords from Svalbard', 'Arctic', 'Research Paper', 'Observations of Kongsfjorden water properties and glacier retreat from India\'s Arctic station.', 'Himadri, India\'s Arctic research station, opened in 2008 at Ny-Alesund, Svalbard.\n\nOur multi-year measurements of Kongsfjorden show strong seasonal changes in temperature and salinity linked to glacier meltwater and the inflow of Atlantic water.\n\nThese records help model how warming affects fjord ecosystems, from plankton to seabirds.', 760),
    A('Himalayan Glaciers: The Third Pole Under Watch', 'Himalaya', 'Article', 'Why the Himalayan cryosphere matters for rivers feeding hundreds of millions of people.', 'The Hindu Kush Himalaya holds the largest ice mass outside the polar regions, which is why it is called the Third Pole.\n\nGlacier mass balance studies at stations like Himansh track how much snow is gained and lost each year.\n\nMelting patterns affect river flow, flood risk from glacial lakes and long-term water security.', 640),
    A('Southern Ocean Carbon Sink: What Krill and Currents Tell Us', 'Ocean', 'Research Paper', 'A study of how the Southern Ocean absorbs atmospheric CO2 and the role of marine life.', 'The Southern Ocean absorbs a large share of the carbon dioxide humans release.\n\nCold water dissolves more gas, and upwelling and mixing move carbon to the deep ocean. Phytoplankton blooms also pull carbon from the surface.\n\nChanges in sea ice and winds may alter this balance, so continuous ship-based sampling is essential.', 520),
    A('Reading Climate History from Ice Cores', 'Climate', 'Article', 'Tiny trapped air bubbles in polar ice preserve hundreds of thousands of years of climate data.', 'Ice cores are cylinders drilled from glaciers and ice sheets.\n\nEach layer records snowfall, and bubbles inside hold ancient air. Analysing them reveals past carbon dioxide levels and temperatures.\n\nThis record shows that today\'s greenhouse gas levels are unmatched in the last 800,000 years.', 430),
    A('Life at -89°C: Penguins, Skuas and the Antarctic Food Web', 'Antarctic', 'Article', 'A look at the animals that survive on the coldest continent and what they eat.', 'Emperor and Adelie penguins breed on the sea ice and coast, relying on krill and fish.\n\nSkuas and petrels hunt along the coast, while seals and whales feed in nutrient-rich waters.\n\nShrinking sea ice can disrupt this web because krill depend on algae growing under the ice.', 350)
  ]);
  const ar = await Article.findOne({ category: 'Arctic' });
  await Comment.create({ article: ar._id, user: (await User.findOne({ role: 'public' }))._id, userName: 'Demo Reader', text: 'Fascinating work! How often are fjord samples collected?' });
  console.log('Seeded demo data. Admin:', process.env.ADMIN_EMAIL || 'admin@polar.in');
}
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/polarportal')
  .then(async () => { console.log('MongoDB connected'); await seed(); app.listen(process.env.PORT || 5000, () => console.log(`Open http://localhost:${process.env.PORT || 5000}`)); })
  .catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
