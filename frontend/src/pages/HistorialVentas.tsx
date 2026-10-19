import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LockKeyhole, Plus, Printer, ReceiptText, RefreshCw, Send, Trash2, TriangleAlert, X } from "lucide-react";
import { CashClosing, CashExpense, DailySalesSummary, Sale } from "../types";
import { getCurrentUser } from "../services/auth";
import { approveSaleVoidRequest, closeCashRegister, createCashExpense, deleteCashExpense, fetchDailySalesSummary, requestSaleVoid, updateSalePaymentMethod, deleteSale } from "../services/sales";
import { addCreditPayment } from "../services/customers";
import { getErrorMessage } from "../utils/errors";
import { buildThermalCashClosingHtml, buildThermalReceiptHtml } from "../utils/thermalReceipt";
import { HistorySummaryStrip } from "../components/history/HistorySummaryStrip";
import { SalesHistoryTable } from "../components/history/SalesHistoryTable";
import { moneyInputPattern, parseMoneyInput, validateCashReconciliation } from "../components/history/cashReconciliation";

const money = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });

const formatDateOnly = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" }) : "-";

const formatInputDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const defaultDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const productConditionLabel = (condition?: string | null) => condition === "USADO" ? "Usado" : "Nuevo";
const productConditionClass = (condition?: string | null) =>
  condition === "USADO"
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : "border-green-500/40 bg-green-500/10 text-green-200";
type ExpenseMethod = "EFECTIVO" | "QR";
const expenseMethods: ExpenseMethod[] = ["EFECTIVO", "QR"];
const shiftInputDate = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

export default function HistorialVentas() {
  const user = getCurrentUser();
  const [searchParams] = useSearchParams();
  const pendingDate = searchParams.get("fecha");
  const requestedSaleId = searchParams.get("venta");
  const requestedBranchId = searchParams.get("sucursal");
  const [reportDate, setReportDate] = useState(pendingDate || defaultDay);
  const [summary, setSummary] = useState<DailySalesSummary | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [declaredCashInput, setDeclaredCashInput] = useState("");
  const [verifiedQrInput, setVerifiedQrInput] = useState("");
  const [reconciliationConfirmed, setReconciliationConfirmed] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [depositToBank, setDepositToBank] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseMethod, setExpenseMethod] = useState<ExpenseMethod>("EFECTIVO");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "QR">("EFECTIVO");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingCash, setClosingCash] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [voidingExpenseId, setVoidingExpenseId] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDailySalesSummary(
        reportDate,
        user?.role === "ADMIN" ? requestedBranchId || undefined : undefined,
      );
      setSummary(data);
      setDeclaredCashInput(data.cerrado && data.cierre ? String(data.cierre.montoDeclarado) : "");
      setVerifiedQrInput(data.cerrado && data.cierre ? String(data.cierre.netoQr) : "");
      setReconciliationConfirmed(Boolean(data.cerrado));
      setCloseNotes(data.cierre?.notas || "");
      setDepositToBank(Boolean(data.cierre?.depositadoBanco));
      setDepositAmount(data.cierre?.montoDepositado != null ? String(data.cierre.montoDepositado) : "");
      setDepositReference(data.cierre?.referenciaDeposito || "");
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [reportDate, requestedBranchId, user?.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  useEffect(() => {
    if (!pendingDate || pendingDate === reportDate) return;
    const updateDate = window.setTimeout(() => setReportDate(pendingDate), 0);
    return () => window.clearTimeout(updateDate);
  }, [pendingDate, reportDate]);

  useEffect(() => {
    if (!requestedSaleId || !summary) return;
    const requestedSale = summary.ventas.find((sale) => sale.id === requestedSaleId);
    if (!requestedSale) return;
    const openSale = window.setTimeout(() => setSelectedSale(requestedSale), 0);
    return () => window.clearTimeout(openSale);
  }, [requestedSaleId, summary]);

  const handleCloseCash = async () => {
    setMessage(null);
    if (!summary) return setMessage("No se pudo preparar el cierre para impresión.");

    const reconciliation = validateCashReconciliation({
      expectedCash,
      expectedQr,
      countedCash: declaredCashInput,
      verifiedQr: verifiedQrInput,
      confirmed: reconciliationConfirmed,
      notes: closeNotes,
    });
    if (!reconciliation.canSubmit || reconciliation.countedCash === null) {
      return setMessage(reconciliation.errors[0] || "Completa la verificación de caja.");
    }

    const parsedDeposit = parseMoneyInput(depositAmount);
    if (depositToBank && (parsedDeposit === null || parsedDeposit <= 0)) {
      return setMessage("Indica el monto que se depositó al banco.");
    }
    if (depositToBank && parsedDeposit !== null && parsedDeposit > reconciliation.countedCash) {
      return setMessage("El monto depositado no puede ser mayor al efectivo contado.");
    }
    if (depositToBank && !depositReference.trim()) {
      return setMessage("Ingresa la referencia o número del comprobante del depósito.");
    }

    const declaredCash = reconciliation.countedCash;

    // Se abre durante el clic para evitar que el navegador bloquee la impresión
    // después de esperar la respuesta del servidor.
    const printWindow = window.open("", "_blank", "width=360,height=720");
    if (!printWindow) {
      return setMessage("Habilita las ventanas emergentes para enviar e imprimir el cierre.");
    }

    setClosingCash(true);
    try {
      const closing = await closeCashRegister({
        fecha: reportDate,
        montoDeclarado: declaredCash,
        notas: closeNotes || null,
        depositadoBanco: depositToBank,
        montoDepositado: depositToBank ? parsedDeposit : null,
        referenciaDeposito: depositToBank ? depositReference.trim() || null : null,
      });
      const printableSummary: DailySalesSummary = {
        ...summary,
        cerrado: true,
        estadoCaja: closing.estado,
        cierre: closing,
      };
      let printPrepared = false;
      if (!printWindow.closed) {
        try {
          printWindow.document.open();
          printWindow.document.write(buildThermalCashClosingHtml(printableSummary, user?.nombre || "", {
            declaredCash,
            notes: closeNotes || null,
          }));
          printWindow.document.close();
          printPrepared = true;
        } catch {
          // El cierre ya fue guardado; el vendedor puede usar el boton de reimpresion.
        }
      }
      setMessage(printPrepared
        ? `Cierre enviado a revisión e impresión de la versión ${closing.version || 1} preparada. Diferencia: ${money(closing.diferencia)}.`
        : `Cierre enviado a revisión. No se abrió la impresión; usa "Reimprimir comprobante pendiente" para imprimir la versión ${closing.version || 1}.`);
      await loadSummary();
    } catch (err: unknown) {
      printWindow.close();
      setMessage(getErrorMessage(err));
    } finally {
      setClosingCash(false);
    }
  };

  const handleAddExpense = async () => {
    setMessage(null);
    const motivo = expenseReason.trim();
    const monto = parseMoneyInput(expenseAmount);
    if (!motivo) return setMessage("Indica para que se saco dinero.");
    if (monto === null || monto <= 0) return setMessage("Ingresa un monto de gasto mayor a cero.");
    if (reportDate !== defaultDay && summary?.estadoCaja !== "OBSERVADO") {
      return setMessage("Para agregar un gasto histórico, el administrador debe reabrir primero ese cierre.");
    }
    if (summary?.cerrado) return setMessage("La caja de este dia ya fue cerrada.");

    setSavingExpense(true);
    try {
      await createCashExpense({
        fecha: reportDate,
        motivo,
        monto,
        metodoPago: expenseMethod,
        notas: expenseNotes.trim() || null,
      });
      setExpenseReason("");
      setExpenseAmount("");
      setExpenseMethod("EFECTIVO");
      setExpenseNotes("");
      setMessage(reportDate === defaultDay ? "Gasto registrado correctamente." : `Gasto agregado a la caja del ${reportDate}.`);
      await loadSummary();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingExpense(false);
    }
  };

  const handleVoidExpense = async (expense: CashExpense) => {
    setMessage(null);
    if (summary?.cerrado) return setMessage("La caja de este dia ya fue cerrada.");

    const confirmed = window.confirm(`Seguro que deseas anular el gasto "${expense.motivo}" por ${money(expense.monto)}?`);
    if (!confirmed) return;

    setVoidingExpenseId(expense.id);
    try {
      await deleteCashExpense(expense.id);
      setMessage("Gasto anulado correctamente.");
      await loadSummary();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setVoidingExpenseId(null);
    }
  };

  const fillBankDepositNote = () => {
    const amount = money(expectedCash);
    setDepositToBank(true);
    setDepositAmount(String(expectedCash));
    setCloseNotes(`Efectivo neto del dia (${amount}) entregado para deposito al banco. Ya no queda efectivo de ventas en caja.`);
  };

  const printCashClosing = () => {
    if (!summary) return;
    if (!summary.cierre || summary.cierre.estado === "OBSERVADO") {
      return setMessage("El cierre observado debe corregirse y reenviarse antes de imprimir una nueva versión.");
    }
    const printWindow = window.open("", "_blank", "width=360,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    printWindow.document.write(buildThermalCashClosingHtml(summary, user?.nombre || "", {
      declaredCash: parseMoneyInput(declaredCashInput) ?? summary.cierre?.montoDeclarado ?? 0,
      notes: closeNotes || null,
    }));
    printWindow.document.close();
  };

  const printSale = (sale: Sale) => {
    const printWindow = window.open("", "_blank", "width=360,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    printWindow.document.write(buildThermalReceiptHtml(sale, user?.nombre || ""));
    printWindow.document.close();
  };

  const openCreditPayment = (sale: Sale) => {
    setMessage(null);
    setPaymentSale(sale);
    setPaymentAmount(String(sale.cuenta?.saldo || sale.total || 0));
    setPaymentMethod("EFECTIVO");
    setPaymentNotes("");
  };

  const handleCreditPayment = async () => {
    setMessage(null);
    if (!user?.id) return setMessage("Debes iniciar sesion nuevamente.");
    if (!paymentSale?.cuenta) return setMessage("Esta venta no tiene cuenta de credito.");
    const monto = parseMoneyInput(paymentAmount);
    if (monto === null || monto <= 0) return setMessage("Ingresa un monto de pago mayor a cero.");

    setSavingPayment(true);
    try {
      const cuenta = await addCreditPayment(paymentSale.cuenta.id, {
        monto,
        metodoPago: paymentMethod,
        usuarioId: user.id,
        notas: paymentNotes.trim() || null,
      });
      const updateSaleAccount = (sale: Sale) => sale.id === paymentSale.id ? { ...sale, cuenta } : sale;
      setSelectedSale((sale) => sale ? updateSaleAccount(sale) : sale);
      setPaymentSale(null);
      setPaymentAmount("");
      setPaymentNotes("");
      setMessage(cuenta.saldo === 0 ? "Credito pagado completamente." : `Pago registrado. Saldo pendiente: ${money(cuenta.saldo)}.`);
      await loadSummary();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleVoidSale = async (sale: Sale, motivo: string) => {
    try {
      const pendingRequest = sale.solicitudAnulacion?.estado === "PENDIENTE" ? sale.solicitudAnulacion : null;
      if (user?.role === "ADMIN" && pendingRequest) {
        await approveSaleVoidRequest(pendingRequest.id);
        setSelectedSale(null);
        setMessage("Solicitud aprobada. Venta anulada correctamente y stock devuelto al inventario.");
      } else if (user?.role === "SELLER") {
        await requestSaleVoid(sale.id, motivo);
        setSelectedSale(null);
        setMessage("Solicitud enviada al administrador. La venta se anulara cuando sea aprobada.");
      } else {
        await deleteSale(sale.id, motivo);
        setSelectedSale(null);
        setMessage("Venta anulada correctamente. Los productos han sido devueltos al inventario.");
      }
      await loadSummary();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  };

  const grossCash = summary?.totals.totalEfectivo || 0;
  const grossQr = summary?.totals.totalQr || 0;
  const creditPaymentTotals = summary?.cobrosCredito?.totals || { totalCobrosCredito: 0, totalEfectivo: 0, totalTransferencia: 0, totalQr: 0, totalTarjeta: 0 };
  const expenseTotals = summary?.gastos?.totals || { totalGastos: 0, totalEfectivo: 0, totalQr: 0 };
  const expectedCash = summary?.netos?.totalEfectivo ?? Math.max(grossCash + creditPaymentTotals.totalEfectivo - expenseTotals.totalEfectivo, 0);
  const expectedQr = summary?.netos?.totalQr ?? Math.max(grossQr + creditPaymentTotals.totalQr - expenseTotals.totalQr, 0);
  const reconciliation = validateCashReconciliation({
    expectedCash,
    expectedQr,
    countedCash: declaredCashInput,
    verifiedQr: verifiedQrInput,
    confirmed: reconciliationConfirmed,
    notes: closeNotes,
  });
  const difference = reconciliation.cashDifference;
  const pendingVoidRequests = (summary?.ventas || []).filter((sale) => sale.solicitudAnulacion?.estado === "PENDIENTE");
  const isHistoricalDay = reportDate !== defaultDay;
  const canEditExpenses = !summary?.cerrado && (!isHistoricalDay || summary?.estadoCaja === "OBSERVADO");

  if (loading) return <div className="p-6 text-white">Cargando historial...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
              <CalendarDays className="text-primary" /> Historial de ventas
            </h2>
            <p className="mt-1 text-sm text-gray-400">Revisa las ventas y realiza el cierre de caja.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportDate((current) => shiftInputDate(current, -1))}
              className="btn-secondary flex h-11 w-11 items-center justify-center px-0"
              aria-label="Ver día anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <input
              type="date"
              value={reportDate}
              max={defaultDay}
              onChange={(event) => setReportDate(event.target.value)}
              className="premium-input h-11 min-w-40"
            />
            <button
              type="button"
              onClick={() => setReportDate((current) => shiftInputDate(current, 1))}
              disabled={reportDate >= defaultDay}
              className="btn-secondary flex h-11 w-11 items-center justify-center px-0 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Ver día siguiente"
            >
              <ChevronRight size={20} />
            </button>
            <button type="button" onClick={() => setReportDate(defaultDay)} disabled={reportDate === defaultDay} className="btn-secondary h-11 disabled:opacity-50">
              Hoy
            </button>
            <button type="button" onClick={loadSummary} disabled={loading} className="btn-secondary flex h-11 w-11 items-center justify-center px-0 disabled:opacity-60" aria-label="Actualizar información">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
      </div>

      {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}

      {summary?.estadoCaja === "OBSERVADO" && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-100 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <TriangleAlert className="mt-0.5 shrink-0 text-amber-300" size={22} />
            <div>
              <p className="font-bold text-white">Caja observada: requiere corrección</p>
              <p className="text-sm text-amber-100/90">
                {summary.cierre?.motivoObservacion || "Verifica las ventas y gastos antes de reenviar el cierre."}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-200">
            Requiere corrección
          </span>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-700 bg-grafito-800/80 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-white">Movimientos del {formatInputDate(reportDate)}</h3>
            <p className="text-sm text-gray-400">
              {summary?.totals.cantidadVentas || 0} ventas registradas
            </p>
          </div>
          {summary?.cierre && (
            <span className={`rounded-lg border px-3 py-2 text-sm font-semibold ${summary.cierre.estado === "APROBADO" ? "border-green-500/30 bg-green-500/10 text-green-200" : summary.cierre.estado === "OBSERVADO" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-blue-500/30 bg-blue-500/10 text-blue-200"}`}>
              Caja {summary.cierre.estado.toLowerCase()}
            </span>
          )}
        </div>

        <HistorySummaryStrip items={[
          { label: "Total vendido", value: money(summary?.totals.totalVentas || 0) },
          { label: "Efectivo", value: money(grossCash), tone: "success" },
          { label: "QR", value: money(grossQr), tone: "info" },
          { label: "Gastos", value: money(expenseTotals.totalGastos), tone: "warning" },
          { label: "Efectivo neto", value: money(expectedCash), tone: "success" },
        ]} />
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-800 bg-[#101214] px-4 py-2.5 text-xs text-gray-500">
          <span>Transferencia <strong className="ml-1 text-gray-300">{money(summary?.totals.totalTransferencia || 0)}</strong></span>
          <span>Tarjeta <strong className="ml-1 text-gray-300">{money(summary?.totals.totalTarjeta || 0)}</strong></span>
          <span>Crédito <strong className="ml-1 text-gray-300">{money(summary?.totals.totalCredito || 0)}</strong></span>
          <span>Cobros de crédito <strong className="ml-1 text-gray-300">{money(creditPaymentTotals.totalCobrosCredito)}</strong></span>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            {user?.role === "ADMIN" && pendingVoidRequests.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-semibold text-white">
                    <Clock3 size={18} className="text-amber-300" /> Solicitudes de anulacion pendientes
                  </p>
                  <span className="rounded-lg bg-amber-400/15 px-2 py-1 text-xs font-bold text-amber-100">
                    {pendingVoidRequests.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingVoidRequests.map((sale) => (
                    <button
                      key={sale.id}
                      type="button"
                      onClick={() => setSelectedSale(sale)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-grafito-900/60 px-3 py-2 text-left transition hover:border-amber-400/50"
                    >
                      <span>
                        <span className="block font-semibold text-white">{sale.cliente?.nombre || "Cliente ocasional"} - {money(sale.total)}</span>
                        <span className="block text-xs text-amber-100/80">{sale.solicitudAnulacion?.motivo}</span>
                      </span>
                      <span className="text-xs font-semibold text-amber-200">Revisar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <SalesHistoryTable sales={summary?.ventas || []} money={money} onSelect={setSelectedSale} />

            <div className="rounded-xl border border-gray-800 bg-grafito-900/40 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <ReceiptText size={18} className="text-amber-300" /> Gastos del {formatInputDate(reportDate)}
                </h4>
                <span className="text-sm font-semibold text-amber-200">{money(expenseTotals.totalGastos)}</span>
              </div>
              {isHistoricalDay && summary?.estadoCaja === "OBSERVADO" && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">
                  Los gastos que añadas aquí se guardarán en la caja del {formatInputDate(reportDate)}, no en la caja de hoy.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-[1fr_150px_180px]">
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(event) => setExpenseReason(event.target.value)}
                  disabled={!canEditExpenses}
                  placeholder="Para que se saco dinero..."
                  className="premium-input"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (moneyInputPattern.test(value)) setExpenseAmount(value);
                  }}
                  disabled={!canEditExpenses}
                  placeholder="Cuanto gasto"
                  aria-label="Cuanto gasto"
                  className="premium-input"
                />
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Origen del gasto">
                  {expenseMethods.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setExpenseMethod(method)}
                      disabled={!canEditExpenses}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                        expenseMethod === method
                          ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                          : "border-gray-700 bg-grafito-800 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {method === "EFECTIVO" ? "Efectivo" : "QR"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(event) => setExpenseNotes(event.target.value)}
                  disabled={!canEditExpenses}
                  placeholder="Nota opcional"
                  className="premium-input"
                />
                <button
                  onClick={handleAddExpense}
                  disabled={savingExpense || !canEditExpenses}
                  className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Plus size={18} /> {savingExpense ? "Guardando..." : `Añadir gasto al ${formatInputDate(reportDate)}`}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-gray-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-grafito-900 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Hora</th>
                      <th className="p-3">Motivo</th>
                      <th className="p-3">Origen</th>
                      <th className="p-3 text-right">Monto</th>
                      <th className="p-3 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(summary?.gastos?.items || []).map((expense) => (
                      <tr key={expense.id}>
                        <td className="p-3 text-gray-400">{formatDateTime(expense.createdAt)}</td>
                        <td className="p-3 text-white">
                          <p className="font-semibold">{expense.motivo}</p>
                          {expense.notas && <p className="text-xs text-gray-500">{expense.notas}</p>}
                        </td>
                        <td className="p-3 text-gray-300">{expense.metodoPago}</td>
                        <td className="p-3 text-right font-bold text-amber-200">{money(expense.monto)}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleVoidExpense(expense)}
                            disabled={summary?.cerrado || voidingExpenseId === expense.id}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            title={summary?.cerrado ? "La caja ya esta cerrada" : "Anular gasto"}
                            aria-label={`Anular gasto ${expense.motivo}`}
                          >
                            <Trash2 size={14} />
                            {voidingExpenseId === expense.id ? "Anulando..." : "Anular"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(summary?.gastos?.items || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">Sin gastos registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-4 self-start rounded-xl border border-gray-800 bg-grafito-900/40 p-4 xl:sticky xl:top-4">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-bold text-white">
                <Banknote size={20} className="text-primary" /> {summary?.estadoCaja === "OBSERVADO" ? "Corregir cierre de caja" : "Cierre de caja"}
              </h4>
              <p className="mt-1 text-xs text-gray-500">Cuenta el efectivo y comprueba los pagos QR antes de enviar.</p>
            </div>

            {!summary?.cerrado && (
              <>
                <div className="grid grid-cols-3 gap-2 border-b border-gray-800 pb-4 text-center text-[11px] font-semibold">
                  <div className="text-green-300"><span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-500/15">✓</span>Revisar</div>
                  <div className="text-primary-light"><span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">2</span>Contar</div>
                  <div className="text-gray-500"><span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800">3</span>Enviar</div>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-800 bg-[#111315] p-3 text-sm">
                  <div className="flex justify-between gap-3 text-gray-400"><span>Ventas en efectivo</span><strong className="text-white">{money(grossCash)}</strong></div>
                  <div className="flex justify-between gap-3 text-gray-400"><span>Cobros de crédito</span><strong className="text-green-200">+{money(creditPaymentTotals.totalEfectivo)}</strong></div>
                  <div className="flex justify-between gap-3 text-gray-400"><span>Gastos en efectivo</span><strong className="text-amber-200">-{money(expenseTotals.totalEfectivo)}</strong></div>
                  <div className="flex justify-between gap-3 border-t border-gray-700 pt-2 font-bold text-white"><span>Efectivo esperado</span><strong className="text-green-300">{money(expectedCash)}</strong></div>
                </div>

                <label className="block text-sm text-gray-200">
                  <span className="mb-1.5 block font-semibold">¿Cuánto dinero contaste físicamente?</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={declaredCashInput}
                    onChange={(event) => { if (moneyInputPattern.test(event.target.value)) setDeclaredCashInput(event.target.value); }}
                    className="premium-input h-12 text-lg font-bold"
                    placeholder="0,00"
                    aria-describedby="cash-reconciliation-status"
                  />
                </label>
                <ReconciliationStatus id="cash-reconciliation-status" kind="Efectivo" difference={difference} money={money} />

                <div className="space-y-2 rounded-lg border border-gray-800 bg-[#111315] p-3 text-sm">
                  <div className="flex justify-between gap-3 text-gray-400"><span>Ventas por QR</span><strong className="text-white">{money(grossQr)}</strong></div>
                  <div className="flex justify-between gap-3 text-gray-400"><span>Cobros de crédito</span><strong className="text-blue-200">+{money(creditPaymentTotals.totalQr)}</strong></div>
                  <div className="flex justify-between gap-3 text-gray-400"><span>Gastos por QR</span><strong className="text-amber-200">-{money(expenseTotals.totalQr)}</strong></div>
                  <div className="flex justify-between gap-3 border-t border-gray-700 pt-2 font-bold text-white"><span>QR esperado</span><strong className="text-blue-300">{money(expectedQr)}</strong></div>
                </div>

                <label className="block text-sm text-gray-200">
                  <span className="mb-1.5 block font-semibold">Monto verificado en la cuenta QR</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={verifiedQrInput}
                    onChange={(event) => { if (moneyInputPattern.test(event.target.value)) setVerifiedQrInput(event.target.value); }}
                    className="premium-input h-12 text-lg font-bold"
                    placeholder="0,00"
                    aria-describedby="qr-reconciliation-status"
                  />
                  <span className="mt-1.5 block text-xs text-gray-500">Comprueba los abonos en la aplicación o cuenta bancaria.</span>
                </label>
                <ReconciliationStatus id="qr-reconciliation-status" kind="QR" difference={reconciliation.qrDifference} money={money} />

                <label className="block text-sm text-gray-300">
                  <span className="mb-1 block font-semibold">Observaciones {reconciliation.hasDifference ? <span className="text-amber-300">(obligatorias por la diferencia)</span> : "(opcional)"}</span>
                  <textarea
                    value={closeNotes}
                    onChange={(event) => setCloseNotes(event.target.value)}
                    className="premium-input min-h-20"
                    maxLength={500}
                    placeholder={reconciliation.hasDifference ? "Explica el motivo del sobrante o faltante..." : "Agrega una nota si es necesario..."}
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-700 bg-[#111315] p-3 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={reconciliationConfirmed}
                    onChange={(event) => setReconciliationConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-orange-500"
                  />
                  <span>Confirmo que conté todo el efectivo y verifiqué los pagos QR.</span>
                </label>

                <div className="space-y-3 rounded-lg border border-gray-700 p-3">
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input type="checkbox" checked={depositToBank} onChange={(event) => {
                      setDepositToBank(event.target.checked);
                      if (event.target.checked && !depositAmount) setDepositAmount(String(expectedCash));
                    }} /> El efectivo fue depositado al banco
                  </label>
                  {depositToBank && <>
                    <label className="block text-sm text-gray-300"><span className="mb-1 block">Monto depositado</span><input className="premium-input" inputMode="decimal" value={depositAmount} onChange={(event) => { if (moneyInputPattern.test(event.target.value)) setDepositAmount(event.target.value); }} /></label>
                    <label className="block text-sm text-gray-300"><span className="mb-1 block">Referencia o comprobante</span><input className="premium-input" maxLength={120} value={depositReference} onChange={(event) => setDepositReference(event.target.value)} /></label>
                    <button type="button" onClick={fillBankDepositNote} className="btn-secondary w-full">Preparar depósito del efectivo esperado</button>
                  </>}
                </div>
              </>
            )}
            {summary?.cerrado ? (
              <>
                <ClosedCashBox closing={summary.cierre} />
                {summary.cierre && summary.cierre.estado !== "OBSERVADO" && <button
                  type="button"
                  onClick={printCashClosing}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Printer size={18} /> {summary.cierre.estado === "APROBADO"
                    ? `Imprimir cierre aprobado · versión ${summary.cierre.version || 1}`
                    : `Reimprimir comprobante pendiente · versión ${summary.cierre.version || 1}`}
                </button>}
                {summary.cierre?.estado === "PENDIENTE" && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
                    Conserva la impresión pendiente. Si el administrador devuelve este cierre, esta versión dejará de ser vigente y al reenviarlo se imprimirá una nueva.
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-2">
                <button
                  onClick={handleCloseCash}
                  disabled={closingCash || !reconciliation.canSubmit}
                  className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {summary?.estadoCaja === "OBSERVADO" ? <Send size={18} /> : <LockKeyhole size={18} />}
                  {closingCash ? "Enviando..." : summary?.estadoCaja === "OBSERVADO" ? "Reenviar cierre corregido" : "Enviar cierre a revisión"}
                </button>
                {!reconciliation.canSubmit && <p className="text-center text-xs text-gray-500">Completa la verificación para habilitar el envío.</p>}
                <p className="text-center text-xs text-gray-500">Se enviará al administrador para revisión.</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {selectedSale && (
        <SaleDetailModal 
          sale={selectedSale} 
          onClose={() => setSelectedSale(null)} 
          onPrint={() => printSale(selectedSale)} 
          onRegisterCreditPayment={openCreditPayment}
          onPaymentUpdated={(updatedSale) => {
            setSelectedSale(updatedSale);
            loadSummary();
          }} 
          onVoid={(motivo) => handleVoidSale(selectedSale, motivo)}
          isClosed={Boolean(summary?.cerrado)}
          userRole={user?.role}
        />
      )}
      {paymentSale && (
        <CreditPaymentModal
          sale={paymentSale}
          amount={paymentAmount}
          method={paymentMethod}
          notes={paymentNotes}
          saving={savingPayment}
          onAmountChange={setPaymentAmount}
          onMethodChange={setPaymentMethod}
          onNotesChange={setPaymentNotes}
          onClose={() => setPaymentSale(null)}
          onConfirm={handleCreditPayment}
        />
      )}
    </div>
  );
}

function ReconciliationStatus({
  id,
  kind,
  difference,
  money: formatMoney,
}: {
  id: string;
  kind: "Efectivo" | "QR";
  difference: number | null;
  money: (value: number) => string;
}) {
  if (difference === null) {
    return <div id={id} className="rounded-lg border border-gray-700 bg-gray-800/30 p-3 text-sm text-gray-400">Ingresa el monto que verificaste.</div>;
  }
  if (difference === 0) {
    return (
      <div id={id} className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm font-semibold text-green-200">
        <CheckCircle2 size={17} /> {kind} correcto. No existen sobrantes ni faltantes.
      </div>
    );
  }
  if (difference < 0) {
    return (
      <div id={id} className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-200">
        Faltan {formatMoney(Math.abs(difference))}. Vuelve a verificar y explica la diferencia si continúa.
      </div>
    );
  }
  return (
    <div id={id} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-semibold text-amber-200">
      Sobran {formatMoney(difference)}. Revisa las ventas y gastos antes de enviar.
    </div>
  );
}

function ClosedCashBox({ closing }: { closing?: CashClosing | null }) {
  const state = closing?.estado || "PENDIENTE";
  return (
    <div className={`space-y-1 rounded-lg border p-3 text-sm ${state === "APROBADO" ? "border-green-500/30 bg-green-500/10 text-green-200" : state === "OBSERVADO" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-blue-500/30 bg-blue-500/10 text-blue-200"}`}>
      <p className="font-bold">Estado: {state} · Versión {closing?.version || 1}</p>
      {closing?.id && <p className="font-mono text-xs">ID: {closing.id}</p>}
      <p>Declarado con {money(closing?.montoDeclarado || 0)} en caja.</p>
      <p>Cobros de credito {money(closing?.totalCobrosCredito || 0)}.</p>
      <p>Efectivo neto esperado {money(closing?.netoEfectivo ?? closing?.totalEfectivo ?? 0)}.</p>
      <p>Gastos descontados {money(closing?.totalGastos || 0)}. Diferencia {money(closing?.diferencia || 0)}.</p>
      {closing?.motivoObservacion && <p className="font-semibold text-amber-200">Observación: {closing.motivoObservacion}</p>}
      {closing?.notaAdministrador && <p>Administrador: {closing.notaAdministrador}</p>}
    </div>
  );
}

function SaleDetailModal({
  sale,
  onClose,
  onPrint,
  onRegisterCreditPayment,
  onPaymentUpdated,
  onVoid,
  isClosed,
  userRole,
}: {
  sale: Sale;
  onClose: () => void;
  onPrint: () => void;
  onRegisterCreditPayment: (sale: Sale) => void;
  onPaymentUpdated: (sale: Sale) => void;
  onVoid: (motivo: string) => Promise<void>;
  isClosed: boolean;
  userRole?: string;
}) {
  const [updating, setUpdating] = useState(false);
  const [confirmMethod, setConfirmMethod] = useState<"EFECTIVO" | "QR" | "MIXTO" | null>(null);
  const [mixedCashInput, setMixedCashInput] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const creditBalance = sale.cuenta?.saldo || 0;
  const pendingVoidRequest = sale.solicitudAnulacion?.estado === "PENDIENTE" ? sale.solicitudAnulacion : null;
  const isAdmin = userRole === "ADMIN";
  const isSeller = userRole === "SELLER";
  const voidActionLabel = isAdmin && pendingVoidRequest ? "Aprobar anulacion" : isSeller ? "Solicitar anulacion" : "Anular";

  const mixedCashAmount = Number(mixedCashInput.replace(",", ".")) || 0;
  const mixedQrAmount = Math.max(Math.round((sale.total - mixedCashAmount) * 100) / 100, 0);

  const openPaymentChange = (method: "EFECTIVO" | "QR" | "MIXTO") => {
    setMixedCashInput(method === "MIXTO" ? String(sale.pagos?.find((pago) => pago.metodoPago === "EFECTIVO")?.monto || "") : "");
    setConfirmMethod(method);
  };

  const handleUpdatePayment = async (newMethod: "EFECTIVO" | "QR" | "MIXTO") => {
    if (newMethod === "MIXTO" && (mixedCashAmount <= 0 || mixedCashAmount >= sale.total)) {
      alert("El monto en efectivo debe ser mayor a cero y menor al total de la venta.");
      return;
    }
    setUpdating(true);
    try {
      const updatedSale = await updateSalePaymentMethod(
        sale.id,
        newMethod,
        newMethod === "MIXTO" ? [
          { metodoPago: "EFECTIVO", monto: mixedCashAmount },
          { metodoPago: "QR", monto: mixedQrAmount },
        ] : undefined,
      );
      onPaymentUpdated(updatedSale);
      setConfirmMethod(null);
      setMixedCashInput("");
    } catch (error) {
      alert(getErrorMessage(error));
      setConfirmMethod(null);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-grafito-900/80 p-5">
          <div>
            <h3 className="text-xl font-bold text-white">Detalle de venta</h3>
            <p className="text-sm text-gray-400">{formatDateTime(sale.createdAt)} - {sale.cliente?.nombre || "Cliente ocasional"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5 custom-scrollbar">
          {pendingVoidRequest && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              <div className="mb-1 flex items-center gap-2 font-semibold text-white">
                <Clock3 size={16} className="text-amber-300" /> Solicitud de anulacion pendiente
              </div>
              <p>
                {pendingVoidRequest.solicitante?.nombre || "Vendedor"} solicito anular esta venta.
              </p>
              <p className="mt-2 text-amber-100/90">
                Motivo: <span className="font-semibold text-white">{pendingVoidRequest.motivo}</span>
              </p>
            </div>
          )}
          <div className="rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-grafito-900 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3 text-center">Cant.</th>
                  <th className="p-3 text-right">Precio</th>
                  <th className="p-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {(sale.detalles || []).map((detail) => (
                  <tr key={detail.id}>
                    <td className="p-3">
                      <p className="font-semibold text-white">{detail.producto?.descripcion || detail.descripcion || "Detalle"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">{detail.producto?.codigo || detail.tipoLinea || ""}</span>
                        {detail.producto && (
                          <span className={`rounded border px-2 py-0.5 font-bold ${productConditionClass(detail.producto.condicion)}`}>
                            {productConditionLabel(detail.producto.condicion)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center text-gray-300">{detail.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right text-gray-300">{money(detail.precioUnitario)}</td>
                    <td className="p-3 text-right font-bold text-primary-light">{money(detail.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t border-gray-700 pt-4">
            {sale.tipoVenta === "CREDITO" && sale.cuenta && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Credito" value={sale.cuenta.estado} />
                  <Stat label="Vence" value={formatDateOnly(sale.cuenta.fechaVencimiento)} />
                  <Stat label="Pagado" value={money(sale.cuenta.montoPagado || 0)} />
                  <Stat label="Saldo" value={money(creditBalance)} />
                </div>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>{money(sale.subtotal || 0)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Descuento</span>
              <span>{money(sale.descuento || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 text-xl font-bold text-white">
              <span>Total</span>
              <span className="text-primary-light">{money(sale.total)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-700 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-400">Pago actual: <strong className="text-white">{sale.tipoVenta === "CREDITO" ? "CREDITO" : sale.metodoPago}</strong></span>
              {sale.tipoVenta === "CREDITO" && sale.cuenta && creditBalance > 0 ? (
                <button onClick={() => onRegisterCreditPayment(sale)} className="btn-secondary py-1 px-2 text-xs">Registrar pago</button>
              ) : sale.tipoVenta === "CONTADO" ? (
                <>
                  {(["EFECTIVO", "QR", "MIXTO"] as const).filter((method) => method !== sale.metodoPago).map((method) => (
                    <button key={method} onClick={() => openPaymentChange(method)} disabled={updating} className="btn-secondary py-1 px-2 text-xs">
                      Cambiar a {method === "EFECTIVO" ? "Efectivo" : method === "MIXTO" ? "Mixto" : "QR"}
                    </button>
                  ))}
                </>
              ) : null}
              {sale.metodoPago === "MIXTO" && sale.pagos?.map((pago) => (
                <span key={pago.metodoPago} className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300">
                  {pago.metodoPago}: {money(pago.monto)}
                </span>
              ))}
            </div>
            <div className="flex gap-3">
              {!isClosed && (!pendingVoidRequest || isAdmin) && (
                <button 
                  onClick={() => setConfirmVoid(true)} 
                  disabled={updating} 
                  className={`rounded-lg px-4 py-2 font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center ${
                    isAdmin && pendingVoidRequest
                      ? "border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                      : "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  }`}
                >
                  {isAdmin && pendingVoidRequest && <CheckCircle2 size={16} className="mr-2" />}
                  {voidActionLabel}
                </button>
              )}
              {!isClosed && pendingVoidRequest && !isAdmin && (
                <span className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
                  Solicitud pendiente
                </span>
              )}
              <button onClick={onClose} className="btn-secondary">Cerrar</button>
              <button onClick={onPrint} className="btn-primary flex items-center gap-2">
                <Printer size={18} /> Imprimir detalle
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmMethod && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmMethod(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Confirmar cambio</h3>
            <p className="text-gray-300 mb-6">
              ¿Seguro que deseas cambiar el método de pago a <strong className="text-white">{confirmMethod}</strong>?
            </p>
            {confirmMethod === "MIXTO" && (
              <div className="mb-6 space-y-3 text-left">
                <label className="block text-sm text-gray-300">
                  <span className="mb-1 block font-semibold">Monto en efectivo</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={mixedCashInput}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (/^[0-9]*([.,][0-9]{0,2})?$/.test(value)) setMixedCashInput(value);
                    }}
                    className="premium-input"
                    placeholder="0,00"
                  />
                </label>
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Monto por QR</span>
                  <strong className="text-primary-light">{money(mixedQrAmount)}</strong>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmMethod(null)} className="btn-secondary w-full" disabled={updating}>Cancelar</button>
              <button onClick={() => handleUpdatePayment(confirmMethod)} className="btn-primary w-full" disabled={updating}>
                {updating ? "Guardando..." : "Sí, cambiar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmVoid && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setConfirmVoid(false); setMotivoAnulacion(""); }} />
          <div className="relative w-full max-w-sm rounded-2xl border border-red-900/50 bg-grafito-800 shadow-premium p-6 text-center">
            <h3 className="text-xl font-bold text-red-400 mb-2">{voidActionLabel}</h3>
            <p className="text-gray-300 mb-4 text-sm">
              {isAdmin && pendingVoidRequest
                ? "Al aprobar, la venta se anulara y los productos volveran al inventario."
                : isSeller
                  ? "La solicitud sera enviada al administrador. La venta seguira activa hasta que sea aprobada."
                  : "Seguro que deseas anular esta venta? Los productos y balatas volveran al inventario y esta accion no se puede deshacer."}
            </p>
            
            {isAdmin && pendingVoidRequest ? (
              <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm text-amber-100">
                <p className="font-semibold text-white">{pendingVoidRequest.solicitante?.nombre || "Vendedor"}</p>
                <p className="mt-1">{pendingVoidRequest.motivo}</p>
              </div>
            ) : (
              <div className="text-left mb-6">
                <label className="block text-xs font-semibold text-gray-400 mb-1">Motivo de anulacion <span className="text-red-500">*</span></label>
                <textarea
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  className="w-full bg-grafito-900 border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-red-500"
                  placeholder="Escribe el motivo..."
                  rows={2}
                  disabled={updating}
                />
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button onClick={() => { setConfirmVoid(false); setMotivoAnulacion(""); }} className="btn-secondary w-full" disabled={updating}>Cancelar</button>
              <button onClick={() => {
                const motivo = pendingVoidRequest?.motivo || motivoAnulacion.trim();
                if (!motivo) {
                  alert("Por favor ingresa un motivo para anular la venta");
                  return;
                }
                setUpdating(true);
                onVoid(motivo).finally(() => {
                  setUpdating(false);
                  setConfirmVoid(false);
                  setMotivoAnulacion("");
                });
              }} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 w-full" disabled={updating || (!pendingVoidRequest && !motivoAnulacion.trim())}>
                {updating ? "Procesando..." : isAdmin && pendingVoidRequest ? "Aprobar y anular" : isSeller ? "Enviar solicitud" : "Si, anular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditPaymentModal({
  sale,
  amount,
  method,
  notes,
  saving,
  onAmountChange,
  onMethodChange,
  onNotesChange,
  onClose,
  onConfirm,
}: {
  sale: Sale;
  amount: string;
  method: "EFECTIVO" | "QR";
  notes: string;
  saving: boolean;
  onAmountChange: (value: string) => void;
  onMethodChange: (value: "EFECTIVO" | "QR") => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const saldo = sale.cuenta?.saldo || 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="flex items-center justify-between border-b border-gray-700 p-5">
          <div>
            <h3 className="text-xl font-bold text-white">Registrar pago de credito</h3>
            <p className="text-sm text-gray-400">{sale.cliente?.nombre || "Cliente"} - saldo {money(saldo)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-white disabled:opacity-50">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="block text-sm text-gray-300">
            <span className="mb-1 block">Monto recibido</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const value = event.target.value;
                if (moneyInputPattern.test(value)) onAmountChange(value);
              }}
              className="premium-input"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["EFECTIVO", "QR"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onMethodChange(item)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  method === item
                    ? "border-primary/60 bg-primary/15 text-primary-light"
                    : "border-gray-700 bg-grafito-900 text-gray-300 hover:border-gray-500"
                }`}
              >
                {item === "EFECTIVO" ? "Efectivo" : "QR"}
              </button>
            ))}
          </div>
          <label className="block text-sm text-gray-300">
            <span className="mb-1 block">Nota opcional</span>
            <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} className="premium-input min-h-20" />
          </label>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-gray-700 p-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-grafito-900/50 p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}
