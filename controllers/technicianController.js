// Technician Controller using Firebase Firestore with fallback JSON support
// Replaces Sequelize implementation and shares Firebase admin init.

const admin = require('firebase-admin');
const { STATUS_ATIVOS } = require('../config/constants');
const { validationMessages } = require('../utils/helpers');
const { loadFallback } = require('../utils/fallback');

// Initialize Firebase Admin only once (shared with other controllers)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

function pick(body) {
  return {
    nome: (body.nome || '').trim(),
    email: (body.email || '').trim().toLowerCase(),
    especialidade: (body.especialidade || '').trim() || null,
    ativo: body.ativo === 'on' || body.ativo === 'true',
  };
}

function renderForm(res, { tecnico, errors = [], isEdit, status = 200 }) {
  res.status(status).render('technicians/form', {
    title: isEdit ? 'Editar técnico' : 'Novo técnico',
    tecnico,
    errors,
    isEdit,
  });
}

// GET /technicians – list all technicians with ticket counts (fallback on error)
exports.index = async (req, res) => {
  try {
    const techSnap = await db.collection('tecnicos')
      .orderBy('ativo', 'desc')
      .orderBy('nome', 'asc')
      .get();

    const tecnicos = [];
    for (const doc of techSnap.docs) {
      const tech = { id: doc.id, ...doc.data() };
      const ticketsSnap = await db.collection('chamados')
        .where('tecnicoId', '==', tech.id)
        .get();
      const tickets = [];
      ticketsSnap.forEach(t => tickets.push(t.data()));
      tecnicos.push({
        ...tech,
        ativos: tickets.filter(t => STATUS_ATIVOS.includes(t.status)).length,
        concluidos: tickets.filter(t => !STATUS_ATIVOS.includes(t.status)).length,
      });
    }
    return res.render('technicians/index', { title: 'Técnicos', tecnicos });
  } catch (err) {
    console.error('Technician index error:', err);
    const fallback = loadFallback('techniciansIndex.json');
    if (fallback) return res.render('technicians/index', { title: 'Técnicos', tecnicos: fallback });
    return res.status(500).render('500', { error: err.message });
  }
};

// GET /technicians/new – render creation form
exports.new = (req, res) => renderForm(res, { tecnico: { ativo: true }, isEdit: false });

// POST /technicians – create a new technician
exports.create = async (req, res) => {
  const data = pick(req.body);
  try {
    await db.collection('tecnicos').add(data);
    res.redirect(`/technicians?msg=${encodeURIComponent('Técnico cadastrado com sucesso!')}`);
  } catch (err) {
    const errors = [{ msg: err.message }];
    renderForm(res, { tecnico: data, errors, isEdit: false, status: 422 });
  }
};

// GET /technicians/:id/edit – render edit form
exports.edit = async (req, res) => {
  try {
    const doc = await db.collection('tecnicos').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).render('404', { title: 'Técnico não encontrado' });
    const tecnico = { id: doc.id, ...doc.data() };
    renderForm(res, { tecnico, isEdit: true });
  } catch (err) {
    console.error('Technician edit error:', err);
    const fallback = loadFallback('technicianEdit.json');
    if (fallback) return renderForm(res, { tecnico: fallback, isEdit: true });
    return res.status(500).render('500', { error: err.message });
  }
};

// PUT /technicians/:id – update technician
exports.update = async (req, res) => {
  try {
    const ref = db.collection('tecnicos').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).render('404', { title: 'Técnico não encontrado' });
    const data = pick(req.body);
    await ref.update(data);
    res.redirect(`/technicians?msg=${encodeURIComponent('Técnico atualizado.')}`);
  } catch (err) {
    const errors = [{ msg: err.message }];
    const tecnico = { id: req.params.id, ...pick(req.body) };
    renderForm(res, { tecnico, errors, isEdit: true, status: 422 });
  }
};

// DELETE /technicians/:id – remove technician and unassign tickets
exports.destroy = async (req, res) => {
  try {
    const ref = db.collection('tecnicos').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).render('404', { title: 'Técnico não encontrado' });

    // Unassign tickets from this technician
    const ticketsSnap = await db.collection('chamados')
      .where('tecnicoId', '==', req.params.id)
      .get();
    const batch = db.batch();
    ticketsSnap.forEach(doc => batch.update(doc.ref, { tecnicoId: null }));
    batch.delete(ref);
    await batch.commit();

    res.redirect(`/technicians?msg=${encodeURIComponent('Técnico removido.')}`);
  } catch (err) {
    console.error('Technician destroy error:', err);
    res.status(500).render('500', { error: err.message });
  }
};

module.exports = exports;
