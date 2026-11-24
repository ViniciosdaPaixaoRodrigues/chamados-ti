const admin = require('firebase-admin');
const { validationMessages } = require('../utils/helpers');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// POST /tickets/:id/comments – add a comment to a ticket
exports.create = async (req, res) => {
  const ticketId = req.params.id;
  // Verify ticket exists
  const ticketSnap = await db.collection('chamados').doc(ticketId).get();
  if (!ticketSnap.exists) {
    return res.status(404).render('404', { title: 'Chamado não encontrado' });
  }
  const autor = (req.body.autor || '').trim();
  const mensagem = (req.body.mensagem || '').trim();
  if (!autor || !mensagem) {
    // Simple validation fallback
    const errors = [{ msg: 'Autor e mensagem são obrigatórios.' }];
    return res.redirect(`/tickets/${ticketId}?erro=${encodeURIComponent(errors.map(e=>e.msg).join(' '))}#comentarios`);
  }
  try {
    await db.collection('comentarios').add({
      ticketId,
      autor,
      mensagem,
      tipo: 'comentario',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.redirect(`/tickets/${ticketId}?msg=${encodeURIComponent('Comentário adicionado.') }#comentarios`);
  } catch (err) {
    const errors = [{ msg: err.message }];
    res.redirect(`/tickets/${ticketId}?erro=${encodeURIComponent(errors.map(e=>e.msg).join(' '))}#comentarios`);
  }
};

module.exports = exports;
