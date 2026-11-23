// =========================================================
//  HelpDesk TI — Lógica do Dashboard & Autenticação de Perfil
//  Salvar em: public/js/dashboard.js
// =========================================================

(function () {
  'use strict';

  // 1. CONFIGURAÇÃO DO FIREBASE (credenciais do seu projeto)
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

  // ---------------------------------------------------------
  // 2. OBSERVADOR ON AUTH STATE CHANGED
  // ---------------------------------------------------------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // Se user for nulo: Redireciona imediatamente para a tela de login/home
      console.warn('Usuário não autenticado. Redirecionando...');
      window.location.href = '/'; 
      return;
    }

    try {
      console.log('Usuário autenticado:', user.email);

      // Busca o documento correspondente na coleção "usuarios"
      const docRef = db.collection('usuarios').doc(user.uid);
      const docSnap = await docRef.get();

      let perfil = 'user';
      let setor = 'Geral';
      let nome = user.displayName || user.email.split('@')[0];

      if (docSnap.exists) {
        const data = docSnap.data();
        perfil = data.perfil || 'user';
        setor = data.setor || 'Geral';
        nome = data.nome || nome;
      } else {
        // Se ainda não existir no Firestore, cria com perfil default "user"
        await docRef.set({
          uid: user.uid,
          nome: nome,
          email: user.email,
          setor: setor,
          perfil: 'user',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // Renderiza as informações no cabeçalho e modal
      renderHeaderUser({ nome, email: user.email, perfil, setor });

    } catch (error) {
      console.error('Erro ao buscar dados do perfil no Firestore:', error);
    }
  });

  // Atualiza os elementos visuais do cabeçalho e modal
  function renderHeaderUser({ nome, email, perfil, setor }) {
    const elName = document.getElementById('userName');
    const elEmail = document.getElementById('userEmail');
    const elAvatar = document.getElementById('userAvatar');
    const elBadge = document.getElementById('userBadge');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalNameTitle = document.getElementById('modalNameTitle');
    const modalBadge = document.getElementById('modalBadge');

    if (elName) elName.textContent = nome;
    if (elEmail) elEmail.textContent = email;

    const initials = nome.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
    if (elAvatar) elAvatar.textContent = initials;
    if (modalAvatar) modalAvatar.textContent = initials;
    if (modalNameTitle) modalNameTitle.textContent = nome;

    if (elBadge) {
      elBadge.className = 'profile-badge badge-' + perfil;
      elBadge.textContent = perfil;
    }
    if (modalBadge) {
      modalBadge.className = 'profile-badge badge-' + perfil;
      modalBadge.textContent = perfil;
    }

    // Campos do Modal
    const inEmail = document.getElementById('profileEmail');
    const inName = document.getElementById('profileName');
    const inSetor = document.getElementById('profileSetor');
    const inRole = document.getElementById('profileRole');

    if (inEmail) inEmail.value = email;
    if (inName) inName.value = nome;
    if (inSetor) inSetor.value = setor;
    if (inRole) inRole.value = perfil.toUpperCase();
  }

  // ---------------------------------------------------------
  // 3. BOTÃO SAIR (LOGOUT) COM SIGNOUT(AUTH)
  // ---------------------------------------------------------
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await auth.signOut();
        localStorage.removeItem('helpdesk_user');
        window.location.href = '/';
      } catch (err) {
        alert('Erro ao sair: ' + err.message);
      }
    });
  }

  // ---------------------------------------------------------
  // 4. FUNÇÕES DO MODAL DE PERFIL (Expostas globalmente)
  // ---------------------------------------------------------
  window.openProfileModal = function () {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.add('active');
  };

  window.closeProfileModal = function () {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('active');
  };

  // Fechar com clique fora ou tecla ESC
  const modalOverlay = document.getElementById('profileModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) window.closeProfileModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
      window.closeProfileModal();
    }
  });

  window.switchProfileTab = function (tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const formDados = document.getElementById('formProfileData');
    const formSeg = document.getElementById('formProfileSecurity');

    if (tab === 'dados') {
      if (formDados) formDados.style.display = 'block';
      if (formSeg) formSeg.style.display = 'none';
    } else {
      if (formDados) formDados.style.display = 'none';
      if (formSeg) formSeg.style.display = 'block';
    }
  };

  // Salvar Nome e Setor no Firestore
  window.handleUpdateProfile = async function (e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const novoNome = document.getElementById('profileName').value.trim();
    const novoSetor = document.getElementById('profileSetor').value.trim();

    try {
      await user.updateProfile({ displayName: novoNome });
      await db.collection('usuarios').doc(user.uid).update({
        nome: novoNome,
        setor: novoSetor
      });

      alert('Perfil atualizado com sucesso!');
      renderHeaderUser({
        nome: novoNome,
        email: user.email,
        perfil: document.getElementById('userBadge').textContent,
        setor: novoSetor
      });
      window.closeProfileModal();
    } catch (err) {
      alert('Erro ao atualizar perfil: ' + err.message);
    }
  };

  // Atualizar Senha
  window.handleUpdatePassword = async function (e) {
    e.preventDefault();
    const user = auth.currentUser;
    const pass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    if (!pass || pass.length < 6) {
      alert('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (pass !== confirmPass) {
      alert('As senhas não conferem.');
      return;
    }

    try {
      await user.updatePassword(pass);
      alert('Senha alterada com sucesso!');
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
      window.closeProfileModal();
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        alert('Por segurança, faça login novamente antes de alterar sua senha.');
      } else {
        alert('Erro ao alterar senha: ' + err.message);
      }
    }
  };

  // Enviar link de redefinição por e-mail
  window.handleSendResetEmail = async function () {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    try {
      await auth.sendPasswordResetEmail(user.email);
      alert('E-mail de redefinição de senha enviado para: ' + user.email);
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

})();
