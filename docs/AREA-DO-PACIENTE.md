# Área do Paciente — Clínica Flamboyant

Área restrita onde cada paciente assiste às orientações em vídeo do seu procedimento
(pré, trans e pós-operatório). A clínica cadastra pacientes, procedimentos e vídeos por um painel próprio.

## Endereços

| Página | Quem usa | Login |
|---|---|---|
| `/area-do-paciente` | Pacientes | CPF + senha individual |
| `/admin` | Equipe da clínica (Simone) | E-mail + senha |

## Como funciona

**Paciente**
1. Recebe pelo WhatsApp o link, o CPF e uma senha provisória gerada pelo painel.
2. No primeiro acesso cria a própria senha e aceita o termo de uso (LGPD).
3. Vê o procedimento, a data da cirurgia, o médico e os vídeos separados em Pré, Trans e Pós-operatório.
4. O vídeo assistido até 90% fica marcado como "Assistido".
5. Sem validade: o acesso fica ativo até a clínica bloquear ou excluir.
6. Por segurança, a sessão é encerrada após 30 minutos sem uso.

**Clínica (`/admin`)**
- Pacientes: cadastrar (gera senha e mensagem pronta para WhatsApp), nova senha, vincular mais procedimentos, bloquear/reativar, excluir (apaga todos os dados — LGPD).
- Acompanhamento: vídeos assistidos por paciente e último acesso.
- Procedimentos e vídeos: criar procedimentos sob demanda, enviar vídeos (MP4) por fase, ordenar, editar, remover.

## Segurança

- **Login:** CPF + senha individual (internamente o CPF vira `cpf@pacientes.clinicaflamboyant.app`; nenhum e-mail é enviado). Senhas guardadas com hash pelo Supabase Auth, com limite de tentativas.
- **Regras no banco (RLS):** cada paciente só lê o próprio cadastro, os próprios procedimentos e os vídeos deles. Só administradores (tabela `admins`) leem e alteram o resto.
- **Ações sensíveis** (criar login, gerar senha, bloquear, excluir) passam pela Edge Function `admin-pacientes`, que confere se quem chama é administrador. A chave de serviço nunca vai para o navegador.
- **Vídeos:** bucket privado `videos-pacientes`. O player recebe um link assinado válido por 30 minutos, gerado só para pacientes com acesso àquele procedimento. Não há botão de download, menu de contexto nem picture-in-picture, e o arquivo não tem endereço público.
- **Marca d'água:** nome e CPF parcial do paciente, com data e hora, mudando de posição a cada 7 s, mais uma marca diagonal fixa. Ela continua visível em tela cheia.
- **Limite honesto:** nenhum site impede a gravação da tela. A marca d'água identifica quem vazou.
- Páginas fora do Google (`noindex`) e sem cache.

## Implantação

1. **Projeto Supabase** dedicado (recomendado: região `sa-east-1`, São Paulo).
2. **Banco:** executar `supabase/migrations/0001_area_do_paciente.sql` (SQL Editor ou CLI).
3. **Função:** publicar `supabase/functions/admin-pacientes` com verificação de JWT ativa.
   Opcional: segredo `ALLOWED_ORIGINS` com o domínio do site (ex.: `https://clinicaflamboyant.com.br`).
4. **Configuração do site:** preencher `assets/js/supabase-config.js` com a URL do projeto e a chave **publishable/anon**.
5. **Conta da Simone:** em Authentication → Users → Add user, criar com e-mail e senha (marcar "Auto confirm"). Depois, no SQL Editor:
   ```sql
   insert into public.admins (user_id, nome)
   select id, 'Simone Barreiro' from auth.users where email = 'EMAIL-DA-SIMONE';
   ```
6. **Auth:** em Authentication → Providers → Email, desativar "Allow new users to sign up" (só o painel cria pacientes).
7. **Vídeos grandes:** no plano gratuito o limite por arquivo é 50 MB. No plano Pro, aumentar em Storage → Settings.

## Arquivos

```
area-do-paciente/index.html       Login, troca de senha, termo, painel e player
admin/index.html                  Painel da clínica
assets/css/area.css               Estilos das duas áreas
assets/js/supabase-config.js      URL e chave pública do Supabase
assets/js/area-comum.js           Utilitários (CPF, máscaras, cliente Supabase)
assets/js/paciente.js             Lógica da Área do Paciente
assets/js/admin.js                Lógica do painel
supabase/migrations/…sql          Tabelas, regras de acesso e bucket privado
supabase/functions/admin-pacientes Função de servidor das ações administrativas
```
