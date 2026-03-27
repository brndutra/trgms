import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  createContext,
  useContext,
} from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { Session, Case } from "@shared/schema";
import { PREFERENCE_TYPES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Printer,
  Mic,
  Star,
  ThumbsUp,
  Pencil,
  Check,
  X,
  RotateCcw,
  Clock,
  Trash2,
  MessageSquare,
  ChevronDown,
  Eye,
  StickyNote,
  Highlighter,
  Hash,
  Save,
  Send,
  Plus,
  Users,
  FileText,
  Copy,
  Download,
  Settings2,
  Share2,
  CalendarDays,
  Info,
  Ban,
  FileSearch,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SessionDetailsForm } from "@/components/session-details-form";
import { CaseCard } from "@/components/CaseCard";
import { DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import logoImg from "@assets/1677547506-LOGO-COM-FUNDO-QUADRADO1_1771966882643.png";
import coatOfArmsImg from "@assets/images-removebg-preview_1771961908602.png";

type DynamicSpeech = {
  id: string;
  role: string;
  title?: string;
  text: string;
  slotKey: string;
  kind?: "speech" | "action";
};

function getDynamicSpeeches(overrides: Overrides): DynamicSpeech[] {
  try {
    return JSON.parse(overrides._dynamic_speeches || "[]");
  } catch {
    return [];
  }
}

const PARTICIPANT_ROLES = [
  { id: "presidente", label: "Presidente" },
  { id: "relator", label: "Relator(a)" },
  { id: "desembargador", label: "Desembargador(a) Federal" },
  { id: "mpf", label: "Representante do MPF" },
  { id: "advogado", label: "Advogado(a)" },
  { id: "secretario", label: "Secretário(a)" },
  { id: "outro", label: "Outro participante" },
];

const NOTE_COLORS = [
  {
    id: "yellow",
    label: "Amarelo",
    bg: "bg-yellow-100",
    border: "border-yellow-300",
    css: "#fef9c3",
  },
  {
    id: "blue",
    label: "Azul",
    bg: "bg-blue-100",
    border: "border-blue-300",
    css: "#dbeafe",
  },
  {
    id: "green",
    label: "Verde",
    bg: "bg-green-100",
    border: "border-green-300",
    css: "#dcfce7",
  },
  {
    id: "pink",
    label: "Rosa",
    bg: "bg-pink-100",
    border: "border-pink-300",
    css: "#fce7f3",
  },
  {
    id: "orange",
    label: "Laranja",
    bg: "bg-orange-100",
    border: "border-orange-300",
    css: "#ffedd5",
  },
];

const HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Amarelo", bg: "bg-yellow-200", css: "#fef08a" },
  { id: "blue", label: "Azul", bg: "bg-blue-200", css: "#bfdbfe" },
  { id: "green", label: "Verde", bg: "bg-green-200", css: "#bbf7d0" },
  { id: "pink", label: "Rosa", bg: "bg-pink-200", css: "#fbcfe8" },
  { id: "orange", label: "Laranja", bg: "bg-orange-200", css: "#fed7aa" },
];

type DynamicNote = {
  id: string;
  color: string;
  text: string;
  slotKey: string;
};

function getDynamicNotes(overrides: Overrides): DynamicNote[] {
  try {
    return JSON.parse(overrides._dynamic_notes || "[]");
  } catch {
    return [];
  }
}

type Comunicacao = {
  id: string;
  text: string;
};

const DEFAULT_COMUNICACOES: Comunicacao[] = [
  {
    id: "videoconferencia",
    text: "USO ADEQUADO DOS RECURSOS DE VIDEOCONFERÊNCIA: Solicito aos participantes que, na videoconferência, ativem microfone e câmera apenas quando receberem a palavra, a fim de evitar ruídos e sobrecarga da transmissão.",
  },
  {
    id: "prioridade",
    text: "PRIORIDADE NA ORDEM DE JULGAMENTO: Informo que os processos serão julgados com prioridade para aqueles com pedido de sustentação oral, especialmente os presenciais, seguidos pelos realizados por videoconferência.",
  },
  {
    id: "dispensa_relatorio",
    text: "DISPENSA DO RELATÓRIO E PREFERÊNCIA: Esclareço que, considerando a disponibilização prévia dos relatórios e votos no PJe, consultarei os advogados quanto à dispensa da leitura do relatório e quanto ao eventual interesse na sustentação oral em casos com resultado favorável já indicado, com possível conversão para pedido de preferência.",
  },
];

function getComunicacoes(overrides: Overrides): Comunicacao[] {
  try {
    const raw = overrides._comunicacoes;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        return parsed.filter((c: any) => c && c.id && c.text);
    }
  } catch {}
  return DEFAULT_COMUNICACOES.map((c) => ({
    ...c,
    text:
      overrides[
        `fase3_${c.id === "videoconferencia" ? "uso_videoconferencia" : c.id === "prioridade" ? "prioridade" : "dispensa_relatorio"}`
      ] || c.text,
  }));
}

function getAtaComunicacao(
  overrides: Overrides,
  competencia: string,
): Comunicacao {
  return {
    id: "ata_anterior",
    text:
      overrides.fase3_ata_anterior ||
      `APROVAÇÃO DA ATA ANTERIOR: A ata da sessão anterior, referente à competência da ${competencia} Seção, foi distribuída previamente. Não havendo impugnações, declaro-a aprovada.`,
  };
}

type RoteiroContext = {
  viewerMode: boolean;
  editMode: boolean;
  cases: Case[];
  participants: { role: string; name: string }[];
  activeHighlightKey: string | null;
  setActiveHighlightKey: (v: string | null) => void;
};

const DragContext = createContext<RoteiroContext>({
  viewerMode: false,
  editMode: false,
  cases: [],
  participants: [],
  activeHighlightKey: null,
  setActiveHighlightKey: () => {},
});

function InlineInsertMenu({
  onAddSpeech,
  onAddNote,
  onAddAction,
  slotKey,
}: {
  onAddSpeech: (role: string, slotKey: string, title?: string) => void;
  onAddNote: (color: string, slotKey: string) => void;
  onAddAction: (slotKey: string) => void;
  slotKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [showTitleInput, setShowTitleInput] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setShowTitleInput(null);
      setTitleDraft("");
      return;
    }
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  useEffect(() => {
    if (showTitleInput && titleInputRef.current) titleInputRef.current.focus();
  }, [showTitleInput]);

  if (!open) {
    return (
      <div className="flex justify-center my-1 print:hidden">
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-40 hover:opacity-100"
          data-testid={`insert-btn-${slotKey}`}
        >
          <span className="w-4 h-4 rounded-full border border-dashed border-current flex items-center justify-center text-xs leading-none">
            +
          </span>
          <span className="hidden sm:inline">Inserir</span>
        </button>
      </div>
    );
  }

  const confirmSpeech = (role: string) => {
    onAddSpeech(role, slotKey, titleDraft.trim() || undefined);
    setOpen(false);
  };

  return (
    <div
      ref={menuRef}
      className="my-2 print:hidden animate-in fade-in slide-in-from-top-1 duration-150"
      data-testid={`insert-menu-${slotKey}`}
    >
      <div className="bg-white rounded-xl shadow-lg shadow-blue-900/10 border border-blue-100 p-3 max-w-xs mx-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">
            Inserir
          </p>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {showTitleInput && (
          <div className="mb-2 space-y-1.5">
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSpeech(showTitleInput);
              }}
              placeholder="Título da fala (opcional)"
              className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              data-testid={`insert-title-input-${slotKey}`}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="default"
                className="h-6 text-[10px] px-2 flex-1"
                onClick={() => confirmSpeech(showTitleInput)}
              >
                <Check className="w-3 h-3 mr-1" /> Confirmar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  setShowTitleInput(null);
                  setTitleDraft("");
                }}
              >
                Voltar
              </Button>
            </div>
          </div>
        )}

        {!showTitleInput && (
          <>
            <p className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-1.5">
              Falas
            </p>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {PARTICIPANT_ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setShowTitleInput(role.label)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/50 hover:bg-blue-100 active:bg-blue-200 transition-colors text-left"
                  data-testid={`insert-role-${role.id}-${slotKey}`}
                >
                  <MessageSquare className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">{role.label}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-2 mb-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">
                Ação / Instrução
              </p>
              <button
                onClick={() => {
                  onAddAction(slotKey);
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200/50 hover:bg-slate-100 active:bg-slate-200 transition-colors w-full text-left"
                data-testid={`insert-action-${slotKey}`}
              >
                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                <span>[Ação ou instrução]</span>
              </button>
            </div>

            <div className="border-t border-slate-200 pt-2">
              <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-1.5">
                Notas
              </p>
              <div className="flex gap-1.5 justify-center">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => {
                      onAddNote(color.id, slotKey);
                      setOpen(false);
                    }}
                    className={`w-7 h-7 rounded-lg ${color.bg} border ${color.border} hover:scale-110 active:scale-95 transition-transform flex items-center justify-center`}
                    title={`Nota ${color.label}`}
                    data-testid={`insert-note-${color.id}-${slotKey}`}
                  >
                    <StickyNote className="w-3 h-3 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DropSlot({
  slotKey,
  speeches,
  notes,
  overrides,
  onSave,
  onAddSpeech,
  onRemoveSpeech,
  onAddNote,
  onRemoveNote,
  onAddAction,
}: {
  slotKey: string;
  speeches: DynamicSpeech[];
  notes: DynamicNote[];
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  onAddSpeech: (role: string, slotKey: string, title?: string) => void;
  onRemoveSpeech: (id: string) => void;
  onAddNote: (color: string, slotKey: string) => void;
  onRemoveNote: (id: string) => void;
  onAddAction: (slotKey: string) => void;
}) {
  const { viewerMode, editMode } = useContext(DragContext);
  const slotSpeeches = speeches.filter((s) => s.slotKey === slotKey);
  const slotNotes = notes.filter((n) => n.slotKey === slotKey);

  return (
    <>
      {slotSpeeches.map((speech) => (
        <DynamicSpeechBlock
          key={speech.id}
          speech={speech}
          overrides={overrides}
          onSave={onSave}
          onRemove={() => onRemoveSpeech(speech.id)}
        />
      ))}
      {slotNotes.map((note) => (
        <DynamicNoteBlock
          key={note.id}
          note={note}
          overrides={overrides}
          onSave={onSave}
          onRemove={() => onRemoveNote(note.id)}
        />
      ))}
      {!viewerMode && editMode && (
        <InlineInsertMenu
          slotKey={slotKey}
          onAddSpeech={onAddSpeech}
          onAddNote={onAddNote}
          onAddAction={onAddAction}
        />
      )}
    </>
  );
}

function DynamicSpeechBlock({
  speech,
  overrides,
  onSave,
  onRemove,
}: {
  speech: DynamicSpeech;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  onRemove: () => void;
}) {
  const { viewerMode } = useContext(DragContext);
  const isAction = speech.kind === "action";
  const textKey = `_dyn_${speech.id}`;
  const currentText = overrides[textKey] ?? speech.text;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  useEffect(() => {
    setDraft(currentText);
  }, [currentText]);

  const handleSaveText = () => {
    const trimmed = draft.trim();
    if (trimmed === "" || trimmed === speech.text) {
      onSave(textKey, null);
    } else {
      onSave(textKey, trimmed);
    }
    setEditing(false);
  };

  const labelText = speech.title
    ? `${speech.role} — ${speech.title}`
    : speech.role;
  const placeholderText = isAction
    ? "[Ação ou instrução]"
    : `[Fala de ${speech.role}]`;

  if (editing && !viewerMode) {
    return (
      <div
        className={`my-3 print:my-2 ${isAction ? "pl-10" : "pl-6"} relative group`}
        data-testid={`dynamic-speech-${speech.id}`}
      >
        {!isAction && (
          <p className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-1 flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            {labelText}
          </p>
        )}
        <div className="print:hidden">
          <SmartTextarea
            textareaRef={textareaRef}
            value={draft}
            onChange={setDraft}
            placeholder={
              isAction
                ? "Descreva a ação ou instrução..."
                : `Fala de ${speech.role}...`
            }
            className={`w-full p-2 text-sm border rounded-lg bg-white resize-none focus:outline-none focus:ring-2 ${isAction ? "border-slate-300 focus:ring-slate-300/40" : "border-blue-300 focus:ring-blue-400/40"}`}
          />
          <div className="flex items-center gap-1 mt-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs px-3"
              onClick={handleSaveText}
            >
              <Check className="w-3 h-3 mr-1" /> Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2"
              onClick={() => {
                setDraft(currentText);
                setEditing(false);
              }}
            >
              <X className="w-3 h-3 mr-1" /> Cancelar
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={onRemove}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Remover
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !currentText || currentText === placeholderText;

  if (viewerMode && isEmpty) return null;

  if (isAction) {
    return (
      <div
        className="my-2 print:my-1 pl-10 relative group"
        data-testid={`dynamic-speech-${speech.id}`}
      >
        <p
          onClick={viewerMode ? undefined : () => setEditing(true)}
          className={`text-xs text-muted-foreground print:text-gray-600 ${
            viewerMode
              ? "cursor-default"
              : isEmpty
                ? "text-slate-400 hover:text-slate-600 cursor-pointer"
                : "hover:bg-slate-50 cursor-pointer rounded px-1 -mx-1"
          }`}
        >
          {isEmpty ? placeholderText : `[${currentText}]`}
          {!viewerMode && (
            <>
              <Pencil className="w-3 h-3 text-muted-foreground/40 inline-block ml-1 print:hidden" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 inline-block ml-1 print:hidden"
                data-testid={`remove-speech-${speech.id}`}
              >
                <Trash2 className="w-3 h-3 inline" />
              </button>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className="my-3 print:my-2 pl-6 relative group"
      data-testid={`dynamic-speech-${speech.id}`}
    >
      {labelText && (
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-blue-500 font-bold flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {labelText}
          </p>
          {!viewerMode && (
            <button
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 print:hidden"
              data-testid={`remove-speech-${speech.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
      <blockquote
        onClick={viewerMode ? undefined : () => setEditing(true)}
        className={`border-l-[3px] pl-5 py-2 text-sm rounded-r-lg leading-relaxed transition-colors print:cursor-default print:text-black print:border-gray-300 ${
          viewerMode
            ? "border-blue-200/60 text-foreground/80 cursor-default bg-white/50"
            : isEmpty
              ? "border-dashed border-blue-300/50 text-blue-400 hover:bg-blue-50/50 hover:border-blue-400 cursor-pointer"
              : "border-blue-200/60 text-foreground/80 hover:bg-blue-50/20 cursor-pointer bg-white/50"
        }`}
      >
        {isEmpty ? placeholderText : renderTextWithBoldNames(currentText)}
        {!viewerMode && (
          <Pencil className="w-3 h-3 text-muted-foreground/40 inline-block ml-2 print:hidden" />
        )}
      </blockquote>
    </div>
  );
}

function DynamicNoteBlock({
  note,
  overrides,
  onSave,
  onRemove,
}: {
  note: DynamicNote;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  onRemove: () => void;
}) {
  const { viewerMode } = useContext(DragContext);
  const textKey = `_note_${note.id}`;
  const currentText = overrides[textKey] ?? note.text;
  const [draft, setDraft] = useState(currentText);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const colorDef =
    NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];

  useEffect(() => {
    setDraft(currentText);
  }, [currentText]);

  const handleBlur = () => {
    setFocused(false);
    const trimmed = draft.trim();
    if (trimmed !== currentText) {
      onSave(textKey, trimmed || null);
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.max(48, el.scrollHeight) + "px";
  };

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [draft]);

  if (viewerMode && !currentText) return null;

  return (
    <div
      className="my-3 print:my-2 relative group"
      data-testid={`dynamic-note-${note.id}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <StickyNote className="w-3 h-3 opacity-60" />
        <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">
          Nota
        </span>
        {!viewerMode && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 print:hidden ml-1"
            data-testid={`remove-note-${note.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {viewerMode ? (
        <div
          className={`border-2 ${colorDef.border} ${colorDef.bg} rounded-lg p-3 text-sm whitespace-pre-wrap print:border-gray-400 print:bg-white`}
        >
          {currentText}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoResize(e.target);
          }}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder="Escreva sua anotação..."
          className={`w-full border-2 rounded-lg p-3 text-sm resize-none transition-colors min-h-[48px] focus:outline-none print:border-gray-400 print:bg-white ${colorDef.bg} ${
            focused
              ? `${colorDef.border} ring-2 ring-blue-200/50`
              : `${colorDef.border} hover:opacity-90`
          }`}
          data-testid={`note-textarea-${note.id}`}
        />
      )}
    </div>
  );
}

function estimateSessionDuration(cases: Case[]): {
  totalMinutes: number;
  label: string;
  breakdown: string;
} {
  const ORAL_ARGUMENT_MINUTES = 15;

  let oralSlots = 0;

  for (const c of cases) {
    if (c.hasOralArgument) oralSlots++;
    if (c.hasOralArgument2) oralSlots++;
  }

  const totalMinutes = oralSlots * ORAL_ARGUMENT_MINUTES;

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const label =
    hours > 0
      ? `${hours}h${mins > 0 ? `${mins.toString().padStart(2, "0")}min` : ""}`
      : `${mins}min`;

  return {
    totalMinutes,
    label,
    breakdown: `${oralSlots} × ${ORAL_ARGUMENT_MINUTES}min sust. oral`,
  };
}

const preferenceLabels: Record<string, string> = Object.fromEntries(
  PREFERENCE_TYPES.map((p) => [p.value, p.label]),
);

const RESULT_DECISION_TEXT: Record<string, string> = {
  provimento: "deu provimento",
  improvimento: "negou provimento",
  parcial_provimento: "deu parcial provimento",
  prejudicado: "julgou prejudicado",
  nao_conhecido: "não conheceu",
};

function getResultDecisionText(c: Case): string {
  if (!c.result) return "[decisão]";
  const base = RESULT_DECISION_TEXT[c.result] || c.result;
  const classeLower = (c.caseClass || "").toLowerCase();
  const subjectLower = (c.subject || "").toLowerCase();
  const combined = `${classeLower} ${subjectLower}`;
  const hasRemessa =
    combined.includes("remessa necessária") ||
    combined.includes("reexame necessário");
  if (hasRemessa) {
    return `${base} à apelação e, em reexame necessário, [manteve/reformou] a sentença`;
  }
  const classeMatch = classeLower.match(
    /^(apela[çc][ãa]o|agravo|mandado de seguran[çc]a|recurso|embargos|a[çc][ãa]o rescis[óo]ria|execu[çc][ãa]o fiscal)/i,
  );
  if (classeMatch) {
    return `${base} à ${classeMatch[1].toLowerCase()}`;
  }
  return base;
}

function getSessionOrdinal(
  sessionDate: string,
  allSessions: Session[],
): string {
  const ordinals = [
    "primeira",
    "segunda",
    "terceira",
    "quarta",
    "quinta",
    "sexta",
    "sétima",
    "oitava",
    "nona",
    "décima",
    "décima primeira",
    "décima segunda",
    "décima terceira",
    "décima quarta",
    "décima quinta",
    "décima sexta",
    "décima sétima",
    "décima oitava",
    "décima nona",
    "vigésima",
  ];
  const year = sessionDate.substring(0, 4);
  const sorted = allSessions
    .filter((s) => s.sessionDate.startsWith(year))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const idx = sorted.findIndex((s) => s.sessionDate === sessionDate);
  if (idx < 0) return "";
  if (idx < ordinals.length) return ordinals[idx];
  return `${idx + 1}ª`;
}

type Overrides = Record<string, string>;

function renderTextWithBoldNames(text: string): React.ReactNode {
  const SKIP_WORDS = new Set([
    "DA",
    "DE",
    "DO",
    "DAS",
    "DOS",
    "E",
    "EM",
    "A",
    "O",
    "AS",
    "OS",
    "NA",
    "NO",
    "NAS",
    "NOS",
    "AO",
    "AOS",
    "POR",
    "COM",
    "SEM",
    "PARA",
    "QUE",
    "SE",
  ]);
  const TITLE_PREFIXES = /(?:Dr(?:\(a\))?\.?\s+|V\.\s*Sa\.\s+)/gi;
  const renderLine = (line: string, key?: number) => {
    const parts: React.ReactNode[] = [];
    const regex =
      /([A-ZÀ-ÚÇ][A-ZÀ-ÚÇa-zà-úç.]*(?:\s+(?:[A-ZÀ-ÚÇ][A-ZÀ-ÚÇa-zà-úç.]*|(?:da|de|do|das|dos|e)\b))+)/g;
    let lastIdx = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const seg = match[1];
      const words = seg.split(/\s+/);
      const upperWords = words.filter((w) => !SKIP_WORDS.has(w));
      const allUpper =
        upperWords.length >= 2 &&
        upperWords.every(
          (w) => w === w.toUpperCase() && /[A-ZÀ-ÚÇ]/.test(w[0]),
        );
      if (allUpper) {
        let startIdx = match.index;
        let prefix = "";
        const before = line.slice(0, startIdx);
        TITLE_PREFIXES.lastIndex = 0;
        const prefixMatch = before.match(
          new RegExp(`(${TITLE_PREFIXES.source})$`, "i"),
        );
        if (prefixMatch) {
          startIdx -= prefixMatch[1].length;
          prefix = prefixMatch[1];
        }
        if (startIdx > lastIdx) parts.push(line.slice(lastIdx, startIdx));
        parts.push(
          <span key={`b${startIdx}`} className="font-medium">
            {prefix}
            {seg}
          </span>,
        );
        lastIdx = match.index + seg.length;
      }
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    if (parts.length === 0) return line;
    return key !== undefined ? <span key={key}>{parts}</span> : <>{parts}</>;
  };
  if (text.includes("\n")) {
    return text.split("\n").map((line, i) => (
      <span key={i}>
        {i > 0 && (
          <>
            <br />
            <span className="block h-1.5" />
          </>
        )}
        {renderLine(line)}
      </span>
    ));
  }
  return renderLine(text);
}

function EditableText({
  textKey,
  defaultText,
  overrides,
  onSave,
  className,
  editMode,
  renderCustom,
  textTransform,
}: {
  textKey: string;
  defaultText: string;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  className?: string;
  editMode: boolean;
  renderCustom?: (text: string) => React.ReactNode;
  textTransform?: (text: string) => string;
}) {
  const rawText = overrides[textKey] ?? defaultText;
  const currentText = textTransform ? textTransform(rawText) : rawText;
  const isOverridden = textKey in overrides;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(rawText);
  }, [rawText, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed === defaultText.trim()) {
      onSave(textKey, null);
    } else {
      onSave(textKey, trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(rawText);
    setEditing(false);
  };

  const handleReset = () => {
    setDraft(defaultText);
    onSave(textKey, null);
    setEditing(false);
  };

  const hlKey = `_hl_${textKey}`;
  const highlightColor = overrides[hlKey] || null;
  const activeHighlight = HIGHLIGHT_COLORS.find((c) => c.id === highlightColor);

  if (editing) {
    return (
      <>
        <span className="hidden print:inline">{currentText}</span>
        <div className="relative print:hidden">
          <SmartTextarea
            textareaRef={textareaRef}
            value={draft}
            onChange={setDraft}
            className="w-full p-2 text-sm border border-primary/40 rounded bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            dataTestId={`edit-textarea-${textKey}`}
          />
          <div className="flex items-center gap-1 mt-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs px-2"
              onClick={handleSave}
              data-testid={`edit-save-${textKey}`}
            >
              <Check className="w-3 h-3 mr-1" /> Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2"
              onClick={handleCancel}
              data-testid={`edit-cancel-${textKey}`}
            >
              <X className="w-3 h-3 mr-1" /> Cancelar
            </Button>
            {isOverridden && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2 ml-auto"
                onClick={handleReset}
                data-testid={`edit-reset-${textKey}`}
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Restaurar original
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  const { setActiveHighlightKey } = useContext(DragContext);

  return (
    <span
      className={`${className || ""} ${editMode ? "cursor-pointer hover:bg-primary/5 rounded transition-colors relative group" : ""} ${isOverridden ? "ring-1 ring-primary/20 rounded px-1 -mx-1" : ""}`}
      style={
        activeHighlight
          ? {
              backgroundColor: activeHighlight.css,
              borderRadius: "2px",
              padding: "0 2px",
            }
          : undefined
      }
      onClick={() => editMode && setEditing(true)}
      data-testid={`editable-${textKey}`}
    >
      {renderCustom
        ? renderCustom(currentText)
        : renderTextWithBoldNames(currentText)}
      {editMode && (
        <>
          <Pencil className="w-3 h-3 text-primary/40 inline-block ml-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveHighlightKey(textKey);
            }}
            className={`inline-flex items-center justify-center w-4 h-4 rounded ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden ${
              activeHighlight
                ? `${activeHighlight.bg}`
                : "hover:bg-amber-100 text-amber-500"
            }`}
            title="Destacar"
            data-testid={`hl-trigger-${textKey}`}
          >
            <Highlighter className="w-3 h-3" />
          </button>
        </>
      )}
      {isOverridden && editMode && (
        <span className="text-[8px] text-primary/50 ml-1 print:hidden">
          (editado)
        </span>
      )}
    </span>
  );
}

function PresidentSpeech({
  label,
  textKey,
  defaultText,
  overrides,
  onSave,
  editMode,
  textTransform,
}: {
  label?: string;
  textKey: string;
  defaultText: string;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  editMode: boolean;
  textTransform?: (text: string) => string;
}) {
  return (
    <div className="my-4 print:my-3" data-testid="president-speech">
      {label && (
        <p className="text-[9px] uppercase tracking-[0.18em] text-[#1a3a6e]/60 font-bold mb-2 print:text-gray-500 flex items-center gap-1.5">
          <span className="inline-block w-2 h-[1.5px] bg-[#1a3a6e]/30 rounded-full" />
          {label}
        </p>
      )}
      <blockquote className="border-l-[3px] border-[#1a3a6e]/25 pl-5 py-3 text-sm text-slate-700 bg-white/90 rounded-r-lg shadow-sm shadow-blue-900/5 ring-1 ring-black/[0.03] print:text-black print:border-gray-400 print:bg-white print:shadow-none print:ring-0">
        <EditableText
          textKey={textKey}
          defaultText={defaultText}
          overrides={overrides}
          onSave={onSave}
          editMode={editMode}
          textTransform={textTransform}
        />
      </blockquote>
    </div>
  );
}

function InstructionEditable({
  textKey,
  defaultText,
  overrides,
  onSave,
  editMode,
}: {
  textKey: string;
  defaultText: string;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  editMode: boolean;
}) {
  return (
    <p
      className="text-xs text-slate-400 italic my-2.5 pl-10 border-l-[1.5px] border-dashed border-slate-200/80 leading-relaxed print:text-gray-600 print:pl-10 print:border-gray-300"
      data-testid="instruction"
    >
      <EditableText
        textKey={textKey}
        defaultText={defaultText}
        overrides={overrides}
        onSave={onSave}
        editMode={editMode}
      />
    </p>
  );
}

function renderComunicacaoText(text: string) {
  const colonIdx = text.indexOf(":");
  if (
    colonIdx > 0 &&
    colonIdx < 80 &&
    text.substring(0, colonIdx) === text.substring(0, colonIdx).toUpperCase() &&
    /[A-ZÀ-Ú]/.test(text[0])
  ) {
    const title = text.substring(0, colonIdx + 1);
    const body = text.substring(colonIdx + 1);
    return (
      <>
        <span className="font-semibold text-slate-500 print:text-gray-600">
          {title}
        </span>
        {body.includes("\n")
          ? body.split("\n").map((line, i) => (
              <span key={i}>
                {i > 0 && (
                  <>
                    <br />
                    <span className="block h-1.5" />
                  </>
                )}
                {line}
              </span>
            ))
          : body}
      </>
    );
  }
  return text.includes("\n")
    ? text.split("\n").map((line, i) => (
        <span key={i}>
          {i > 0 && (
            <>
              <br />
              <span className="block h-1.5" />
            </>
          )}
          {line}
        </span>
      ))
    : text;
}

function ComunicacaoCard({
  item,
  index,
  total,
  editMode,
  overrides,
  onSave,
  onMoveUp,
  onMoveDown,
  onRemove,
  pinned,
}: {
  item: Comunicacao;
  index: number;
  total: number;
  editMode: boolean;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  pinned?: boolean;
}) {
  return (
    <div className="relative group" data-testid={`comunicacao-${item.id}`}>
      <div className="border-l-[3px] border-slate-300/50 pl-5 py-2.5 text-sm text-foreground/80 bg-white/70 rounded-r-lg shadow-sm shadow-black/[0.03] ring-1 ring-black/[0.03] print:text-black print:border-gray-300 print:bg-white print:shadow-none print:ring-0">
        <EditableText
          textKey={`comunicacao_${item.id}`}
          defaultText={item.text}
          overrides={overrides}
          onSave={onSave}
          editMode={editMode}
          className="leading-relaxed"
          renderCustom={renderComunicacaoText}
        />
      </div>
      {editMode && !pinned && (
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
          {index > 0 && (
            <button
              onClick={onMoveUp}
              className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
              title="Mover para cima"
              data-testid={`comunicacao-up-${item.id}`}
            >
              <ChevronDown className="w-3 h-3 rotate-180" />
            </button>
          )}
          {index < total - 1 && (
            <button
              onClick={onMoveDown}
              className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
              title="Mover para baixo"
              data-testid={`comunicacao-down-${item.id}`}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-600"
            title="Remover comunicação"
            data-testid={`comunicacao-remove-${item.id}`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function TeamsAlert({ text }: { text: string }) {
  return (
    <div
      className="flex items-center justify-center my-4 print:my-2"
      data-testid="teams-alert"
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 shadow-sm shadow-amber-100">
        <AlertTriangle className="w-3 h-3 text-amber-500" />
        {text}
      </div>
    </div>
  );
}

function TimeRecorder({
  label,
  overrideKey,
  overrides,
  onSave,
  editMode,
}: {
  label: string;
  overrideKey: string;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  editMode: boolean;
}) {
  const saved = overrides[overrideKey] || "";
  const [time, setTime] = useState(saved);

  useEffect(() => {
    setTime(overrides[overrideKey] || "");
  }, [overrides[overrideKey]]);

  return (
    <div
      className="flex items-center justify-center my-3 print:my-2"
      data-testid={`time-recorder-${overrideKey}`}
    >
      <div
        className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${
          saved
            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : "bg-slate-100 text-slate-600 border-slate-200"
        }`}
      >
        <Clock className="w-3 h-3" />
        <span>{label}:</span>
        {editMode ? (
          <div className="flex items-center gap-1">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="border border-slate-300 rounded-full px-2 py-0.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 w-24"
              data-testid={`time-input-${overrideKey}`}
            />
            <button
              onClick={() => {
                onSave(overrideKey, time || null);
              }}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors"
              data-testid={`time-save-${overrideKey}`}
            >
              <Check className="w-3 h-3" /> Salvar
            </button>
          </div>
        ) : (
          <span className={saved ? "font-bold" : ""}>
            {saved || "[Registre]"}
          </span>
        )}
      </div>
    </div>
  );
}

function ParticipantSpeech({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-3 print:my-2 pl-6" data-testid="participant-speech">
      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400/90 font-semibold mb-1.5 print:text-gray-500">
        {role}
      </p>
      <blockquote className="border-l-2 border-slate-200/80 pl-4 py-1.5 text-sm text-slate-500 italic leading-relaxed print:text-black print:border-gray-300">
        {children}
      </blockquote>
    </div>
  );
}

function EditableParticipantSpeech({
  role,
  textKey,
  defaultText,
  overrides,
  onSave,
  editMode,
}: {
  role: string;
  textKey: string;
  defaultText: string;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  editMode: boolean;
}) {
  const { viewerMode } = useContext(DragContext);
  const currentText = overrides[textKey] ?? defaultText;
  const isFilled = textKey in overrides && overrides[textKey] !== defaultText;
  const isPlaceholder =
    currentText.startsWith("[") && currentText.endsWith("]");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  useEffect(() => {
    setDraft(currentText);
  }, [currentText]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed === defaultText.trim() || trimmed === "") {
      onSave(textKey, null);
    } else {
      onSave(textKey, trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(currentText);
    setEditing(false);
  };

  if (viewerMode && isPlaceholder && !isFilled) return null;

  const hlKey = `_hl_${textKey}`;
  const highlightColor = overrides[hlKey] || null;
  const activeHighlight = HIGHLIGHT_COLORS.find((c) => c.id === highlightColor);

  const { setActiveHighlightKey } = useContext(DragContext);

  if (editing && !viewerMode) {
    return (
      <div
        className="my-3 print:my-2 pl-6"
        data-testid="participant-speech-editable"
      >
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1 print:text-gray-500">
          {role}
        </p>
        <div className="print:hidden">
          <SmartTextarea
            textareaRef={textareaRef}
            value={draft}
            onChange={setDraft}
            placeholder={defaultText}
            className="w-full p-2 text-sm border border-blue-300 rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            dataTestId={`edit-textarea-${textKey}`}
          />
          <div className="flex items-center gap-1 mt-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs px-3"
              onClick={handleSave}
              data-testid={`edit-save-${textKey}`}
            >
              <Check className="w-3 h-3 mr-1" /> Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2"
              onClick={handleCancel}
              data-testid={`edit-cancel-${textKey}`}
            >
              <X className="w-3 h-3 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="my-3 print:my-2 pl-6 group"
      data-testid="participant-speech-editable"
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1 print:text-gray-500">
        {role}
        {!viewerMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveHighlightKey(textKey);
            }}
            className={`inline-flex items-center justify-center w-4 h-4 rounded ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden ${
              activeHighlight
                ? `${activeHighlight.bg}`
                : "hover:bg-amber-100 text-amber-500"
            }`}
            title="Destacar"
            data-testid={`hl-trigger-${textKey}`}
          >
            <Highlighter className="w-3 h-3" />
          </button>
        )}
      </p>
      <blockquote
        onClick={viewerMode ? undefined : () => setEditing(true)}
        style={
          activeHighlight ? { backgroundColor: activeHighlight.css } : undefined
        }
        className={`border-l-2 pl-4 py-1.5 text-sm leading-relaxed rounded-r transition-colors print:cursor-default print:text-black print:border-gray-300 ${
          viewerMode
            ? "border-slate-200/80 text-foreground/80 cursor-default"
            : isPlaceholder && !isFilled
              ? "border-dashed border-blue-300/50 text-blue-400 hover:bg-blue-50/50 hover:border-blue-400 cursor-pointer"
              : "border-slate-200/80 text-foreground/80 hover:bg-slate-50/80 cursor-pointer"
        }`}
        data-testid={`editable-participant-${textKey}`}
      >
        {currentText}
        {!viewerMode && (
          <Pencil className="w-3 h-3 text-muted-foreground/40 inline-block ml-2 print:hidden" />
        )}
      </blockquote>
    </div>
  );
}

function FloatingHighlighter({
  overrides,
  onSave,
}: {
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
}) {
  const { activeHighlightKey, setActiveHighlightKey, viewerMode } =
    useContext(DragContext);

  if (viewerMode || !activeHighlightKey) return null;

  const hlKey = `_hl_${activeHighlightKey}`;
  const currentColor = overrides[hlKey] || null;

  return (
    <div
      className="fixed bottom-6 left-6 z-50 print:hidden animate-in slide-in-from-bottom-2 fade-in duration-200"
      data-testid="floating-highlighter"
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-amber-900/15 border border-amber-200 p-3 w-auto">
        <div className="flex items-center gap-2">
          <Highlighter className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() =>
                  onSave(hlKey, currentColor === color.id ? null : color.id)
                }
                className={`w-7 h-7 rounded-lg border-2 transition-all ${
                  currentColor === color.id
                    ? `${color.bg} border-gray-500 ring-2 ring-gray-400/50 scale-110`
                    : `${color.bg} border-transparent hover:border-gray-300 hover:scale-105`
                }`}
                title={color.label}
                data-testid={`hl-${color.id}`}
              />
            ))}
            {currentColor && (
              <button
                onClick={() => onSave(hlKey, null)}
                className="w-7 h-7 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 flex items-center justify-center transition-all"
                title="Remover destaque"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setActiveHighlightKey(null)}
            className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SmartTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  textareaRef,
  dataTestId,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  dataTestId?: string;
}) {
  const { cases, participants } = useContext(DragContext);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { label: string; insert: string }[]
  >([]);
  const [triggerPos, setTriggerPos] = useState(-1);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef || localRef;

  const computeSuggestions = (text: string, cursorPos: number) => {
    const beforeCursor = text.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^\n]*)$/);
    if (!atMatch) {
      setShowSuggestions(false);
      return;
    }

    const query = atMatch[1].toLowerCase().trim();
    setTriggerPos(atMatch.index!);
    const results: { label: string; insert: string }[] = [];

    const groupMentions: {
      keyword: string;
      label: string;
      filter: (c: Case) => boolean;
    }[] = [
      {
        keyword: "preferências",
        label: "Processos com Preferência",
        filter: (c) => !!c.preferenceType,
      },
      {
        keyword: "preferencias",
        label: "Processos com Preferência",
        filter: (c) => !!c.preferenceType,
      },
      {
        keyword: "adiados",
        label: "Processos Adiados / P/ Próxima",
        filter: (c) => c.status === "postponed",
      },
      {
        keyword: "sustentações",
        label: "Processos com Sustentação Oral",
        filter: (c) => !!c.hasOralArgument,
      },
      {
        keyword: "sustentacoes",
        label: "Processos com Sustentação Oral",
        filter: (c) => !!c.hasOralArgument,
      },
      {
        keyword: "presencial",
        label: "Sustentação Presencial",
        filter: (c) => c.hasOralArgument && c.oralArgumentType === "presencial",
      },
      {
        keyword: "videoconferência",
        label: "Sustentação por Videoconferência",
        filter: (c) =>
          c.hasOralArgument && c.oralArgumentType === "videoconferencia",
      },
      {
        keyword: "videoconferencia",
        label: "Sustentação por Videoconferência",
        filter: (c) =>
          c.hasOralArgument && c.oralArgumentType === "videoconferencia",
      },
      {
        keyword: "demais",
        label: "Demais Processos",
        filter: (c) => !c.hasOralArgument && !c.preferenceType,
      },
      { keyword: "todos", label: "Todos os Processos", filter: () => true },
      {
        keyword: "julgados",
        label: "Processos Julgados",
        filter: (c) => !!c.result,
      },
      {
        keyword: "sobrestados",
        label: "Processos Sobrestados",
        filter: (c) => !!c.sobrestado,
      },
      {
        keyword: "com vista",
        label: "Processos com Vista",
        filter: (c) => !!c.pedidoVista,
      },
      {
        keyword: "vista",
        label: "Processos com Vista",
        filter: (c) => !!c.pedidoVista,
      },
      {
        keyword: "retirados de pauta",
        label: "Retirados de Pauta",
        filter: (c) => c.status === "withdrawn",
      },
      {
        keyword: "retirados",
        label: "Retirados de Pauta",
        filter: (c) => c.status === "withdrawn",
      },
      {
        keyword: "p/ próxima",
        label: "P/ Próxima Sessão",
        filter: (c) => c.status === "postponed",
      },
      {
        keyword: "próxima sessão",
        label: "P/ Próxima Sessão",
        filter: (c) => c.status === "postponed",
      },
    ];

    const queryWords = query.split(/\s+/).filter(Boolean);
    const matchedGroups = groupMentions.filter((g) => {
      if (query === "") return true;
      const combined = (g.keyword + " " + g.label).toLowerCase();
      return queryWords.every((w) => combined.includes(w));
    });
    const seenLabels = new Set<string>();
    for (const g of matchedGroups) {
      if (seenLabels.has(g.label)) continue;
      seenLabels.add(g.label);
      const filtered = cases.filter(g.filter);
      if (filtered.length > 0) {
        const list = filtered.map((c) => c.processNumber).join("; ");
        results.push({
          label: `📋 ${g.label} (${filtered.length})`,
          insert: `${g.label}: ${list}`,
        });
      }
    }

    for (const c of cases) {
      const pje = c.pjeOrder?.toString() || "";
      const para = c.paragraph.toString();
      const searchable =
        `${para} ${pje} ${c.processNumber} ${c.relator} ${c.parties}`.toLowerCase();
      if (query === "" || queryWords.every((w) => searchable.includes(w))) {
        results.push({
          label: `#${c.paragraph} — ${c.processNumber} (${c.relator})`,
          insert: `Processo ${c.processNumber} — ${c.parties} — Rel. ${c.relator}`,
        });
      }
      if (results.length >= 12) break;
    }

    for (const p of participants) {
      const pSearchable = `${p.name} ${p.role}`.toLowerCase();
      if (
        p.name &&
        (query === "" || queryWords.every((w) => pSearchable.includes(w)))
      ) {
        results.push({
          label: `${p.role}: ${p.name}`,
          insert: p.name,
        });
      }
      if (results.length >= 10) break;
    }

    for (const role of PARTICIPANT_ROLES) {
      if (role.label.toLowerCase().includes(query) || role.id.includes(query)) {
        const matching = participants.filter(
          (p) => p.role.toLowerCase() === role.label.toLowerCase(),
        );
        if (matching.length > 0) {
          for (const m of matching) {
            if (!results.find((r) => r.insert === m.name)) {
              results.push({
                label: `${role.label}: ${m.name}`,
                insert: m.name,
              });
            }
          }
        }
      }
      if (results.length >= 10) break;
    }

    setSuggestions(results);
    setShowSuggestions(results.length > 0);
    setSelectedIdx(0);
  };

  const insertSuggestion = (suggestion: { label: string; insert: string }) => {
    const ta = ref.current;
    if (!ta) return;
    const before = value.slice(0, triggerPos);
    const after = value.slice(ta.selectionStart);
    const newVal = before + suggestion.insert + after;
    onChange(newVal);
    setShowSuggestions(false);
    setTimeout(() => {
      if (ta) {
        const newPos = triggerPos + suggestion.insert.length;
        ta.selectionStart = newPos;
        ta.selectionEnd = newPos;
        ta.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[selectedIdx]) {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIdx]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
          computeSuggestions(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setTimeout(() => setShowSuggestions(false), 150);
          onBlur?.();
        }}
        placeholder={placeholder}
        className={className}
        data-testid={dataTestId}
      />
      {showSuggestions && (
        <div className="absolute z-50 left-0 top-full mt-1 w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto print:hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${
                i === selectedIdx ? "bg-blue-50 text-blue-800" : "text-gray-700"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertSuggestion(s);
              }}
              data-testid={`suggestion-${i}`}
            >
              {s.label}
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-gray-400 border-t">
            Use{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">@</kbd>{" "}
            + número para processos, @cargo para participantes
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleStage({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      data-testid={`stage-${number}`}
      className="print:break-inside-avoid-page"
    >
      <div
        className="mt-10 mb-5 print:mt-6 print:mb-3 cursor-pointer select-none group"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-white bg-gradient-to-br from-[#1e4080] to-[#0f2347] rounded-lg w-7 h-7 flex items-center justify-center shrink-0 shadow-md shadow-[#0f2347]/30 ring-1 ring-white/10 print:text-black print:bg-white print:border print:border-gray-400 print:shadow-none print:ring-0">
            {number}
          </span>
          <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-slate-700 print:text-black flex-1 group-hover:text-[#1a3a6e] transition-colors">
            {title}
          </h3>
          <ChevronDown
            className={`w-4 h-4 text-slate-400/70 group-hover:text-[#1a3a6e] transition-all duration-200 print:hidden ${collapsed ? "-rotate-90" : ""}`}
          />
        </div>
        <div className="mt-2.5 flex items-center gap-2 print:hidden">
          <div className="h-px flex-1 bg-gradient-to-r from-[#1a3a6e]/30 via-blue-200/60 to-transparent" />
        </div>
        <div className="mt-2.5 hidden print:block h-px bg-gray-400" />
      </div>
      <div
        className={`transition-all duration-200 overflow-hidden print:!max-h-none print:!opacity-100 ${
          collapsed ? "max-h-0 opacity-0" : "max-h-[100000px] opacity-100"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const ATA_FIELDS = [
  {
    key: "ata_competencia",
    label: "Competência (Seção)",
    placeholder: "1",
    type: "text",
  },
  {
    key: "ata_sessao_numero",
    label: "Número da Sessão Ordinária",
    placeholder: "1",
    type: "text",
  },
  {
    key: "ata_hora_inicio",
    label: "Hora de Início (por extenso)",
    placeholder: "quatorze horas",
    type: "text",
  },
  {
    key: "ata_hora_encerramento",
    label: "Hora de Encerramento (por extenso)",
    placeholder: "dezoito horas",
    type: "text",
  },
  {
    key: "ata_presentes_sala",
    label: "Presentes na Sala de Sessões",
    placeholder: "os Desembargadores Federais...",
    type: "textarea",
  },
  {
    key: "ata_presentes_teams",
    label: "Presentes por Teams",
    placeholder: "o Desembargador Federal...",
    type: "textarea",
  },
  {
    key: "ata_cumprimentos",
    label: "Cumprimentos / Observações iniciais",
    placeholder: "(opcional)",
    type: "textarea",
  },
  {
    key: "ata_secretario_nome",
    label: "Nome do Secretário",
    placeholder: "Fábio Bordin de Sales",
    type: "text",
  },
  {
    key: "ata_secretario_titulo",
    label: "Título do Secretário",
    placeholder: "Diretor da Subsecretaria...",
    type: "text",
  },
] as const;

function AtaSettingsPanel({
  overrides,
  onSaveBatch,
  onRegenerate,
}: {
  overrides: Overrides;
  onSaveBatch: (updates: Record<string, string | null>) => void;
  onRegenerate: () => void;
}) {
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {};
    for (const f of ATA_FIELDS) {
      vals[f.key] = overrides[f.key] || "";
    }
    return vals;
  });

  const handleChange = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveAll = () => {
    const updates: Record<string, string | null> = {};
    for (const f of ATA_FIELDS) {
      const val = localValues[f.key]?.trim();
      updates[f.key] = val || null;
    }
    onSaveBatch(updates);
    setTimeout(onRegenerate, 600);
  };

  return (
    <div
      className="border-b bg-slate-50 px-5 py-4"
      data-testid="ata-settings-panel"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ATA_FIELDS.map((f) => (
          <div
            key={f.key}
            className={f.type === "textarea" ? "md:col-span-2" : ""}
          >
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              {f.label}
            </label>
            {f.type === "textarea" ? (
              <textarea
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none resize-none"
                rows={2}
                placeholder={f.placeholder}
                value={localValues[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                data-testid={`input-${f.key}`}
              />
            ) : (
              <input
                type="text"
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                placeholder={f.placeholder}
                value={localValues[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                data-testid={`input-${f.key}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleSaveAll}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          data-testid="button-ata-save-settings"
        >
          Salvar e Regenerar Ata
        </button>
      </div>
    </div>
  );
}

function ViewSessionPicker() {
  const sessionsQuery = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const activeSessions = useMemo(() => {
    if (!sessionsQuery.data) return [];
    return sessionsQuery.data
      .filter((s) => s.status !== "closed")
      .sort((a, b) => {
        if (a.isNext && !b.isNext) return -1;
        if (!a.isNext && b.isNext) return 1;
        return (
          new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
        );
      });
  }, [sessionsQuery.data]);

  if (sessionsQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Skeleton className="w-80 h-40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={coatOfArmsImg}
            alt=""
            className="w-16 h-16 mx-auto mb-4 opacity-60"
          />
          <h1 className="text-xl font-bold text-slate-800">
            Roteiro de Sessão
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Turma Regional de MS — TRF3
          </p>
        </div>
        {activeSessions.length === 0 ? (
          <p className="text-center text-slate-400 text-sm">
            Nenhuma sessão disponível no momento.
          </p>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((session) => (
              <a
                key={session.id}
                href={`/viewer/roteiro/${session.id}`}
                className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-blue-300 transition-all group"
                data-testid={`view-session-${session.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                      {session.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(session.sessionDate).toLocaleDateString(
                        "pt-BR",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </p>
                  </div>
                  {session.isNext && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-100 text-blue-700">
                      Próxima
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Roteiro({
  forceViewOnly = false,
}: {
  forceViewOnly?: boolean;
}) {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  if (!sessionId && forceViewOnly) {
    return <ViewSessionPicker />;
  }

  return <RoteiroInner sessionId={sessionId!} forceViewOnly={forceViewOnly} />;
}

function RoteiroInner({
  sessionId,
  forceViewOnly,
}: {
  sessionId: string;
  forceViewOnly: boolean;
}) {
  const { toast } = useToast();
  const editMode = !forceViewOnly;
  const [viewerMode] = useState(forceViewOnly);
  const [activeHighlightKey, setActiveHighlightKey] = useState<string | null>(
    null,
  );
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editCount, setEditCount] = useState(0);
  const [expandVolumeStat, setExpandVolumeStat] = useState(false);
  const [expandPrefStat, setExpandPrefStat] = useState(false);
  const [expandOralStat, setExpandOralStat] = useState(false);
  const [showAtaDialog, setShowAtaDialog] = useState(false);
  const [showAtaSettings, setShowAtaSettings] = useState(false);
  const [showDefaultsDialog, setShowDefaultsDialog] = useState(false);
  const [showSessionDetailsDialog, setShowSessionDetailsDialog] =
    useState(false);
  const [ataText, setAtaText] = useState<string | null>(null);
  const [ataLoading, setAtaLoading] = useState(false);

  const sessionQuery = useQuery<Session>({
    queryKey: ["/api/sessions", sessionId],
  });

  const casesQuery = useQuery<Case[]>({
    queryKey: ["/api/sessions", sessionId, "cases"],
    enabled: !!sessionId,
  });

  const allSessionsQuery = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  const overrides: Overrides =
    (sessionQuery.data?.scriptOverrides as Overrides) || {};

  const saveMutation = useMutation({
    mutationFn: async (newOverrides: Overrides) => {
      await apiRequest("PATCH", `/api/sessions/${sessionId}`, {
        scriptOverrides: newOverrides,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      setEditCount((c) => c + 1);
      setHasPendingChanges(true);
    },
    onError: () => {
      toast({ title: "Erro ao salvar alteração", variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/sessions/${sessionId}`, {
        status: "active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      setHasPendingChanges(false);
      setIsPublishing(false);
      toast({ title: "Roteiro publicado com sucesso!" });
    },
    onError: () => {
      setIsPublishing(false);
      toast({ title: "Erro ao publicar roteiro", variant: "destructive" });
    },
  });

  const caseMutation = useMutation({
    mutationFn: async ({
      caseId,
      updates,
    }: {
      caseId: string;
      updates: Record<string, any>;
    }) => {
      await apiRequest("PATCH", `/api/cases/${caseId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", sessionId, "cases"],
      });
      setEditCount((c) => c + 1);
      setHasPendingChanges(true);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar processo", variant: "destructive" });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      await apiRequest("DELETE", `/api/cases/${caseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", sessionId, "cases"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions-summary"] });
      setEditCount((c) => c + 1);
      setHasPendingChanges(true);
      toast({ title: "Processo removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover processo", variant: "destructive" });
    },
  });

  const handleUpdateCase = useCallback(
    (caseId: string, updates: Record<string, any>) => {
      caseMutation.mutate({ caseId, updates });
    },
    [caseMutation],
  );

  const handleSave = useCallback(
    (key: string, value: string | null) => {
      const latestSession = queryClient.getQueryData<Session>([
        "/api/sessions",
        sessionId,
      ]);
      const latestOverrides =
        (latestSession?.scriptOverrides as Overrides) || {};
      const current = { ...latestOverrides };
      if (value === null) {
        delete current[key];
      } else {
        current[key] = value;
      }
      saveMutation.mutate(current);
    },
    [sessionId, saveMutation],
  );

  const dynamicSpeeches = useMemo(
    () => getDynamicSpeeches(overrides),
    [overrides],
  );
  const dynamicNotes = useMemo(() => getDynamicNotes(overrides), [overrides]);

  const handleAddSpeech = useCallback(
    (role: string, slotKey: string, title?: string) => {
      const latestSession = queryClient.getQueryData<Session>([
        "/api/sessions",
        sessionId,
      ]);
      const latestOverrides =
        (latestSession?.scriptOverrides as Overrides) || {};
      const current = { ...latestOverrides };
      const speeches = getDynamicSpeeches(current);
      const newSpeech: DynamicSpeech = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        role,
        title: title || undefined,
        text: `[Fala de ${role}]`,
        slotKey,
        kind: "speech",
      };
      speeches.push(newSpeech);
      current._dynamic_speeches = JSON.stringify(speeches);
      saveMutation.mutate(current);
    },
    [sessionId, saveMutation],
  );

  const handleAddAction = useCallback(
    (slotKey: string) => {
      const latestSession = queryClient.getQueryData<Session>([
        "/api/sessions",
        sessionId,
      ]);
      const latestOverrides =
        (latestSession?.scriptOverrides as Overrides) || {};
      const current = { ...latestOverrides };
      const speeches = getDynamicSpeeches(current);
      const newAction: DynamicSpeech = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        role: "ação",
        text: "[Ação ou instrução]",
        slotKey,
        kind: "action",
      };
      speeches.push(newAction);
      current._dynamic_speeches = JSON.stringify(speeches);
      saveMutation.mutate(current);
    },
    [sessionId, saveMutation],
  );

  const handleRemoveSpeech = useCallback(
    (id: string) => {
      const latestSession = queryClient.getQueryData<Session>([
        "/api/sessions",
        sessionId,
      ]);
      const latestOverrides =
        (latestSession?.scriptOverrides as Overrides) || {};
      const current = { ...latestOverrides };
      const speeches = getDynamicSpeeches(current).filter((s) => s.id !== id);
      current._dynamic_speeches = JSON.stringify(speeches);
      delete current[`_dyn_${id}`];
      saveMutation.mutate(current);
    },
    [sessionId, saveMutation],
  );

  const handleAddNote = useCallback(
    (color: string, slotKey: string) => {
      const latestSession = queryClient.getQueryData<Session>([
        "/api/sessions",
        sessionId,
      ]);
      const latestOverrides =
        (latestSession?.scriptOverrides as Overrides) || {};
      const current = { ...latestOverrides };
      const notes = getDynamicNotes(current);
      const newNote: DynamicNote = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        color,
        text: "",
        slotKey,
      };
      notes.push(newNote);
      current._dynamic_notes = JSON.stringify(notes);
      saveMutation.mutate(current);
    },
    [sessionId, saveMutation],
  );

  const handleRemoveNote = useCallback(
    (id: string) => {
      const latestSession = queryClient.getQueryData<Session>([
        "/api/sessions",
        sessionId,
      ]);
      const latestOverrides =
        (latestSession?.scriptOverrides as Overrides) || {};
      const current = { ...latestOverrides };
      const notes = getDynamicNotes(current).filter((n) => n.id !== id);
      current._dynamic_notes = JSON.stringify(notes);
      delete current[`_dyn_note_${id}`];
      saveMutation.mutate(current);
    },
    [sessionId, saveMutation],
  );

  const handleDispensadaEffect = useCallback(
    (caseItem: Case) => {
      const latestSession = queryClient.getQueryData<Session>([
        "/api/sessions",
        sessionId,
      ]);
      const latestOverrides =
        (latestSession?.scriptOverrides as Overrides) || {};
      const current = { ...latestOverrides };
      const speeches = getDynamicSpeeches(current);
      const notes = getDynamicNotes(current);
      const slotKey = `case_${caseItem.id}_dispensada`;
      const advogado = caseItem.oralArgumentRequester || "[requerente]";
      const speechId =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const noteId =
        (Date.now() + 1).toString(36) + Math.random().toString(36).slice(2, 6);
      const noteText = `Sustentação dispensada — Dr(a). ${advogado} declarou ciência do resultado favorável e dispensou a sustentação oral.`;
      speeches.push({
        id: speechId,
        role: "Presidente",
        title: "Sustentação Dispensada",
        text: `Dr(a). ${advogado}, V. Sa. declara ciência do resultado favorável e dispensa a sustentação oral?`,
        slotKey,
        kind: "speech",
      });
      notes.push({ id: noteId, color: "yellow", text: noteText, slotKey });
      current._dynamic_speeches = JSON.stringify(speeches);
      current._dynamic_notes = JSON.stringify(notes);
      current[`_note_${noteId}`] = noteText;
      saveMutation.mutate(current);
    },
    [sessionId, saveMutation],
  );

  const dropSlotProps = useCallback(
    (slotKey: string) => ({
      slotKey,
      speeches: dynamicSpeeches,
      notes: dynamicNotes,
      overrides,
      onSave: handleSave,
      onAddSpeech: handleAddSpeech,
      onRemoveSpeech: handleRemoveSpeech,
      onAddNote: handleAddNote,
      onRemoveNote: handleRemoveNote,
      onAddAction: handleAddAction,
    }),
    [
      dynamicSpeeches,
      dynamicNotes,
      overrides,
      handleSave,
      handleAddSpeech,
      handleRemoveSpeech,
      handleAddNote,
      handleRemoveNote,
      handleAddAction,
    ],
  );

  const participants = useMemo(() => {
    const result: { role: string; name: string }[] = [];
    const compKeys = [
      { key: "composicao_presidente", role: "Presidente" },
      { key: "composicao_desembargadores", role: "Desembargador(a) Federal" },
      { key: "composicao_convocados", role: "Juiz(a) Federal Convocado(a)" },
      { key: "composicao_secretario", role: "Secretário(a)" },
      { key: "composicao_mpf", role: "Representante do MPF" },
      { key: "composicao_advogados", role: "Advogado(a)" },
    ];
    for (const { key, role } of compKeys) {
      const val = overrides[key];
      if (val && !val.startsWith("[")) {
        const names = val
          .split(/[,;]/)
          .map((n) => n.trim())
          .filter(Boolean);
        for (const name of names) {
          result.push({ role, name });
        }
      }
    }
    return result;
  }, [overrides]);

  const quorumInfo = useMemo(() => {
    const presidente = overrides.composicao_presidente;
    const desembargadores = overrides.composicao_desembargadores;
    const convocados = overrides.composicao_convocados;
    const hasPresidente = presidente && !presidente.startsWith("[");
    const desList =
      desembargadores && !desembargadores.startsWith("[")
        ? desembargadores
            .split(/[,;]/)
            .map((n) => n.trim())
            .filter(Boolean)
        : [];
    const convList =
      convocados && !convocados.startsWith("[")
        ? convocados
            .split(/[,;]/)
            .map((n) => n.trim())
            .filter(Boolean)
        : [];
    const totalMembers =
      (hasPresidente ? 1 : 0) + desList.length + convList.length;
    const quorumMet = totalMembers >= 3;
    return {
      totalMembers,
      quorumMet,
      hasPresidente,
      desembargadoresCount: desList.length,
      convocadosCount: convList.length,
    };
  }, [overrides]);

  const sortedCases = useMemo(() => {
    return (
      casesQuery.data?.slice().sort((a, b) => {
        const priorityOf = (c: Case) => {
          const isPref = !!(c.preferenceType && c.preferenceType !== "adiado");
          const isAdi = c.preferenceType === "adiado";
          const isPresencial =
            c.hasOralArgument && c.oralArgumentType === "presencial";
          const isVideo = c.hasOralArgument && !isPresencial;
          if (isPref && isPresencial) return 0; // Preferência + Sust. Presencial
          if (isPref && isVideo) return 1; // Preferência + Sust. Videoconferência
          if (isPref) return 2; // Preferência (sem oral)
          if (isAdi && isPresencial) return 3; // Ant. Adiado + Sust. Presencial
          if (isAdi && isVideo) return 4; // Ant. Adiado + Sust. Videoconferência
          if (isPresencial) return 5; // Sust. Presencial
          if (isVideo) return 6; // Sust. Videoconferência
          if (isAdi) return 7; // Ant. Adiado (sem oral)
          return 8; // Demais
        };
        const pa = priorityOf(a);
        const pb = priorityOf(b);
        if (pa !== pb) return pa - pb;
        if (
          a.hasOralArgument &&
          b.hasOralArgument &&
          a.oralArgumentReceivedAt &&
          b.oralArgumentReceivedAt
        ) {
          return a.oralArgumentReceivedAt.localeCompare(
            b.oralArgumentReceivedAt,
          );
        }
        return a.paragraph - b.paragraph;
      }) || []
    );
  }, [casesQuery.data]);

  const isSeparatedCase = (c: Case) =>
    c.sobrestado ||
    c.pedidoVista ||
    c.status === "postponed" ||
    c.status === "withdrawn";
  const prefOnlyCases = sortedCases.filter(
    (c) => c.preferenceType && !c.hasOralArgument && !isSeparatedCase(c),
  );
  const oralCases = sortedCases.filter(
    (c) => c.hasOralArgument && !isSeparatedCase(c),
  );
  const plainCases = sortedCases.filter(
    (c) => !c.hasOralArgument && !c.preferenceType && !isSeparatedCase(c),
  );
  const allOralCases = sortedCases.filter((c) => c.hasOralArgument);
  const prefCases = sortedCases.filter(
    (c) => c.preferenceType && !isSeparatedCase(c),
  );
  const judgedCases = sortedCases.filter((c) => c.result);
  const sobrestadoCases = sortedCases.filter((c) => c.sobrestado);
  const vistaCases = sortedCases.filter((c) => c.pedidoVista);
  const adiados = sortedCases.filter((c) => c.status === "postponed");
  const retirados = sortedCases.filter((c) => c.status === "withdrawn");
  const retiradosListStr =
    retirados.length > 0
      ? retirados
          .map((c) => `item ${c.paragraph} (${c.processNumber})`)
          .join(", ")
      : "[nenhum]";
  const replaceRetiradosAt = (text: string) =>
    text.replace(/@/g, retiradosListStr);
  const separatedCases = sortedCases.filter(isSeparatedCase);
  const activeCases = useMemo(
    () => sortedCases.filter((c) => !isSeparatedCase(c)),
    [sortedCases],
  );
  const timeEstimate = useMemo(
    () =>
      activeCases.length > 0 ? estimateSessionDuration(activeCases) : null,
    [activeCases],
  );

  const relatorDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of sortedCases) {
      if (!c.relator) continue;
      const words = c.relator.trim().split(/\s+/);
      const abbr = words[words.length - 1];
      map[abbr] = (map[abbr] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([abbr, count]) => ({ abbr, count }));
  }, [sortedCases]);

  const prefSolicitadas = useMemo(
    () => prefCases.filter((c) => c.preferenceType && c.preferenceType !== "adiado").length,
    [prefCases],
  );
  const prefAdiados = useMemo(
    () => prefCases.filter((c) => c.preferenceType === "adiado").length,
    [prefCases],
  );

  const oralPresencial = useMemo(
    () => sortedCases.reduce((sum, c) => {
      let n = 0;
      if (c.hasOralArgument && c.oralArgumentType === "presencial") n++;
      if (c.hasOralArgument2 && c.oralArgumentType2 === "presencial") n++;
      return sum + n;
    }, 0),
    [sortedCases],
  );
  const oralVideoconf = useMemo(
    () => sortedCases.reduce((sum, c) => {
      let n = 0;
      if (c.hasOralArgument && (c.oralArgumentType === "videoconferencia" || c.oralArgumentType === "videoconferência")) n++;
      if (c.hasOralArgument2 && (c.oralArgumentType2 === "videoconferencia" || c.oralArgumentType2 === "videoconferência")) n++;
      return sum + n;
    }, 0),
    [sortedCases],
  );
  const totalOralSlots = useMemo(
    () => sortedCases.reduce((sum, c) => sum + (c.hasOralArgument ? 1 : 0) + (c.hasOralArgument2 ? 1 : 0), 0),
    [sortedCases],
  );

  const session = sessionQuery.data;
  const isLoading = sessionQuery.isLoading || casesQuery.isLoading;

  const sessionDateObj = session
    ? new Date(session.sessionDate + "T12:00:00")
    : null;
  const sessionDateFormatted = sessionDateObj
    ? sessionDateObj.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  const sessionDateFull = sessionDateObj
    ? sessionDateObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  const sessionWeekday = sessionDateObj
    ? sessionDateObj.toLocaleDateString("pt-BR", { weekday: "long" })
    : "";

  const sessionOrdinal = useMemo(() => {
    if (!session || !allSessionsQuery.data) return "";
    return getSessionOrdinal(session.sessionDate, allSessionsQuery.data);
  }, [session, allSessionsQuery.data]);

  const presidente = (
    overrides.composicao_presidente || "[Presidente]"
  ).toUpperCase();
  const desembargadores = (
    overrides.composicao_desembargadores || "[Desembargadores Federais]"
  ).toUpperCase();
  const convocados = (
    overrides.composicao_convocados || "[Juízes Federais Convocados]"
  ).toUpperCase();
  const mpfNome = (
    overrides.composicao_mpf || "[Procurador(a) da República]"
  ).toUpperCase();
  const competencia = overrides.ata_competencia || "3ª";

  let globalIndex = 0;

  const ep = (key: string, defaultText: string) => ({
    textKey: key,
    defaultText,
    overrides,
    onSave: handleSave,
    editMode,
  });

  return (
    <DragContext.Provider
      value={{
        viewerMode,
        editMode,
        cases: sortedCases,
        participants,
        activeHighlightKey,
        setActiveHighlightKey,
      }}
    >
      <div className="min-h-screen bg-[hsl(215,30%,96%)] print:bg-white">
        {/* ── HEADER PADRÃO ────────────────────────────────────────────── */}
        <div
          className="print:hidden sticky top-0 z-10 text-white shadow-xl shadow-[#0f2347]/35"
          style={{
            background:
              "linear-gradient(90deg, #152d5c 0%, #122855 45%, #0b1d3e 100%)",
            borderBottom: "1.5px solid rgba(180,155,90,0.35)",
          }}
        >
          <div className="flex items-center justify-between px-3 md:px-4 py-2 gap-3">
            {/* LEFT — Ícone + Título */}
            <div className="flex items-center gap-2.5 min-w-0">
              {!forceViewOnly && (
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
              )}
              <img
                src={coatOfArmsImg}
                alt="Justiça Federal"
                className="w-9 h-9 object-contain shrink-0 hidden md:block"
                style={{
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                  opacity: 0.95,
                }}
              />
              <div className="min-w-0 pl-0.5">
                <h1 className="text-[14px] leading-tight truncate">
                  <span className="font-extrabold text-white tracking-tight">
                    ROTEIRO
                  </span>
                  <span className="font-normal text-white/75 ml-1 tracking-tight">
                    DE SESSÃO
                  </span>
                </h1>
                <p
                  className="text-[9.5px] font-semibold mt-0.5 uppercase tracking-widest hidden md:block"
                  style={{ color: "rgba(160,190,255,0.55)" }}
                >
                  Turma Regional de MS · TRF3
                </p>
              </div>
            </div>

            {/* RIGHT — Botões */}
            <div className="flex items-center gap-1 shrink-0">
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
              <button
                type="button"
                onClick={() => {
                  const viewUrl = `${window.location.origin}/viewer/roteiro/${sessionId}`;
                  navigator.clipboard.writeText(viewUrl);
                  toast({
                    title: "Link copiado!",
                    description:
                      "Link de visualização copiado para a área de transferência.",
                  });
                }}
                data-testid="button-share-view"
                className="h-8 w-8 rounded-md flex items-center justify-center transition-colors border border-white/10"
                style={{ background: "rgba(255,255,255,0.09)" }}
                title="Compartilhar link (somente leitura)"
              >
                <Share2 className="w-4 h-4 text-white" />
              </button>
              {!forceViewOnly && (
                <button
                  type="button"
                  onClick={async () => {
                    setAtaLoading(true);
                    setShowAtaDialog(true);
                    try {
                      const res = await fetch(`/api/sessions/${sessionId}/ata`);
                      const data = await res.json();
                      setAtaText(data.text);
                    } catch {
                      toast({
                        title: "Erro ao gerar ata",
                        variant: "destructive",
                      });
                    } finally {
                      setAtaLoading(false);
                    }
                  }}
                  data-testid="button-generate-ata"
                  className="h-8 px-3 rounded-md flex items-center gap-1.5 text-[11px] font-bold transition-colors border border-[rgba(100,140,255,0.3)]"
                  style={{ background: "#1c3fd1", color: "#fff" }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Gerar Ata</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {editMode && (
          <div className="print:hidden bg-amber-50 border-b border-amber-200/70 px-4 py-1.5 text-center text-xs text-amber-700 font-medium flex items-center justify-center gap-1.5">
            <Pencil className="w-3 h-3 text-amber-500" />
            Modo de edição ativo — clique em qualquer fala para editar. Salvo
            automaticamente.
          </div>
        )}

        <div className="max-w-4xl mx-auto px-3 md:px-8 py-6 md:py-10 print:px-0 print:py-0 print:max-w-none text-justify">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-96 mx-auto" />
              <Skeleton className="h-6 w-64 mx-auto" />
              <Skeleton className="h-4 w-48 mx-auto" />
              <div className="mt-12 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <header className="text-center mb-10 print:mb-6">
                <div className="flex items-center justify-center mb-4">
                  <img
                    src={coatOfArmsImg}
                    alt="República Federativa do Brasil"
                    className="w-20 h-20 drop-shadow-md print:w-16 print:h-16"
                  />
                </div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-blue-700/60 font-semibold mb-1 print:text-gray-500">
                  Poder Judiciário
                </p>
                <h1 className="text-lg font-bold uppercase tracking-[0.05em] text-slate-800 print:text-black">
                  Tribunal Regional Federal da 3ª Região
                </h1>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 mt-1 print:text-black">
                  Turma Regional de Mato Grosso do Sul
                </p>
                <div className="mt-7 pt-5 space-y-2 relative">
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-blue-200 print:bg-gray-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-300 print:bg-gray-400" />
                    <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-blue-200 print:bg-gray-400" />
                  </div>
                  <h2 className="text-base font-bold uppercase tracking-[0.08em] text-slate-800 print:text-black">
                    Sessão Ordinária de Julgamento
                  </h2>
                  <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600 print:text-black">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-400 print:hidden" />
                    <span className="font-medium">
                      {sessionDateFull || "..."}
                    </span>
                    <span className="text-slate-300 print:hidden">·</span>
                    <span className="capitalize text-slate-500">
                      {sessionWeekday}
                    </span>
                    <span className="text-slate-300 print:hidden">·</span>
                    <TimeRecorder
                      label="Início"
                      overrideKey="horario_inicio"
                      overrides={overrides}
                      onSave={handleSave}
                      editMode={editMode}
                    />
                  </div>
                </div>
              </header>

              {/* ======= FASE I - ABERTURA DA SESSÃO ======= */}
              <CollapsibleStage number="I" title="Abertura da Sessão">
                <TeamsAlert text="INICIAR GRAVAÇÃO DO TEAMS" />
                <PresidentSpeech
                  label="Presidente"
                  {...ep(
                    "fase1_abertura",
                    `Boa tarde a todas e todos!\nVerificada a existência de quórum regimental, declaro aberta a ${sessionOrdinal} sessão ordinária da Turma Regional de Mato Grosso do Sul, destinada ao julgamento de feitos de competência da ${competencia} Seção do Tribunal Regional Federal da 3ª Região.`,
                  )}
                />
                <DropSlot {...dropSlotProps("after_fase1")} />
              </CollapsibleStage>

              {/* ======= FASE II - SAUDAÇÃO: QUÓRUM E COMPOSIÇÃO ======= */}
              <CollapsibleStage
                number="II"
                title="Saudação: Quórum e Composição"
              >
                <PresidentSpeech
                  {...ep(
                    "fase2_saudacao_1",
                    `Cumprimento, inicialmente, o Excelentíssimo Senhor Presidente do egrégio Tribunal Regional Federal da 3ª Região, ${(overrides.composicao_presidente_trf3 || presidente).toUpperCase()}, bem como os(as) Excelentíssimos(as) Juízes(as) Federais que compõem esta Turma, ${desembargadores}, ${convocados}.`,
                  )}
                />

                <PresidentSpeech
                  {...ep(
                    "fase2_saudacao_2",
                    `Cumprimento também a Excelentíssima Senhora Procuradora Regional da República, ${mpfNome}, representante do Ministério Público Federal.`,
                  )}
                />

                <PresidentSpeech
                  {...ep(
                    "fase2_saudacao_3",
                    `Cumprimento, por fim, todos os advogados presentes, servidores e demais participantes que nos acompanham.`,
                  )}
                />
                <DropSlot {...dropSlotProps("after_composicao")} />
              </CollapsibleStage>

              {/* ======= FASE III - COMUNICAÇÕES DA PRESIDÊNCIA ======= */}
              <CollapsibleStage
                number="III"
                title="Comunicações da Presidência"
              >
                <PresidentSpeech
                  label="Presidente"
                  {...ep(
                    "fase3_comunicacoes",
                    `Passo às comunicações da Presidência:`,
                  )}
                />

                {(() => {
                  const comunicacoes = getComunicacoes(overrides);
                  const ataCom = getAtaComunicacao(overrides, competencia);
                  const editableCount = comunicacoes.length;

                  const saveComunicacoes = (newList: Comunicacao[]) => {
                    handleSave(
                      "_comunicacoes",
                      JSON.stringify(
                        newList.filter((c) => c && c.id && c.text),
                      ),
                    );
                  };

                  const moveUp = (idx: number) => {
                    if (idx <= 0 || idx >= editableCount) return;
                    const next = [...comunicacoes];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    saveComunicacoes(next);
                  };
                  const moveDown = (idx: number) => {
                    if (idx < 0 || idx >= editableCount - 1) return;
                    const next = [...comunicacoes];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    saveComunicacoes(next);
                  };
                  const removeCom = (idx: number) => {
                    if (idx < 0 || idx >= editableCount) return;
                    const next = comunicacoes.filter((_, i) => i !== idx);
                    saveComunicacoes(next);
                  };
                  const addComunicacao = () => {
                    const newId = `custom_${Date.now()}`;
                    saveComunicacoes([
                      ...comunicacoes,
                      {
                        id: newId,
                        text: "[NOVA COMUNICAÇÃO]: Digite o conteúdo aqui.",
                      },
                    ]);
                  };

                  return (
                    <div
                      className="ml-6 mt-2 mb-4 space-y-3 pl-4 border-l-2 border-dashed border-slate-200 print:border-gray-300 print:ml-4"
                      data-testid="comunicacoes-section"
                    >
                      {comunicacoes.map((item, i) => (
                        <ComunicacaoCard
                          key={item.id}
                          item={item}
                          index={i}
                          total={editableCount}
                          editMode={editMode}
                          overrides={overrides}
                          onSave={handleSave}
                          onMoveUp={() => moveUp(i)}
                          onMoveDown={() => moveDown(i)}
                          onRemove={() => removeCom(i)}
                        />
                      ))}

                      {editMode && (
                        <button
                          onClick={addComunicacao}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary font-medium px-3 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-primary/50 transition-colors print:hidden"
                          data-testid="add-comunicacao"
                        >
                          <Plus className="w-3 h-3" />
                          Adicionar comunicação
                        </button>
                      )}

                      <ComunicacaoCard
                        key={ataCom.id}
                        item={ataCom}
                        index={editableCount}
                        total={editableCount + 1}
                        editMode={editMode}
                        overrides={overrides}
                        onSave={handleSave}
                        onMoveUp={() => {}}
                        onMoveDown={() => {}}
                        onRemove={() => {}}
                        pinned
                      />
                    </div>
                  );
                })()}

                <DropSlot {...dropSlotProps("after_fase3")} />
              </CollapsibleStage>

              {/* ======= FASE IV - ORDEM DO DIA: INTROITO ======= */}
              <CollapsibleStage number="IV" title="Ordem do Dia: Introito">
                <PresidentSpeech
                  label="Presidente"
                  {...ep("fase4_introito", `Passemos à pauta de julgamento:`)}
                />

                <div className="ml-6 border-l-2 border-dashed border-primary/20 pl-4 space-y-4 mt-2 print:ml-4 print:border-gray-400">
                  <PresidentSpeech
                    label="Retirada de Pauta"
                    {...ep(
                      "fase4_retirados_anuncio",
                      `RETIRADA DE PAUTA:\nForam retirados de pauta os itens: @.`,
                    )}
                    textTransform={replaceRetiradosAt}
                  />

                  <PresidentSpeech
                    label="Manifestação do MPF"
                    {...ep(
                      "fase4_mpf_manifestacao",
                      `MANIFESTAÇÃO DO MPF:\nConcedo a palavra ao(à) representante do Ministério Público Federal, ${mpfNome}, para manifestação nos feitos com intervenção ministerial.`,
                    )}
                  />

                  <InstructionEditable
                    {...ep(
                      "fase4_mpf_instrucao",
                      "[Aguardar manifestação do MPF]",
                    )}
                  />

                  <PresidentSpeech
                    label="Pedido de Preferência"
                    {...ep(
                      "fase4_pref_intro",
                      `PEDIDO DE PREFERÊNCIA:\nHá pedido de preferência no processo ${prefOnlyCases.length > 0 ? prefOnlyCases[0].processNumber : "[número]"}. Resultado proclamado: A Turma Regional de Mato Grosso do Sul, por unanimidade, ${prefOnlyCases.length > 0 ? getResultDecisionText(prefOnlyCases[0]) : "deu parcial provimento à apelação"}, nos termos do voto do relator.`,
                    )}
                  />

                  {prefOnlyCases.map((c) => {
                    globalIndex++;
                    const decisionText = getResultDecisionText(c);
                    return (
                      <div key={c.id}>
                        <div className="mb-4 rounded-xl overflow-hidden border border-sky-200 bg-white shadow-sm print:border-gray-300 print:shadow-none">
                          <div className="px-4 py-2.5 bg-sky-50 flex items-center justify-between gap-2 print:bg-gray-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-sm font-bold text-muted-foreground print:text-black">
                                {globalIndex}.
                              </span>
                              {c.pjeOrder && (
                                <span className="text-xs font-medium text-muted-foreground print:text-black">
                                  <Hash className="w-3 h-3 inline -mt-0.5" />
                                  {c.pjeOrder}
                                </span>
                              )}
                              <span className="font-mono text-sm font-bold print:text-black">
                                {c.processNumber}
                              </span>
                              <span className="text-xs font-bold text-sky-700 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded print:text-black print:bg-white print:border-gray-400">
                                {preferenceLabels[c.preferenceType!] ||
                                  c.preferenceType}
                              </span>
                            </div>
                            {c.result && (
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded print:text-black print:bg-white print:border print:border-gray-400 ${
                                  c.result === "provimento"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : c.result === "improvimento"
                                      ? "bg-red-100 text-red-800 border border-red-200"
                                      : c.result === "parcial_provimento"
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-slate-100 text-slate-700 border border-slate-300"
                                }`}
                              >
                                {RESULT_DECISION_TEXT[
                                  c.result
                                ]?.toUpperCase() || c.result.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="px-4 py-3 space-y-1.5">
                            <p className="text-sm print:text-black">
                              <strong>Partes:</strong> {c.parties}
                            </p>
                            <p className="text-xs text-muted-foreground print:text-black">
                              <strong>Relator(a):</strong> {c.relator}
                            </p>
                          </div>
                          <div className="px-4 pb-3">
                            <PresidentSpeech
                              label=""
                              {...ep(
                                `case_${c.id}_proclamacao`,
                                `Há pedido de preferência no processo ${c.processNumber}. Resultado proclamado: A Turma Regional de Mato Grosso do Sul, por unanimidade, ${decisionText}, nos termos do voto do(a) relator(a).`,
                              )}
                            />
                          </div>
                          <CaseActionBar
                            caseItem={c}
                            onUpdate={(updates) =>
                              handleUpdateCase(c.id, updates)
                            }
                          />
                        </div>
                        <DropSlot {...dropSlotProps(`after_case_${c.id}`)} />
                      </div>
                    );
                  })}
                </div>

                <DropSlot {...dropSlotProps("after_fase4")} />
              </CollapsibleStage>

              {/* ======= FASE V - ORDEM DO DIA: JULGAMENTOS COM SUSTENTAÇÃO ORAL ======= */}
              {oralCases.length > 0 && (
                <CollapsibleStage
                  number="V"
                  title={`Ordem do Dia: Julgamentos com Sustentação Oral (${oralCases.length})`}
                >
                  <DndContext>
                    <SortableContext
                      items={oralCases.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {oralCases.map((c) => {
                        globalIndex++;
                        return (
                          <div key={c.id}>
                            <CaseScript
                              caseItem={c}
                              index={globalIndex}
                              overrides={overrides}
                              onSave={handleSave}
                              editMode={editMode}
                              sessionDateFormatted={sessionDateFormatted}
                              dropSlotProps={dropSlotProps}
                              onUpdateCase={handleUpdateCase}
                              onDelete={() => deleteCaseMutation.mutate(c.id)}
                              onDispensada={handleDispensadaEffect}
                            />
                            <DropSlot
                              {...dropSlotProps(`after_case_${c.id}`)}
                            />
                          </div>
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                  <DropSlot {...dropSlotProps("before_fase6")} />
                </CollapsibleStage>
              )}

              {/* ======= FASE VI - ORDEM DO DIA: JULGAMENTOS NO PAINEL PJE ======= */}
              {plainCases.length > 0 &&
                (() => {
                  const RESULT_LABELS: Record<string, string> = {
                    provimento: "Provimento",
                    improvimento: "Improvimento",
                    parcial_provimento: "Parcial Provimento",
                    prejudicado: "Prejudicado",
                    nao_conhecido: "Não Conhecido",
                  };
                  const RESULT_COLORS: Record<
                    string,
                    { bg: string; border: string; text: string }
                  > = {
                    provimento: {
                      bg: "bg-emerald-50",
                      border: "border-emerald-200",
                      text: "text-emerald-700",
                    },
                    improvimento: {
                      bg: "bg-red-50",
                      border: "border-red-200",
                      text: "text-red-700",
                    },
                    parcial_provimento: {
                      bg: "bg-amber-50",
                      border: "border-amber-200",
                      text: "text-amber-700",
                    },
                    prejudicado: {
                      bg: "bg-slate-50",
                      border: "border-slate-200",
                      text: "text-slate-500",
                    },
                    nao_conhecido: {
                      bg: "bg-violet-50",
                      border: "border-violet-200",
                      text: "text-violet-700",
                    },
                  };
                  const grouped = plainCases.reduce<
                    Record<string, typeof plainCases>
                  >((acc, c) => {
                    const key = c.result || "_sem_resultado";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(c);
                    return acc;
                  }, {});
                  const resultOrder = [
                    "provimento",
                    "improvimento",
                    "parcial_provimento",
                    "prejudicado",
                    "nao_conhecido",
                    "_sem_resultado",
                  ];
                  const sortedGroups = resultOrder.filter((k) => grouped[k]);

                  return (
                    <CollapsibleStage
                      number={oralCases.length > 0 ? "VI" : "V"}
                      title="Ordem do Dia: Julgamentos no Painel PJe"
                    >
                      <PresidentSpeech
                        label="Presidente"
                        {...ep(
                          "fase6_painel_pje",
                          `Julgados os processos com pedidos de sustentação oral e de preferência, consulto os integrantes da Turma se podemos proceder ao julgamento dos demais feitos em conjunto, de acordo com os votos lançados no painel do Processo Judicial Eletrônico.`,
                        )}
                      />

                      <InstructionEditable
                        {...ep("fase6_painel_instrucao", "[Confirmam]")}
                      />

                      <PresidentSpeech
                        label="Presidente"
                        {...ep(
                          "fase6_mpf_painel",
                          `Concedo a palavra ao(à) Senhor(a) Procurador(a) Regional da República para a sua manifestação, tendo em vista existirem feitos em que há intervenção do órgão ministerial.`,
                        )}
                      />

                      <InstructionEditable
                        {...ep(
                          "fase6_mpf_painel_instrucao",
                          "[MPF se manifesta]",
                        )}
                      />

                      <PresidentSpeech
                        label="Presidente"
                        {...ep(
                          "fase6_proclama_resultados",
                          `Ante a concordância da Turma, ratificada a manifestação do Ministério Público Federal, proclamo os resultados constantes no PJe, cabendo à Secretaria realizar os devidos apontamentos.`,
                        )}
                      />

                      <div className="mt-6 mb-3 print:mt-4">
                        <div className="pb-2 border-b-2 border-slate-300 print:border-gray-500">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground print:text-black">
                            Demais Processos ({plainCases.length})
                          </h4>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden print:border-gray-300">
                        <div className="px-4 py-3 space-y-3">
                          {sortedGroups.map((resultKey) => {
                            const cases = grouped[resultKey];
                            const label =
                              RESULT_LABELS[resultKey] || "Sem resultado";
                            const colors = RESULT_COLORS[resultKey] || {
                              bg: "bg-slate-50",
                              border: "border-slate-200",
                              text: "text-slate-400",
                            };
                            return (
                              <div key={resultKey}>
                                <div
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide mb-1.5 ${colors.bg} ${colors.border} ${colors.text} border print:bg-white print:border-gray-400 print:text-black`}
                                >
                                  {label} ({cases.length})
                                </div>
                                <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-mono text-slate-600 print:text-black leading-relaxed">
                                  {cases.map((c, i) => {
                                    globalIndex++;
                                    return (
                                      <PlainCaseItem
                                        key={c.id}
                                        caseItem={c}
                                        index={globalIndex}
                                        isLast={i === cases.length - 1}
                                        onUpdateCase={handleUpdateCase}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {separatedCases.length > 0 && (
                        <>
                          <div className="mt-8 mb-3 print:mt-4">
                            <div className="pb-2 border-b-2 border-orange-300 print:border-gray-500">
                              <h4 className="text-xs font-bold uppercase tracking-wide text-orange-700 print:text-black">
                                Processos Sobrestados, com Vista, Adiados e
                                Retirados ({separatedCases.length})
                              </h4>
                            </div>
                          </div>

                          <div
                            data-testid="separated-cases-section"
                            className="rounded-xl border border-orange-200 bg-white shadow-sm overflow-hidden print:border-gray-300"
                          >
                            <div className="px-4 py-3 space-y-3">
                              {sobrestadoCases.length > 0 && (
                                <div data-testid="sobrestados-group">
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide mb-1.5 bg-amber-50 border-amber-200 text-amber-700 border print:bg-white print:border-gray-400 print:text-black">
                                    Sobrestados ({sobrestadoCases.length})
                                  </div>
                                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-mono text-slate-600 print:text-black leading-relaxed">
                                    {sobrestadoCases.map((c, i) => {
                                      globalIndex++;
                                      return (
                                        <PlainCaseItem
                                          key={c.id}
                                          caseItem={c}
                                          index={globalIndex}
                                          isLast={
                                            i === sobrestadoCases.length - 1
                                          }
                                          onUpdateCase={handleUpdateCase}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {vistaCases.length > 0 && (
                                <div>
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide mb-1.5 bg-violet-50 border-violet-200 text-violet-700 border print:bg-white print:border-gray-400 print:text-black">
                                    Com Vista ({vistaCases.length})
                                  </div>
                                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-mono text-slate-600 print:text-black leading-relaxed">
                                    {vistaCases.map((c, i) => {
                                      globalIndex++;
                                      return (
                                        <PlainCaseItem
                                          key={c.id}
                                          caseItem={c}
                                          index={globalIndex}
                                          isLast={i === vistaCases.length - 1}
                                          onUpdateCase={handleUpdateCase}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {adiados.length > 0 && (
                                <div>
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide mb-1.5 bg-pink-50 border-pink-200 text-pink-700 border print:bg-white print:border-gray-400 print:text-black">
                                    Adiados / P/ Próxima Sessão (
                                    {adiados.length})
                                  </div>
                                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-mono text-slate-600 print:text-black leading-relaxed">
                                    {adiados.map((c, i) => {
                                      globalIndex++;
                                      return (
                                        <PlainCaseItem
                                          key={c.id}
                                          caseItem={c}
                                          index={globalIndex}
                                          isLast={i === adiados.length - 1}
                                          onUpdateCase={handleUpdateCase}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {retirados.length > 0 && (
                                <div>
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide mb-1.5 bg-rose-50 border-rose-200 text-rose-700 border print:bg-white print:border-gray-400 print:text-black">
                                    Retirados de Pauta ({retirados.length})
                                  </div>
                                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs font-mono text-slate-600 print:text-black leading-relaxed">
                                    {retirados.map((c, i) => {
                                      globalIndex++;
                                      return (
                                        <PlainCaseItem
                                          key={c.id}
                                          caseItem={c}
                                          index={globalIndex}
                                          isLast={i === retirados.length - 1}
                                          onUpdateCase={handleUpdateCase}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </CollapsibleStage>
                  );
                })()}

              {/* ======= ENCERRAMENTO DA SESSÃO ======= */}
              <CollapsibleStage
                number={
                  oralCases.length > 0 && plainCases.length > 0
                    ? "VII"
                    : oralCases.length > 0 || plainCases.length > 0
                      ? "VI"
                      : "V"
                }
                title="Encerramento da Sessão"
              >
                {retirados.length > 0 && (
                  <PresidentSpeech
                    label="Presidente"
                    {...ep(
                      "fase7_reitero_retirados",
                      `Reitero que ${retirados.length === 1 ? "foi retirado" : "foram retirados"} de pauta ${retirados.length === 1 ? "o item" : "os itens"}: @.`,
                    )}
                    textTransform={replaceRetiradosAt}
                  />
                )}
                <PresidentSpeech
                  label="Presidente"
                  {...ep(
                    "fase7_encerramento",
                    `Não havendo mais processos, agradeço a presença de todos e declaro encerrada a sessão.`,
                  )}
                />
                <TeamsAlert text="ENCERRAR GRAVAÇÃO DO TEAMS" />
                <TimeRecorder
                  label="Horário do encerramento (horário de Campo Grande/MS)"
                  overrideKey="horario_encerramento"
                  overrides={overrides}
                  onSave={handleSave}
                  editMode={editMode}
                />
              </CollapsibleStage>

              <footer className="mt-14 pt-6 border-t border-blue-100 text-center text-[11px] text-muted-foreground/60 print:text-gray-400 print:mt-8">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="h-px w-8 bg-blue-200/50" />
                  <span className="text-blue-300/50 text-[9px]">✦</span>
                  <div className="h-px w-8 bg-blue-200/50" />
                </div>
                <p>
                  Documento gerado em {new Date().toLocaleDateString("pt-BR")}{" "}
                  às{" "}
                  {new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · TRF3 / Turma Regional MS
                </p>
              </footer>
            </>
          )}
        </div>

        {!viewerMode && (
          <FloatingHighlighter overrides={overrides} onSave={handleSave} />
        )}

        {showAtaDialog && (
          <div
            className="print:hidden fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => {
              setShowAtaDialog(false);
              setShowAtaSettings(false);
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-[#1a3a6e] to-[#0f2347] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-300" />
                  <h2 className="text-white font-bold text-lg">
                    Ata da Sessão
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAtaSettings(!showAtaSettings)}
                    className="rounded-lg h-8 w-8 flex items-center justify-center hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                    title="Configurações da Ata"
                    data-testid="button-ata-settings"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (ataText) {
                        navigator.clipboard.writeText(ataText);
                        toast({
                          title: "Ata copiada para a área de transferência",
                        });
                      }
                    }}
                    className="rounded-lg h-8 w-8 flex items-center justify-center hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                    title="Copiar"
                    data-testid="button-ata-copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (ataText) {
                        const blob = new Blob([ataText], {
                          type: "text/plain;charset=utf-8",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `ata_sessao_${session?.sessionDate || "sem_data"}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    }}
                    className="rounded-lg h-8 w-8 flex items-center justify-center hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                    title="Baixar .txt"
                    data-testid="button-ata-download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAtaDialog(false);
                      setShowAtaSettings(false);
                    }}
                    className="rounded-lg h-8 w-8 flex items-center justify-center hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                    data-testid="button-ata-close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showAtaSettings && (
                <AtaSettingsPanel
                  overrides={overrides}
                  onSaveBatch={(updates) => {
                    const latestSession = queryClient.getQueryData<Session>([
                      "/api/sessions",
                      sessionId,
                    ]);
                    const latestOverrides =
                      (latestSession?.scriptOverrides as Overrides) || {};
                    const current = { ...latestOverrides };
                    for (const [k, v] of Object.entries(updates)) {
                      if (v === null) delete current[k];
                      else current[k] = v;
                    }
                    saveMutation.mutate(current);
                  }}
                  onRegenerate={async () => {
                    setAtaLoading(true);
                    try {
                      const res = await fetch(`/api/sessions/${sessionId}/ata`);
                      const data = await res.json();
                      setAtaText(data.text);
                    } catch {
                      toast({
                        title: "Erro ao gerar ata",
                        variant: "destructive",
                      });
                    } finally {
                      setAtaLoading(false);
                    }
                  }}
                />
              )}

              <div className="flex-1 overflow-y-auto p-5">
                {ataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <span className="ml-3 text-sm text-slate-500">
                      Gerando ata...
                    </span>
                  </div>
                ) : ataText ? (
                  <pre
                    className="whitespace-pre-wrap text-sm font-serif leading-relaxed text-slate-800"
                    data-testid="ata-text-content"
                  >
                    {ataText}
                  </pre>
                ) : (
                  <p className="text-center text-slate-400 py-8">
                    Nenhum conteúdo gerado.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {showDefaultsDialog && (
          <div
            className="print:hidden fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowDefaultsDialog(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-[#1a3a6e] to-[#0f2347] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-amber-300" />
                  <h2 className="text-white font-bold text-lg">
                    Editar Padrão de Roteiro
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDefaultsDialog(false)}
                  className="rounded-lg h-8 w-8 flex items-center justify-center hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                  data-testid="button-defaults-close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <DefaultsForm
                sessionDate={session?.sessionDate || ""}
                overrides={overrides}
                onClose={() => setShowDefaultsDialog(false)}
              />
            </div>
          </div>
        )}

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
                  <h2 className="text-white font-bold text-lg">
                    Detalhes da Sessão
                  </h2>
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

        {sortedCases.length > 0 && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 print:hidden"
            data-testid="floating-stats-bar"
          >
            <div className="max-w-4xl mx-auto px-4">
              <div className="bg-gradient-to-r from-[#1a3a6e] via-[#163261] to-[#0f2347] text-white rounded-t-xl shadow-2xl shadow-[#0f2347]/40 border border-white/10 border-b-0 px-3 py-0 flex items-stretch justify-center gap-0 flex-wrap backdrop-blur-sm divide-x divide-white/[0.08]">

                {/* VOLUME */}
                <button
                  type="button"
                  onClick={() => setExpandVolumeStat(v => !v)}
                  data-testid="stat-total"
                  className="inline-flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left group"
                  title="Clique para ver distribuição por relator"
                >
                  <span className="bg-white/20 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums shrink-0">
                    {sortedCases.length}
                  </span>
                  <span className="text-[11px] text-white/70">
                    {sortedCases.length === 1 ? "processo" : "processos"}
                  </span>
                  {expandVolumeStat && relatorDist.length > 0 && (
                    <span className="text-[10px] text-white/45 font-mono hidden sm:inline">
                      {relatorDist.map(r => `${r.abbr}:${r.count}`).join(" · ")}
                    </span>
                  )}
                  <ChevronDown className={`w-3 h-3 text-white/30 transition-transform group-hover:text-white/50 shrink-0 ${expandVolumeStat ? "rotate-180" : ""}`} />
                </button>

                {/* PREFERÊNCIAS */}
                {prefCases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandPrefStat(v => !v)}
                    data-testid="stat-preferences"
                    className="inline-flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.06] transition-colors group"
                    title="Clique para ver detalhes de preferências"
                  >
                    <span className="bg-[#86efac]/25 text-[#86efac] rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums shrink-0">
                      {prefCases.length}
                    </span>
                    <span className="text-[11px] text-white/70">
                      {prefCases.length === 1 ? "preferência" : "preferências"}
                    </span>
                    {expandPrefStat && (
                      <span className="text-[10px] text-white/45 hidden sm:inline">
                        {prefSolicitadas > 0 && <span>{prefSolicitadas} sol.</span>}
                        {prefSolicitadas > 0 && prefAdiados > 0 && <span className="mx-1 opacity-40">·</span>}
                        {prefAdiados > 0 && <span>{prefAdiados} adiado{prefAdiados > 1 ? "s" : ""}</span>}
                      </span>
                    )}
                    <ChevronDown className={`w-3 h-3 text-white/30 transition-transform group-hover:text-white/50 shrink-0 ${expandPrefStat ? "rotate-180" : ""}`} />
                  </button>
                )}

                {/* SUSTENTAÇÕES */}
                {allOralCases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandOralStat(v => !v)}
                    data-testid="stat-oral"
                    className="inline-flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.06] transition-colors group"
                    title="Clique para ver detalhes das sustentações"
                  >
                    <span className="bg-[#7dd3fc]/25 text-[#7dd3fc] rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums shrink-0">
                      {allOralCases.length}
                    </span>
                    <span className="text-[11px] text-white/70">
                      {allOralCases.length === 1 ? "sustentação" : "sustentações"}
                    </span>
                    <span className="text-[10px] text-white/40 hidden sm:inline">
                      ~{totalOralSlots * 15}min
                    </span>
                    {expandOralStat && (
                      <span className="text-[10px] text-white/45 hidden sm:inline">
                        {oralPresencial > 0 && <span>{oralPresencial} pres.</span>}
                        {oralPresencial > 0 && oralVideoconf > 0 && <span className="mx-1 opacity-40">·</span>}
                        {oralVideoconf > 0 && <span>{oralVideoconf} vídeo</span>}
                      </span>
                    )}
                    <ChevronDown className={`w-3 h-3 text-white/30 transition-transform group-hover:text-white/50 shrink-0 ${expandOralStat ? "rotate-180" : ""}`} />
                  </button>
                )}

              </div>
            </div>
          </div>
        )}
      </div>
    </DragContext.Provider>
  );
}

function DefaultsForm({
  sessionDate,
  overrides,
  onClose,
}: {
  sessionDate: string;
  overrides: Record<string, string>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [activeTab, setActiveTab] = useState<"textos" | "ata">("textos");

  const textoFields = [
    { key: "fase1_abertura", label: "I — Abertura da Sessão", multi: true },
    {
      key: "fase2_saudacao_1",
      label: "II — Cumprimento aos Magistrados",
      multi: true,
    },
    { key: "fase2_saudacao_2", label: "II — Cumprimento ao MPF", multi: true },
    {
      key: "fase2_saudacao_3",
      label: "II — Cumprimento aos Advogados",
      multi: true,
    },
    { key: "fase3_comunicacoes", label: "III — Comunicações", multi: true },
    {
      key: "fase3_uso_videoconferencia",
      label: "III — Videoconferência",
      multi: true,
    },
    { key: "fase3_prioridade", label: "III — Prioridade", multi: true },
    {
      key: "fase3_dispensa_relatorio",
      label: "III — Dispensa do Relatório",
      multi: true,
    },
    { key: "fase3_ata_anterior", label: "III — Ata Anterior", multi: true },
    { key: "fase4_introito", label: "IV — Introito", multi: true },
    {
      key: "fase4_mpf_manifestacao",
      label: "IV — Manifestação do MPF",
      multi: true,
    },
    { key: "fase6_painel_pje", label: "VI — Painel PJe", multi: true },
    {
      key: "fase6_proclama_resultados",
      label: "VI — Proclamação Resultados PJe",
      multi: true,
    },
    { key: "fase7_encerramento", label: "VII — Encerramento", multi: true },
    { key: "chamada", label: "Chamada do Processo (1. Abertura)", multi: true },
    {
      key: "consulta_relatorio",
      label: "Consulta Relatório (2.)",
      multi: true,
    },
    { key: "sustentacao_oral", label: "Sustentação Oral (3.)", multi: true },
    { key: "para_voto", label: "Voto do Relator (4.)", multi: true },
    { key: "colher_votos", label: "Votos dos Demais (5.)", multi: true },
    { key: "proclamacao", label: "Resultado (6.)", multi: true },
  ];

  const ataFields = [
    { key: "ata_competencia", label: "Competência (seção)" },
    { key: "ata_secretario_titulo", label: "Título do(a) Secretário(a)" },
  ];

  const allFields = [...textoFields, ...ataFields];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of allFields) {
      const v = overrides[f.key];
      init[f.key] = v && !v.startsWith("[") ? v : "";
    }
    return init;
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const defaults: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v.trim()) defaults[k] = v.trim();
      }
      if (Object.keys(defaults).length === 0) {
        toast({ title: "Nenhum valor preenchido", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      const body: any = { fromDate: sessionDate, defaults };
      if (forceOverwrite) body.forceOverwrite = true;
      const res = await fetch("/api/sessions/apply-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({
        title: "Padrão aplicado",
        description: `${data.updated} sessão(ões) atualizada(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = sessionDate
    ? new Date(sessionDate + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  const tabs = [
    { id: "textos" as const, label: "Textos do Roteiro" },
    { id: "ata" as const, label: "Ata" },
  ];

  const currentFields = activeTab === "textos" ? textoFields : ataFields;

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex border-b border-slate-200 bg-slate-50/50 px-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
            data-testid={`tab-defaults-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        <p className="text-xs text-slate-500">
          Padrão para sessões a partir de <strong>{formattedDate}</strong>.
          Campos já editados manualmente não serão sobrescritos.
        </p>
        <div className="space-y-3">
          {currentFields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {f.label}
              </label>
              {"multi" in f && f.multi ? (
                <textarea
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                  placeholder={`Texto padrão para ${f.label.toLowerCase()}`}
                  data-testid={`input-default-${f.key}`}
                />
              ) : (
                <input
                  type="text"
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder={`Padrão para ${f.label.toLowerCase()}`}
                  data-testid={`input-default-${f.key}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="forceOverwrite"
            checked={forceOverwrite}
            onChange={(e) => setForceOverwrite(e.target.checked)}
            className="rounded border-slate-300"
            data-testid="checkbox-force-overwrite"
          />
          <label htmlFor="forceOverwrite" className="text-xs text-slate-500">
            Sobrescrever campos já editados
          </label>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#0428F0" }}
          data-testid="button-apply-defaults"
        >
          {isSaving
            ? "Aplicando..."
            : `Aplicar padrão a partir de ${formattedDate}`}
        </button>
      </div>
    </div>
  );
}

const RESULT_OPTIONS = [
  {
    value: "provimento",
    label: "Provimento",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    value: "improvimento",
    label: "Improvimento",
    color: "bg-red-100 text-red-800 border-red-300",
  },
  {
    value: "parcial_provimento",
    label: "Parcial Provimento",
    color: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    value: "prejudicado",
    label: "Prejudicado",
    color: "bg-slate-100 text-slate-600 border-slate-300",
  },
  {
    value: "nao_conhecido",
    label: "Não Conhecido",
    color: "bg-violet-100 text-violet-800 border-violet-300",
  },
];

function PlainCaseItem({
  caseItem,
  index,
  isLast,
  onUpdateCase,
}: {
  caseItem: Case;
  index: number;
  isLast: boolean;
  onUpdateCase: (caseId: string, updates: Record<string, any>) => void;
}) {
  const { viewerMode } = useContext(DragContext);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="inline" data-testid={`roteiro-plain-${caseItem.id}`}>
      <span className="font-bold text-slate-400 print:text-gray-500">
        {index}.
      </span>
      {viewerMode ? (
        <span className="ml-0.5">{caseItem.processNumber}</span>
      ) : (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`ml-0.5 transition-colors ${expanded ? "text-blue-600 underline" : "hover:text-blue-600 hover:underline"}`}
          title="Alterar resultado"
        >
          {caseItem.processNumber}
        </button>
      )}
      {expanded && !viewerMode && (
        <span className="inline-flex items-center gap-1 ml-1 print:hidden">
          <select
            value={caseItem.result || ""}
            onChange={(e) =>
              onUpdateCase(caseItem.id, { result: e.target.value || null })
            }
            className={`text-[10px] leading-none h-[22px] px-1.5 rounded-md border cursor-pointer transition-colors font-medium ${
              caseItem.result
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold"
                : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
            }`}
            data-testid={`plain-select-result-${caseItem.id}`}
          >
            <option value="">—</option>
            <option value="provimento">Provimento</option>
            <option value="improvimento">Improvimento</option>
            <option value="parcial_provimento">Parcial</option>
            <option value="prejudicado">Prejudicado</option>
            <option value="nao_conhecido">Não conhecido</option>
          </select>
          <RoteiroTogglePill
            checked={caseItem.status === "postponed"}
            onChange={(v) =>
              onUpdateCase(caseItem.id, { status: v ? "postponed" : "pending" })
            }
            activeColor="bg-pink-100 ring-1 ring-inset ring-pink-300"
            activeText="text-pink-700"
            label="P/ próx."
            testId={`plain-postponed-${caseItem.id}`}
          />
          <RoteiroTogglePill
            checked={caseItem.pedidoVista}
            onChange={(v) => onUpdateCase(caseItem.id, { pedidoVista: v })}
            activeColor="bg-violet-100 ring-1 ring-inset ring-violet-300"
            activeText="text-violet-700"
            icon={Eye}
            label="Vista"
            testId={`plain-vista-${caseItem.id}`}
          />
          <RoteiroTogglePill
            checked={caseItem.sobrestado}
            onChange={(v) => onUpdateCase(caseItem.id, { sobrestado: v })}
            activeColor="bg-amber-100 ring-1 ring-inset ring-amber-300"
            activeText="text-amber-700"
            label="Sobr."
            testId={`plain-sobrestado-${caseItem.id}`}
          />
          <RoteiroTogglePill
            checked={caseItem.preferenceType === "adiado"}
            onChange={(v) =>
              onUpdateCase(caseItem.id, { preferenceType: v ? "adiado" : null })
            }
            activeColor="bg-[#ffff77] ring-1 ring-inset ring-[#d9d95e]"
            activeText="text-[#6b6b14]"
            label="Adiado"
            testId={`plain-adiado-${caseItem.id}`}
          />
          <RoteiroTogglePill
            checked={caseItem.status === "withdrawn"}
            onChange={(v) =>
              onUpdateCase(caseItem.id, { status: v ? "withdrawn" : "pending" })
            }
            activeColor="bg-rose-100 ring-1 ring-inset ring-rose-300"
            activeText="text-rose-700"
            icon={Ban}
            label="Retirado"
            testId={`plain-retirado-${caseItem.id}`}
          />
          <RoteiroTogglePill
            checked={
              !!caseItem.preferenceType && caseItem.preferenceType !== "adiado"
            }
            onChange={(v) =>
              onUpdateCase(caseItem.id, { preferenceType: v ? "idoso" : null })
            }
            activeColor="bg-[#aeff77] ring-1 ring-inset ring-[#8dd95e]"
            activeText="text-[#3d6b14]"
            icon={Star}
            label="Pref."
            testId={`plain-preferencia-${caseItem.id}`}
          />
        </span>
      )}
      {!isLast && (
        <span className="text-slate-300 ml-0.5 print:text-gray-400">·</span>
      )}
    </div>
  );
}

function RoteiroTogglePill({
  checked,
  onChange,
  activeColor,
  activeText,
  inactiveColor,
  inactiveText,
  icon: Icon,
  label,
  activeLabel,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  activeColor: string;
  activeText: string;
  inactiveColor?: string;
  inactiveText?: string;
  icon?: any;
  label: string;
  activeLabel?: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1 text-[10px] leading-none px-2 py-[5px] rounded-md font-semibold transition-all duration-150 select-none cursor-pointer ${
        checked
          ? `${activeColor} ${activeText} shadow-sm`
          : `${inactiveColor || "bg-slate-50 hover:bg-slate-100"} ${inactiveText || "text-slate-500"} ring-1 ring-inset ring-slate-200`
      }`}
      data-testid={testId}
    >
      <span
        className={`w-3 h-3 rounded flex items-center justify-center shrink-0 ${
          checked ? "bg-white/25" : "border border-current/30"
        }`}
      >
        {checked && <Check className="w-2.5 h-2.5" />}
      </span>
      {Icon && <Icon className="w-3 h-3" />}
      {checked && activeLabel ? activeLabel : label}
    </button>
  );
}

function CaseActionBar({
  caseItem,
  onUpdate,
}: {
  caseItem: Case;
  onUpdate: (updates: Record<string, any>) => void;
}) {
  const { viewerMode } = useContext(DragContext);
  if (viewerMode) return null;

  return (
    <div
      className="px-4 py-2.5 border-t border-dashed border-slate-200 bg-slate-50/50 print:hidden"
      data-testid={`case-actions-${caseItem.id}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-400 font-medium">
          Resultado:
        </span>
        <select
          value={caseItem.result || ""}
          onChange={(e) => onUpdate({ result: e.target.value || null })}
          className={`text-[10px] leading-none h-[22px] px-1.5 rounded-md border cursor-pointer transition-colors font-medium ${
            caseItem.result
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold"
              : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
          }`}
          data-testid={`select-result-${caseItem.id}`}
        >
          <option value="">— sem resultado —</option>
          <option value="provimento">Provimento</option>
          <option value="improvimento">Improvimento</option>
          <option value="parcial_provimento">Parcial provimento</option>
          <option value="prejudicado">Prejudicado</option>
          <option value="nao_conhecido">Não conhecido</option>
        </select>

        <span className="text-[10px] text-slate-300 font-medium">|</span>

        <RoteiroTogglePill
          checked={caseItem.status === "postponed"}
          onChange={(v) => onUpdate({ status: v ? "postponed" : "pending" })}
          activeColor="bg-pink-100 ring-1 ring-inset ring-pink-300"
          activeText="text-pink-700"
          label="P/ próxima"
          testId={`action-postponed-${caseItem.id}`}
        />
        <RoteiroTogglePill
          checked={caseItem.sobrestado}
          onChange={(v) => onUpdate({ sobrestado: v })}
          activeColor="bg-amber-100 ring-1 ring-inset ring-amber-300"
          activeText="text-amber-700"
          label="Sobr."
          testId={`action-sobrestado-${caseItem.id}`}
        />
        <RoteiroTogglePill
          checked={caseItem.pedidoVista}
          onChange={(v) => onUpdate({ pedidoVista: v })}
          activeColor="bg-violet-100 ring-1 ring-inset ring-violet-300"
          activeText="text-violet-700"
          icon={Eye}
          label="Vista"
          testId={`action-vista-${caseItem.id}`}
        />
        <RoteiroTogglePill
          checked={caseItem.status === "withdrawn"}
          onChange={(v) => onUpdate({ status: v ? "withdrawn" : "pending" })}
          activeColor="bg-rose-100 ring-1 ring-inset ring-rose-300"
          activeText="text-rose-700"
          label="Retirado"
          testId={`action-retirado-${caseItem.id}`}
        />
      </div>
    </div>
  );
}

function CaseScript({
  caseItem,
  index,
  overrides,
  onSave,
  editMode,
  sessionDateFormatted,
  dropSlotProps,
  onUpdateCase,
  collapsible = false,
  onDelete,
  onDispensada,
}: {
  caseItem: Case;
  index: number;
  overrides: Overrides;
  onSave: (key: string, value: string | null) => void;
  editMode: boolean;
  sessionDateFormatted: string;
  dropSlotProps: (slotKey: string) => any;
  onUpdateCase: (caseId: string, updates: Record<string, any>) => void;
  collapsible?: boolean;
  onDelete?: () => void;
  onDispensada?: (c: Case) => void;
}) {
  const { viewerMode } = useContext(DragContext);
  const hasPref = !!caseItem.preferenceType;
  const hasOral = caseItem.hasOralArgument;
  const favorable = caseItem.oralArgumentFavorable;
  const caseKey = `case_${caseItem.id}`;

  const ep = (suffix: string, defaultText: string) => ({
    textKey: `${caseKey}_${suffix}`,
    defaultText,
    overrides,
    onSave,
    editMode,
  });

  return (
    <div
      data-testid={`roteiro-case-${caseItem.id}`}
      className="mb-8 print:mb-5"
    >
      {/* ── Case Card — identical to Home panel (screen only) ── */}
      <div className="print:hidden">
        <CaseCard
          caseItem={caseItem}
          index={index}
          onDelete={onDelete || (() => {})}
          onEdit={() => {}}
          onBatchUpdate={(updates) =>
            onUpdateCase(caseItem.id, updates as Record<string, any>)
          }
          viewOnly={viewerMode}
          onSustDispensada={() => onDispensada?.(caseItem)}
        />
      </div>

      {/* ── Print-only minimal case header ── */}
      <div className="hidden print:block rounded border border-gray-300 mb-2 p-3 bg-gray-50">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-black">{index}.</span>
          {caseItem.pjeOrder && (
            <span className="text-xs text-gray-600 font-mono">
              #{caseItem.pjeOrder}
            </span>
          )}
          <span
            className="font-mono font-bold text-black"
            data-testid={`roteiro-process-${caseItem.id}`}
          >
            {caseItem.processNumber}
          </span>
          {hasPref && (
            <span className="text-xs font-bold text-black border border-gray-400 px-1.5 py-0.5 rounded">
              {preferenceLabels[caseItem.preferenceType!] ||
                caseItem.preferenceType}
            </span>
          )}
          {caseItem.result && (
            <span className="text-xs font-bold text-black border border-gray-400 px-1.5 py-0.5 rounded">
              {caseItem.result.replace(/_/g, " ").toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-sm text-black mt-1.5">
          <strong>Partes:</strong> {caseItem.parties}
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-black mt-0.5">
          {caseItem.caseClass && (
            <span>
              <strong>Classe:</strong> {caseItem.caseClass}
            </span>
          )}
          <span>
            <strong>Relator(a):</strong> {caseItem.relator}
          </span>
          {hasOral && caseItem.oralArgumentRequester && (
            <span>
              <strong>Advogado(a):</strong> {caseItem.oralArgumentRequester}
            </span>
          )}
        </div>
      </div>

      {/* ── Session speech script ── */}
      <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden print:mt-1 print:border-gray-300 print:shadow-none print:rounded-none">
        <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between print:hidden">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Roteiro de Fala — Item {index}
          </span>
          <span className="font-mono text-[9px] text-slate-300">
            {caseItem.processNumber}
          </span>
        </div>
        <div className="px-4 pb-4 space-y-0 pt-1">
          {/* 1. ABERTURA DO ITEM */}
          <PresidentSpeech
            label="Presidente — 1. Abertura do Item"
            {...ep(
              "chamada",
              `Passamos ao item ${index}, ${caseItem.caseClass || "[classe processual]"} e número do processo ${caseItem.processNumber}, de relatoria do(a) ${caseItem.relator.toUpperCase()}, envolvendo ${caseItem.parties}.${hasOral ? ` Registrado para sustentação oral ${caseItem.oralArgumentType === "videoconferencia" ? "por videoconferência" : "presencial"} o(a) advogado(a) Dr(a). ${(caseItem.oralArgumentRequester || "[nome]").toUpperCase()}. Está presente?` : ""}`,
            )}
          />

          {/* 2. CONSULTA SOBRE O RELATÓRIO */}
          {hasOral && (
            <PresidentSpeech
              label="Presidente — 2. Consulta sobre o Relatório"
              {...ep(
                "consulta_relatorio",
                `V. Sa. ${(caseItem.oralArgumentRequester || "[advogado(a)]").toUpperCase()}, dispensa a leitura do relatório?`,
              )}
            />
          )}

          {!hasOral && (
            <ParticipantSpeech role="Relator(a)">
              [Leitura do relatório]
            </ParticipantSpeech>
          )}

          {/* 3. SUSTENTAÇÃO ORAL */}
          {hasOral && !favorable && (
            <>
              <PresidentSpeech
                label="Presidente — 3. Sustentação Oral"
                {...ep(
                  "sustentacao_oral",
                  `V. Sa. tem a palavra, pelo prazo regimental de 15 minutos.${caseItem.oralArgumentSide && caseItem.oralArgumentSide !== "MPF" ? ` Sustentação pelo(a) ${caseItem.oralArgumentSide}.` : ""}`,
                )}
              />

              <ParticipantSpeech
                role={
                  caseItem.oralArgumentSide === "MPF"
                    ? "Ministério Público Federal"
                    : `Advogado(a) — ${caseItem.oralArgumentSide || "Parte"}`
                }
              >
                [Sustentação oral —{" "}
                {caseItem.oralArgumentRequester || "Requerente"}]
              </ParticipantSpeech>

              {caseItem.hasOralArgument2 && caseItem.oralArgumentRequester2 && (
                <>
                  <PresidentSpeech
                    label="Presidente"
                    {...ep(
                      "sustentacao_oral_2",
                      `Faculto a palavra ${caseItem.oralArgumentSide2 === "MPF" ? "ao representante do Ministério Público Federal" : `ao(a) advogado(a) Dr(a). ${(caseItem.oralArgumentRequester2 || "").toUpperCase()}`} para sustentação oral, pelo prazo regimental de 15 minutos.${caseItem.oralArgumentSide2 && caseItem.oralArgumentSide2 !== "MPF" ? ` Sustentação pelo(a) ${caseItem.oralArgumentSide2}.` : ""}`,
                    )}
                  />

                  <ParticipantSpeech
                    role={
                      caseItem.oralArgumentSide2 === "MPF"
                        ? "Ministério Público Federal"
                        : `Advogado(a) — ${caseItem.oralArgumentSide2 || "Parte"}`
                    }
                  >
                    [2ª Sustentação oral — {caseItem.oralArgumentRequester2}]
                  </ParticipantSpeech>
                </>
              )}
            </>
          )}

          {hasOral && favorable && (
            <>
              <PresidentSpeech
                label="Presidente — 3. Resultado Favorável"
                {...ep(
                  "resultado_favoravel",
                  `Havendo indicação de julgamento favorável, consulto ${(caseItem.oralArgumentRequester || "o(a) advogado(a)").toUpperCase()} sobre a conversão em preferência.`,
                )}
              />

              <InstructionEditable
                {...ep(
                  "resultado_favoravel_instrucao",
                  "[Se o advogado concorda: 'Convertido em preferência. Passo à proclamação do resultado.' Se mantiver a sustentação, conceder 15 minutos regimentais.]",
                )}
              />

              {/* Slot gerado automaticamente quando sustentação é marcada como dispensada no CaseCard */}
              <DropSlot {...dropSlotProps(`case_${caseItem.id}_dispensada`)} />
            </>
          )}

          {/* 4. VOTO DO RELATOR */}
          <PresidentSpeech
            label="Presidente — 4. Voto do Relator"
            {...ep(
              "para_voto",
              `Passo a palavra ao(à) relator(a), ${caseItem.relator.toUpperCase()}, para leitura de seu voto.`,
            )}
          />

          <EditableParticipantSpeech
            role="Relator(a)"
            {...ep("voto_relator", "[Voto do(a) Relator(a)]")}
          />

          {/* 5. VOTOS DOS DEMAIS JULGADORES */}
          <PresidentSpeech
            label="Presidente — 5. Votos dos Demais Julgadores"
            {...ep(
              "colher_votos",
              `Agradeço ao(à) relator(a), ${caseItem.relator.toUpperCase()}. Declaro meu voto, acompanhando o relator.\nComo vota o(a) ${(overrides.composicao_desembargadores || "[julgador 2]").toUpperCase()}?\nComo vota o(a) ${(overrides.composicao_convocados || "[julgador 3]").toUpperCase()}?`,
            )}
          />

          <EditableParticipantSpeech
            role="Demais Julgadores"
            {...ep("votos_demais", "[Votos dos demais membros da Turma]")}
          />

          <EditableParticipantSpeech
            role="Representante do MPF"
            {...ep("parecer_mpf", "[Parecer do MPF, se houver]")}
          />

          <DropSlot {...dropSlotProps(`case_${caseItem.id}_before_result`)} />

          {/* 6. RESULTADO */}
          <PresidentSpeech
            label="Presidente — 6. Resultado"
            {...ep(
              "proclamacao",
              `Assim, proclamo o resultado: A Turma Regional de Mato Grosso do Sul, por unanimidade, ${getResultDecisionText(caseItem)}, nos termos do voto do(a) relator(a).`,
            )}
          />
        </div>
      </div>
    </div>
  );
}
