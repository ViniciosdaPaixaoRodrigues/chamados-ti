const apiKey = process.env.FIREBASE_API_KEY;
const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
const projectId = process.env.FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.FIREBASE_STORAGE_BUCKET;
const appId = process.env.FIREBASE_APP_ID;

(function () {
  'use strict';

  // ---------------------------------------------------------
  //  INICIALIZAÇÃO FIREBASE
  // ---------------------------------------------------------
  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: storageBucket,
    messagingSenderId: messagingSenderId,
    appId: appId
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // Listener de estado de autenticação
  auth.onAuthStateChanged(function (user) {
  if (user) {
    redirectToDashboard('Autenticado com sucesso!');
  }
});

  // ---------------------------------------------------------
  //  CONTROLE DE MODAIS
  // ---------------------------------------------------------
  var overlay = document.getElementById('modalOverlay');
  var modalLogin = document.getElementById('modalLogin');
  var modalCadastro = document.getElementById('modalCadastro');

  window.openModal = function (tipo) {
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (tipo === 'login') {
      modalLogin.style.display = '';
      modalCadastro.style.display = 'none';
      var emailInput = document.getElementById('login-email');
      if (emailInput) setTimeout(function () { emailInput.focus(); }, 100);
    } else {
      modalLogin.style.display = 'none';
      modalCadastro.style.display = '';
      var nomeInput = document.getElementById('cad-nome');
      if (nomeInput) setTimeout(function () { nomeInput.focus(); }, 100);
    }

    // Limpar erros ao abrir
    hideError('loginError');
    hideError('cadastroError');
  };

  window.closeModal = function () {
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  window.switchModal = function (e, tipo) {
    e.preventDefault();
    window.openModal(tipo);
  };

  // Fechar modal ao clicar no overlay
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) window.closeModal();
    });
  }

  // Fechar modal com ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
      window.closeModal();
    }
  });

  // Abrir modal via hash na URL (#login ou #cadastro)
  function checkHash() {
    var hash = window.location.hash.replace('#', '');
    if (hash === 'login' || hash === 'cadastro') {
      window.openModal(hash);
      // Limpa o hash sem rolar
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
  checkHash();

  // ---------------------------------------------------------
  //  TOGGLE VISIBILIDADE DE SENHA
  // ---------------------------------------------------------
  window.togglePassword = function (inputId, btn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    var iconEye = btn.querySelector('.icon-eye');
    var iconEyeOff = btn.querySelector('.icon-eye-off');
    if (iconEye && iconEyeOff) {
      iconEye.style.display = isPassword ? 'none' : '';
      iconEyeOff.style.display = isPassword ? '' : 'none';
    }
  };

  // ---------------------------------------------------------
  //  INDICADOR DE FORÇA DA SENHA
  // ---------------------------------------------------------
  var senhaInput = document.getElementById('cad-senha');
  var strengthFill = document.getElementById('strengthFill');
  var strengthText = document.getElementById('strengthText');

  if (senhaInput) {
    senhaInput.addEventListener('input', function () {
      var val = senhaInput.value;
      var score = 0;
      if (val.length >= 6) score++;
      if (val.length >= 10) score++;
      if (/[a-z]/.test(val) && /[A-Z]/.test(val)) score++;
      if (/\d/.test(val)) score++;
      if (/[^a-zA-Z0-9]/.test(val)) score++;

      var levels = [
        { width: '0%', color: 'transparent', label: '' },
        { width: '20%', color: 'var(--red)', label: 'Muito fraca' },
        { width: '40%', color: 'var(--amber)', label: 'Fraca' },
        { width: '60%', color: 'var(--amber)', label: 'Razoável' },
        { width: '80%', color: 'var(--blue)', label: 'Boa' },
        { width: '100%', color: 'var(--green)', label: 'Forte' },
      ];

      var level = val.length === 0 ? levels[0] : levels[Math.min(score, 5)];
      if (strengthFill) {
        strengthFill.style.width = level.width;
        strengthFill.style.background = level.color;
      }
      if (strengthText) {
        strengthText.textContent = level.label;
        strengthText.style.color = level.color;
      }
    });
  }

  // ---------------------------------------------------------
  //  HELPERS
  // ---------------------------------------------------------
  function showError(containerId, message) {
    var el = document.getElementById(containerId);
    var msgEl = document.getElementById(containerId.replace('Error', 'ErrorMsg'));
    if (el && msgEl) {
      msgEl.textContent = message;
      el.style.display = '';
    }
  }

  function hideError(containerId) {
    var el = document.getElementById(containerId);
    if (el) el.style.display = 'none';
  }

  function setLoading(btnId, loading) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    var text = btn.querySelector('.btn-text');
    var loader = btn.querySelector('.btn-loading');
    if (text) text.style.display = loading ? 'none' : '';
    if (loader) loader.style.display = loading ? '' : 'none';
    btn.disabled = loading;
  }

  window.showToast = function (message) {
    var toast = document.getElementById('toastSucesso');
    var msg = document.getElementById('toastMsg');
    if (toast && msg) {
      msg.textContent = message;
      toast.style.display = '';
      toast.classList.remove('hide');
      setTimeout(function () {
        window.hideToast();
      }, 4500);
    }
  };

  window.hideToast = function () {
    var toast = document.getElementById('toastSucesso');
    if (toast) {
      toast.classList.add('hide');
      setTimeout(function () {
        toast.style.display = 'none';
        toast.classList.remove('hide');
      }, 400);
    }
  };

  // Mapeia erros do Firebase para mensagens em PT-BR
  function firebaseErrorMessage(code) {
    var messages = {
      'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/operation-not-allowed': 'Método de autenticação não habilitado.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      'auth/user-disabled': 'Esta conta foi desativada.',
      'auth/user-not-found': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento e tente novamente.',
      'auth/popup-closed-by-user': 'Login cancelado. A janela foi fechada.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    };
    return messages[code] || 'Ocorreu um erro. Tente novamente.';
  }

  // ---------------------------------------------------------
  //  HANDLER: LOGIN COM EMAIL/SENHA
  // ---------------------------------------------------------
  window.handleLogin = function (e) {
    e.preventDefault();
    hideError('loginError');

    var email = document.getElementById('login-email').value.trim();
    var senha = document.getElementById('login-senha').value;

    // Validação básica no front
    if (!email || !senha) {
      showError('loginError', 'Preencha todos os campos.');
      return;
    }

    setLoading('btnLogin', true);

    // ----- FIREBASE: Login com email/senha -----
    // Descomente o bloco abaixo quando o Firebase estiver configurado:
    /*
    auth.signInWithEmailAndPassword(email, senha)
      .then(function (userCredential) {
        // Login bem-sucedido — o onAuthStateChanged vai redirecionar
        window.showToast('Login realizado com sucesso!');
        window.closeModal();
      })
      .catch(function (error) {
        showError('loginError', firebaseErrorMessage(error.code));
        setLoading('btnLogin', false);
      });
    */

    // ----- SIMULAÇÃO (remova quando usar Firebase) -----
    setTimeout(function () {
      setLoading('btnLogin', false);
      window.showToast('Login realizado com sucesso! (simulação)');
      window.closeModal();
      // window.location.href = '/';
    }, 1500);
  };

  // ---------------------------------------------------------
  //  HANDLER: CADASTRO COM EMAIL/SENHA
  // ---------------------------------------------------------
  window.handleCadastro = function (e) {
    e.preventDefault();
    hideError('cadastroError');

    var nome = document.getElementById('cad-nome').value.trim();
    var email = document.getElementById('cad-email').value.trim();
    var setor = document.getElementById('cad-setor').value;
    var senha = document.getElementById('cad-senha').value;
    var confirma = document.getElementById('cad-confirma').value;

    // Validações
    if (!nome || !email || !senha || !confirma) {
      showError('cadastroError', 'Preencha todos os campos obrigatórios.');
      return;
    }
    if (senha.length < 6) {
      showError('cadastroError', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirma) {
      showError('cadastroError', 'As senhas não coincidem.');
      return;
    }

    setLoading('btnCadastro', true);

    // ----- FIREBASE: Criar conta -----
    auth.createUserWithEmailAndPassword(email, senha)
      .then(function (userCredential) {
        // Atualizar perfil com nome
        return userCredential.user.updateProfile({
          displayName: nome,
        });
      })
      .then(function () {
        // Opcional: salvar dados extras (setor) no Firestore
        // const db = firebase.firestore();
        // return db.collection('usuarios').doc(auth.currentUser.uid).set({
        //   nome: nome,
        //   email: email,
        //   setor: setor,
        //   criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        // });

        window.showToast('Conta criada com sucesso!');
        window.closeModal();
        // onAuthStateChanged vai redirecionar
      })
      .catch(function (error) {
        showError('cadastroError', firebaseErrorMessage(error.code));
        setLoading('btnCadastro', false);
      });

    // ----- SIMULAÇÃO (remova quando usar Firebase) -----
    setTimeout(function () {
      setLoading('btnCadastro', false);
      window.showToast('Conta criada com sucesso! (simulação)');
      window.closeModal();
    }, 1500);
  };

  // ---------------------------------------------------------
  //  HANDLER: LOGIN COM GOOGLE
  // ---------------------------------------------------------
  window.handleGoogleLogin = function () {
    // ----- FIREBASE: Google Sign-In -----
    auth.signInWithPopup(googleProvider)
      .then(function (result) {
        window.showToast('Login com Google realizado!');
        window.closeModal();
        // onAuthStateChanged vai redirecionar
      })
      .catch(function (error) {
        if (error.code === 'auth/popup-closed-by-user') return;
        var currentModal = modalLogin.style.display !== 'none' ? 'loginError' : 'cadastroError';
        showError(currentModal, firebaseErrorMessage(error.code));
      });

    // ----- SIMULAÇÃO (remova quando usar Firebase) -----
    window.showToast('Login com Google (simulação)');
    window.closeModal();
  };

  // ---------------------------------------------------------
  //  HANDLER: ESQUECEU A SENHA
  // ---------------------------------------------------------
  window.handleForgotPassword = function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();

    if (!email) {
      showError('loginError', 'Preencha o campo de e-mail para recuperar a senha.');
      return;
    }

    // ----- FIREBASE: Enviar email de redefinição -----
    auth.sendPasswordResetEmail(email)
      .then(function () {
        hideError('loginError');
        window.showToast('E-mail de redefinição enviado para ' + email);
      })
      .catch(function (error) {
        showError('loginError', firebaseErrorMessage(error.code));
      });

    // ----- SIMULAÇÃO (remova quando usar Firebase) -----
    hideError('loginError');
    window.showToast('E-mail de redefinição enviado para ' + email + ' (simulação)');
  };

})();
