#!/usr/bin/env node
/**
 * @bridgeapi/mcp-nfe — MCP Server para Notas Fiscais Eletronicas
 *
 * 16 tools para emissao, consulta, cancelamento e download de NFe/NFSe/NFCe.
 * Compativel com eNotas, NFe.io e Focus NFe.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  NFeClient,
  type NFeConfig,
  type NFeProvider,
  type NFeEnvironment,
  type ApiResponse,
} from "./nfe-client.js";

// ─── Config ──────────────────────────────────────────────────────

function loadConfig(): NFeConfig {
  const apiToken = process.env.NFE_API_TOKEN;
  if (!apiToken) throw new Error("NFE_API_TOKEN e obrigatorio");

  const companyId = process.env.NFE_COMPANY_ID;
  if (!companyId) throw new Error("NFE_COMPANY_ID e obrigatorio");

  const provider = (process.env.NFE_PROVIDER || "enotas") as NFeProvider;
  if (!["enotas", "nfeio", "focusnfe"].includes(provider)) {
    throw new Error("NFE_PROVIDER deve ser enotas, nfeio ou focusnfe");
  }

  const environment = (process.env.NFE_ENVIRONMENT || "sandbox") as NFeEnvironment;
  if (!["production", "sandbox"].includes(environment)) {
    throw new Error("NFE_ENVIRONMENT deve ser production ou sandbox");
  }

  return { apiToken, provider, environment, companyId };
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatResponse<T>(result: ApiResponse<T>): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: result.success,
            ...(result.data ? { data: result.data } : {}),
            ...(result.error ? { error: result.error } : {}),
            meta: result.meta,
          },
          null,
          2
        ),
      },
    ],
  };
}

// ─── Init ────────────────────────────────────────────────────────

const config = loadConfig();
const client = new NFeClient(config);

const server = new McpServer(
  { name: "bridgeapi-nfe", version: "0.1.0" },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    },
  }
);

// ═════════════════════════════════════════════════════════════════
// TOOLS (16)
// ═════════════════════════════════════════════════════════════════

// ── 1. create_nfe ──

server.tool(
  "create_nfe",
  "Emitir uma NFe (Nota Fiscal Eletronica de Produto). Envia os dados para a SEFAZ e retorna o ID da nota.",
  {
    dados: z
      .object({
        natureza_operacao: z.string().describe("Ex: Venda de mercadoria"),
        tipo_documento: z.number().optional().describe("0=Entrada, 1=Saida (padrao 1)"),
        items: z
          .array(
            z.object({
              descricao: z.string(),
              ncm: z.string().describe("Codigo NCM do produto (8 digitos)"),
              cfop: z.string().describe("Codigo CFOP (ex: 5102)"),
              unidade: z.string().describe("Ex: UN, KG, CX"),
              quantidade: z.number(),
              valor_unitario: z.number(),
              valor_total: z.number(),
            })
          )
          .min(1)
          .describe("Itens da nota fiscal"),
        destinatario: z.object({
          cpf_cnpj: z.string().describe("CPF ou CNPJ do destinatario"),
          nome: z.string(),
          endereco: z
            .object({
              logradouro: z.string(),
              numero: z.string(),
              complemento: z.string().optional(),
              bairro: z.string(),
              cidade: z.string(),
              uf: z.string().length(2),
              cep: z.string(),
            })
            .optional(),
          email: z.string().optional(),
        }),
        informacoes_adicionais: z.string().optional(),
      })
      .describe("Dados completos da NFe"),
  },
  async ({ dados }) => formatResponse(await client.createNFe(dados))
);

// ── 2. get_nfe ──

server.tool(
  "get_nfe",
  "Consultar uma NFe pelo ID. Retorna status, chave de acesso, valores e dados do destinatario.",
  {
    nfe_id: z.string().describe("ID da NFe no provedor"),
  },
  async ({ nfe_id }) => formatResponse(await client.getNFe(nfe_id))
);

// ── 3. list_nfe ──

server.tool(
  "list_nfe",
  "Listar notas fiscais de produto (NFe) emitidas, com filtros opcionais de data e status.",
  {
    inicio: z.string().optional().describe("Data inicio (YYYY-MM-DD)"),
    fim: z.string().optional().describe("Data fim (YYYY-MM-DD)"),
    status: z
      .enum(["autorizada", "cancelada", "rejeitada", "pendente", "processando"])
      .optional()
      .describe("Filtrar por status"),
    pagina: z.number().optional().describe("Numero da pagina"),
    limite: z.number().optional().describe("Registros por pagina"),
  },
  async (params) =>
    formatResponse(
      await client.listNFe({
        inicio: params.inicio,
        fim: params.fim,
        status: params.status,
        pagina: params.pagina,
        limite: params.limite,
      })
    )
);

// ── 4. cancel_nfe ──

server.tool(
  "cancel_nfe",
  "Cancelar uma NFe autorizada. A justificativa deve ter no minimo 15 caracteres (exigencia SEFAZ).",
  {
    nfe_id: z.string().describe("ID da NFe a cancelar"),
    justificativa: z.string().min(15).describe("Motivo do cancelamento (min 15 caracteres)"),
  },
  async ({ nfe_id, justificativa }) => formatResponse(await client.cancelNFe(nfe_id, justificativa))
);

// ── 5. correct_nfe ──

server.tool(
  "correct_nfe",
  "Emitir Carta de Correcao (CC-e) para uma NFe autorizada. Nao altera valores, apenas informacoes complementares.",
  {
    nfe_id: z.string().describe("ID da NFe"),
    correcao: z.string().min(15).describe("Texto da correcao (min 15 caracteres)"),
  },
  async ({ nfe_id, correcao }) => formatResponse(await client.correctNFe(nfe_id, correcao))
);

// ── 6. create_nfse ──

server.tool(
  "create_nfse",
  "Emitir uma NFSe (Nota Fiscal de Servico Eletronica). Para prestadores de servico.",
  {
    dados: z
      .object({
        servico: z.object({
          descricao: z.string().describe("Descricao do servico prestado"),
          codigo_servico: z.string().describe("Codigo do servico na lista LC 116/2003"),
          aliquota_iss: z.number().describe("Aliquota do ISS (ex: 5.0 para 5%)"),
          valor_servicos: z.number().describe("Valor total dos servicos"),
          iss_retido: z.boolean().optional().describe("ISS retido pelo tomador?"),
        }),
        tomador: z.object({
          cpf_cnpj: z.string().describe("CPF ou CNPJ do tomador"),
          nome: z.string(),
          endereco: z
            .object({
              logradouro: z.string(),
              numero: z.string(),
              complemento: z.string().optional(),
              bairro: z.string(),
              cidade: z.string(),
              uf: z.string().length(2),
              cep: z.string(),
            })
            .optional(),
          email: z.string().optional(),
        }),
        valor: z.number().describe("Valor total da NFSe"),
        competencia: z.string().optional().describe("Mes de competencia (YYYY-MM)"),
        rps_numero: z.number().optional().describe("Numero do RPS"),
        rps_serie: z.string().optional().describe("Serie do RPS"),
      })
      .describe("Dados completos da NFSe"),
  },
  async ({ dados }) => formatResponse(await client.createNFSe(dados))
);

// ── 7. get_nfse ──

server.tool(
  "get_nfse",
  "Consultar uma NFSe pelo ID. Retorna status, numero, valor e dados do tomador.",
  {
    nfse_id: z.string().describe("ID da NFSe no provedor"),
  },
  async ({ nfse_id }) => formatResponse(await client.getNFSe(nfse_id))
);

// ── 8. list_nfse ──

server.tool(
  "list_nfse",
  "Listar notas fiscais de servico (NFSe) emitidas, com filtros opcionais.",
  {
    inicio: z.string().optional().describe("Data inicio (YYYY-MM-DD)"),
    fim: z.string().optional().describe("Data fim (YYYY-MM-DD)"),
    status: z
      .enum(["autorizada", "cancelada", "rejeitada", "pendente", "processando"])
      .optional()
      .describe("Filtrar por status"),
    pagina: z.number().optional().describe("Numero da pagina"),
    limite: z.number().optional().describe("Registros por pagina"),
  },
  async (params) =>
    formatResponse(
      await client.listNFSe({
        inicio: params.inicio,
        fim: params.fim,
        status: params.status,
        pagina: params.pagina,
        limite: params.limite,
      })
    )
);

// ── 9. cancel_nfse ──

server.tool(
  "cancel_nfse",
  "Cancelar uma NFSe autorizada. A justificativa deve ter no minimo 15 caracteres.",
  {
    nfse_id: z.string().describe("ID da NFSe a cancelar"),
    justificativa: z.string().min(15).describe("Motivo do cancelamento (min 15 caracteres)"),
  },
  async ({ nfse_id, justificativa }) => formatResponse(await client.cancelNFSe(nfse_id, justificativa))
);

// ── 10. create_nfce ──

server.tool(
  "create_nfce",
  "Emitir uma NFCe (Nota Fiscal de Consumidor Eletronica). Para vendas no varejo / ponto de venda.",
  {
    dados: z
      .object({
        items: z
          .array(
            z.object({
              descricao: z.string(),
              ncm: z.string(),
              cfop: z.string(),
              unidade: z.string(),
              quantidade: z.number(),
              valor_unitario: z.number(),
              valor_total: z.number(),
            })
          )
          .min(1)
          .describe("Itens vendidos"),
        pagamento: z.object({
          forma: z
            .string()
            .describe("Forma de pagamento: 01=Dinheiro, 03=Cartao Credito, 04=Cartao Debito, 05=Pix"),
          valor: z.number(),
          troco: z.number().optional(),
        }),
        cpf_consumidor: z.string().optional().describe("CPF do consumidor (opcional)"),
      })
      .describe("Dados da NFCe"),
  },
  async ({ dados }) => formatResponse(await client.createNFCe(dados))
);

// ── 11. get_nfce ──

server.tool(
  "get_nfce",
  "Consultar uma NFCe pelo ID.",
  {
    nfce_id: z.string().describe("ID da NFCe no provedor"),
  },
  async ({ nfce_id }) => formatResponse(await client.getNFCe(nfce_id))
);

// ── 12. download_pdf ──

server.tool(
  "download_pdf",
  "Baixar o PDF (DANFE/DANFSE) de uma nota fiscal. Retorna o conteudo em base64.",
  {
    id: z.string().describe("ID da nota fiscal"),
    tipo: z.enum(["nfe", "nfse", "nfce"]).describe("Tipo do documento"),
  },
  async ({ id, tipo }) => formatResponse(await client.downloadPDF(id, tipo))
);

// ── 13. download_xml ──

server.tool(
  "download_xml",
  "Baixar o XML de uma nota fiscal. Retorna o conteudo em base64.",
  {
    id: z.string().describe("ID da nota fiscal"),
    tipo: z.enum(["nfe", "nfse", "nfce"]).describe("Tipo do documento"),
  },
  async ({ id, tipo }) => formatResponse(await client.downloadXML(id, tipo))
);

// ── 14. get_sefaz_status ──

server.tool(
  "get_sefaz_status",
  "Verificar o status dos servicos da SEFAZ. Util para saber se a emissao esta disponivel antes de emitir notas.",
  {},
  async () => formatResponse(await client.getStatus())
);

// ── 15. get_company ──

server.tool(
  "get_company",
  "Consultar dados cadastrais da empresa emissora (razao social, CNPJ, endereco, regime tributario).",
  {},
  async () => formatResponse(await client.getCompany())
);

// ── 16. update_company ──

server.tool(
  "update_company",
  "Atualizar dados cadastrais da empresa emissora. Envie apenas os campos que deseja alterar.",
  {
    razao_social: z.string().optional().describe("Razao social da empresa"),
    cnpj: z.string().optional().describe("CNPJ (apenas numeros, 14 digitos)"),
    inscricao_estadual: z.string().optional().describe("Inscricao estadual"),
    inscricao_municipal: z.string().optional().describe("Inscricao municipal"),
    regime_tributario: z
      .number()
      .optional()
      .describe("1=Simples Nacional, 2=Simples Excesso, 3=Lucro Presumido/Real"),
    endereco: z
      .object({
        logradouro: z.string(),
        numero: z.string(),
        complemento: z.string().optional(),
        bairro: z.string(),
        cidade: z.string(),
        uf: z.string().length(2),
        cep: z.string(),
      })
      .optional()
      .describe("Endereco da empresa"),
  },
  async (params) => {
    const data: Record<string, unknown> = {};
    if (params.razao_social) data.razao_social = params.razao_social;
    if (params.cnpj) data.cnpj = params.cnpj;
    if (params.inscricao_estadual) data.inscricao_estadual = params.inscricao_estadual;
    if (params.inscricao_municipal) data.inscricao_municipal = params.inscricao_municipal;
    if (params.regime_tributario) data.regime_tributario = params.regime_tributario;
    if (params.endereco) data.endereco = params.endereco;
    return formatResponse(await client.updateCompany(data));
  }
);

// ═════════════════════════════════════════════════════════════════
// RESOURCES (3)
// ═════════════════════════════════════════════════════════════════

server.resource(
  "invoices",
  "nfe://invoices",
  async () => {
    const [nfeResult, nfseResult] = await Promise.all([
      client.listNFe({ limite: 20 }),
      client.listNFSe({ limite: 20 }),
    ]);
    const summary = {
      nfe: nfeResult.success ? nfeResult.data : { error: nfeResult.error },
      nfse: nfseResult.success ? nfseResult.data : { error: nfseResult.error },
    };
    return {
      contents: [
        {
          uri: "nfe://invoices",
          mimeType: "application/json",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }
);

server.resource(
  "company",
  "nfe://company",
  async () => {
    const result = await client.getCompany();
    return {
      contents: [
        {
          uri: "nfe://company",
          mimeType: "application/json",
          text: JSON.stringify(result.success ? result.data : { error: result.error }, null, 2),
        },
      ],
    };
  }
);

server.resource(
  "status",
  "nfe://status",
  async () => {
    const result = await client.getStatus();
    return {
      contents: [
        {
          uri: "nfe://status",
          mimeType: "application/json",
          text: JSON.stringify(result.success ? result.data : { error: result.error }, null, 2),
        },
      ],
    };
  }
);

// ═════════════════════════════════════════════════════════════════
// PROMPTS (3) — em Portugues
// ═════════════════════════════════════════════════════════════════

server.prompt(
  "emissor-nfe",
  "Guia passo a passo para emissao de Nota Fiscal Eletronica (NFe, NFSe ou NFCe)",
  {
    tipo: z.enum(["nfe", "nfse", "nfce"]).describe("Tipo de nota a emitir"),
  },
  ({ tipo }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso emitir uma ${tipo.toUpperCase()}. Me guie passo a passo:

1. Primeiro, verifique o status da SEFAZ com get_sefaz_status.
2. Consulte os dados da empresa emissora com get_company para confirmar cadastro.
3. ${
            tipo === "nfe"
              ? "Use create_nfe com: natureza_operacao, items (descricao, NCM, CFOP, quantidade, valores), e destinatario (CPF/CNPJ, nome, endereco)."
              : tipo === "nfse"
                ? "Use create_nfse com: servico (descricao, codigo_servico, aliquota_iss, valor), tomador (CPF/CNPJ, nome), e valor total."
                : "Use create_nfce com: items (descricao, NCM, CFOP, quantidade, valores) e pagamento (forma, valor)."
          }
4. Apos emissao, consulte o resultado com get_${tipo} e baixe o PDF com download_pdf.

Valide todos os campos obrigatorios antes de enviar. Pergunte ao usuario os dados que faltarem.`,
        },
      },
    ],
  })
);

server.prompt(
  "cancelamento",
  "Guia para cancelamento de notas fiscais com os requisitos legais",
  {
    tipo: z.enum(["nfe", "nfse", "nfce"]).describe("Tipo de nota a cancelar"),
    id: z.string().describe("ID da nota fiscal"),
  },
  ({ tipo, id }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Preciso cancelar a ${tipo.toUpperCase()} com ID ${id}. Siga o procedimento:

1. Primeiro, consulte a nota com get_${tipo}(${id}) para verificar se ela esta autorizada.
2. Uma nota so pode ser cancelada se:
   - NFe: dentro de 24 horas da autorizacao (algumas UFs permitem 168h).
   - NFSe: prazo varia por municipio.
   - NFCe: dentro de 30 minutos da autorizacao.
3. A justificativa de cancelamento e OBRIGATORIA e deve ter no minimo 15 caracteres.
4. Use cancel_${tipo === "nfce" ? "nfe" : tipo}(id, justificativa) para efetuar o cancelamento.
5. Apos o cancelamento, baixe o XML do evento com download_xml para arquivo.

ATENCAO: O cancelamento e irreversivel. Confirme com o usuario antes de executar.`,
        },
      },
    ],
  })
);

server.prompt(
  "relatorio-fiscal",
  "Gerar relatorio fiscal com totais de notas emitidas em um periodo",
  {
    periodo_inicio: z.string().describe("Data inicio (YYYY-MM-DD)"),
    periodo_fim: z.string().describe("Data fim (YYYY-MM-DD)"),
  },
  ({ periodo_inicio, periodo_fim }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Gere um relatorio fiscal consolidado de ${periodo_inicio} ate ${periodo_fim}. Passos:

1. Use list_nfe(inicio="${periodo_inicio}", fim="${periodo_fim}") para listar todas as NFe do periodo.
2. Use list_nfse(inicio="${periodo_inicio}", fim="${periodo_fim}") para listar todas as NFSe do periodo.
3. Consolide os dados em um resumo com:
   - Total de notas emitidas (por tipo: NFe, NFSe)
   - Total de notas autorizadas vs canceladas vs rejeitadas
   - Valor total faturado (NFe + NFSe)
   - Valor total de impostos (se disponivel)
   - Lista das 10 maiores notas por valor
4. Apresente o relatorio em formato de tabela organizada.
5. Destaque eventuais notas rejeitadas que precisem de atencao.

Se houver paginacao, busque todas as paginas para ter os dados completos.`,
        },
      },
    ],
  })
);

// ═════════════════════════════════════════════════════════════════
// START SERVER
// ═════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `BridgeAPI NFe MCP Server v0.1.0 [${config.provider}/${config.environment}] running on stdio`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
