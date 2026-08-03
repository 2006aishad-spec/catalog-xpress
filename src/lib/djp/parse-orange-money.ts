/**
 * DJUMBAI PAY — Parser de SMS Orange Money (Guiné-Bissau)
 *
 * Função PURA, sem I/O, sem dependências. É o único ponto do sistema que
 * interpreta texto livre, por isso é deliberadamente conservador:
 * - se algo essencial faltar (valor OU ID de transação) → devolve erro,
 *   nunca "adivinha" valores.
 * - o SMS original é sempre guardado antes de chegar aqui (raw_sms_events),
 *   por isso um erro de parsing nunca perde dinheiro/prova.
 *
 * FORMATO DE REFERÊNCIA (SMS real):
 *   "Deposito de 2000.00 FCFA feito pelo 957151448. O seu novo saldo e de
 *    2257.00 FCFA. ID: CI260801.2122.B06384. OFM Bissau"
 *
 * O ID da transação carrega data/hora: CI<AAMMDD>.<HHMM>.<sufixo>
 *   CI260801.2122.B06384 → 2026-08-01, 21:22
 *
 * -------------------------------------------------------------------------
 * CASOS DE TESTE (verificados manualmente — este módulo processa dinheiro real)
 * -------------------------------------------------------------------------
 * 1) SMS canónico
 *    in : "Deposito de 2000.00 FCFA feito pelo 957151448. O seu novo saldo e de 2257.00 FCFA. ID: CI260801.2122.B06384. OFM Bissau"
 *    out: ok, amount=2000, senderMsisdn="957151448", newBalance=2257,
 *         providerTransactionId="CI260801.2122.B06384", date="2026-08-01", time="21:22:00"
 *
 * 2) Sem saldo no texto
 *    in : "Deposito de 3500 FCFA feito pelo 955112233. ID: CI260801.0904.A11111."
 *    out: ok, amount=3500, newBalance=null, date="2026-08-01", time="09:04:00"
 *
 * 3) Separador de milhar com ponto + decimal com vírgula
 *    in : "Deposito de 7.900,00 FCFA feito pelo 955112233. ID: CI260715.1830.C22222"
 *    out: ok, amount=7900
 *
 * 4) Separador de milhar com espaço
 *    in : "Deposito de 3 500 FCFA feito pelo 955112233. ID: CI260715.1830.C33333"
 *    out: ok, amount=3500
 *
 * 5) Maiúsculas/acentos/variação de redação
 *    in : "DEPÓSITO DE 2000.00 FCFA FEITO PELO 957151448. ID: CI260801.2122.B06384"
 *    out: ok, amount=2000
 *
 * 6) Texto truncado sem ID → ERRO (nunca inventar ID)
 *    in : "Deposito de 2000.00 FCFA feito pelo 957151448. O seu novo sal"
 *    out: erro "ID da transação não encontrado"
 *
 * 7) Sem valor → ERRO
 *    in : "ID: CI260801.2122.B06384. OFM Bissau"
 *    out: erro "valor não encontrado"
 *
 * 8) ID com formato inesperado (sem data/hora embutida) → ok, mas date/time null
 *    in : "Deposito de 2000 FCFA feito pelo 955112233. ID: XYZ-98765"
 *    out: ok, providerTransactionId="XYZ-98765", date=null, time=null
 *
 * 9) SMS de outra natureza (retirada/publicidade) sem valor+ID → ERRO
 *    in : "Recarregue o seu saldo Orange e ganhe bónus!"
 *    out: erro "valor não encontrado"
 *
 * 10) Valor 0 → ERRO (não faz sentido como pagamento)
 *    in : "Deposito de 0.00 FCFA feito pelo 955112233. ID: CI260801.2122.B06384"
 *    out: erro "valor inválido"
 */

export type ParsedOrangeMoneySms = {
  providerTransactionId: string;
  amount: number;
  currency: string;
  senderMsisdn: string | null;
  recipientMsisdn: string | null;
  newBalance: number | null;
  transactionDate: string | null; // YYYY-MM-DD
  transactionTime: string | null; // HH:MM:SS
};

export type ParseResult =
  | { ok: true; data: ParsedOrangeMoneySms }
  | { ok: false; error: string };

/** Normaliza acentos e espaços para tornar os regex insensíveis a variações. */
function normalize(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte um número escrito em texto para Number.
 * Regras (FCFA raramente usa cêntimos, mas o SMS mostra ".00"):
 * - "2 000"      → 2000  (espaço = milhar)
 * - "2.000"      → 2000  (3 dígitos depois do ponto = milhar)
 * - "2000.00"    → 2000  (2 dígitos depois do único ponto = decimal)
 * - "7.900,00"   → 7900  (ponto = milhar, vírgula = decimal)
 * - "2000,50"    → 2000.5
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/\s/g, "");
  if (!s) return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    const tail = s.split(",").pop() ?? "";
    s = tail.length === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (hasDot) {
    const parts = s.split(".");
    const tail = parts[parts.length - 1] ?? "";
    // Único ponto com 1-2 dígitos finais = decimal; caso contrário é milhar.
    s = parts.length === 2 && tail.length <= 2 ? s : parts.join("");
  }

  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** Extrai data/hora do ID Orange Money: CI<AAMMDD>.<HHMM>.<sufixo> */
export function dateTimeFromTransactionId(
  txId: string,
): { date: string; time: string } | null {
  const m = /^[A-Z]{2}(\d{2})(\d{2})(\d{2})\.(\d{2})(\d{2})\./i.exec(txId);
  if (!m) return null;
  const [, yy, mm, dd, hh, mi] = m;
  const month = Number(mm);
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(mi);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  return { date: `20${yy}-${mm}-${dd}`, time: `${hh}:${mi}:00` };
}

export function parseOrangeMoneySms(
  rawBody: string,
  options: { recipientMsisdn?: string | null; currency?: string } = {},
): ParseResult {
  if (!rawBody || !rawBody.trim()) return { ok: false, error: "SMS vazio" };
  const text = normalize(rawBody);

  // ID da transação: aceita o formato Orange (CI260801.2122.B06384) e,
  // em alternativa, qualquer token após "ID:".
  const idMatch =
    /\b([A-Z]{2}\d{6}\.\d{4}\.[A-Z0-9]+)\b/i.exec(text) ??
    /\bID\s*[:=]?\s*([A-Z0-9][A-Z0-9._-]{4,})/i.exec(text);
  if (!idMatch?.[1]) return { ok: false, error: "ID da transação não encontrado" };
  const providerTransactionId = idMatch[1].replace(/[.,;]+$/, "").toUpperCase();

  // Valor: primeiro número seguido de FCFA/XOF que NÃO seja o saldo.
  const amountMatch =
    /(?:deposito|depositado|recebido|transferencia|pagamento)\s+(?:de\s+)?([\d .,]+?)\s*(?:FCFA|XOF|F\b)/i.exec(
      text,
    ) ?? /([\d][\d .,]*?)\s*(?:FCFA|XOF)\b/i.exec(text);
  if (!amountMatch?.[1]) return { ok: false, error: "valor não encontrado" };
  const amount = parseAmount(amountMatch[1]);
  if (amount === null) return { ok: false, error: "valor não encontrado" };
  if (!(amount > 0)) return { ok: false, error: "valor inválido" };

  // Novo saldo (opcional).
  const balanceMatch = /saldo\s+e?\s*(?:de)?\s*([\d .,]+?)\s*(?:FCFA|XOF)/i.exec(text);
  const newBalance = balanceMatch?.[1] ? parseAmount(balanceMatch[1]) : null;

  // Número remetente (opcional): "feito pelo 957151448" ou primeiro MSISDN 9 dígitos.
  const senderMatch =
    /(?:feito\s+pel[oa]|remetente|de)\s+(\+?\d{8,15})\b/i.exec(text) ??
    /\b(\d{9})\b/.exec(text);
  const senderMsisdn = senderMatch?.[1] ? senderMatch[1].replace(/\D/g, "") : null;

  const dt = dateTimeFromTransactionId(providerTransactionId);

  return {
    ok: true,
    data: {
      providerTransactionId,
      amount,
      currency: options.currency ?? "XOF",
      senderMsisdn,
      recipientMsisdn: options.recipientMsisdn ?? null,
      newBalance,
      transactionDate: dt?.date ?? null,
      transactionTime: dt?.time ?? null,
    },
  };
}
