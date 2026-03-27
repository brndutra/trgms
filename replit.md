# Roteiro TRF3 / TRGMS

Sistema de gerenciamento de sessões de julgamento para a Turma Regional de Mato Grosso do Sul (TRF3).

## Stack

- **Frontend**: React + Vite + Wouter + TanStack Query + shadcn/ui + Tailwind
- **Backend**: Express + Drizzle ORM + PostgreSQL
- **Porta**: 5000 (Express serve frontend via Vite middleware)

## Páginas

- `/` — Home: gerenciamento de sessões, painel de processos, inbox de solicitações
- `/roteiro/:sessionId` — Roteiro de sessão (script de julgamento com falas)
- `/pauta-interna/:sessionId` — Pauta interna da sessão (view tabular de processos)

## Componentes principais

- `client/src/components/CaseCard.tsx` — Card de processo (arraste, status, movimentação, nota interna)
- `client/src/components/session-details-form.tsx` — Formulário de detalhes da sessão
- `server/agentmail.ts` — Integração AgentMail para inbox de e-mails

## Schema (shared/schema.ts)

### sessions
- id, title, sessionDate, receiptDeadline, status, isNext, scriptOverrides (jsonb)

### cases
- id, sessionId, paragraph, pjeOrder, processNumber, parties, caseClass, subject, relator
- hasOralArgument, oralArgumentRequester, oralArgumentSide, oralArgumentFavorable, oralArgumentType
- hasOralArgument2, oralArgumentRequester2, oralArgumentSide2, oralArgumentType2
- preferenceType, hasProcuracao, procuracaoStatus, hasPreliminares
- sustentacaoDispensada, sustentacaoRealizada, oralArgumentReceivedAt
- sobrestado, pedidoVista, divergencia, result, resultRemessa, status
- notes, internalNote, isMesa (bool), retiradoAnterior (bool)

### email_requests
- id, sessionId, caseId, fromEmail, subject, body, requestType
- processNumber, requesterName, side, preferenceType, status, modality
- receivedAt, threadId, messageId, parsedData (jsonb)

## AgentMail

O conector OAuth do AgentMail foi dispensado pelo usuário. Para habilitar o inbox de e-mails, é necessário fornecer a variável de ambiente `AGENTMAIL_API_KEY` como secret no Replit. O endereço de inbox configurado é `trgms@agentmail.to`. Sem a API key, o endpoint `/api/email/inbox` retorna erro 500 esperado.

## Autenticação

- `SESSION_SECRET` (env var) — chave para sessões HTTP
- `ACCESS_PASSWORD` (padrão: "sucesso") — senha de acesso ao sistema

## Tema

- Modo claro/escuro via `jf_theme` no localStorage
- Toggle no sidebar da home (botão Sol/Lua)
- Classes CSS `:root` e `.dark` definidas em `client/src/index.css`
