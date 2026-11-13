// Área do Paciente — Clínica Flamboyant
// Ações administrativas que precisam da chave de serviço (criar login, senha, bloqueio).
// Só pode ser chamada por um usuário cadastrado na tabela public.admins.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ORIGENS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());
const DOMINIO_LOGIN = "pacientes.clinicaflamboyant.app";

function cors(req: Request) {
  const origem = req.headers.get("origin") ?? "";
  const permitido = ORIGENS.includes("*") ? "*" : (ORIGENS.includes(origem) ? origem : ORIGENS[0]);
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dig = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(cpf[9]) && dig(10) === Number(cpf[10]);
}

// Senha legível para ditar por WhatsApp: ex. "Flor-4827-km"
function gerarSenha() {
  const palavras = ["Flor", "Galho", "Raiz", "Folha", "Copa", "Petala", "Broto", "Ramo"];
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const rnd = new Uint32Array(5);
  crypto.getRandomValues(rnd);
  const p = palavras[rnd[0] % palavras.length];
  const n = String(1000 + (rnd[1] % 9000));
  const l = letras[rnd[2] % letras.length] + letras[rnd[3] % letras.length];
  return `${p}-${n}-${l}`;
}

const emailDoCpf = (cpf: string) => `${cpf}@${DOMINIO_LOGIN}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "Método não permitido." }, 405);

  // 1. Quem está chamando?
  const auth = req.headers.get("Authorization") ?? "";
  const usuario = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u } = await usuario.auth.getUser();
  if (!u?.user) return json(req, { erro: "Sessão inválida. Entre novamente." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: ehAdmin } = await admin.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!ehAdmin) return json(req, { erro: "Acesso restrito à administração da clínica." }, 403);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return json(req, { erro: "Requisição inválida." }, 400); }
  const acao = String(corpo.acao ?? "");

  try {
    // ── Criar paciente ──
    if (acao === "criar") {
      const nome = String(corpo.nome ?? "").trim();
      const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
      const telefone = String(corpo.telefone ?? "").replace(/\D/g, "") || null;
      const procedimentoId = corpo.procedimento_id ? String(corpo.procedimento_id) : null;
      if (nome.length < 3) return json(req, { erro: "Informe o nome completo do paciente." }, 400);
      if (!cpfValido(cpf)) return json(req, { erro: "CPF inválido." }, 400);

      const { data: existe } = await admin.from("pacientes").select("id").eq("cpf", cpf).maybeSingle();
      if (existe) return json(req, { erro: "Já existe um paciente com este CPF." }, 409);

      const senha = gerarSenha();
      const { data: criado, error: e1 } = await admin.auth.admin.createUser({
        email: emailDoCpf(cpf),
        password: senha,
        email_confirm: true,
        user_metadata: { tipo: "paciente" },
      });
      if (e1 || !criado.user) throw e1 ?? new Error("Falha ao criar o login.");

      const { error: e2 } = await admin.from("pacientes").insert({
        id: criado.user.id, nome, cpf, telefone, criado_por: u.user.id,
      });
      if (e2) { await admin.auth.admin.deleteUser(criado.user.id); throw e2; }

      if (procedimentoId) {
        const { error: e3 } = await admin.from("paciente_procedimentos").insert({
          paciente_id: criado.user.id,
          procedimento_id: procedimentoId,
          data_cirurgia: corpo.data_cirurgia || null,
          medico: corpo.medico ? String(corpo.medico) : null,
        });
        if (e3) throw e3;
      }
      return json(req, { ok: true, paciente_id: criado.user.id, senha });
    }

    const pacienteId = String(corpo.paciente_id ?? "");
    const { data: pac } = await admin.from("pacientes").select("id").eq("id", pacienteId).maybeSingle();
    if (!pac) return json(req, { erro: "Paciente não encontrado." }, 404);

    // ── Nova senha (o paciente troca no próximo acesso) ──
    if (acao === "redefinir_senha") {
      const senha = gerarSenha();
      const { error } = await admin.auth.admin.updateUserById(pacienteId, { password: senha });
      if (error) throw error;
      await admin.from("pacientes").update({ precisa_trocar_senha: true }).eq("id", pacienteId);
      return json(req, { ok: true, senha });
    }

    // ── Ativar / bloquear acesso ──
    if (acao === "definir_status") {
      const ativo = Boolean(corpo.ativo);
      const { error } = await admin.auth.admin.updateUserById(pacienteId, { ban_duration: ativo ? "none" : "876000h" });
      if (error) throw error;
      await admin.from("pacientes").update({ ativo }).eq("id", pacienteId);
      return json(req, { ok: true, ativo });
    }

    // ── Excluir paciente e todos os seus dados (LGPD) ──
    if (acao === "excluir") {
      const { error } = await admin.auth.admin.deleteUser(pacienteId);
      if (error) throw error;
      return json(req, { ok: true });
    }

    return json(req, { erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(acao, e);
    return json(req, { erro: "Não foi possível concluir a ação. Tente novamente." }, 500);
  }
});
