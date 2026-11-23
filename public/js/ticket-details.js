// =========================================================
//  HelpDesk TI — Detalhes do Chamado & Controle RBAC
// =========================================================

(function () {
  'use strict';

  // -----------------------------------------------------------------
  // 1. CONFIGURAÇÃO DO FIREBASE
  // -----------------------------------------------------------------
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

  // -----------------------------------------------------------------
  // 2. DADOS DA ROTA/USUÁRIO
  // -----------------------------------------------------------------
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const ticketId = pathParts[pathParts.length - 1];

  let usuarioAtual = null;
  let perfilAtual = 'user';
  let dadosUsuarioDoc = {};
  let dadosChamado = null;

  // -----------------------------------------------------------------
  // 3. OBSERVADOR DE AUTENTICAÇÃO & PERFIL
  // -----------------------------------------------------------------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }

    usuarioAtual = user;

    try {
      const docUser = await db.collection('usuarios').doc(user.uid).get();
      if (docUser.exists) {
        dadosUsuarioDoc = docUser.data();
        // Normaliza o campo de perfil (ex.: "Admin", "tech")
        perfilAtual = (dadosUsuarioDoc.perfil || 'user').toString().toLowerCase();
        if (perfilAtual === 'tech') perfilAtual = 'tecnico';
      }
    } catch (e) {
      console.warn('Erro ao obter perfil do usuário:', e);
    }

    // Exibe link de Gestão de Usuários na sidebar para admins
    const adminNav = document.getElementById('adminNavSection');
    if (adminNav && perfilAtual === 'admin') {
      adminNav.style.display = 'block';
    }

    if (!ticketId || ticketId === 'tickets') {
      alert('ID de chamado inválido.');
      window.location.href = '/tickets';
      return;
    }

    await carregarDetalhesChamado();
    await carregarComentarios();
  });

  // -----------------------------------------------------------------
  // 4. CARREGAR DETALHES DO CHAMADO & REGRAS RBAC
  // -----------------------------------------------------------------
  async function carregarDetalhesChamado() {
    try {
      const docRef = db.collection('chamados').doc(ticketId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        document.getElementById('ticketTitle').textContent = 'Chamado não encontrado';
        document.getElementById('ticketDescription').textContent =
          'Este chamado pode ter sido removido ou o link está incorreto.';
        return;
      }

      dadosChamado = docSnap.data();

      const isUser = perfilAtual === 'user';
      const isTecnico = perfilAtual === 'tecnico';
      const isAdmin = perfilAtual === 'admin';

      // ---------- RESTRIÇÃO DE USUÁRIO ----------
      if (isUser && dadosChamado.criadoPorId && dadosChamado.criadoPorId !== usuarioAtual.uid) {
        alert('Acesso negado: Você só pode visualizar os chamados criados por você.');
        window.location.href = '/tickets';
        return;
      }

      // ---------- PREENCIMENTO DE DADOS ----------
      const protocolo = dadosChamado.protocolo || `#${ticketId.slice(0, 8)}`;
      document.getElementById('ticketProtocolo').textContent = protocolo;
      document.getElementById('ticketTitle').textContent = dadosChamado.titulo || 'Sem título';

      const solicitante = dadosChamado.solicitante || 'Não informado';
      const setor = dadosChamado.setor ? ` (${dadosChamado.setor})` : '';
      const dataCriacao = formatarDataCompleta(dadosChamado.criadoEm);
      document.getElementById('ticketSubtitle').innerHTML =
        `Aberto em <strong>${dataCriacao}</strong> por <strong>${solicitante}${setor}</strong>`;

      document.getElementById('ticketDescription').textContent =
        dadosChamado.descricao || 'Sem descrição informada.';

      renderBadges(dadosChamado.status, dadosChamado.prioridade);

      // Metadados do solicitante e técnico
      document.getElementById('infoCategoria').textContent = dadosChamado.categoria || 'Geral';
      document.getElementById('infoSolicitante').textContent = solicitante;
      document.getElementById('infoEmail').textContent = dadosChamado.emailSolicitante || 'Não informado';
      document.getElementById('infoSetor').textContent = dadosChamado.setor || 'Geral';
      const elTecnicoResp = document.getElementById('infoTecnico');
      if (elTecnicoResp) elTecnicoResp.textContent = dadosChamado.tecnicoNome || 'Não atribuído';

      // ---------- CONTROLE DE INTERFACE POR PERFIL ----------
      const cardAcoes = document.getElementById('cardAcoesRapidas');
      const btnDelete = document.getElementById('btnDeleteTicket');
      const btnAssumir = document.getElementById('btnAssumirChamado');
      const selectStatus = document.getElementById('q-status');
      const selectPrio = document.getElementById('q-prioridade');
      const boxParecer = document.getElementById('boxParecerTecnico');

      // USUÁRIO
      if (isUser) {
        if (cardAcoes) cardAcoes.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
        if (boxParecer) boxParecer.style.display = 'none';
      }

      // TÉCNICO
      if (isTecnico) {
        if (cardAcoes) cardAcoes.style.display = 'block';
        if (btnDelete) btnDelete.style.display = 'none';
        if (boxParecer) boxParecer.style.display = 'block';

        // status editável (aberto, em_andamento, resolvido)
        if (selectStatus) selectStatus.value = dadosChamado.status || 'aberto';

        // prioridade somente admin
        if (selectPrio) {
          selectPrio.value = dadosChamado.prioridade || 'media';
          selectPrio.disabled = true;
          selectPrio.title = 'Apenas administradores podem redefinir a prioridade';
        }

        // botão “Assumir Chamado”
        if (btnAssumir) {
          if (dadosChamado.tecnicoId === usuarioAtual.uid) {
            btnAssumir.style.display = 'inline-flex';
            btnAssumir.className = 'btn btn-secondary btn-sm';
            btnAssumir.innerHTML = '✓ Chamado sob sua responsabilidade';
            btnAssumir.disabled = true;
          } else {
            btnAssumir.style.display = 'inline-flex';
            btnAssumir.className = 'btn btn-primary btn-sm';
            btnAssumir.innerHTML = '🙋 Assumir este Chamado';
            btnAssumir.disabled = false;
          }
        }
      }

      // ADMIN
      if (isAdmin) {
        if (cardAcoes) cardAcoes.style.display = 'block';
        if (btnDelete) btnDelete.style.display = 'inline-flex';
        if (boxParecer) boxParecer.style.display = 'block';

        if (selectStatus) selectStatus.value = dadosChamado.status || 'aberto';
        if (selectPrio) {
          selectPrio.value = dadosChamado.prioridade || 'media';
          selectPrio.disabled = false;
        }

        if (btnAssumir) {
          btnAssumir.style.display = 'inline-flex';
          btnAssumir.className = 'btn btn-primary btn-sm';
          btnAssumir.innerHTML = dadosChamado.tecnicoId ? 'Atribuir a mim' : 'Assumir chamado';
          btnAssumir.disabled = false;
        }
      }

      // Preenche autor do comentário
      const inAutor = document.getElementById('commentAutor');
      if (inAutor) {
        inAutor.value =
          dadosUsuarioDoc.nome ||
          usuarioAtual.displayName ||
          usuarioAtual.email.split('@')[0];
      }
    } catch (error) {
      console.error('Erro ao carregar chamado:', error);
      alert('Erro ao carregar chamado: ' + error.message);
    }
  }

  // -----------------------------------------------------------------
  // 5. BADGES DE STATUS & PRIORIDADE
  // -----------------------------------------------------------------
  function renderBadges(status, prioridade) {
    const elStatus = document.getElementById('ticketStatusBadge');
    const elPrio = document.getElementById('ticketPriorityBadge');

    const corStatus =
      status === 'resolvido'
        ? 'green'
        : status === 'em_andamento'
        ? 'amber'
        : status === 'fechado'
        ? 'gray'
        : 'blue';
    const labelStatus =
      status === 'em_andamento'
        ? 'Em atendimento'
        : status === 'aberto'
        ? 'Aberto'
        : status === 'resolvido'
        ? 'Resolvido'
        : status === 'fechado'
        ? 'Fechado'
        : status || 'Aberto';

    const corPrio =
      prioridade === 'critica'
        ? 'red'
        : prioridade === 'alta'
        ? 'amber'
        : prioridade === 'baixa'
        ? 'gray'
        : 'blue';
    const labelPrio = prioridade
      ? prioridade.charAt(0).toUpperCase() + prioridade.slice(1)
      : 'Normal';

    if (elStatus) {
      elStatus.className = `status status-${corStatus}`;
      elStatus.textContent = labelStatus;
    }
    if (elPrio) {
      elPrio.className = `badge badge-${corPrio}`;
      elPrio.textContent = labelPrio;
    }
  }

  // -----------------------------------------------------------------
  // 6. TIMELINE DE COMENTÁRIOS & PARECER TÉCNICO
  // -----------------------------------------------------------------
  async function carregarComentarios() {
    const timeline = document.getElementById('commentsTimeline');
    const countBadge = document.getElementById('commentsCount');
    if (!timeline) return;

    try {
      const snap = await db
        .collection('chamados')
        .doc(ticketId)
        .collection('comentarios')
        .orderBy('criadoEm', 'asc')
        .get();

      const comentarios = [];
      snap.forEach((doc) => comentários.push({ id: doc.id, ...doc.data() }));

      if (countBadge) countBadge.textContent = comentarios.length;

      if (comentarios.length === 0) {
        timeline.innerHTML = `
          <li class="tl-item tl-system">
            <p class="muted">Nenhum comentário ou parecer registrado.</p>
          </li>`;
        return;
      }

      timeline.innerHTML = comentarios
        .map((c) => {
          const iniciais = (c.autor || 'U')
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          const dataStr = formatarDataCompleta(c.criadoEm);

          if (c.tipo === 'sistema') {
            return `
              <li class="tl-item tl-system">
                <span class="tl-dot"></span>
                <p>${c.mensagem} <time class="muted">${dataStr}</time></p>
              </li>`;
          }

          if (c.tipo === 'parecer_tecnico') {
            return `
              <li class="tl-item tl-comment">
                <span class="avatar avatar-sm" style="background: var(--primary); color: #fff;">
                  ${iniciais}
                </span>
                <div class="bubble" style="border-left: 3px solid var(--primary); background: rgba(124, 108, 255, 0.08);">
                  <div class="bubble-head">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <strong>${c.autor || 'Técnico'}</strong>
                      <span class="badge badge-purple" style="font-size: 10px;">Parecer Técnico</span>
                    </div>
                    <time class="muted">${dataStr}</time>
                  </div>
                  <p style="margin-top: 6px;">${c.mensagem}</p>
                </div>
              </li>`;
          }

          // Comentário normal
          return `
            <li class="tl-item tl-comment">
              <span class="avatar avatar-sm">${iniciais}</span>
              <div class="bubble">
                <div class="bubble-head">
                  <strong>${c.autor || 'Usuário'}</strong>
                  <time class="muted">${dataStr}</time>
                </div>
                <p>${c.mensagem}</p>
              </div>
            </li>`;
        })
        .join('');
    } catch (e) {
      console.warn('Erro ao carregar comentários:', e);
    }
  }

  // -----------------------------------------------------------------
  // 7. ENVIAR COMENTÁRIO OU PARECER TÉCNICO
  // -----------------------------------------------------------------
  window.handleAddComment = async function (e) {
    e.preventDefault();
    const mensagemInput = document.getElementById('commentMensagem');
    const autorInput = document.getElementById('commentAutor');
    const chkParecer = document.getElementById('chkIsParecer');

    const mensagem = mensagemInput.value.trim();
    const autor = autorInput.value.trim() || usuarioAtual.displayName || 'Usuário';
    const isParecer = chkParecer && chkParecer.checked;

    if (!mensagem) return;

    try {
      const btn = document.getElementById('btnSubmitComment');
      if (btn) btn.disabled = true;

      const tipoComentario = isParecer ? 'parecer_tecnico' : 'comentario';

      await db
        .collection('chamados')
        .doc(ticketId)
        .collection('comentarios')
        .add({
          autor,
          mensagem,
          tipo: tipoComentario,
          userId: usuarioAtual.uid,
          perfilAutor: perfilAtual,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

      // Atualiza timestamp e possivelmente status
      const updateData = {
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (isParecer && dadosChamado.status === 'aberto') {
        updateData.status = 'em_andamento';
      }
      await db.collection('chamados').doc(ticketId).update(updateData);

      mensagemInput.value = '';
      if (chkParecer) chkParecer.checked = false;
      if (btn) btn.disabled = false;

      await carregarDetalhesChamado();
      await carregarComentarios();
    } catch (error) {
      alert('Erro ao enviar mensagem: ' + error.message);
      const btn = document.getElementById('btnSubmitComment');
      if (btn) btn.disabled = false;
    }
  };

  // -----------------------------------------------------------------
  // 8. ASSUMIR CHAMADO (TÉCNICO / ADMIN)
  // -----------------------------------------------------------------
  window.handleAssumirChamado = async function () {
    if (perfilAtual !== 'tecnico' && perfilAtual !== 'admin') {
      alert('Apenas técnicos ou administradores podem assumir chamados.');
      return;
    }

    const nomeTecnico =
      dadosUsuarioDoc.nome ||
      usuarioAtual.displayName ||
      usuarioAtual.email.split('@')[0];

    try {
      await db.collection('chamados').doc(ticketId).update({
        tecnicoId: usuarioAtual.uid,
        tecnicoNome: nomeTecnico,
        status: dadosChamado.status === 'aberto' ? 'em_andamento' : dadosChamado.status,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Registra mensagem do sistema no histórico
      await db
        .collection('chamados')
        .doc(ticketId)
        .collection('comentarios')
        .add({
          autor: 'Sistema',
          mensagem: `Chamado assumido pelo técnico ${nomeTecnico}.`,
          tipo: 'sistema',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

      alert('Você assumiu este chamado!');
      await carregarDetalhesChamado();
      await carregarComentarios();
    } catch (error) {
      alert('Erro ao assumir chamado: ' + error.message);
    }
  };

  // -----------------------------------------------------------------
  // 9. ATUALIZAÇÃO RÁPIDA (STATUS & PRIORIDADE)
  // -----------------------------------------------------------------
  window.handleQuickUpdate = async function (e) {
    e.preventDefault();
    if (perfilAtual === 'user') {
      alert('Usuários padrão não têm permissão para alterar o status do chamado.');
      return;
    }

    const novoStatus = document.getElementById('q-status').value;
    const selectPrio = document.getElementById('q-prioridade');
    const novaPrioridade = selectPrio ? selectPrio.value : dadosChamado.prioridade;

    try {
      const updatePayload = {
        status: novoStatus,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (perfilAtual === 'admin') {
        updatePayload.prioridade = novaPrioridade;
      }

      await db.collection('chamados').doc(ticketId).update(updatePayload);

      const nomeAutor = dadosUsuarioDoc.nome || usuarioAtual.displayName || 'Técnico';
      await db
        .collection('chamados')
        .doc(ticketId)
        .collection('comentarios')
        .add({
          autor: 'Sistema',
          mensagem: `Status atualizado para "${novoStatus}" por ${nomeAutor}.`,
          tipo: 'sistema',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

      renderBadges(novoStatus, novaPrioridade);
      await carregarDetalhesChamado();
      await carregarComentarios();
      alert('Chamado atualizado com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar chamado: ' + error.message);
    }
  };

  // -----------------------------------------------------------------
  // 10. EXCLUIR CHAMADO (APENAS ADMIN)
  // -----------------------------------------------------------------
  window.handleDeleteTicket = async function () {
    if (perfilAtual !== 'admin') {
      alert('Permissão negada: Apenas administradores podem excluir chamados.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir permanentemente este chamado? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await db.collection('chamados').doc(ticketId).delete();
      alert('Chamado excluído com sucesso.');
      window.location.href = '/tickets';
    } catch (error) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  // -----------------------------------------------------------------
  // 11. FUNÇÃO AUXILIAR DE FORMATAÇÃO DE DATA
  // -----------------------------------------------------------------
  function formatarDataCompleta(timestamp) {
    if (!timestamp) return 'Hoje';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
})();