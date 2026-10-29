/* Clínica Flamboyant — interações */
(function () {
  'use strict';

  var reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WHATS = 'https://wa.me/5555996776740?text=';

  /* Cabeçalho compacto ao rolar + menu mobile */
  var header = document.getElementById('header');
  var menuBtn = document.getElementById('menu-btn');
  var onScroll = function () { header.classList.toggle('is-compacto', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  menuBtn.addEventListener('click', function () {
    var aberto = header.classList.toggle('menu-aberto');
    menuBtn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  });
  document.querySelectorAll('#nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      header.classList.remove('menu-aberto');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  /* Revelação suave ao rolar */
  var revelaveis = document.querySelectorAll('.revela');
  if ('IntersectionObserver' in window && !reduzMovimento) {
    var ioRevela = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visivel'); ioRevela.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revelaveis.forEach(function (el) { ioRevela.observe(el); });
  } else {
    revelaveis.forEach(function (el) { el.classList.add('is-visivel'); });
  }

  /* Jornada: 4 etapas */
  var etapas = document.querySelectorAll('.etapa');
  var fotos = document.querySelectorAll('.jornada__fotos img');
  var flor = document.getElementById('jornada-flor');
  var num = document.getElementById('jornada-num');
  etapas.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      etapas.forEach(function (b, j) {
        b.classList.toggle('is-ativa', i === j);
        b.setAttribute('aria-pressed', i === j ? 'true' : 'false');
      });
      fotos.forEach(function (f, j) { f.classList.toggle('is-ativa', i === j); });
      flor.style.transform = 'rotate(' + (i * 90) + 'deg)';
      num.textContent = '0' + (i + 1);
    });
  });

  /* Carrossel do corpo clínico */
  var trilho = document.getElementById('carrossel-trilho');
  var cards = trilho.querySelectorAll('.card-pro');
  var contador = document.getElementById('carrossel-contador');
  var btnAnt = document.getElementById('carrossel-ant');
  var btnProx = document.getElementById('carrossel-prox');
  var pontosBox = document.getElementById('carrossel-pontos');
  var total = cards.length;
  var atual = 0;
  var pad = function (v) { return (v < 10 ? '0' : '') + v; };
  var pontos = [];
  cards.forEach(function (c, i) {
    var p = document.createElement('button');
    p.type = 'button';
    p.className = 'ponto' + (i === 0 ? ' is-ativo' : '');
    p.setAttribute('aria-label', 'Ver especialista ' + (i + 1));
    p.appendChild(document.createElement('span'));
    p.addEventListener('click', function () { irPara(i); });
    pontosBox.appendChild(p);
    pontos.push(p);
  });
  function marcar(i) {
    atual = i;
    cards.forEach(function (c, j) { c.classList.toggle('is-ativo', i === j); });
    pontos.forEach(function (p, j) { p.classList.toggle('is-ativo', i === j); });
    contador.textContent = pad(i + 1) + ' / ' + pad(total);
    var fim = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4;
    btnAnt.disabled = i === 0 && trilho.scrollLeft < 4;
    btnProx.disabled = fim && i >= total - 1;
  }
  function irPara(i) {
    i = Math.max(0, Math.min(total - 1, i));
    var alvo = cards[i].offsetLeft - cards[0].offsetLeft;
    trilho.scrollTo({ left: alvo, behavior: reduzMovimento ? 'auto' : 'smooth' });
    marcar(i);
  }
  btnAnt.addEventListener('click', function () { irPara(atual - 1); });
  btnProx.addEventListener('click', function () { irPara(atual + 1); });
  var tScroll;
  trilho.addEventListener('scroll', function () {
    clearTimeout(tScroll);
    tScroll = setTimeout(function () {
      var base = cards[0].offsetLeft;
      var mais = 0, menor = Infinity;
      cards.forEach(function (c, j) {
        var d = Math.abs(c.offsetLeft - base - trilho.scrollLeft);
        if (d < menor) { menor = d; mais = j; }
      });
      var fim = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4;
      if (fim && atual > mais) mais = atual;
      marcar(mais);
    }, 90);
  }, { passive: true });
  trilho.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); irPara(atual + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(atual - 1); }
  });
  marcar(0);

  /* Ecossistema: árvore flamboyant */
  var SERVICOS = {
    coluna: { titulo: 'Coluna', grupo: 'Carro-chefe da clínica',
      desc: 'Complexo de atendimento especializado na saúde da coluna. Hérnia de disco, dor no nervo ciático e dores para quem não precisa, ou não deseja, passar por cirurgia, com tratamento multidisciplinar e não cirúrgico.',
      tags: ['Medicina', 'Fisioterapia', 'Treinamento físico'], cta: 'Agendar avaliação da coluna',
      quem: 'Dr. Jonas Barreiro (ortopedia), Dra. Simone Barreiro, Dr. Roger Brazeiro e Dr. Vitor Lopes Neves (fisioterapia e treinamento)' },
    ombro: { titulo: 'Ombro', grupo: 'Ortopedia e traumatologia',
      desc: 'Avaliação e tratamento ortopédico do ombro, incluindo quadros de artrose, com reabilitação dentro da clínica.',
      tags: ['Ortopedia', 'Fisioterapia'], cta: 'Agendar avaliação', quem: 'Dr. Jonas Barreiro · Ortopedia' },
    fisio: { titulo: 'Fisioterapia', grupo: 'Reabilitação',
      desc: 'Fisioterapia em ortopedia e traumatologia, conduzida em conjunto com o plano definido pelo médico.',
      tags: ['Ortopedia', 'Traumatologia'], cta: 'Agendar fisioterapia', quem: 'Dra. Simone Barreiro, Dr. Roger Brazeiro e Dr. Vitor Lopes Neves' },
    quadril: { titulo: 'Quadril', grupo: 'Ortopedia e traumatologia',
      desc: 'Complexo de atendimento especializado na saúde do quadril. Artrose com tratamento não cirúrgico e cirúrgico: medicina, fisioterapia e treinamento físico.',
      tags: ['Medicina e cirurgia', 'Fisioterapia', 'Treinamento físico'], cta: 'Agendar avaliação de quadril', quem: 'Dr. Jonas Barreiro · Ortopedia' },
    pilates: { titulo: 'Pilates', grupo: 'Movimento',
      desc: 'Pilates com acompanhamento profissional, integrado às etapas de reabilitação e fortalecimento. [DETALHES A CONFIRMAR: modalidades e horários]',
      tags: ['Fortalecimento', 'Reabilitação'], cta: 'Quero saber mais', quem: 'Dr. Roger Brazeiro' },
    joelho: { titulo: 'Joelho', grupo: 'Ortopedia e traumatologia',
      desc: 'Complexo de atendimento especializado na saúde do joelho. Artrose com tratamento não cirúrgico e cirúrgico: medicina, fisioterapia e treinamento físico.',
      tags: ['Medicina e cirurgia', 'Fisioterapia', 'Treinamento físico'], cta: 'Agendar avaliação de joelho', quem: 'Dr. Jonas Barreiro · Ortopedia' },
    box: { titulo: 'Box de treinamento e reabilitação', grupo: 'Movimento',
      desc: 'Espaço próprio para treinamento físico e reabilitação, a etapa que devolve força e confiança para a rotina.',
      tags: ['Treinamento físico', 'Reabilitação'], cta: 'Quero saber mais', quem: 'Dr. Vitor Lopes Neves' },
    neuro: { titulo: 'Neurologia', grupo: 'Medicina',
      desc: 'Atendimento em neurologia no mesmo espaço, complementando a investigação de dores e sintomas. [DETALHES A CONFIRMAR: profissional e atendimentos]',
      tags: ['Consulta'], cta: 'Agendar consulta', quem: 'Dr. Roger Brazeiro · Neuromodulação e reabilitação neurológica' },
    palmilhas: { titulo: 'Palmilhas funcionais', grupo: 'Avaliação funcional',
      desc: 'Avaliação e indicação de palmilhas funcionais, um apoio para pisada, postura e alívio de sobrecarga. [DETALHES A CONFIRMAR]',
      tags: ['Avaliação', 'Palmilha funcional'], cta: 'Agendar avaliação', quem: 'Dra. Simone Barreiro' }
  };

  var arvore = document.getElementById('arvore');
  var ecoArvore = document.getElementById('eco-arvore');
  var botoesArvore = arvore.querySelectorAll('.servico');
  var lista = document.getElementById('eco-lista');
  var painel = document.getElementById('painel');
  var el = {
    grupo: document.getElementById('painel-grupo'),
    titulo: document.getElementById('painel-titulo'),
    desc: document.getElementById('painel-desc'),
    tags: document.getElementById('painel-tags'),
    quem: document.getElementById('painel-quem'),
    cta: document.getElementById('painel-cta')
  };
  var botoesLista = [];

  Object.keys(SERVICOS).forEach(function (id) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = SERVICOS[id].titulo;
    b.dataset.servico = id;
    b.setAttribute('aria-pressed', id === 'coluna' ? 'true' : 'false');
    if (id === 'coluna') b.classList.add('is-ativo');
    b.addEventListener('click', function () { selecionar(id); });
    lista.appendChild(b);
    botoesLista.push(b);
  });

  function selecionar(id) {
    var s = SERVICOS[id];
    if (!s) return;
    [].concat([].slice.call(botoesArvore), botoesLista).forEach(function (b) {
      var on = b.dataset.servico === id;
      b.classList.toggle('is-ativo', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    el.grupo.textContent = s.grupo;
    el.titulo.textContent = s.titulo;
    el.desc.textContent = s.desc;
    el.tags.innerHTML = '';
    s.tags.forEach(function (t) { var sp = document.createElement('span'); sp.textContent = t; el.tags.appendChild(sp); });
    el.quem.textContent = s.quem;
    el.cta.textContent = s.cta;
    el.cta.href = WHATS + encodeURIComponent('Olá! Gostaria de saber mais sobre ' + s.titulo.toLowerCase() + '.');
    painel.classList.remove('is-trocando');
    void painel.offsetWidth;
    painel.classList.add('is-trocando');
  }
  botoesArvore.forEach(function (b) {
    b.addEventListener('click', function () { selecionar(b.dataset.servico); });
  });

  function crescer() { arvore.classList.add('is-crescida'); ecoArvore.classList.add('is-crescida'); }
  function replantar() {
    arvore.classList.remove('is-crescida');
    ecoArvore.classList.remove('is-crescida');
    void arvore.offsetWidth;
    setTimeout(crescer, 60);
  }
  if (reduzMovimento || !('IntersectionObserver' in window)) {
    crescer();
  } else {
    var ioArvore = new IntersectionObserver(function (entradas) {
      if (entradas[0].isIntersecting) { crescer(); ioArvore.disconnect(); }
    }, { threshold: 0.35 });
    ioArvore.observe(arvore);
  }
  document.getElementById('eco-replay').addEventListener('click', replantar);

  /* Dúvidas: acordeão (uma aberta por vez) */
  var perguntas = document.querySelectorAll('.faq__pergunta');
  perguntas.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var abrir = btn.getAttribute('aria-expanded') !== 'true';
      perguntas.forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
        document.getElementById(b.getAttribute('aria-controls')).hidden = true;
      });
      if (abrir) {
        btn.setAttribute('aria-expanded', 'true');
        document.getElementById(btn.getAttribute('aria-controls')).hidden = false;
      }
    });
  });
})();
