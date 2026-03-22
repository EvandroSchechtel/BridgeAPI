/**
 * NFe API Client
 * @bridgeapi/mcp-nfe
 *
 * Supports multiple Brazilian NFe providers:
 * - eNotas (https://enotas.com.br)
 * - NFe.io (https://nfe.io)
 * - Focus NFe (https://focusnfe.com.br)
 */

// ─── Configuration ───────────────────────────────────────────────

export type NFeProvider = "enotas" | "nfeio" | "focusnfe";
export type NFeEnvironment = "production" | "sandbox";

export interface NFeConfig {
  apiToken: string;
  provider: NFeProvider;
  environment: NFeEnvironment;
  companyId: string;
}

// ─── API Response ────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: number; message: string; details?: unknown };
  meta: { latency_ms: number; endpoint: string; method: string; provider: NFeProvider };
}

// ─── NFe Types ───────────────────────────────────────────────────

export type NFeDocType = "nfe" | "nfse" | "nfce";
export type NFeStatus = "autorizada" | "cancelada" | "rejeitada" | "pendente" | "processando";

export interface NFeDestinatario {
  cpf_cnpj: string;
  nome: string;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  email?: string;
  telefone?: string;
}

export interface NFeItem {
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms?: Record<string, unknown>;
  pis?: Record<string, unknown>;
  cofins?: Record<string, unknown>;
}

export interface NFeCreateData {
  natureza_operacao: string;
  tipo_documento?: number;
  items: NFeItem[];
  destinatario: NFeDestinatario;
  informacoes_adicionais?: string;
  transporte?: Record<string, unknown>;
}

export interface NFSeCreateData {
  servico: {
    descricao: string;
    codigo_servico: string;
    aliquota_iss: number;
    valor_servicos: number;
    iss_retido?: boolean;
  };
  tomador: NFeDestinatario;
  valor: number;
  competencia?: string;
  rps_numero?: number;
  rps_serie?: string;
}

export interface NFCeCreateData {
  items: NFeItem[];
  pagamento: {
    forma: string; // 01=Dinheiro, 02=Cheque, 03=Cartao Credito, 04=Cartao Debito, 05=Pix
    valor: number;
    troco?: number;
  };
  cpf_consumidor?: string;
}

export interface NFeListParams {
  inicio?: string;
  fim?: string;
  status?: NFeStatus;
  pagina?: number;
  limite?: number;
}

export interface CompanyData {
  razao_social?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario?: number;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  certificado_digital?: string;
}

// ─── Provider URL Map ────────────────────────────────────────────

const PROVIDER_BASE_URLS: Record<NFeProvider, Record<NFeEnvironment, string>> = {
  enotas: {
    production: "https://api.enotas.com.br/v2",
    sandbox: "https://api.enotas.com.br/v2",
  },
  nfeio: {
    production: "https://api.nfe.io/v1",
    sandbox: "https://api.nfe.io/v1",
  },
  focusnfe: {
    production: "https://api.focusnfe.com.br/v2",
    sandbox: "https://homologacao.focusnfe.com.br/v2",
  },
};

// ─── Provider Path Mappers ───────────────────────────────────────

interface ProviderPaths {
  nfe: string;
  nfse: string;
  nfce: string;
  company: string;
  status: string;
}

function getProviderPaths(provider: NFeProvider, companyId: string): ProviderPaths {
  switch (provider) {
    case "enotas":
      return {
        nfe: `/empresas/${companyId}/nfe`,
        nfse: `/empresas/${companyId}/nfse`,
        nfce: `/empresas/${companyId}/nfce`,
        company: `/empresas/${companyId}`,
        status: `/sefaz/status`,
      };
    case "nfeio":
      return {
        nfe: `/companies/${companyId}/productinvoices`,
        nfse: `/companies/${companyId}/serviceinvoices`,
        nfce: `/companies/${companyId}/nfce`,
        company: `/companies/${companyId}`,
        status: `/sefaz/status`,
      };
    case "focusnfe":
      return {
        nfe: `/nfe`,
        nfse: `/nfse`,
        nfce: `/nfce`,
        company: `/empresas`,
        status: `/sefaz/status`,
      };
  }
}

// ─── Client ──────────────────────────────────────────────────────

export class NFeClient {
  private config: NFeConfig;
  private baseUrl: string;
  private paths: ProviderPaths;

  constructor(config: NFeConfig) {
    this.config = config;
    this.baseUrl = PROVIDER_BASE_URLS[config.provider][config.environment];
    this.paths = getProviderPaths(config.provider, config.companyId);
  }

  // ── Generic Request ──

  async request<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Auth header varies by provider
    switch (this.config.provider) {
      case "enotas":
        headers["Authorization"] = `Bearer ${this.config.apiToken}`;
        break;
      case "nfeio":
        headers["Authorization"] = this.config.apiToken;
        break;
      case "focusnfe":
        // Focus NFe uses HTTP Basic Auth with token as username
        headers["Authorization"] = `Basic ${Buffer.from(`${this.config.apiToken}:`).toString("base64")}`;
        break;
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const latency_ms = Date.now() - start;
      const meta = { latency_ms, endpoint, method, provider: this.config.provider };

      // Handle binary responses (PDF/XML downloads)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/pdf") || contentType.includes("application/xml")) {
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return {
          success: res.ok,
          data: { content: base64, contentType, size: buffer.byteLength } as unknown as T,
          meta,
        };
      }

      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const errData = data as Record<string, unknown>;
        return {
          success: false,
          error: {
            code: res.status,
            message: String(errData.mensagem || errData.message || errData.erro || `HTTP ${res.status}`),
            details: data,
          },
          meta,
        };
      }

      return { success: true, data: data as T, meta };
    } catch (err) {
      return {
        success: false,
        error: {
          code: -1,
          message: err instanceof Error ? err.message : "Erro desconhecido na requisicao",
        },
        meta: { latency_ms: Date.now() - start, endpoint, method, provider: this.config.provider },
      };
    }
  }

  // ── NFe (Nota Fiscal de Produto) ──

  async createNFe(data: NFeCreateData): Promise<ApiResponse> {
    return this.request(this.paths.nfe, "POST", data);
  }

  async getNFe(id: string): Promise<ApiResponse> {
    return this.request(`${this.paths.nfe}/${id}`);
  }

  async listNFe(params?: NFeListParams): Promise<ApiResponse> {
    const qs = this.buildQueryString(params);
    return this.request(`${this.paths.nfe}${qs}`);
  }

  async cancelNFe(id: string, justificativa: string): Promise<ApiResponse> {
    return this.request(`${this.paths.nfe}/${id}/cancelar`, "POST", { justificativa });
  }

  async correctNFe(id: string, correcao: string): Promise<ApiResponse> {
    return this.request(`${this.paths.nfe}/${id}/cartacorrecao`, "POST", { correcao });
  }

  // ── NFSe (Nota Fiscal de Servico) ──

  async createNFSe(data: NFSeCreateData): Promise<ApiResponse> {
    return this.request(this.paths.nfse, "POST", data);
  }

  async getNFSe(id: string): Promise<ApiResponse> {
    return this.request(`${this.paths.nfse}/${id}`);
  }

  async listNFSe(params?: NFeListParams): Promise<ApiResponse> {
    const qs = this.buildQueryString(params);
    return this.request(`${this.paths.nfse}${qs}`);
  }

  async cancelNFSe(id: string, justificativa: string): Promise<ApiResponse> {
    return this.request(`${this.paths.nfse}/${id}/cancelar`, "POST", { justificativa });
  }

  // ── NFCe (Nota Fiscal de Consumidor Eletronica) ──

  async createNFCe(data: NFCeCreateData): Promise<ApiResponse> {
    return this.request(this.paths.nfce, "POST", data);
  }

  async getNFCe(id: string): Promise<ApiResponse> {
    return this.request(`${this.paths.nfce}/${id}`);
  }

  // ── Download (PDF / XML) ──

  async downloadPDF(id: string, type: NFeDocType): Promise<ApiResponse> {
    const basePath = this.getPathForType(type);
    return this.request(`${basePath}/${id}/pdf`);
  }

  async downloadXML(id: string, type: NFeDocType): Promise<ApiResponse> {
    const basePath = this.getPathForType(type);
    return this.request(`${basePath}/${id}/xml`);
  }

  // ── SEFAZ Status ──

  async getStatus(): Promise<ApiResponse> {
    return this.request(this.paths.status);
  }

  // ── Company ──

  async getCompany(): Promise<ApiResponse> {
    return this.request(this.paths.company);
  }

  async updateCompany(data: CompanyData): Promise<ApiResponse> {
    return this.request(this.paths.company, "PUT", data);
  }

  // ── Helpers ──

  private getPathForType(type: NFeDocType): string {
    switch (type) {
      case "nfe":
        return this.paths.nfe;
      case "nfse":
        return this.paths.nfse;
      case "nfce":
        return this.paths.nfce;
    }
  }

  private buildQueryString(params?: NFeListParams): string {
    if (!params) return "";
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (entries.length === 0) return "";
    return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  }
}
