/* Utilitários compartilhados: Área do Paciente e Painel da Clínica */
(function () {
  'use strict';
  var cfg = window.FLAMBOYANT_SUPABASE || {};
  var configurado = cfg.url && cfg.url.indexOf('SEU-PROJETO') === -1;

  window.Flamboyant = {
    configurado: configurado,
    db: configurado ? window.supabase.createClient(cfg.url, cfg.chave, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'flamboyant-area' }
    }) : null,
    DOMINIO_LOGIN: 'pacientes.clinicaflamboyant.app',
    BUCKET: 'videos-pacientes',

    soDigitos: function (v) { return String(v || '').replace(/\D/g, ''); },

    cpfValido: function (cpf) {
      cpf = this.soDigitos(cpf);
      if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
      var dig = function (n) {
        var s = 0;
        for (var i = 0; i < n; i++) s += Number(cpf[i]) * (n + 1 - i);
        var r = (s * 10) % 11;
        return r === 10 ? 0 : r;
      };
      return dig(9) === Number(cpf[9]) && dig(10) === Number(cpf[10]);
    },

    formatarCpf: function (v) {
      var d = this.soDigitos(v).slice(0, 11);
      return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    },

    mascararCpf: function (v) {
      var d = this.soDigitos(v);
      return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : '';
    },

    formatarTelefone: function (v) {
      var d = this.soDigitos(v);
      if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
      if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return v || '';
    },

    formatarData: function (iso) {
      if (!iso) return '';
      var p = String(iso).slice(0, 10).split('-');
      return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
    },

    emailDoCpf: function (cpf) { return this.soDigitos(cpf) + '@' + this.DOMINIO_LOGIN; },

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    mostrar: function (el, msg) { el.textContent = msg; el.classList.remove('oculto'); },
    esconder: function (el) { el.classList.add('oculto'); },

    FASES: [
      { id: 'pre', nome: 'Pré-operatório', intro: 'Como se preparar nos dias antes da cirurgia.' },
      { id: 'trans', nome: 'Transoperatório', intro: 'O que acontece no dia e durante o procedimento.' },
      { id: 'pos', nome: 'Pós-operatório', intro: 'Os cuidados para uma recuperação segura depois da cirurgia.' }
    ]
  };

  // Máscara de CPF e botão de mostrar senha
  document.querySelectorAll('input[name="cpf"], input[data-cpf]').forEach(function (inp) {
    inp.addEventListener('input', function () { inp.value = window.Flamboyant.formatarCpf(inp.value); });
  });
  document.querySelectorAll('[data-ver-senha]').forEach(function (b) {
    b.addEventListener('click', function () {
      var inp = document.getElementById(b.getAttribute('data-ver-senha'));
      var ver = inp.type === 'password';
      inp.type = ver ? 'text' : 'password';
      b.setAttribute('aria-label', ver ? 'Ocultar senha' : 'Mostrar senha');
    });
  });
})();
