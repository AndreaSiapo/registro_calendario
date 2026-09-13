import { useMemo, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Globe,
  Lightbulb,
  Target,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CAPACITACIONES: Record<string, string> = {
  ventas: "Módulo de Ventas",
  gastos: "Módulo de Administración y Gestión de Gastos",
  abastecimientos: "Abastecimientos, Inventarios y Compras",
};

const DEFAULT_CAPACITACION = "Demo";

const TIME_SLOTS = ["10:00 AM", "02:30 PM"];

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatFecha(date: Date) {
  return `${DIAS_SEMANA[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]} de ${date.getFullYear()}`;
}

/** Convierte "10:00 AM" a horas/minutos 24h */
function parseSlot(slot: string) {
  const [time = "10:00", meridiem = "AM"] = slot.split(" ");
  const parts = time.split(":").map(Number);
  let h = parts[0] ?? 10;
  const m = parts[1] ?? 0;
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return { h, m };
}

function toGoogleCalendarUrl(opts: {
  title: string;
  date: Date;
  slot: string;
  details: string;
}) {
  const { h, m } = parseSlot(opts.slot);
  // America/Lima = UTC-5, sin horario de verano
  const start = new Date(
    Date.UTC(opts.date.getFullYear(), opts.date.getMonth(), opts.date.getDate(), h + 5, m),
  );
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: opts.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function toOutlookCalendarUrl(opts: {
  title: string;
  date: Date;
  slot: string;
  details: string;
}) {
  const { h, m } = parseSlot(opts.slot);
  const start = new Date(
    Date.UTC(opts.date.getFullYear(), opts.date.getMonth(), opts.date.getDate(), h + 5, m),
  );
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: opts.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: opts.details,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { capacitacion: string | undefined } => ({
    capacitacion:
      typeof search["capacitacion"] === "string"
        ? search["capacitacion"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agenda una capacitación — Casamarket" },
      {
        name: "description",
        content:
          "Agenda una capacitación personalizada de 2 horas con un especialista de Casamarket. Demostración en vivo del sistema y consejos de implementación.",
      },
      { property: "og:title", content: "Agenda una capacitación — Casamarket" },
      {
        property: "og:description",
        content:
          "Reserva tu capacitación de 2 horas con un especialista de producto de Casamarket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendamientoPage,
});

type FormData = {
  nombre: string;
  documento: string;
  correo: string;
  telefono: string;
  empresa: string;
  tamano: string;
};

const EMPTY_FORM: FormData = {
  nombre: "",
  documento: "",
  correo: "",
  telefono: "",
  empresa: "",
  tamano: "",
};

function AgendamientoPage() {
  const { capacitacion } = useSearch({ from: "/" });
  const productoNombre =
    (capacitacion && CAPACITACIONES[capacitacion.toLowerCase()]) ||
    DEFAULT_CAPACITACION;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );

  // Días disponibles simulados: todo día futuro excepto domingos;
  // algunos sábados "llenos" para dar variedad al mock.
  const disabledDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [
      { before: today },
      { dayOfWeek: [0] }, // domingos
    ];
  }, []);

  const isDayAvailable = (date: Date) => {
    // Mock: sábados alternos sin disponibilidad
    if (date.getDay() === 6 && date.getDate() % 2 === 0) return false;
    return true;
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (!date || !isDayAvailable(date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormData, string>> = {};
    if (!form.nombre.trim()) next.nombre = "Ingresa tu nombre y apellidos";
    if (!form.documento.trim()) next.documento = "Ingresa tu RUC o DNI";
    else if (!/^\d{8,11}$/.test(form.documento.trim()))
      next.documento = "Debe tener entre 8 y 11 dígitos";
    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim()))
      next.correo = "Ingresa un correo válido";
    if (!form.telefono.trim()) next.telefono = "Ingresa tu teléfono";
    else if (!/^\+?\d{6,15}$/.test(form.telefono.replace(/[\s-]/g, "")))
      next.telefono = "Ingresa un número válido con prefijo (ej. +51...)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) setStep(3);
  };

  const calendarTitle = `Capacitación Casamarket: ${productoNombre}`;
  const calendarDetails = `Capacitación personalizada (${productoNombre}) para ${form.empresa || form.nombre}. Duración: 2 horas.`;

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold text-brand-foreground">
              C
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Casamarket
            </span>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> 2 horas
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          {/* Panel informativo */}
          <div className="space-y-8">
            <div className="space-y-3">
              <Badge className="bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/10 border-0">
                Demostración seleccionada: {productoNombre}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Agenda una capacitación
                {capacitacion ? ` de ${productoNombre}` : ""}
              </h1>
              <p className="text-muted-foreground">
                2 Horas • Con un especialista de producto
              </p>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10">
                  <Target className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="font-medium">Recorrido grupal</p>
                  <p className="text-sm text-muted-foreground">
                    Sesión guiada para tu equipo, enfocada en tu tipo de
                    negocio.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10">
                  <Zap className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="font-medium">Demostración en vivo</p>
                  <p className="text-sm text-muted-foreground">
                    Verás el sistema funcionando en tiempo real, con casos
                    reales.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10">
                  <Lightbulb className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="font-medium">Consejos de implementación</p>
                  <p className="text-sm text-muted-foreground">
                    Recomendaciones prácticas de implementación e integración.
                  </p>
                </div>
              </li>
            </ul>

            <Card className="border-brand/20 bg-brand/5">
              <CardContent className="flex items-center gap-3 p-4">
                <Globe className="h-5 w-5 shrink-0 text-brand" />
                <p className="text-sm text-muted-foreground">
                  Zona horaria:{" "}
                  <span className="font-medium text-foreground">
                    GMT-5 / America/Lima
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Módulo de agendamiento */}
          <Card className="h-fit shadow-lg">
            <CardContent className="p-6">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <CalendarDays className="h-5 w-5 text-brand" />
                      Selecciona fecha y hora
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Elige un día disponible y luego un horario.
                    </p>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleSelectDate}
                      disabled={disabledDays}
                      modifiers={{ unavailable: (d) => !isDayAvailable(d) }}
                      modifiersClassNames={{
                        unavailable: "opacity-40 pointer-events-none",
                      }}
                      className="rounded-md border p-3 pointer-events-auto"
                    />

                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        {selectedDate
                          ? `Horarios para el ${formatFecha(selectedDate)}`
                          : "Selecciona un día para ver horarios"}
                      </p>
                      {selectedDate && (
                        <div className="grid gap-2">
                          {TIME_SLOTS.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={cn(
                                "rounded-md border px-4 py-2.5 text-sm font-medium transition-colors",
                                selectedSlot === slot
                                  ? "border-brand bg-brand text-brand-foreground"
                                  : "hover:border-brand hover:text-brand",
                              )}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" /> GMT-5 / America/Lima
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                    disabled={!selectedDate || !selectedSlot}
                    onClick={() => setStep(2)}
                  >
                    Continuar
                  </Button>
                </div>
              )}

              {step === 2 && selectedDate && selectedSlot && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-accent"
                      aria-label="Volver"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div>
                      <h2 className="text-lg font-semibold">Tus datos</h2>
                      <p className="text-sm text-muted-foreground">
                        {formatFecha(selectedDate)} • {selectedSlot}
                      </p>
                    </div>
                  </div>

                  {/* Campo capturado desde la URL */}
                  <input
                    type="hidden"
                    name="capacitacion"
                    value={capacitacion ?? "demo"}
                  />

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="nombre">
                        Nombre y Apellidos <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="nombre"
                        value={form.nombre}
                        onChange={(e) =>
                          setForm({ ...form, nombre: e.target.value })
                        }
                        placeholder="Ej. María Quispe Ramos"
                        maxLength={100}
                      />
                      {errors.nombre && (
                        <p className="text-xs text-destructive">
                          {errors.nombre}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="documento">
                        RUC / DNI <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="documento"
                        inputMode="numeric"
                        value={form.documento}
                        onChange={(e) =>
                          setForm({ ...form, documento: e.target.value })
                        }
                        placeholder="Ej. 10456789012"
                        maxLength={11}
                      />
                      {errors.documento && (
                        <p className="text-xs text-destructive">
                          {errors.documento}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="correo">Correo</Label>
                      <Input
                        id="correo"
                        type="email"
                        value={form.correo}
                        onChange={(e) =>
                          setForm({ ...form, correo: e.target.value })
                        }
                        placeholder="tunombre@empresa.com"
                        maxLength={255}
                      />
                      {errors.correo && (
                        <p className="text-xs text-destructive">
                          {errors.correo}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="telefono">
                        Teléfono / WhatsApp{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="telefono"
                        type="tel"
                        value={form.telefono}
                        onChange={(e) =>
                          setForm({ ...form, telefono: e.target.value })
                        }
                        placeholder="+51 999 888 777"
                        maxLength={20}
                      />
                      {errors.telefono && (
                        <p className="text-xs text-destructive">
                          {errors.telefono}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="empresa">
                        Nombre de la Empresa / Negocio
                      </Label>
                      <Input
                        id="empresa"
                        value={form.empresa}
                        onChange={(e) =>
                          setForm({ ...form, empresa: e.target.value })
                        }
                        placeholder="Ej. Bodega Los Andes"
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Tamaño de la empresa</Label>
                      <Select
                        value={form.tamano}
                        onValueChange={(v) => setForm({ ...form, tamano: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-5">1-5 personas</SelectItem>
                          <SelectItem value="6-20">6-20 personas</SelectItem>
                          <SelectItem value="20+">20+ personas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    Confirmar agendamiento
                  </Button>
                </form>
              )}

              {step === 3 && selectedDate && selectedSlot && (
                <div className="space-y-6 py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-9 w-9 text-success" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      ¡Tu reunión ha sido agendada con éxito!
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Te esperamos en la fecha y hora seleccionadas.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-left text-sm">
                    <p>
                      <span className="font-medium">Fecha:</span>{" "}
                      {formatFecha(selectedDate)}
                    </p>
                    <p>
                      <span className="font-medium">Hora:</span> {selectedSlot}{" "}
                      (GMT-5 / America/Lima)
                    </p>
                    <p>
                      <span className="font-medium">Capacitación:</span>{" "}
                      {productoNombre}
                    </p>
                    <p>
                      <span className="font-medium">Duración:</span> 2 horas
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="outline" asChild>
                      <a
                        href={toGoogleCalendarUrl({
                          title: calendarTitle,
                          date: selectedDate,
                          slot: selectedSlot,
                          details: calendarDetails,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Google Calendar
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a
                        href={toOutlookCalendarUrl({
                          title: calendarTitle,
                          date: selectedDate,
                          slot: selectedSlot,
                          details: calendarDetails,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Outlook
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
