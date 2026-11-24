// Dashboard Controller using Firebase Firestore with fallback JSON support
// Shares Firebase admin init with other controllers.

const admin = require('../utils/firebaseInit');
const { loadFallback } = require('../utils/fallback');

const db = admin.firestore();

// Helper: builds a summary object for the dashboard cards.
async function buildStats(userUid, userPerfil) {
  try {
    let query = db.collection('chamados');
    if (userPerfil === 'user') query = query.where('criadoPorId', '==', userUid);
    const snap = await query.get();
    const chamados = [];
    snap.forEach(d => chamados.push({ id: d.id, ...d.data() }));
    return {
      abertos: chamados.filter(c => c.status === 'aberto').length,
      emAndamento: chamados.filter(c => c.status === 'em_andamento').length,
      semTecnico: chamados.filter(c => !c.tecnicoId && c.status !== 'resolvido' && c.status !== 'fechado').length,
      resolvidos: chamados.filter(c => c.status === 'resolvido' || c.status === 'fechado').length,
    };
  } catch (e) {
    console.error('buildStats fallback error:', e);
    const fb = loadFallback('dashboardStats.json');
    return fb || { abertos: 0, emAndamento: 0, semTecnico: 0, resolvidos: 0 };
  }
}

// GET /dashboard/data – returns stats and recent tickets
async function index(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    const perfil = (userDoc.exists && userDoc.data().perfil) ? userDoc.data().perfil.toString().toLowerCase() : 'user';
    const stats = await buildStats(user.uid, perfil);

    // Recent tickets (max 6) ordered by created timestamp descending
    let ticketsQuery = db.collection('chamados');
    if (perfil === 'user') ticketsQuery = ticketsQuery.where('criadoPorId', '==', user.uid);
    const recentSnap = await ticketsQuery.orderBy('criadoEm', 'desc').limit(6).get();
    const recentTickets = [];
    recentSnap.forEach(d => recentTickets.push({ id: d.id, ...d.data() }));
    res.json({ stats, recentTickets });
  } catch (err) {
    console.error('Dashboard /data error:', err);
    const fallback = loadFallback('dashboardData.json');
    if (fallback) return res.json(fallback);
    res.status(500).json({ error: err.message });
  }
}

// GET /dashboard/user – returns logged‑in user profile
async function user(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const doc = await db.collection('usuarios').doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};
    const profile = {
      uid: user.uid,
      email: user.email,
      nome: data.nome || user.displayName || user.email.split('@')[0],
      setor: data.setor || 'Geral',
      perfil: (data.perfil || 'user').toString().toLowerCase(),
    };
    res.json({ profile });
  } catch (err) {
    console.error('Dashboard /user error:', err);
    const fallback = loadFallback('dashboardUser.json');
    if (fallback) return res.json(fallback);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { index, user };
