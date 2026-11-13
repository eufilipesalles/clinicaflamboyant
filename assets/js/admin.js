/* Painel da Clínica — cadastro de pacientes, procedimentos e vídeos */
(function () {
  'use strict';
  var F = window.Flamboyant;
  var db = F.db;
  var $ = function (id) { return document.getElementById(id); };
  var LINK_SITE = window.location.origin + '/area-do-paciente/';
  var MEDICO_PADRAO = 'Dr. Jonas Barreiro';
  var estado = { pacientes: [], procs: [], videos: [], procSel: null };

  // ───────── Utilidades de interface ─────────
  function tela(id) {
    ['tela-login', 'tela-painel'].forEach(function (t) { $(t).classList.toggle('oculto', t !== id); });
    $('topo-logado').classList.toggle('oculto', id !== 'tela-painel');
  }
  var modal = $('modal'), caixa = $('modal-caixa'), focoAnterior = null;
  function abrirModal(html) {
    focoAnterior = document.activeElement;
    caixa.innerHTML = html;
    modal.classList.remove('oculto');
    var primeiro = caixa.querySelector('input, select, textarea, button');
    if (primeiro) primeiro.focus();
  }
  function fecharModal() { modal.classList.add('oculto'); caixa.innerHTML = ''; if (focoAnterior) focoAnterior.focus(); }
  modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.classList.contains('oculto')) fecharModal(); });
  caixa.addEventListener('click', function (e) { if (e.target.closest('[data-fechar]')) fecharModal(); });

  function opcoesProcs(selecionado) {
    return estado.procs.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === selecionado ? ' selected' : '') + '>' + F.esc(p.nome) + '</option>';
    }).join('');
  }
  function dataHora(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  async function funcaoAdmin(corpo) {
    var r = await db.functions.invoke('admin-pacientes', { body: corpo });
    if (r.error) {
      var msg = 'Não foi possível concluir a ação.';
      try { var j = await r.error.context.json(); if (j && j.erro) msg = j.erro; } catch (e) { /* mantém mensagem padrão */ }
      throw new Error(msg);
    }
    if (r.data && r.data.erro) throw new Error(r.data.erro);
    return r.data;
  }

  // ───────── Login ─────────
  $('form-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    var erro = $('login-erro');
    F.esconder(erro);
    if (!db) return F.mostrar(erro, 'Sistema ainda não configurado (supabase-config.js).');
    var btn = $('btn-entrar');
    btn.disabled = true; btn.textContent = 'Entrando…';
    var r = await db.auth.signInWithPassword({ email: $('adm-email').value.trim(), password: $('adm-senha').value });
    btn.disabled = false; btn.textContent = 'Entrar';
    if (r.error) return F.mostrar(erro, /rate|too many/i.test(r.error.message) ? 'Muitas tentativas. Aguarde alguns minutos.' : 'E-mail ou senha incorretos.');
    $('adm-senha').value = '';
    verificarAdmin();
  });

  async function verificarAdmin() {
    var u = await db.auth.getUser();
    if (!u.data || !u.data.user) return tela('tela-login');
    var r = await db.from('admins').select('nome').eq('user_id', u.data.user.id).maybeSingle();
    if (!r.data) {
      await db.auth.signOut();
      tela('tela-login');
      return F.mostrar($('login-erro'), 'Este usuário não tem acesso ao painel da clínica.');
    }
    $('topo-nome').textContent = r.data.nome;
    tela('tela-painel');
    await carregarTudo();
  }

  $('btn-sair').addEventListener('click', async function () { await db.auth.signOut(); tela('tela-login'); });

  // ───────── Abas ─────────
  document.querySelectorAll('[data-aba]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-aba]').forEach(function (x) {
        var on = x === b;
        x.classList.toggle('is-ativa', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        $('aba-' + x.getAttribute('data-aba')).classList.toggle('oculto', !on);
      });
    });
  });

  // ───────── Dados ─────────
  async function carregarTudo() {
    var rp = await db.from('procedimentos').select('id, nome, descricao').order('nome');
    estado.procs = rp.data || [];
    var rv = await db.from('videos').select('id, procedimento_id, fase, titulo, descricao, storage_path, ordem, criado_em').order('ordem').order('criado_em');
    estado.videos = rv.data || [];
    var rpa = await db.from('pacientes')
      .select('id, nome, cpf, telefone, ativo, precisa_trocar_senha, termos_aceitos_em, ultimo_acesso_em, criado_em, paciente_procedimentos ( procedimento_id, data_cirurgia, medico ), visualizacoes ( video_id )')
      .order('criado_em', { ascending: false });
    estado.pacientes = rpa.data || [];
    if (!estado.procSel && estado.procs.length) estado.procSel = estado.procs[0].id;
    desenharPacientes();
    desenharProcedimentos();
  }

  // ───────── Pacientes ─────────
  function nomeProc(id) { var p = estado.procs.filter(function (x) { return x.id === id; })[0]; return p ? p.nome : '—'; }
  function totalVideos(ids) { return estado.videos.filter(function (v) { return ids.indexOf(v.procedimento_id) !== -1; }).length; }

  function desenharPacientes() {
    var termo = F.soDigitos($('busca').value) || $('busca').value.trim().toLowerCase();
    var lista = estado.pacientes.filter(function (p) {
      if (!termo) return true;
      return p.nome.toLowerCase().indexOf(termo) !== -1 || p.cpf.indexOf(termo) !== -1;
    });
    var tb = $('tbody-pacientes');
    if (!lista.length) {
      tb.innerHTML = '<tr><td colspan="6">' + (estado.pacientes.length ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado ainda. Clique em “+ Novo paciente”.') + '</td></tr>';
      return;
    }
    tb.innerHTML = lista.map(function (p) {
      var pps = p.paciente_procedimentos || [];
      var ids = pps.map(function (x) { return x.procedimento_id; });
      var total = totalVideos(ids);
      var vistos = (p.visualizacoes || []).length;
      var status = !p.ativo ? '<span class="status status--bloq">Bloqueado</span>'
        : (p.precisa_trocar_senha ? '<span class="status status--novo">Aguardando 1º acesso</span>' : '<span class="status status--ativo">Ativo</span>');
      var procs = pps.length ? pps.map(function (x) {
        return F.esc(nomeProc(x.procedimento_id)) + (x.data_cirurgia ? '<small>Cirurgia ' + F.esc(F.formatarData(x.data_cirurgia)) + (x.medico ? ' · ' + F.esc(x.medico) : '') + '</small>' : '');
      }).join('<br>') : '<small>Sem procedimento</small>';
      return '<tr>' +
        '<td><strong>' + F.esc(p.nome) + '</strong><small>CPF ' + F.esc(F.formatarCpf(p.cpf)) + '</small>' + (p.telefone ? '<small>' + F.esc(F.formatarTelefone(p.telefone)) + '</small>' : '') + '</td>' +
        '<td>' + procs + '</td>' +
        '<td>' + vistos + ' de ' + total + '</td>' +
        '<td>' + dataHora(p.ultimo_acesso_em) + '</td>' +
        '<td>' + status + '</td>' +
        '<td><div class="acoes">' +
          '<button type="button" data-acao="senha" data-id="' + p.id + '">Nova senha</button>' +
          '<button type="button" data-acao="vincular" data-id="' + p.id + '">Vincular procedimento</button>' +
          '<button type="button" data-acao="status" data-id="' + p.id + '">' + (p.ativo ? 'Bloquear' : 'Reativar') + '</button>' +
          '<button type="button" class="perigo" data-acao="excluir" data-id="' + p.id + '">Excluir</button>' +
        '</div></td></tr>';
    }).join('');
  }
  $('busca').addEventListener('input', desenharPacientes);

  $('tbody-pacientes').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-acao]');
    if (!b) return;
    var p = estado.pacientes.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0];
    if (!p) return;
    var acao = b.getAttribute('data-acao');
    if (acao === 'senha') novaSenha(p);
    if (acao === 'vincular') vincular(p);
    if (acao === 'status') alternarStatus(p);
    if (acao === 'excluir') excluir(p);
  });

  $('btn-novo-paciente').addEventListener('click', function () {
    if (!estado.procs.length) {
      return abrirModal('<h3 id="modal-titulo">Antes, crie um procedimento</h3><p>Para cadastrar um paciente, cadastre primeiro o procedimento dele (ex.: Artroplastia de quadril) na aba “Procedimentos e vídeos”.</p><div class="modal__acoes"><button class="btn btn--primario btn-p" type="button" data-fechar>Entendi</button></div>');
    }
    abrirModal(
      '<h3 id="modal-titulo">Novo paciente</h3>' +
      '<div class="aviso aviso--erro oculto" id="np-erro" role="alert"></div>' +
      '<form id="form-np" novalidate>' +
        '<div class="campo"><label for="np-nome">Nome completo</label><input id="np-nome" required autocomplete="off"></div>' +
        '<div class="grid-2">' +
          '<div class="campo"><label for="np-cpf">CPF</label><input id="np-cpf" data-cpf inputmode="numeric" maxlength="14" placeholder="000.000.000-00" required autocomplete="off"></div>' +
          '<div class="campo"><label for="np-tel">WhatsApp</label><input id="np-tel" inputmode="tel" placeholder="(55) 99999-9999" autocomplete="off"></div>' +
        '</div>' +
        '<div class="campo"><label for="np-proc">Procedimento</label><select id="np-proc">' + opcoesProcs(estado.procSel) + '</select></div>' +
        '<div class="grid-2">' +
          '<div class="campo"><label for="np-data">Data da cirurgia</label><input id="np-data" type="date"></div>' +
          '<div class="campo"><label for="np-medico">Médico responsável</label><input id="np-medico" value="' + F.esc(MEDICO_PADRAO) + '"></div>' +
        '</div>' +
        '<div class="modal__acoes"><button class="btn btn--contorno btn-p" type="button" data-fechar>Cancelar</button><button class="btn btn--primario btn-p" type="submit" id="np-salvar">Cadastrar e gerar senha</button></div>' +
      '</form>'
    );
    var cpfInp = $('np-cpf');
    cpfInp.addEventListener('input', function () { cpfInp.value = F.formatarCpf(cpfInp.value); });
    $('form-np').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var erro = $('np-erro');
      F.esconder(erro);
      var nome = $('np-nome').value.trim(), cpf = F.soDigitos(cpfInp.value), tel = F.soDigitos($('np-tel').value);
      if (nome.split(/\s+/).length < 2) return F.mostrar(erro, 'Informe nome e sobrenome.');
      if (!F.cpfValido(cpf)) return F.mostrar(erro, 'CPF inválido.');
      if (tel && (tel.length < 10 || tel.length > 11)) return F.mostrar(erro, 'WhatsApp inválido. Use DDD + número.');
      var btn = $('np-salvar'); btn.disabled = true; btn.textContent = 'Cadastrando…';
      try {
        var r = await funcaoAdmin({ acao: 'criar', nome: nome, cpf: cpf, telefone: tel, procedimento_id: $('np-proc').value, data_cirurgia: $('np-data').value || null, medico: $('np-medico').value.trim() || null });
        await carregarTudo();
        mostrarSenha({ nome: nome, cpf: cpf, telefone: tel }, r.senha, true);
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Cadastrar e gerar senha';
        F.mostrar(erro, err.message);
      }
    });
  });

  function mensagemAcesso(p, senha, novo) {
    var nome = String(p.nome).split(/\s+/)[0];
    return 'Olá, ' + nome + '! ' + (novo ? 'Seu acesso à Área do Paciente da Clínica Flamboyant está pronto.' : 'Geramos uma nova senha para a sua Área do Paciente da Clínica Flamboyant.') +
      '\n\nAcesse: ' + LINK_SITE + '\nCPF: ' + F.formatarCpf(p.cpf) + '\nSenha provisória: ' + senha +
      '\n\nNo primeiro acesso você vai criar a sua própria senha. Lá estão os vídeos com os cuidados do seu tratamento. Qualquer dúvida, é só chamar aqui.';
  }

  function mostrarSenha(p, senha, novo) {
    var msg = mensagemAcesso(p, senha, novo);
    var wa = p.telefone ? 'https://wa.me/55' + F.soDigitos(p.telefone) + '?text=' + encodeURIComponent(msg) : '';
    abrirModal(
      '<h3 id="modal-titulo">' + (novo ? 'Paciente cadastrado' : 'Nova senha gerada') + '</h3>' +
      '<p>Envie a senha provisória para <strong>' + F.esc(p.nome) + '</strong>. Ela só aparece agora: depois de fechar esta janela não será possível vê-la de novo.</p>' +
      '<div class="senha-gerada">' + F.esc(senha) + '</div>' +
      '<div class="aviso aviso--ok oculto" id="copiado">Mensagem copiada.</div>' +
      '<div class="modal__acoes">' +
        '<button class="btn btn--contorno btn-p" type="button" id="btn-copiar">Copiar mensagem</button>' +
        (wa ? '<a class="btn btn--primario btn-p" href="' + wa + '" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>' : '') +
        '<button class="btn btn--contorno btn-p" type="button" data-fechar>Concluir</button>' +
      '</div>'
    );
    $('btn-copiar').addEventListener('click', function () {
      navigator.clipboard.writeText(msg).then(function () { $('copiado').classList.remove('oculto'); });
    });
  }

  async function novaSenha(p) {
    if (!confirm('Gerar uma nova senha para ' + p.nome + '? A senha atual deixará de funcionar.')) return;
    try {
      var r = await funcaoAdmin({ acao: 'redefinir_senha', paciente_id: p.id });
      await carregarTudo();
      mostrarSenha(p, r.senha, false);
    } catch (err) { alert(err.message); }
  }

  async function alternarStatus(p) {
    var bloquear = p.ativo;
    if (!confirm((bloquear ? 'Bloquear' : 'Reativar') + ' o acesso de ' + p.nome + '?')) return;
    try { await funcaoAdmin({ acao: 'definir_status', paciente_id: p.id, ativo: !bloquear }); await carregarTudo(); }
    catch (err) { alert(err.message); }
  }

  async function excluir(p) {
    var conf = prompt('Excluir ' + p.nome + ' apaga o login e todo o histórico deste paciente, sem volta.\nPara confirmar, digite EXCLUIR:');
    if (conf !== 'EXCLUIR') return;
    try { await funcaoAdmin({ acao: 'excluir', paciente_id: p.id }); await carregarTudo(); }
    catch (err) { alert(err.message); }
  }

  function vincular(p) {
    var ja = (p.paciente_procedimentos || []).map(function (x) { return x.procedimento_id; });
    var livres = estado.procs.filter(function (x) { return ja.indexOf(x.id) === -1; });
    if (!livres.length) return abrirModal('<h3 id="modal-titulo">Nenhum procedimento disponível</h3><p>Este paciente já está vinculado a todos os procedimentos cadastrados.</p><div class="modal__acoes"><button class="btn btn--primario btn-p" type="button" data-fechar>Ok</button></div>');
    abrirModal(
      '<h3 id="modal-titulo">Vincular procedimento</h3><p>' + F.esc(p.nome) + '</p>' +
      '<div class="aviso aviso--erro oculto" id="vp-erro"></div>' +
      '<form id="form-vp">' +
        '<div class="campo"><label for="vp-proc">Procedimento</label><select id="vp-proc">' + livres.map(function (x) { return '<option value="' + x.id + '">' + F.esc(x.nome) + '</option>'; }).join('') + '</select></div>' +
        '<div class="grid-2"><div class="campo"><label for="vp-data">Data da cirurgia</label><input id="vp-data" type="date"></div>' +
        '<div class="campo"><label for="vp-medico">Médico responsável</label><input id="vp-medico" value="' + F.esc(MEDICO_PADRAO) + '"></div></div>' +
        '<div class="modal__acoes"><button class="btn btn--contorno btn-p" type="button" data-fechar>Cancelar</button><button class="btn btn--primario btn-p" type="submit">Vincular</button></div>' +
      '</form>'
    );
    $('form-vp').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var r = await db.from('paciente_procedimentos').insert({ paciente_id: p.id, procedimento_id: $('vp-proc').value, data_cirurgia: $('vp-data').value || null, medico: $('vp-medico').value.trim() || null });
      if (r.error) return F.mostrar($('vp-erro'), 'Não foi possível vincular. Tente novamente.');
      fecharModal(); carregarTudo();
    });
  }

  // ───────── Procedimentos e vídeos ─────────
  function desenharProcedimentos() {
    var lista = $('procs-lista');
    if (!estado.procs.length) {
      lista.innerHTML = '<div class="dica" style="margin:8px">Nenhum procedimento ainda.</div>';
      $('proc-detalhe').innerHTML = '<div class="vazio">Crie o primeiro procedimento, por exemplo “Artroplastia de quadril”.</div>';
      return;
    }
    lista.innerHTML = estado.procs.map(function (p) {
      var n = estado.videos.filter(function (v) { return v.procedimento_id === p.id; }).length;
      var pacs = estado.pacientes.filter(function (pa) { return (pa.paciente_procedimentos || []).some(function (x) { return x.procedimento_id === p.id; }); }).length;
      return '<button type="button" data-proc="' + p.id + '" class="' + (p.id === estado.procSel ? 'is-ativo' : '') + '">' + F.esc(p.nome) + '<small>' + n + ' vídeo(s) · ' + pacs + ' paciente(s)</small></button>';
    }).join('');

    var proc = estado.procs.filter(function (p) { return p.id === estado.procSel; })[0];
    if (!proc) { $('proc-detalhe').innerHTML = '<div class="vazio">Selecione um procedimento.</div>'; return; }
    var cols = F.FASES.map(function (f) {
      var vids = estado.videos.filter(function (v) { return v.procedimento_id === proc.id && v.fase === f.id; });
      return '<div class="fase-col"><h4>' + F.esc(f.nome) + '</h4>' +
        (vids.length ? vids.map(function (v, i) {
          return '<div class="video-adm"><strong>' + F.esc(v.titulo) + '</strong>' + (v.descricao ? '<span>' + F.esc(v.descricao) + '</span>' : '') +
            '<div class="acoes">' +
              '<button type="button" data-v="ver" data-id="' + v.id + '">Ver</button>' +
              (i > 0 ? '<button type="button" data-v="subir" data-id="' + v.id + '">↑ Subir</button>' : '') +
              (i < vids.length - 1 ? '<button type="button" data-v="descer" data-id="' + v.id + '">↓ Descer</button>' : '') +
              '<button type="button" data-v="editar" data-id="' + v.id + '">Editar</button>' +
              '<button type="button" class="perigo" data-v="remover" data-id="' + v.id + '">Remover</button>' +
            '</div></div>';
        }).join('') : '<span class="dica" style="margin:0">Nenhum vídeo.</span>') +
        '<button class="btn btn--contorno btn-p" type="button" data-novo-video="' + f.id + '" style="margin-top:auto">+ Adicionar vídeo</button></div>';
    }).join('');
    $('proc-detalhe').innerHTML =
      '<div class="adm-barra" style="margin-bottom:12px"><div><h2 style="font-size:28px">' + F.esc(proc.nome) + '</h2>' + (proc.descricao ? '<p class="dica" style="margin:4px 0 0">' + F.esc(proc.descricao) + '</p>' : '') + '</div>' +
      '<div class="acoes"><button type="button" id="btn-editar-proc">Editar</button><button type="button" class="perigo" id="btn-excluir-proc">Excluir procedimento</button></div></div>' +
      '<div class="fases-adm">' + cols + '</div>';
  }

  $('procs-lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-proc]');
    if (!b) return;
    estado.procSel = b.getAttribute('data-proc');
    desenharProcedimentos();
  });

  function formProc(proc) {
    abrirModal(
      '<h3 id="modal-titulo">' + (proc ? 'Editar procedimento' : 'Novo procedimento') + '</h3>' +
      '<div class="aviso aviso--erro oculto" id="pr-erro"></div>' +
      '<form id="form-pr">' +
        '<div class="campo"><label for="pr-nome">Nome do procedimento</label><input id="pr-nome" required placeholder="Ex.: Artroplastia total de quadril" value="' + F.esc(proc ? proc.nome : '') + '"></div>' +
        '<div class="campo"><label for="pr-desc">Descrição (opcional)</label><textarea id="pr-desc">' + F.esc(proc && proc.descricao ? proc.descricao : '') + '</textarea></div>' +
        '<div class="modal__acoes"><button class="btn btn--contorno btn-p" type="button" data-fechar>Cancelar</button><button class="btn btn--primario btn-p" type="submit">Salvar</button></div>' +
      '</form>'
    );
    $('form-pr').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var dados = { nome: $('pr-nome').value.trim(), descricao: $('pr-desc').value.trim() || null };
      if (dados.nome.length < 3) return F.mostrar($('pr-erro'), 'Informe o nome do procedimento.');
      var r = proc ? await db.from('procedimentos').update(dados).eq('id', proc.id).select().single()
                   : await db.from('procedimentos').insert(dados).select().single();
      if (r.error) return F.mostrar($('pr-erro'), 'Não foi possível salvar.');
      estado.procSel = r.data.id;
      fecharModal(); carregarTudo();
    });
  }
  $('btn-novo-proc').addEventListener('click', function () { formProc(null); });

  $('proc-detalhe').addEventListener('click', async function (e) {
    var proc = estado.procs.filter(function (p) { return p.id === estado.procSel; })[0];
    if (!proc) return;
    if (e.target.id === 'btn-editar-proc') return formProc(proc);
    if (e.target.id === 'btn-excluir-proc') {
      var vids = estado.videos.filter(function (v) { return v.procedimento_id === proc.id; });
      if (!confirm('Excluir “' + proc.nome + '”? Os ' + vids.length + ' vídeo(s) serão apagados e os pacientes vinculados perdem acesso a eles.')) return;
      if (vids.length) await db.storage.from(F.BUCKET).remove(vids.map(function (v) { return v.storage_path; }));
      await db.from('procedimentos').delete().eq('id', proc.id);
      estado.procSel = null;
      return carregarTudo();
    }
    var nv = e.target.closest('[data-novo-video]');
    if (nv) return formVideo(proc, nv.getAttribute('data-novo-video'));
    var bv = e.target.closest('[data-v]');
    if (!bv) return;
    var v = estado.videos.filter(function (x) { return x.id === bv.getAttribute('data-id'); })[0];
    if (!v) return;
    var acao = bv.getAttribute('data-v');
    if (acao === 'ver') {
      var s = await db.storage.from(F.BUCKET).createSignedUrl(v.storage_path, 300);
      if (s.data) window.open(s.data.signedUrl, '_blank', 'noopener');
    }
    if (acao === 'subir' || acao === 'descer') {
      var irmaos = estado.videos.filter(function (x) { return x.procedimento_id === v.procedimento_id && x.fase === v.fase; });
      var i = irmaos.indexOf(v), j = acao === 'subir' ? i - 1 : i + 1;
      if (j < 0 || j >= irmaos.length) return;
      var tmp = irmaos[i]; irmaos[i] = irmaos[j]; irmaos[j] = tmp;
      await Promise.all(irmaos.map(function (x, k) { return db.from('videos').update({ ordem: k }).eq('id', x.id); }));
      carregarTudo();
    }
    if (acao === 'editar') formVideo(proc, v.fase, v);
    if (acao === 'remover') {
      if (!confirm('Remover o vídeo “' + v.titulo + '”? Os pacientes deixam de vê-lo.')) return;
      await db.storage.from(F.BUCKET).remove([v.storage_path]);
      await db.from('videos').delete().eq('id', v.id);
      carregarTudo();
    }
  });

  function formVideo(proc, fase, video) {
    var nomeFase = F.FASES.filter(function (f) { return f.id === fase; })[0].nome;
    abrirModal(
      '<h3 id="modal-titulo">' + (video ? 'Editar vídeo' : 'Adicionar vídeo') + '</h3>' +
      '<p class="dica" style="margin-top:-8px">' + F.esc(proc.nome) + ' · ' + F.esc(nomeFase) + '</p>' +
      '<div class="aviso aviso--erro oculto" id="vd-erro"></div>' +
      '<form id="form-vd">' +
        '<div class="campo"><label for="vd-titulo">Título</label><input id="vd-titulo" required placeholder="Ex.: Como levantar da cama nos primeiros dias" value="' + F.esc(video ? video.titulo : '') + '"></div>' +
        '<div class="campo"><label for="vd-desc">Descrição curta (opcional)</label><textarea id="vd-desc">' + F.esc(video && video.descricao ? video.descricao : '') + '</textarea></div>' +
        (video ? '' : '<div class="campo"><label for="vd-arq">Arquivo de vídeo (MP4)</label><input id="vd-arq" type="file" accept="video/mp4" required><small>Use MP4 (H.264), que roda em qualquer celular e computador. Vídeos .MOV do iPhone precisam ser exportados como MP4 antes. O vídeo fica em área privada: só os pacientes deste procedimento conseguem assistir.</small></div>') +
        '<div class="modal__acoes"><button class="btn btn--contorno btn-p" type="button" data-fechar>Cancelar</button><button class="btn btn--primario btn-p" type="submit" id="vd-salvar">' + (video ? 'Salvar' : 'Enviar vídeo') + '</button></div>' +
      '</form>'
    );
    $('form-vd').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var erro = $('vd-erro'); F.esconder(erro);
      var titulo = $('vd-titulo').value.trim(), desc = $('vd-desc').value.trim() || null;
      if (titulo.length < 3) return F.mostrar(erro, 'Informe o título do vídeo.');
      var btn = $('vd-salvar');
      if (video) {
        var ru = await db.from('videos').update({ titulo: titulo, descricao: desc }).eq('id', video.id);
        if (ru.error) return F.mostrar(erro, 'Não foi possível salvar.');
        fecharModal(); return carregarTudo();
      }
      var arq = $('vd-arq').files[0];
      if (!arq) return F.mostrar(erro, 'Selecione o arquivo do vídeo.');
      if (arq.type && arq.type !== 'video/mp4') return F.mostrar(erro, 'Envie o vídeo em formato MP4.');
      var ext = (arq.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
      var caminho = proc.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '.' + ext;
      btn.disabled = true; btn.textContent = 'Enviando… (' + Math.round(arq.size / 1048576) + ' MB)';
      var up = await db.storage.from(F.BUCKET).upload(caminho, arq, { contentType: arq.type || 'video/mp4', upsert: false });
      if (up.error) {
        btn.disabled = false; btn.textContent = 'Enviar vídeo';
        return F.mostrar(erro, /size|large|exceed/i.test(up.error.message) ? 'O arquivo é maior que o limite permitido. Comprima o vídeo e tente novamente.' : 'Falha no envio do vídeo. Verifique a conexão e tente novamente.');
      }
      var ordem = estado.videos.filter(function (x) { return x.procedimento_id === proc.id && x.fase === fase; }).length;
      var ri = await db.from('videos').insert({ procedimento_id: proc.id, fase: fase, titulo: titulo, descricao: desc, storage_path: caminho, ordem: ordem });
      if (ri.error) {
        await db.storage.from(F.BUCKET).remove([caminho]);
        btn.disabled = false; btn.textContent = 'Enviar vídeo';
        return F.mostrar(erro, 'Não foi possível salvar o vídeo.');
      }
      fecharModal(); carregarTudo();
    });
  }

  // ───────── Início ─────────
  (async function iniciar() {
    if (!db) { tela('tela-login'); return F.mostrar($('login-erro'), 'Sistema ainda não configurado (supabase-config.js).'); }
    var s = await db.auth.getSession();
    if (s.data && s.data.session) verificarAdmin(); else tela('tela-login');
  })();
})();
