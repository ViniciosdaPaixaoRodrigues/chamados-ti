const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();

// -----------------------------------------------------------------
// Initialize Firebase Admin (ensure you have the service account key).
// -----------------------------------------------------------------
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// -----------------------------------------------------------------
// Helper: builds a summary object for the dashboard cards.
// -----------------------------------------------------------------
async function buildStats(userUid, userPerfil) {
  let query = db.collection('chamados');
  // If normal user, limit to his tickets only (same rule as front‑end)
  if (userPerfil === 'user') {
    query = query.where('criadoPorId', '==', userUid);
  }
  const snapshot = await query.get();
  const chamados = [];
  snapshot.forEach(doc => chamados.push({ id: doc.id, ...doc.data() }));

  const stats = {
    abertos: chamados.filter(c => c.status === 'aberto').length,
    emAndamento: chamados.filter(c => c.status === 'em_andamento').length,
    semTecnico: chamados.filter(c => !c.tecnicoId && c.status !== 'resolvido' && c.status !== 'fechado').length,
    resolvidos: chamados.filter(c => c.status === 'resolvido' || c.status === 'fechado').length,
  };
  return stats;
}

// -----------------------------------------------------------------
// Route: GET /dashboard/data
// Returns JSON with the four card counters and the 6 most recent tickets.
// -----------------------------------------------------------------
router.get('/data', async (req, res) => {
  try {
    // Assume authentication middleware already attached `req.user`.
    const user = req.user; // { uid, email, displayName, ... }
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch user profile from Firestore (to know if admin/tecnico)
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    const perfil = (userDoc.exists && userDoc.data().perfil) ? userDoc.data().perfil.toString().toLowerCase() : 'user';

    const stats = await buildStats(user.uid, perfil);

    // Recent tickets (max 6) ordered by created timestamp descending
    let ticketsQuery = db.collection('chamados');
    if (perfil === 'user') {
      ticketsQuery = ticketsQuery.where('criadoPorId', '==', user.uid);
    }
    const recentSnap = await ticketsQuery.orderBy('criadoEm', 'desc').limit(6).get();
    const recentTickets = [];
    recentSnap.forEach(doc => recentTickets.push({ id: doc.id, ...doc.data() }));

    res.json({ stats, recentTickets });
  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------
// Route: GET /dashboard/user
// Returns the logged‑in user details (mirrors what the front‑end uses).
// -----------------------------------------------------------------
router.get('/user', async (req, res) => {
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
    console.error('User profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
