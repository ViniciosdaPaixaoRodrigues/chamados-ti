// =========================================================
//  HelpDesk TI — Abertura de Chamados com Firebase Firestore
//  Salvar em: public/js/ticket-new.js
// =========================================================

(function () {
  'use strict';

  // 1. CONFIGURAÇÃO DO FIREBASE
  const firebaseConfig = {
    apiKey: "AIzaSyBe1rlrucH_b34RBut3o5F-SrphZeI-etQ",
    authDomain: "chamados-ti-2ab4f.firebaseapp.com",
    projectId: "chamados-ti-2ab4f",
    storageBucket: "chamados-ti-2ab4f.firebasestorage.app",
    messagingSenderId: "726113088268",
    appId: "1:726113088268:web:c77f9d1b857e4e1fbe4f29"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db = firebase.firestore();

  let usuarioAtual = null;
  let dadosPerfil = {};

  // ---------------------------------------------------------
  // 2. OBSERVADOR DE AUTENTICAÇÃO
  // ---------------------------------------------------------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }

    usuarioAtual = user;

    try {
      const docUser = await db.collection('usuarios').doc(user.uid).get();
      if (docUser.exists) {
        dadosPerfil = docUser.data();
      }
    } catch (e) {
      console.warn('Erro ao ler perfil do solicitante:', e);
    }

    // Se for admin, exibe a opção de Gestão de Usuários na sidebar
    const adminNav = document.getElementById('adminNavSection');
    if (adminNav && dadosPerfil.perfil === 'admin') {
      adminNav.style.display = 'block';
    }
  });

  // ---------------------------------------------------------
  // 3. HANDLER: SALVAR NOVO CHAMADO NO FIRESTORE
  // ---------------------------------------------------------
  window.handleCreateTicket = async function (e) {
    e.preventDefault();

    if (!usuarioAtual) {
      alert('Você precisa estar logado para abrir um chamado.');
      window.location.href = '/';
      return;
    }

    const btn = document.getElementById('btnSubmitTicket');
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const categoria = document.getElementById('categoria').value;
    const prioridadeEl = document.querySelector('input[name="prioridade"]:checked');
    const prioridade = prioridadeEl ? prioridadeEl.value : 'media';

    if (!titulo || !descricao) {
      alert('Preencha o título e a descrição do problema.');
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Gravando chamado...';
      }

      // Gera protocolo único com timestamp/random (ex: #CH-59281)
      const randomSufix = Math.floor(10000 + Math.random() * 90000);
      const protocolo = `CH-${randomSufix}`;

      const nomeSolicitante = dadosPerfil.nome || usuarioAtual.displayName || usuarioAtual.email.split('@')[0];
      const setorSolicitante = dadosPerfil.setor || 'Geral';

      const novoChamado = {
        protocolo: protocolo,
        titulo: titulo,
        descricao: descricao,
        categoria: categoria || 'Geral',
        prioridade: prioridade,
        status: 'aberto',
        criadoPorId: usuarioAtual.uid,
        solicitante: nomeSolicitante,
        emailSolicitante: usuarioAtual.email,
        setor: setorSolicitante,
        tecnicoId: null,
        tecnicoNome: null,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Grava na coleção "chamados"
      const docRef = await db.collection('chamados').add(novoChamado);

      // Adiciona o primeiro registro no histórico de comentários
      await docRef.collection('comentarios').add({
        autor: 'Sistema',
        mensagem: `Chamado #${protocolo} aberto por ${nomeSolicitante} (${setorSolicitante}).`,
        tipo: 'sistema',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Redireciona imediatamente para o chamado criado
      window.location.href = `/tickets/${docRef.id}`;

    } catch (error) {
      console.error('Erro ao abrir chamado:', error);
      alert('Erro ao registrar chamado: ' + error.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar chamado';
      }
    }
  };

})();
