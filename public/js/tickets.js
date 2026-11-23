// =========================================================
//  HelpDesk TI — Listagem de Chamados com Firebase Firestore & RBAC
//  Salvar em: public/js/tickets.js
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

  let todosChamados = [];
  let usuarioAtual = null;
  let perfilAtual = 'user';
  let filtroStatusAtual = '';

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
        // **NORMALIZAÇÃO** do campo perfil
        perfilAtual = (docUser.data().perfil || 'user').toString().toLowerCase();
      }
    } catch (e) {
      console.warn('Erro ao ler perfil do usuário:', e);
    }

    if (perfilAtual === 'tech') perfilAtual = 'tecnico';

    // Exibe link da gestão de usuários para administradores
    const adminNav = document.getElementById('adminNavSection');
    if (adminNav && perfilAtual === 'admin') {
      adminNav.style.display = 'block';
    }

    // Carrega chamados de acordo com a regra de acesso
    await carregarChamados();
  });

  // ---------------------------------------------------------
  // 3. BUSCA DE CHAMADOS NO FIRESTORE (RBAC)
  // ---------------------------------------------------------
  async function carregarChamados() {
    const tbody = document.getElementById('ticketsTableBody');
    const subtitle = document.getElementById('ticketsSubtitle');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align: center; padding: 32px;">Carregando chamados...</td></tr>`;
    }

    try {
      let query = db.collection('chamados');

      // REGRA: Usuário comum só vê os chamados criados por ele
      if (perfilAtual === 'user') {
        query = query.where('criadoPorId', '==', usuarioAtual.uid);
      }
      // Técnico e Admin visualizam todos os chamados

      const snapshot = await query.get();
      todosChamados = [];
      snapshot.forEach(doc => {
        todosChamados.push({ id: doc.id, ...doc.data() });
      });

      // Ordena por data decrescente
      todosChamados.sort((a, b) => {
        const dataA = a.criadoEm && a.criadoEm.toMillis ? a.criadoEm.toMillis() : 0;
        const dataB = b.criadoEm && b.criadoEm.toMillis ? b.criadoEm.toMillis() : 0;
        return dataB - dataA;
      });

      renderizarTabela();
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align: center; color: var(--red); padding: 24px;">Erro ao carregar chamados: ${error.message}</td></tr>`;
      }
    }
  }

  // ---------------------------------------------------------
  // 4. RENDERIZAÇÃO DA TABELA E FILTROS
  // ---------------------------------------------------------
  function renderizarTabela() {
    const tbody = document.getElementById('ticketsTableBody');
    const subtitle = document.getElementById('ticketsSubtitle');
    const q = (document.getElementById('filter-q')?.value || '').trim().toLowerCase();
    const prio = document.getElementById('filter-prioridade')?.value || '';

    let filtrados = todosChamados.filter(c => {
      // filtro por status dos tabs
      if (filtroStatusAtual === 'ativos') {
        if (c.status === 'resolvido' || c.status === 'fechado') return false;
      } else if (filtroStatusAtual && c.status !== filtroStatusAtual) {
        return false;
      }

      // filtro por prioridade
      if (prio && c.prioridade !== prio) return false;

      // filtro de texto livre
      if (q) {
        const prot = (c.protocolo || '').toLowerCase();
        const tit = (c.titulo || '').toLowerCase();
        const sol = (c.solicitante || '').toLowerCase();
        const desc = (c.descricao || '').toLowerCase();
        const uid = (c.id || '').toLowerCase();                 // <-- novo: busca por UUID
        const emailSol = (c.emailSolicitante || '').toLowerCase(); // <-- novo: busca pelo e‑mail do solicitante

        if (!prot.includes(q) && !tit.includes(q) && !sol.includes(q)
            && !desc.includes(q) && !uid.includes(q) && !emailSol.includes(q)) {
          return false;
        }
      }

      return true;
    });

    if (subtitle) {
      subtitle.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'chamado encontrado' : 'chamados encontrados'}`;
    }

    if (!tbody) return;

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px 24px;">
            <div class="empty small">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--muted);">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
              <h3 style="margin-top: 8px;">Nenhum chamado encontrado</h3>
              <p class="muted">Tente ajustar os filtros ou pesquisar por outro termo.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtrados.map(t => {
      const corPrio = t.prioridade === 'critica' ? 'red' : t.prioridade === 'alta' ? 'amber' : t.prioridade === 'baixa' ? 'gray' : 'blue';
      const labelPrio = t.prioridade ? t.prioridade.charAt(0).toUpperCase() + t.prioridade.slice(1) : 'Normal';

      const corStatus = t.status === 'resolvido' ? 'green' : t.status === 'em_andamento' ? 'amber' : t.status === 'fechado' ? 'gray' : 'blue';
      const labelStatus = t.status === 'em_andamento' ? 'Em atendimento' : t.status === 'aberto' ? 'Aberto' : t.status === 'resolvido' ? 'Resolvido' : t.status === 'fechado' ? 'Fechado' : (t.status || 'Aberto');

      const dataFormatada = formatarData(t.criadoEm);
      const setorSolicitante = t.setor ? ` · ${t.setor}` : '';
      const categoria = t.categoria || 'Geral';
      const responsavel = t.tecnicoNome || 'Não atribuído';

      return `
        <tr onclick="window.location.href='/tickets/${t.id}'" style="cursor: pointer;">
          <td><span class="ticket-code">#${t.protocolo || t.id.slice(0, 8)}</span></td>
          <td class="cell-main">
            <strong>${t.titulo || 'Sem título'}</strong>
            <span class="muted">${t.solicitante || 'Anônimo'}${setorSolicitante}</span>
          </td>
          <td><span class="chip"><span class="dot" style="background: var(--primary);"></span>${categoria}</span></td>
          <td><span class="badge badge-${corPrio}">${labelPrio}</span></td>
          <td><span class="status status-${corStatus}">${labelStatus}</span></td>
          <td>
            ${t.tecnicoNome ? `<span class="person"><span class="avatar avatar-sm">${t.tecnicoNome.slice(0, 2).toUpperCase()}</span>${t.tecnicoNome}</span>` : '<span class="muted">Não atribuído</span>'}
          </td>
          <td class="nowrap muted">${dataFormatada}</td>
        </tr>
      `;
    }).join('');
  }

  function formatarData(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ---------------------------------------------------------
  // 5. EVENT LISTENERS
  // ---------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    // Tabs de filtro rápido por status
    const tabs = document.querySelectorAll('.tab[data-status]');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filtroStatusAtual = tab.dataset.status;
        renderizarTabela();
      });
    });

    // Busca livre
    const inputSearch = document.getElementById('filter-q');
    if (inputSearch) {
      inputSearch.addEventListener('input', () => renderizarTabela());
    }

    // Filtro por prioridade
    const selectPrio = document.getElementById('filter-prioridade');
    if (selectPrio) {
      selectPrio.addEventListener('change', () => renderizarTabela());
    }

    // Botão “Limpar filtros”
    const btnClear = document.getElementById('filter-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (inputSearch) inputSearch.value = '';
        if (selectPrio) selectPrio.value = '';
        filtroStatusAtual = '';
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector('.tab[data-status=""]').classList.add('active');
        renderizarTabela();
      });
    }
  });
})();