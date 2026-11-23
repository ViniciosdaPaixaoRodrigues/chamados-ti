// =========================================================
//  HelpDesk TI — Painel de Gestão de Usuários (Apenas Admin)
//  Salvar em: public/js/users.js
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

  let adminUser = null;
  let listaUsuarios = [];

  // ---------------------------------------------------------
  // 2. OBSERVADOR DE AUTENTICAÇÃO (PROTEÇÃO DA ROTA)
  // ---------------------------------------------------------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }

    adminUser = user;

    try {
      const docUser = await db.collection('usuarios').doc(user.uid).get();
      const perfil = docUser.exists ? docUser.data().perfil : 'user';

      if (perfil !== 'admin') {
        alert('Acesso negado: Apenas administradores podem acessar a Gestão de Usuários.');
        window.location.href = '/dashboard';
        return;
      }

      await carregarUsuarios();

    } catch (e) {
      console.error('Erro na validação de permissão:', e);
      window.location.href = '/dashboard';
    }
  });

  // ---------------------------------------------------------
  // 3. CARREGAR USUÁRIOS DO FIRESTORE
  // ---------------------------------------------------------
  async function carregarUsuarios() {
    const tbody = document.getElementById('usersTableBody');
    const subtitle = document.getElementById('usersSubtitle');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align: center; padding: 32px;">Carregando usuários cadastrados...</td></tr>`;
    }

    try {
      const snap = await db.collection('usuarios').get();
      listaUsuarios = [];
      snap.forEach(doc => {
        listaUsuarios.push({ id: doc.id, ...doc.data() });
      });

      // Ordena por nome
      listaUsuarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

      if (subtitle) {
        subtitle.textContent = `${listaUsuarios.length} ${listaUsuarios.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}`;
      }

      renderizarTabelaUsuarios();

    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align: center; color: var(--red); padding: 24px;">Erro ao carregar: ${error.message}</td></tr>`;
      }
    }
  }

  // ---------------------------------------------------------
  // 4. RENDERIZAR TABELA
  // ---------------------------------------------------------
  function renderizarTabelaUsuarios() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (listaUsuarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align: center; padding: 24px;">Nenhum usuário encontrado na coleção "usuarios".</td></tr>`;
      return;
    }

    tbody.innerHTML = listaUsuarios.map(u => {
      const nome = u.nome || 'Sem nome';
      const email = u.email || 'Sem e-mail';
      const setor = u.setor || 'Geral';
      const perfilAtual = u.perfil || 'user';
      const iniciais = nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

      const corBadge = perfilAtual === 'admin' ? 'purple' : (perfilAtual === 'tecnico' || perfilAtual === 'tech') ? 'blue' : 'green';
      const labelBadge = perfilAtual === 'admin' ? 'Admin' : (perfilAtual === 'tecnico' || perfilAtual === 'tech') ? 'Técnico' : 'Usuário';

      const isCurrentAdmin = u.id === adminUser.uid;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="avatar avatar-sm" style="background: var(--surface-2); font-weight: 600;">${iniciais}</span>
              <div>
                <strong>${nome}</strong>
                ${isCurrentAdmin ? '<span class="muted" style="font-size: 11px; margin-left: 4px;">(Você)</span>' : ''}
              </div>
            </div>
          </td>
          <td>${email}</td>
          <td><span class="chip">${setor}</span></td>
          <td>
            <span class="profile-badge badge-${corBadge}" id="badge-${u.id}">${labelBadge}</span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <select class="form-input" id="sel-${u.id}" style="padding: 6px 10px; font-size: 13px; max-width: 140px;" ${isCurrentAdmin ? 'disabled title="Você não pode alterar seu próprio perfil aqui"' : ''}>
                <option value="user" ${perfilAtual === 'user' ? 'selected' : ''}>User (Padrão)</option>
                <option value="tecnico" ${(perfilAtual === 'tecnico' || perfilAtual === 'tech') ? 'selected' : ''}>Técnico</option>
                <option value="admin" ${perfilAtual === 'admin' ? 'selected' : ''}>Administrador</option>
              </select>
              ${!isCurrentAdmin ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="salvarPerfilUsuario('${u.id}', '${nome}')">
                  Salvar
                </button>
              ` : '<span class="muted" style="font-size: 12px;">Conta atual</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ---------------------------------------------------------
  // 5. ATUALIZAR PERFIL DO USUÁRIO NO FIRESTORE
  // ---------------------------------------------------------
  window.salvarPerfilUsuario = async function (uid, nome) {
    const select = document.getElementById(`sel-${uid}`);
    if (!select) return;

    const novoPerfil = select.value;

    if (!confirm(`Deseja alterar o perfil de "${nome}" para "${novoPerfil.toUpperCase()}"?`)) {
      return;
    }

    try {
      await db.collection('usuarios').doc(uid).update({
        perfil: novoPerfil,
        atualizadoPor: adminUser.email,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert(`Perfil de "${nome}" alterado para "${novoPerfil}" com sucesso!`);
      await carregarUsuarios();

    } catch (error) {
      alert('Erro ao atualizar perfil do usuário: ' + error.message);
    }
  };

})();
