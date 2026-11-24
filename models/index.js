// Firestore model wrappers – replaces Sequelize definitions
// Each model exports the Firestore collection reference for the corresponding entity.

const admin = require('firebase-admin');
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = {
  Category: db.collection('categorias'),
  Ticket: db.collection('chamados'),
  Technician: db.collection('tecnicos'),
  Comment: db.collection('comentarios'),
  User: db.collection('usuarios'),
};
