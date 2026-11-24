// Category Controller using Firebase Firestore
// Replaces Sequelize implementation and shares Firebase admin init.

const admin = require('firebase-admin');
const { STATUS_ATIVOS } = require('../config/constants');
const { validationMessages } = require('../utils/helpers');

// Initialize Firebase Admin if not already done (same as dashboardController)
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
    descricao: (body.descricao || '').trim() || null,
    cor: body.cor || '#6366f1',
  };
}

function renderForm(res, { categoria, errors = [], isEdit, status = 200 }) {
  res.status(status).render('categories/form', {
    title: isEdit ? 'Editar categoria' : 'Nova categoria',
    categoria,
    errors,
    isEdit,
  });
}

// Helper to compute ticket stats for a category
async function computeStats(categoryId) {
  const ticketsSnap = await db.collection('chamados').where('categoriaId', '==', categoryId).get();
  const tickets = [];
  ticketsSnap.forEach(doc => tickets.push({ id: doc.id, ...doc.data() }));
  const total = tickets.length;
  const ativos = tickets.filter(t => STATUS_ATIVOS.includes(t.status)).length;
  return { total, ativos };
}

// GET /categories – list categories with ticket stats
exports.index = async (req, res) => {
  const catSnap = await db.collection('categorias').orderBy('nome', 'asc').get();
  const categorias = [];
  for (const doc of catSnap.docs) {
    const data = doc.data();
    const stats = await computeStats(doc.id);
    categorias.push({
      id: doc.id,
      nome: data.nome,
      descricao: data.descricao,
      cor: data.cor,
      total: stats.total,
      ativos: stats.ativos,
    });
  }
  res.render('categories/index', { title: 'Categorias', categorias });
};

// GET /categories/new – render creation form
exports.new = (req, res) => renderForm(res, { categoria: { cor: '#6366f1' }, isEdit: false });

// POST /categories – create a new category
exports.create = async (req, res) => {
  const data = pick(req.body);
  try {
    await db.collection('categorias').add(data);
    res.redirect(`/categories?msg=${encodeURIComponent('Categoria criada com sucesso!')}`);
  } catch (err) {
    const errors = [{ msg: err.message }];
    renderForm(res, { categoria: data, errors, isEdit: false, status: 422 });
  }
};

// GET /categories/:id/edit – render edit form
exports.edit = async (req, res) => {
  const doc = await db.collection('categorias').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).render('404', { title: 'Categoria não encontrada' });
  const categoria = { id: doc.id, ...doc.data() };
  renderForm(res, { categoria, isEdit: true });
};

// PUT /categories/:id – update category
exports.update = async (req, res) => {
  const ref = db.collection('categorias').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).render('404', { title: 'Categoria não encontrada' });
  const data = pick(req.body);
  try {
    await ref.update(data);
    res.redirect(`/categories?msg=${encodeURIComponent('Categoria atualizada.')}`);
  } catch (err) {
    const errors = [{ msg: err.message }];
    const categoria = { id: req.params.id, ...data };
    renderForm(res, { categoria, errors, isEdit: true, status: 422 });
  }
};

// DELETE /categories/:id – remove category and detach tickets
exports.destroy = async (req, res) => {
  const ref = db.collection('categorias').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).render('404', { title: 'Categoria não encontrada' });
  // Set categoryId null on tickets referencing this category
  const ticketsSnap = await db.collection('chamados').where('categoriaId', '==', req.params.id).get();
  const batch = db.batch();
  ticketsSnap.forEach(doc => batch.update(doc.ref, { categoriaId: null }));
  batch.delete(ref);
  await batch.commit();
  res.redirect(`/categories?msg=${encodeURIComponent('Categoria removida.')}`);
};

module.exports = exports;
