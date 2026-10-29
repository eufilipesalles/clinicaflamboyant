# Clínica Flamboyant — Site

Site estático (HTML, CSS e JavaScript puros, sem etapa de build), pronto para a Vercel.

## Estrutura

```
index.html              Página principal
favicon.svg             Ícone (flor da marca)
vercel.json             Configuração da Vercel (cache e cabeçalhos)
assets/css/style.css    Estilos e versão mobile
assets/js/main.js       Interações: menu, jornada, carrossel, árvore, dúvidas
assets/img/marca/       Logos e flores da marca
assets/img/fotos/       Fotos da clínica (otimizadas para web)
assets/img/arvore/      Camadas da animação da árvore flamboyant
assets/video/           Vídeo da hérnia de disco e capa
```

## Publicar na Vercel

**Opção A — pelo painel (via GitHub)**
1. Envie esta pasta para um repositório no GitHub.
2. Na Vercel: Add New → Project → Import o repositório.
3. Framework Preset: **Other**. Build Command: vazio. Output Directory: vazio (raiz).
4. Deploy. Cada novo push atualiza o site automaticamente.

**Opção B — pela linha de comando**
```bash
npm i -g vercel
cd clinica-flamboyant-site
vercel          # cria a URL de pré-visualização
vercel --prod   # publica em produção
```

## Pendências antes da versão final
- RQE do Dr. Jonas Barreiro (rodapé)
- Confirmar se o CRM é do RS (formato "CRM-RS 31755")
- Valor da consulta e regra do desconto (seção Dúvidas)
- Serviço "Neurologia": confirmar nome e profissional
- Ondas de Choque e Neuromodulação (aparecem no Google): incluir ou não
- Confirmar que (55) 99677-6740 é WhatsApp
- Instagram oficial (rodapé)
- Detalhes de Pilates e Palmilhas (painel da árvore)
