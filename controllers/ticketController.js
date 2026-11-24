const admin = require('firebase-admin');
const express = require('express');
const router = express.Router(); // not used directly here but kept for consistency
const { STATUS, PRIORIDADES } = require('../config/constants');

// Initialize Firebase Admin only once (same as dashboardController)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Helper: pick ticket fields from request body
function pickTicket(body) {
  return {
    titulo: (body.titulo || '').trim(),
    descricao: (body.descricao || '').trim(),
    solicitante: (body.solicitante || '').trim(),
    emailSolicitante: (body.emailSolicitante || '').trim() || null,
    setor: body.setor || null,
    prioridade: body.prioridade || 'media',
    status: body.status || 'aberto',
    categoriaId: body.categoryId || null,
    tecnicoId: body.technicianId || null,
    // Will be set on create
    criadoPorId: null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  };
}

// Load form options (categories and technicians) from Firestore
async function formOptions() {
  const [catSnap, techSnap] = await Promise.all([
    db.collection('categorias').orderBy('nome', 'asc').get(),
    db.collection('tecnicos')
      .where('ativo', '==', true)
      .orderBy('nome', 'asc')
      .get(),
  ]);
  const categorias = [];
  catSnap.forEach(doc => categorias.push({ id: doc.id, ...doc.data() }));
  const tecnicos = [];
  techSnap.forEach(doc => tecnicos.push({ id: doc.id, ...doc.data() }));
  return { categorias, tecnicos };
}

// GET /tickets – list tickets with optional filtering
exports.index = async (req, res) => {
  const { q, status, prioridade, categoria, tecnico } = req.query;
  const user = req.user; // { uid, perfil }
  if (!user) return res.status(401).render('401', { title: 'Unauthorized' });
  const perfil = (user.perfil || '').toString().toLowerCase();

  let query = db.collection('chamados');
  // RBAC filter for normal users
  if (perfil === 'user') {
    query = query.where('criadoPorId', '==', user.uid);
  }

  // Apply text search – Firestore does not support complex LIKE, so we only implement simple field matches when possible
  if (q) {
    // For simplicity, match ticket title containing q (case‑insensitive)
    query = query.where('titulo', '>=', q).where('titulo', '<=', q + '\uf8ff');
  }
  if (status && STATUS[status]) query = query.where('status', '==', status);
  if (prioridade && PRIORIDADES[prioridade]) query = query.where('prioridade', '==', prioridade);
  if (categoria) query = query.where('categoriaId', '==', categoria);
  if (tecnico) {
    if (tecnico === 'nenhum') query = query.where('tecnicoId', '==', null);
    else query = query.where('tecnicoId', '==', tecnico);
  }

  const snapshot = await query.orderBy('criadoEm', 'desc').get();
  const tickets = [];
  snapshot.forEach(doc => tickets.push({ id: doc.id, ...doc.data() }));

  const opts = await formOptions();
  res.render('tickets/index', {
    title: 'Chamados',
    tickets,
    filtros: { q: q || '', status: status || '', prioridade: prioridade || '', categoria: categoria || '', tecnico: tecnico || '' },
    ...opts,
  });
};

// GET /tickets/new – render creation form
exports.new = async (req, res) => {
  const opts = await formOptions();
  res.render('tickets/form', {
    title: 'Novo chamado',
    ticket: { prioridade: 'media', status: 'aberto' },
    errors: [],
    isEdit: false,
    ...opts,
  });
};

// POST /tickets – create a new ticket in Firestore
exports.create = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).render('401', { title: 'Unauthorized' });
  const data = pickTicket(req.body);
  data.criadoPorId = user.uid;
  try {
    const docRef = await db.collection('chamados').add(data);
    // Add system comment
    await db.collection('comentarios').add({
      ticketId: docRef.id,
      autor: 'Sistema',
      tipo: 'sistema',
      mensagem: `Chamado aberto por ${data.solicitante}.`,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Retrieve generated ID for redirect (optional: get protocol field if stored)
    res.redirect(`/tickets/${docRef.id}?msg=${encodeURIComponent('Chamado criado com sucesso!')}`);
  } catch (err) {
    // Simple validation handling – forward to form with generic error
    const errors = [{ msg: err.message }];
    const opts = await formOptions();
    res.status(422).render('tickets/form', {
      title: 'Novo chamado',
      ticket: data,
      errors,
      isEdit: false,
      ...opts,
    });
  }
};

// Helper: fetch ticket with comments
async function fetchTicketWithComments(id) {
  const ticketSnap = await db.collection('chamados').doc(id).get();
  if (!ticketSnap.exists) return null;
  const ticket = { id, ...ticketSnap.data() };
  const commentsSnap = await db
    .collection('comentarios')
    .where('ticketId', '==', id)
    .orderBy('criadoEm', 'asc')
    .get();
  const comentarios = [];
  commentsSnap.forEach(doc => comentarios.push({ id: doc.id, ...doc.data() }));
  ticket.comentarios = comentarios;
  return ticket;
}

// GET /tickets/:id – show ticket detail
exports.show = async (req, res) => {
  const ticket = await fetchTicketWithComments(req.params.id);
  if (!ticket) return res.status(404).render('404', { title: 'Chamado não encontrado' });
  const { tecnicos } = await formOptions();
  res.render('tickets/show', { title: ticket.protocolo || ticket.titulo, ticket, tecnicos, errors: [] });
};

// GET /tickets/:id/edit – render edit form
exports.edit = async (req, res) => {
  const ticket = await fetchTicketWithComments(req.params.id);
  if (!ticket) return res.status(404).render('404', { title: 'Chamado não encontrado' });
  const opts = await formOptions();
  res.render('tickets/form', {
    title: `Editar ${ticket.protocolo || ticket.titulo}`,
    ticket,
    errors: [],
    isEdit: true,
    ...opts,
  });
};

// PUT /tickets/:id – update ticket fields
exports.update = async (req, res) => {
  const ticketRef = db.collection('chamados').doc(req.params.id);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return res.status(404).render('404', { title: 'Chamado não encontrado' });
  const data = pickTicket(req.body);
  try {
    await ticketRef.update({ ...data, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
    res.redirect(`/tickets/${req.params.id}?msg=${encodeURIComponent('Chamado atualizado.')}`);
  } catch (err) {
    const errors = [{ msg: err.message }];
    const opts = await formOptions();
    res.status(422).render('tickets/form', {
      title: `Editar ${ticketSnap.data().protocolo || ticketSnap.data().titulo}`,
      ticket: { id: req.params.id, ...data },
      errors,
      isEdit: true,
      ...opts,
    });
  }
};

// PATCH /tickets/:id/quick – quick status/priority/technician update with history comment
exports.quickUpdate = async (req, res) => {
  const ticketRef = db.collection('chamados').doc(req.params.id);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return res.status(404).render('404', { title: 'Chamado não encontrado' });
  const ticket = ticketSnap.data();

  const historico = [];
  const { status, prioridade } = req.body;
  const technicianId = req.body.technicianId ? String(req.body.technicianId) : null;

  const updates = {};
  if (status && STATUS[status] && status !== ticket.status) {
    historico.push(`Status alterado de "${STATUS[ticket.status].label}" para "${STATUS[status].label}".`);
    updates.status = status;
  }
  if (prioridade && PRIORIDADES[prioridade] && prioridade !== ticket.prioridade) {
    historico.push(`Prioridade alterada de "${PRIORIDADES[ticket.prioridade].label}" para "${PRIORIDADES[prioridade].label}".`);
    updates.prioridade = prioridade;
  }
  if (technicianId !== (ticket.tecnicoId ? String(ticket.tecnicoId) : null)) {
    if (technicianId) {
      const techSnap = await db.collection('tecnicos').doc(technicianId).get();
      const nome = techSnap.exists ? techSnap.data().nome : '';
      historico.push(`Chamado atribuído a ${nome}.`);
      updates.tecnicoId = technicianId;
    } else {
      historico.push('Técnico responsável removido.');
      updates.tecnicoId = null;
    }
  }

  if (!historico.length) {
    return res.redirect(`/tickets/${req.params.id}?erro=${encodeURIComponent('Nenhuma alteração realizada.')}`);
  }

  updates.atualizadoEm = admin.firestore.FieldValue.serverTimestamp();
  await ticketRef.update(updates);
  // Add system comments for each change
  const commentPromises = historico.map(msg =>
    db.collection('comentarios').add({
      ticketId: req.params.id,
      autor: 'Sistema',
      tipo: 'sistema',
      mensagem: msg,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    })
  );
  await Promise.all(commentPromises);

  res.redirect(`/tickets/${req.params.id}?msg=${encodeURIComponent('Chamado atualizado.')}`);
};

// DELETE /tickets/:id – remove ticket (admin only)
exports.destroy = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).render('401', { title: 'Unauthorized' });
  const perfil = (user.perfil || '').toString().toLowerCase();
  if (perfil !== 'admin') {
    return res.status(403).render('403', { title: 'Forbidden' });
  }
  const ticketRef = db.collection('chamados').doc(req.params.id);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return res.status(404).render('404', { title: 'Chamado não encontrado' });
  const protocolo = ticketSnap.data().protocolo || ticketSnap.id;
  await ticketRef.delete();
  // Optionally delete related comments
  const commentsSnap = await db.collection('comentarios').where('ticketId', '==', req.params.id).get();
  const deletePromises = [];
  commentsSnap.forEach(doc => deletePromises.push(db.collection('comentarios').doc(doc.id).delete()));
  await Promise.all(deletePromises);
  res.redirect(`/tickets?msg=${encodeURIComponent(`Chamado ${protocolo} excluído.`)}`);
};

module.exports = router;
