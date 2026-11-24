/* Área do Paciente — Clínica Flamboyant */
(function () {
  'use strict';
  var F = window.Flamboyant;
  var db = F.db;
  var $ = function (id) { return document.getElementById(id); };
  var TELAS = ['tela-login', 'tela-senha', 'tela-termos', 'tela-painel', 'tela-carregando'];
  var LINK_MINUTOS = 30;          // validade do link assinado de cada vídeo
  var INATIVIDADE_MIN = 30;       // sai sozinho após 30 min parado

  var estado = { paciente: null, procs: [], videos: [], vistos: {}, procAtual: null, fase: 'pre' };

  function tela(id) {
    TELAS.forEach(function (t) { $(t).classList.toggle('oculto', t !== id); });
    var logado = id === 'tela-painel' || id === 'tela-senha' || id === 'tela-termos';
    $('topo-logado').classList.toggle('oculto', !logado);
    window.scrollTo(0, 0);
  }

  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

  // ───────── Login ─────────
  $('form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    var erro = $('login-erro');
    F.esconder(erro);
    if (!db) return F.mostrar(erro, 'A Área do Paciente está em configuração. Tente novamente em breve.');
    var cpf = F.soDigitos($('login-cpf').value);
    var senha = $('login-senha').value;
    if (!F.cpfValido(cpf)) return F.mostrar(erro, 'Confira o CPF digitado.');
    if (!senha) return F.mostrar(erro, 'Digite a sua senha.');
    var btn = $('btn-entrar');
    btn.disabled = true; btn.textContent = 'Entrando…';
    var r = await db.auth.signInWithPassword({ email: F.emailDoCpf(cpf), password: senha });
    btn.disabled = false; btn.textContent = 'Entrar';
    if (r.error) {
      var msg = /rate|too many/i.test(r.error.message)
        ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
        : (/banned/i.test(r.error.message) ? 'Seu acesso está desativado. Fale com a clínica.' : 'CPF ou senha incorretos.');
      return F.mostrar(erro, msg);
    }
    $('login-senha').value = '';
    carregarPaciente();
  });

  async function carregarPaciente() {
    tela('tela-carregando');
    var u = await db.auth.getUser();
    if (!u.data || !u.data.user) return tela('tela-login');
    var r = await db.from('pacientes').select('id, nome, cpf, ativo, precisa_trocar_senha, termos_aceitos_em').eq('id', u.data.user.id).maybeSingle();
    if (r.error || !r.data) {
      await db.auth.signOut();
      tela('tela-login');
      return F.mostrar($('login-erro'), 'Este acesso não pertence a um paciente.');
    }
    if (!r.data.ativo) {
      await db.auth.signOut();
      tela('tela-login');
      return F.mostrar($('login-erro'), 'Seu acesso está desativado. Fale com a clínica.');
    }
    estado.paciente = r.data;
    $('topo-nome').textContent = primeiroNome(r.data.nome);
    if (r.data.precisa_trocar_senha) return tela('tela-senha');
    if (!r.data.termos_aceitos_em) return tela('tela-termos');
    abrirPainel();
  }

  // ───────── Troca de senha ─────────
  $('form-senha').addEventListener('submit', async function (e) {
    e.preventDefault();
    var erro = $('senha-erro');
    F.esconder(erro);
    var s1 = $('nova-senha').value, s2 = $('nova-senha-2').value;
    if (s1.length < 8 || !/[a-zA-Z]/.test(s1) || !/\d/.test(s1)) return F.mostrar(erro, 'Use pelo menos 8 caracteres, com letras e números.');
    if (s1 !== s2) return F.mostrar(erro, 'As senhas não são iguais.');
    var btn = $('btn-salvar-senha');
    btn.disabled = true; btn.textContent = 'Salvando…';
    var r = await db.auth.updateUser({ password: s1 });
    if (!r.error) r = await db.rpc('marcar_senha_trocada');
    btn.disabled = false; btn.textContent = 'Salvar senha';
    if (r.error) {
      return F.mostrar(erro, /different|same/i.test(r.error.message) ? 'A nova senha precisa ser diferente da senha recebida.' : 'Não foi possível salvar. Tente novamente.');
    }
    $('nova-senha').value = ''; $('nova-senha-2').value = '';
    estado.paciente.precisa_trocar_senha = false;
    if (!estado.paciente.termos_aceitos_em) return tela('tela-termos');
    abrirPainel();
  });

  // ───────── Termos ─────────
  $('btn-aceitar').addEventListener('click', async function () {
    var erro = $('termos-erro');
    F.esconder(erro);
    if (!$('aceite').checked) return F.mostrar(erro, 'Para continuar, marque que leu e aceita o termo.');
    var r = await db.rpc('aceitar_termos');
    if (r.error) return F.mostrar(erro, 'Não foi possível registrar o aceite. Tente novamente.');
    estado.paciente.termos_aceitos_em = new Date().toISOString();
    abrirPainel();
  });

  // ───────── Painel ─────────
  async function abrirPainel() {
    tela('tela-carregando');
    db.rpc('registrar_acesso');
    var p = estado.paciente;
    var rp = await db.from('paciente_procedimentos').select('procedimento_id, data_cirurgia, medico, procedimentos ( id, nome, descricao )').eq('paciente_id', p.id);
    estado.procs = (rp.data || []).filter(function (x) { return x.procedimentos; });
    var ids = estado.procs.map(function (x) { return x.procedimento_id; });
    var rv = ids.length
      ? await db.from('videos').select('id, procedimento_id, fase, titulo, descricao, storage_path, ordem').in('procedimento_id', ids).order('ordem').order('criado_em')
      : { data: [] };
    estado.videos = rv.data || [];
    var rw = await db.from('visualizacoes').select('video_id').eq('paciente_id', p.id);
    estado.vistos = {};
    (rw.data || []).forEach(function (v) { estado.vistos[v.video_id] = true; });
    estado.procAtual = estado.procs.length ? estado.procs[0].procedimento_id : null;
    $('ola').textContent = 'Olá, ' + primeiroNome(p.nome);
    tela('tela-painel');
    desenharPainel();
  }

  function desenharPainel() {
    var seletor = $('proc-seletor');
    seletor.innerHTML = '';
    if (estado.procs.length > 1) {
      estado.procs.forEach(function (x) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'aba' + (x.procedimento_id === estado.procAtual ? ' is-ativa' : '');
        b.textContent = x.procedimentos.nome;
        b.addEventListener('click', function () { estado.procAtual = x.procedimento_id; estado.fase = 'pre'; desenharPainel(); });
        seletor.appendChild(b);
      });
    }

    var card = $('proc-card');
    if (!estado.procAtual) {
      card.classList.add('oculto');
      $('abas').innerHTML = ''; $('fase-intro').textContent = '';
      $('lista-videos').innerHTML = '<div class="vazio">Seu acesso está ativo, mas a clínica ainda não liberou as orientações do seu procedimento. Se precisar, fale com a equipe.</div>';
      return;
    }
    card.classList.remove('oculto');
    var proc = estado.procs.filter(function (x) { return x.procedimento_id === estado.procAtual; })[0];
    var vids = estado.videos.filter(function (v) { return v.procedimento_id === estado.procAtual; });
    var vistos = vids.filter(function (v) { return estado.vistos[v.id]; }).length;
    var pct = vids.length ? Math.round(vistos / vids.length * 100) : 0;
    var meta = [];
    if (proc.data_cirurgia) meta.push('<span>Cirurgia: <strong>' + F.esc(F.formatarData(proc.data_cirurgia)) + '</strong></span>');
    if (proc.medico) meta.push('<span>Médico: <strong>' + F.esc(proc.medico) + '</strong></span>');
    card.innerHTML =
      '<div><div class="eyebrow" style="margin-bottom:6px;color:#C9BF98">Seu procedimento</div>' +
      '<div class="proc-card__nome">' + F.esc(proc.procedimentos.nome) + '</div>' +
      (meta.length ? '<div class="proc-card__meta" style="margin-top:10px">' + meta.join('') + '</div>' : '') + '</div>' +
      '<div class="proc-card__prog"><div style="font-size:14px;color:#E6DCC4">' + vistos + ' de ' + vids.length + ' vídeos assistidos</div>' +
      '<div class="barra"><span style="width:' + pct + '%"></span></div></div>';

    var abas = $('abas');
    abas.innerHTML = '';
    F.FASES.forEach(function (f) {
      var n = vids.filter(function (v) { return v.fase === f.id; }).length;
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', f.id === estado.fase ? 'true' : 'false');
      b.className = 'aba' + (f.id === estado.fase ? ' is-ativa' : '');
      b.innerHTML = F.esc(f.nome) + ' <span>(' + n + ')</span>';
      b.addEventListener('click', function () { estado.fase = f.id; desenharPainel(); });
      abas.appendChild(b);
    });
    var fase = F.FASES.filter(function (f) { return f.id === estado.fase; })[0];
    $('fase-intro').textContent = fase.intro;

    var lista = $('lista-videos');
    lista.innerHTML = '';
    var daFase = vids.filter(function (v) { return v.fase === estado.fase; });
    if (!daFase.length) {
      lista.innerHTML = '<div class="vazio">Os vídeos desta fase serão liberados em breve.</div>';
      return;
    }
    daFase.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'video-item';
      b.innerHTML =
        '<div class="video-item__topo"><span class="video-item__play"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"></path></svg></span>' +
        (estado.vistos[v.id] ? '<span class="selo selo--ok">Assistido</span>' : '<span class="selo">Vídeo ' + (i + 1) + '</span>') + '</div>' +
        '<h3>' + F.esc(v.titulo) + '</h3>' + (v.descricao ? '<p>' + F.esc(v.descricao) + '</p>' : '');
      b.addEventListener('click', function () { abrirVideo(v); });
      lista.appendChild(b);
    });
  }

  // ───────── Player protegido ─────────
  var modal = $('player-modal'), player = $('player'), video = $('player-video');
  var marcaMovel = $('marca-movel'), marcaFixa = $('marca-fixa');
  var timerMarca = null, videoAtual = null, marcado = false, ultimoFoco = null;

  function moverMarca() {
    marcaMovel.style.left = (6 + Math.random() * 56) + '%';
    marcaMovel.style.top = (8 + Math.random() * 70) + '%';
  }

  async function abrirVideo(v) {
    videoAtual = v; marcado = !!estado.vistos[v.id];
    ultimoFoco = document.activeElement;
    $('player-titulo').textContent = v.titulo;
    $('player-desc').textContent = v.descricao || '';
    var agora = new Date();
    var texto = estado.paciente.nome + ' · CPF ' + F.mascararCpf(estado.paciente.cpf);
    marcaMovel.innerHTML = F.esc(texto) + '<br>' + F.esc(agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    marcaFixa.textContent = 'Uso exclusivo · ' + primeiroNome(estado.paciente.nome) + ' · Clínica Flamboyant';
    moverMarca();
    clearInterval(timerMarca);
    timerMarca = setInterval(moverMarca, 7000);
    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';
    $('player-carregando').classList.remove('oculto');
    $('player-fechar').focus();
    var r = await db.storage.from(F.BUCKET).createSignedUrl(v.storage_path, LINK_MINUTOS * 60);
    if (r.error || !r.data) {
      $('player-carregando').textContent = 'Não foi possível carregar o vídeo. Tente novamente.';
      return;
    }
    video.src = r.data.signedUrl;
    video.load();
  }

  function fecharVideo() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    clearInterval(timerMarca);
    modal.classList.add('oculto');
    document.body.style.overflow = '';
    $('player-carregando').textContent = 'Carregando vídeo…';
    if (document.fullscreenElement) document.exitFullscreen();
    if (ultimoFoco) ultimoFoco.focus();
    desenharPainel();
  }

  video.addEventListener('loadeddata', function () { $('player-carregando').classList.add('oculto'); });
  video.addEventListener('error', function () {
    if (!video.getAttribute('src')) return;
    $('player-carregando').classList.remove('oculto');
    $('player-carregando').textContent = 'O link do vídeo expirou ou falhou. Feche e abra novamente.';
  });
  video.addEventListener('timeupdate', function () {
    if (marcado || !videoAtual || !video.duration) return;
    if (video.currentTime / video.duration >= 0.9) {
      marcado = true;
      estado.vistos[videoAtual.id] = true;
      db.from('visualizacoes').upsert({ paciente_id: estado.paciente.id, video_id: videoAtual.id }, { onConflict: 'paciente_id,video_id', ignoreDuplicates: true });
    }
  });
  // Bloqueia menu de contexto (salvar vídeo como…) e arrastar
  player.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  video.addEventListener('dragstart', function (e) { e.preventDefault(); });
  // Tela cheia do conjunto (vídeo + marca d'água), não só do vídeo
  $('player-tela-cheia').addEventListener('click', function () {
    if (document.fullscreenElement) return document.exitFullscreen();
    if (player.requestFullscreen) player.requestFullscreen();
    else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
  });
  video.addEventListener('dblclick', function (e) { e.preventDefault(); $('player-tela-cheia').click(); });
  $('player-fechar').addEventListener('click', fecharVideo);
  modal.addEventListener('click', function (e) { if (e.target === modal) fecharVideo(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.classList.contains('oculto') && !document.fullscreenElement) fecharVideo();
  });

  // ───────── Sair e inatividade ─────────
  async function sair(msg) {
    if (!modal.classList.contains('oculto')) fecharVideo();
    if (db) await db.auth.signOut();
    estado = { paciente: null, procs: [], videos: [], vistos: {}, procAtual: null, fase: 'pre' };
    tela('tela-login');
    if (msg) F.mostrar($('login-erro'), msg); else F.esconder($('login-erro'));
  }
  $('btn-sair').addEventListener('click', function () { sair(); });
  var timerInativo;
  function reiniciarInatividade() {
    clearTimeout(timerInativo);
    timerInativo = setTimeout(function () {
      if (estado.paciente && video.paused) sair('Por segurança, sua sessão foi encerrada após um período sem uso.');
    }, INATIVIDADE_MIN * 60 * 1000);
  }
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { document.addEventListener(ev, reiniciarInatividade, { passive: true }); });
  reiniciarInatividade();

  // ───────── Início ─────────
  (async function iniciar() {
    if (!db) {
      tela('tela-login');
      return F.mostrar($('login-erro'), 'A Área do Paciente está em configuração. Tente novamente em breve.');
    }
    var s = await db.auth.getSession();
    if (s.data && s.data.session) carregarPaciente(); else tela('tela-login');
  })();
})();
