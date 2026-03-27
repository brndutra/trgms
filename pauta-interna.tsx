import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowLeft, Printer, Info, X, CalendarDays, AlertCircle,
  Mic, Star, ListOrdered, TableProperties, Edit,
} from "lucide-react";
import type { Session, Case } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SessionDetailsForm } from "@/components/session-details-form";
import { CaseCard } from "@/components/CaseCard";
import logoImg from "@assets/1677547506-LOGO-COM-FUNDO-QUADRADO1_1771966882643.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PREFERENCE_TYPES } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

function isSeparated(c: Case) {
  return c.sobrestado || c.pedidoVista || c.status === "postponed" || c.status === "withdrawn";
}

/* ─── Inline edit dialog (mirrors home.tsx CaseFormDialog but minimal) ─── */
function EditCaseDialog({
  sessionId,
  existingCase,
  open,
  onOpenChange,
}: {
  sessionId: string;
  existingCase: Case;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [processNumber, setProcessNumber] = useState(existingCase.processNumber || "");
  const [parties, setParties] = useState(existingCase.parties || "");
  const [caseClass, setCaseClass] = useState(existingCase.caseClass || "");
  const [subject, setSubject] = useState(existingCase.subject || "");
  const [relator, setRelator] = useState(existingCase.relator || "");
  const [preferenceType, setPreferenceType] = useState(existingCase.preferenceType || "none");
  const [notes, setNotes] = useState(existingCase.notes || "");

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/cases/${existingCase.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions-summary"] });
      toast({ title: "Processo atualizado" });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      processNumber,
      parties,
      caseClass: caseClass || null,
      subject,
      relator,
      preferenceType: preferenceType === "none" ? null : preferenceType,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Editar Processo
          </DialogTitle>
          <DialogDescription>
            Altere os dados do processo {existingCase.processNumber}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Número do Processo *</Label>
            <Input
              value={processNumber}
              onChange={(e) => setProcessNumber(e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
              required
              data-testid="input-edit-process-number"
            />
          </div>
          <div className="space-y-2">
            <Label>Partes</Label>
            <Input
              value={parties}
              onChange={(e) => setParties(e.target.value)}
              placeholder="Autor vs Réu"
              data-testid="input-edit-parties"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Classe</Label>
              <Input
                value={caseClass}
                onChange={(e) => setCaseClass(e.target.value)}
                placeholder="AC, AG, AMS..."
                data-testid="input-edit-class"
              />
            </div>
            <div className="space-y-2">
              <Label>Relator</Label>
              <Input
                value={relator}
                onChange={(e) => setRelator(e.target.value)}
                placeholder="Nome do relator"
                data-testid="input-edit-relator"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do processo"
              data-testid="input-edit-subject"
            />
          </div>
          <div className="space-y-2">
            <Label>Preferência</Label>
            <Select value={preferenceType} onValueChange={setPreferenceType}>
              <SelectTrigger data-testid="select-edit-preference">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem preferência</SelectItem>
                {PREFERENCE_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações..."
              className="resize-none"
              rows={2}
              data-testid="textarea-edit-notes"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={updateMutation.isPending}
            data-testid="button-save-edit"
          >
            {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Category section header ─── */
function CategoryHeader({
  title,
  count,
  accentColor,
  icon: Icon,
}: {
  title: string;
  count: number;
  accentColor: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className="h-[2px] flex-1 rounded-full"
        style={{ backgroundColor: accentColor + "40" }}
      />
      <div
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border"
        style={{
          color: accentColor,
          borderColor: accentColor + "50",
          backgroundColor: accentColor + "12",
        }}
        data-testid={`section-header-${title.toLowerCase().replace(/\s/g, "-")}`}
      >
        {Icon && <Icon className="w-3 h-3" />}
        {title}
        <span
          className="ml-1 px-1.5 py-px rounded-full text-[10px] font-extrabold"
          style={{ backgroundColor: accentColor + "25", color: accentColor }}
        >
          {count}
        </span>
      </div>
      <div
        className="h-[2px] flex-1 rounded-full"
        style={{ backgroundColor: accentColor + "40" }}
      />
    </div>
  );
}

/* ─── Category section with CaseCards ─── */
function CategorySection({
  title,
  cases,
  accentColor,
  icon,
  sessionId,
  onBatchUpdate,
  onEdit,
  onDelete,
}: {
  title: string;
  cases: Case[];
  accentColor: string;
  icon?: React.ComponentType<{ className?: string }>;
  sessionId: string;
  onBatchUpdate: (caseId: string, updates: Partial<Case>) => void;
  onEdit: (c: Case) => void;
  onDelete: (caseId: string) => void;
}) {
  if (cases.length === 0) return null;

  return (
    <section className="space-y-1" data-testid={`section-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CategoryHeader title={title} count={cases.length} accentColor={accentColor} icon={icon} />
      <SortableContext items={cases.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-0">
          {cases.map((c, i) => (
            <CaseCard
              key={c.id}
              caseItem={c}
              index={i}
              onDelete={() => onDelete(c.id)}
              onEdit={() => onEdit(c)}
              onBatchUpdate={(updates) => onBatchUpdate(c.id, updates)}
              viewOnly={false}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

/* ─── Main page ─── */
export default function PautaInterna() {
  const { toast } = useToast();
  const [, params] = useRoute("/pauta-interna/:sessionId");
  const sessionId = params?.sessionId || "";
  const [showSessionDetailsDialog, setShowSessionDetailsDialog] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | undefined>();

  const sessionQuery = useQuery<Session[]>({ queryKey: ["/api/sessions"] });
  const casesQuery = useQuery<Case[]>({ queryKey: ["/api/sessions", sessionId, "cases"] });

  const session = sessionQuery.data?.find((s) => s.id === sessionId);

  const cases = useMemo(() =>
    (casesQuery.data ?? []).slice().sort(
      (a, b) => (a.paragraph ?? 999) - (b.paragraph ?? 999) || (a.pjeOrder ?? 999) - (b.pjeOrder ?? 999)
    ),
    [casesQuery.data]
  );

  /* Mutations */
  const batchUpdateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Case> }) => {
      const res = await apiRequest("PATCH", `/api/cases/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions-summary"] });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      await apiRequest("DELETE", `/api/cases/${caseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions-summary"] });
      toast({ title: "Processo removido" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    },
  });

  const handleBatchUpdate = (caseId: string, updates: Partial<Case>) => {
    batchUpdateMutation.mutate({ id: caseId, updates });
  };

  const handleDelete = (caseId: string) => {
    deleteCaseMutation.mutate(caseId);
  };

  /* DnD sensors — drag is visually available but reorder not persisted here */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = (_event: DragEndEvent) => {
    /* No reorder in pauta interna */
  };

  /* Category groupings */
  const preferencia = cases.filter(
    (c) => c.preferenceType && c.preferenceType !== "adiado" && !isSeparated(c)
  );
  const adiado = cases.filter(
    (c) => c.preferenceType === "adiado" && !isSeparated(c)
  );
  const oral = cases.filter(
    (c) => !c.preferenceType && (c.hasOralArgument || c.hasOralArgument2) && !isSeparated(c)
  );
  const regular = cases.filter(
    (c) => !c.preferenceType && !c.hasOralArgument && !c.hasOralArgument2 && !isSeparated(c)
  );
  const separated = cases.filter(isSeparated);

  /* Stats */
  const totalOral = cases.filter((c) => c.hasOralArgument || c.hasOralArgument2).length;
  const totalPref = preferencia.length;
  const totalJudged = cases.filter((c) => c.status === "judged").length;

  /* Session date label */
  const sessionDateLabel = session
    ? new Date(session.sessionDate + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const isLoading = casesQuery.isLoading || sessionQuery.isLoading;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-[hsl(215,30%,96%)] print:bg-white">

        {/* ── Top bar ── */}
        <div
          className="print:hidden sticky top-0 z-10 text-white shadow-xl shadow-[#0f2347]/35"
          style={{
            background:
              "linear-gradient(90deg, #152d5c 0%, #122855 45%, #0b1d3e 100%)",
            borderBottom: "1.5px solid rgba(180,155,90,0.35)",
          }}
        >
          <div className="flex items-center justify-between px-3 md:px-4 py-2 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link href="/">
                <button
                  type="button"
                  data-testid="button-back"
                  className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 transition-colors border border-white/10"
                  style={{ background: "rgba(255,255,255,0.09)" }}
                  title="Voltar"
                >
                  <ArrowLeft className="w-4 h-4 text-white" />
                </button>
              </Link>
              <img
                src={logoImg}
                alt="Pauta Interna"
                className="w-9 h-9 object-contain shrink-0 hidden md:block"
                style={{
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                  opacity: 0.95,
                }}
              />
              <div className="min-w-0 pl-0.5">
                <h1 className="text-[14px] leading-tight truncate">
                  <span className="font-extrabold text-white tracking-tight">
                    PAUTA
                  </span>
                  <span className="font-normal text-white/75 ml-1 tracking-tight">
                    INTERNA
                  </span>
                </h1>
                <p
                  className="text-[9.5px] font-semibold mt-0.5 uppercase tracking-widest hidden md:block"
                  style={{ color: "rgba(160,190,255,0.55)" }}
                >
                  {session ? session.title : "Turma Regional de MS · TRF3"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowSessionDetailsDialog(true)}
                data-testid="button-edit-session"
                className="h-8 w-8 rounded-md flex items-center justify-center transition-colors border border-white/10"
                style={{ background: "rgba(255,255,255,0.09)" }}
                title="Detalhes da sessão"
              >
                <Info className="w-4 h-4 text-white" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                data-testid="button-print"
                className="h-8 w-8 rounded-md flex items-center justify-center transition-colors border border-white/10"
                style={{ background: "rgba(255,255,255,0.09)" }}
                title="Imprimir"
              >
                <Printer className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Print header ── */}
        <div className="hidden print:block px-6 py-4 border-b border-black/20 mb-2">
          <h1 className="text-base font-bold text-black">Pauta Interna — {session?.title}</h1>
          <p className="text-sm text-gray-600">{sessionDateLabel}</p>
          <div className="flex gap-6 mt-1 text-xs text-gray-500">
            <span>Total: {cases.length}</span>
            <span>Preferência: {totalPref}</span>
            <span>Sust. Oral: {totalOral}</span>
            <span>Julgados: {totalJudged}</span>
          </div>
        </div>

        {/* ── Session date ── */}
        {session && !isLoading && (
          <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 pb-1 text-center print:hidden">
            <div className="flex items-center justify-center gap-2 text-slate-500">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium capitalize">{sessionDateLabel}</span>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-5 space-y-8">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-400">Nenhum processo nesta sessão</p>
              <Link href="/">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline mt-1"
                  data-testid="button-go-home-empty"
                >
                  Voltar ao roteiro
                </button>
              </Link>
            </div>
          ) : (
            <>
              {/* ── Preferência ── */}
              <CategorySection
                title="Preferência"
                cases={preferencia}
                accentColor="#d97706"
                icon={Star}
                sessionId={sessionId}
                onBatchUpdate={handleBatchUpdate}
                onEdit={(c) => setEditingCase(c)}
                onDelete={handleDelete}
              />

              {/* ── Adiado (ant. adiado) ── */}
              <CategorySection
                title="Ant. Adiado"
                cases={adiado}
                accentColor="#ea580c"
                sessionId={sessionId}
                onBatchUpdate={handleBatchUpdate}
                onEdit={(c) => setEditingCase(c)}
                onDelete={handleDelete}
              />

              {/* ── Sustentação Oral ── */}
              <CategorySection
                title="Sustentação Oral"
                cases={oral}
                accentColor="#0284c7"
                icon={Mic}
                sessionId={sessionId}
                onBatchUpdate={handleBatchUpdate}
                onEdit={(c) => setEditingCase(c)}
                onDelete={handleDelete}
              />

              {/* ── Processos regulares ── */}
              <CategorySection
                title="Processos"
                cases={regular}
                accentColor="#475569"
                icon={ListOrdered}
                sessionId={sessionId}
                onBatchUpdate={handleBatchUpdate}
                onEdit={(c) => setEditingCase(c)}
                onDelete={handleDelete}
              />

              {/* ── Separados ── */}
              <CategorySection
                title="Separados"
                cases={separated}
                accentColor="#7c3aed"
                sessionId={sessionId}
                onBatchUpdate={handleBatchUpdate}
                onEdit={(c) => setEditingCase(c)}
                onDelete={handleDelete}
              />
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {cases.length > 0 && (
          <footer className="max-w-5xl mx-auto px-4 md:px-8 mt-8 pt-5 border-t border-blue-100 text-center text-[11px] text-slate-400 pb-10 print:hidden">
            <p>
              Documento gerado em {new Date().toLocaleDateString("pt-BR")} às{" "}
              {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · TRF3 / Turma Regional MS
            </p>
          </footer>
        )}

        {/* ── Session Details Dialog ── */}
        {showSessionDetailsDialog && session && (
          <div
            className="print:hidden fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowSessionDetailsDialog(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-[#1a3a6e] to-[#0f2347] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-amber-300" />
                  <h2 className="text-white font-bold text-lg">Detalhes da Sessão</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSessionDetailsDialog(false)}
                  className="rounded-lg h-8 w-8 flex items-center justify-center hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                  data-testid="button-session-details-close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <SessionDetailsForm
                session={session}
                onClose={() => setShowSessionDetailsDialog(false)}
              />
            </div>
          </div>
        )}

        {/* ── Edit Case Dialog ── */}
        {editingCase && (
          <EditCaseDialog
            sessionId={sessionId}
            existingCase={editingCase}
            open={!!editingCase}
            onOpenChange={(v) => { if (!v) setEditingCase(undefined); }}
          />
        )}

        <style>{`
          @media print {
            body { background: white !important; color: black !important; }
            .sticky { position: relative !important; }
          }
        `}</style>
      </div>
    </DndContext>
  );
}
