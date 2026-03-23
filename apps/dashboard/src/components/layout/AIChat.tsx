"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Zap, Bot, User, CheckCircle2, Loader2,
  MessageCircle, Flame, FileText, ShoppingCart,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  card?: AutomationCard;
  typing?: boolean;
}

interface AutomationCard {
  title: string;
  steps: { platform: string; action: string; color: string }[];
  status: "preview" | "active" | "paused";
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Olá! 👋 Sou a IA do BridgeAPI. Posso conectar suas plataformas e criar automações para você. O que gostaria de fazer?",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "2",
    role: "assistant",
    content: "Aqui estão algumas coisas que posso fazer:",
    timestamp: new Date(Date.now() - 3595000),
    card: {
      title: "Sugestões rápidas",
      steps: [
        { platform: "Hotmart", action: "Quando vender → WhatsApp de boas-vindas", color: "#F59E0B" },
        { platform: "Mercado Livre", action: "Novo pedido → Gerar nota fiscal", color: "#3B82F6" },
        { platform: "WhatsApp", action: "Responder perguntas com IA", color: "#25D366" },
      ],
      status: "preview",
    },
  },
  {
    id: "3",
    role: "user",
    content: "Quando vender no Hotmart, manda WhatsApp pro cliente e gera nota fiscal",
    timestamp: new Date(Date.now() - 3000000),
  },
  {
    id: "4",
    role: "assistant",
    content: "Perfeito! Vou criar essa automação para você:",
    timestamp: new Date(Date.now() - 2995000),
    card: {
      title: "Venda Hotmart → WhatsApp + NFe",
      steps: [
        { platform: "Hotmart", action: "Detectar venda aprovada", color: "#F59E0B" },
        { platform: "WhatsApp", action: "Enviar template 'boas_vindas'", color: "#25D366" },
        { platform: "NFe", action: "Emitir nota fiscal automática", color: "#14B8A6" },
      ],
      status: "active",
    },
  },
  {
    id: "5",
    role: "assistant",
    content: "Automação ativada! ✅ Estou monitorando vendas do Hotmart. Quando detectar uma venda, vou enviar WhatsApp e gerar NFe automaticamente. Você pode ver tudo acontecendo no Live Feed ao lado.",
    timestamp: new Date(Date.now() - 2990000),
  },
];

const quickActions = [
  "Conectar WhatsApp",
  "Ver minhas automações",
  "Criar automação",
  "Relatório do dia",
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getAIResponse(input),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: action,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      setTimeout(() => {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: getAIResponse(action),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
      }, 1500);
    }, 100);
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-8 h-8 rounded-full bg-green/15 flex items-center justify-center">
          <Bot className="w-4.5 h-4.5 text-green" />
        </div>
        <div>
          <p className="text-sm font-medium">Assistente BridgeAPI</p>
          <p className="text-[10px] text-green">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "assistant" ? "bg-green/15" : "bg-surface-hover"
              }`}
            >
              {msg.role === "assistant" ? (
                <Bot className="w-3.5 h-3.5 text-green" />
              ) : (
                <User className="w-3.5 h-3.5 text-text-muted" />
              )}
            </div>

            {/* Bubble */}
            <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : ""}`}>
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-green text-bg rounded-br-md"
                    : "bg-surface border border-border rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>

              {/* Automation card */}
              {msg.card && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                    <span className="text-[11px] font-medium">{msg.card.title}</span>
                    {msg.card.status === "active" && (
                      <span className="text-[10px] bg-green/15 text-green px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ativa
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    {msg.card.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${step.color}20` }}
                        >
                          <span className="text-[9px] font-bold" style={{ color: step.color }}>
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-medium" style={{ color: step.color }}>
                            {step.platform}
                          </p>
                          <p className="text-[11px] text-text-muted">{step.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {msg.card.status === "preview" && (
                    <div className="px-3 py-2 border-t border-border/50">
                      <p className="text-[10px] text-text-muted">Clique em uma sugestão ou me diga o que precisa</p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-text-muted px-1">
                {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-green/15 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-green" />
            </div>
            <div className="bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="shrink-0 px-4 py-2 flex gap-2 overflow-x-auto border-t border-border/50">
        {quickActions.map((action) => (
          <button
            key={action}
            onClick={() => handleQuickAction(action)}
            className="shrink-0 px-3 py-1.5 rounded-full bg-surface border border-border text-[11px] text-text-muted hover:text-text hover:border-green/30 transition-colors"
          >
            {action}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 focus-within:border-green transition-colors">
          <input
            ref={inputRef}
            type="text"
            placeholder="Diga o que quer automatizar..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-1.5 rounded-lg bg-green text-bg hover:bg-green-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("conectar") && lower.includes("whatsapp")) {
    return "Para conectar o WhatsApp, preciso do seu Access Token do Meta Business. Vá em developers.facebook.com → WhatsApp → API Setup e copie o token. Cole aqui que eu configuro tudo!";
  }
  if (lower.includes("automações") || lower.includes("automacoes")) {
    return "Você tem 2 automações ativas:\n\n1. ✅ Venda Hotmart → WhatsApp + NFe (47 execuções hoje)\n2. ✅ Pedido ML → Confirmação WhatsApp (12 execuções hoje)\n\nQuer criar uma nova ou ajustar alguma?";
  }
  if (lower.includes("relatório") || lower.includes("relatorio")) {
    return "📊 Resumo de hoje:\n\n• 47 ações executadas\n• 43 com sucesso (91.5%)\n• 3 erros (template WhatsApp)\n• 1 aprovação pendente (reembolso Pix)\n• Latência média: 342ms\n\nO erro mais comum foi template não aprovado. Quer que eu verifique o status dos templates?";
  }
  if (lower.includes("criar")) {
    return "Claro! Me diga qual automação quer criar. Por exemplo:\n\n• \"Quando vender no Hotmart, manda WhatsApp\"\n• \"Pergunta no ML, responde com IA\"\n• \"Cancelamento → cupom de retenção\"\n\nOu descreva com suas palavras!";
  }
  return "Entendi! Vou trabalhar nisso. Posso ajudar com automações entre suas plataformas, verificar status, criar relatórios, ou configurar novos conectores. O que mais precisa?";
}
