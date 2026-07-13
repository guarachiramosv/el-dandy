import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { ArrowRight, Hammer, Plus, Printer, RefreshCcw, Save, Search, Trash2, X } from "lucide-react";
import { getCurrentUser } from "../services/auth";
import {
  adjustRemachadoMedidaStock,
  adjustRemachadoRemacheStock,
  createRemachadoMedida,
  createRemachadoRemache,
  createRemachadoTrabajo,
  fetchRemachadoSummary,
} from "../services/remachado";
import { useProducts } from "../hooks/useProducts";
import { PaymentMethod, RemachadoMedida, RemachadoRemache, RemachadoTrabajo } from "../types";

type Tab = "TRABAJO" | "BALATAS" | "REMACHES" | "HISTORIAL";
type DetailProductLine = {
  id: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
};

const money = (value: number) => `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Ocurrio un error inesperado.";

export default function Remachado() {
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  const { data: products, refetch: refetchProducts } = useProducts("active", {
    scope: "all",
    refreshIntervalMs: 10000,
  });
  const [tab, setTab] = useState<Tab>("TRABAJO");
  const [medidas, setMedidas] = useState<RemachadoMedida[]>([]);
  const [remaches, setRemaches] = useState<RemachadoRemache[]>([]);
  const [trabajos, setTrabajos] = useState<RemachadoTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItems, setDetailItems] = useState<DetailProductLine[]>([]);
  const [detailProductId, setDetailProductId] = useState("");
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [detailPrice, setDetailPrice] = useState(0);

  const [trabajoForm, setTrabajoForm] = useState({
    medidaId: "",
    remacheId: "",
    tipoTrabajo: "JUEGO" as "JUEGO" | "MEDIO_JUEGO",
    metodoPago: "EFECTIVO" as PaymentMethod,
    notas: "",
  });
  const [medidaForm, setMedidaForm] = useState({
    medida: "",
    descripcion: "",
    stockJuegos: 0,
    stockMinimoJuegos: 1,
    precioJuego: 0,
    precioMedioJuego: 0,
    remachesPorJuego: 8,
    remachesPorMedioJuego: 4,
  });
  const [remacheForm, setRemacheForm] = useState({
    codigo: "",
    nombre: "",
    medida: "",
    stock: 0,
    stockMinimo: 20,
  });
  const [stockMedida, setStockMedida] = useState({ medidaId: "", cantidadJuegos: 1, notas: "" });
  const [stockRemache, setStockRemache] = useState({ remacheId: "", cantidad: 100, notas: "" });

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchRemachadoSummary();
      setMedidas(data.medidas);
      setRemaches(data.remaches);
      setTrabajos(data.trabajos);
      setTrabajoForm((prev) => ({
        ...prev,
        medidaId: prev.medidaId || data.medidas[0]?.id || "",
        remacheId: prev.remacheId || data.remaches[0]?.id || "",
      }));
      setStockMedida((prev) => ({ ...prev, medidaId: prev.medidaId || data.medidas[0]?.id || "" }));
      setStockRemache((prev) => ({ ...prev, remacheId: prev.remacheId || data.remaches[0]?.id || "" }));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedMedida = medidas.find((item) => item.id === trabajoForm.medidaId);
  const selectedPrice = selectedMedida
    ? trabajoForm.tipoTrabajo === "MEDIO_JUEGO" ? selectedMedida.precioMedioJuego : selectedMedida.precioJuego
    : 0;
  const selectedJuegos = trabajoForm.tipoTrabajo === "MEDIO_JUEGO" ? 0.5 : 1;
  const selectedBalatas = trabajoForm.tipoTrabajo === "MEDIO_JUEGO" ? 2 : 4;
  const selectedRemaches = selectedMedida
    ? trabajoForm.tipoTrabajo === "MEDIO_JUEGO" ? selectedMedida.remachesPorMedioJuego : selectedMedida.remachesPorJuego
    : 0;
  const unitProducts = products.filter((product) => product.unidadVenta !== "METRO");
  const detailSubtotal = detailItems.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);
  const detailTotal = selectedPrice + detailSubtotal;

  const filteredMedidas = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return medidas;
    return medidas.filter((item) => item.medida.toLowerCase().includes(q) || (item.descripcion || "").toLowerCase().includes(q));
  }, [medidas, search]);

  const openDetail = () => {
    if (!trabajoForm.medidaId) return setMessage("Selecciona la medida de balata.");
    setMessage(null);
    setDetailOpen(true);
  };

  const addDetailProduct = () => {
    const product = products.find((item) => item.id === detailProductId);
    if (!product) return setMessage("Selecciona un producto del inventario.");
    if (!Number.isFinite(detailQuantity) || detailQuantity <= 0) return setMessage("La cantidad debe ser mayor a cero.");
    if (!Number.isFinite(detailPrice) || detailPrice < 0) return setMessage("El precio no puede ser negativo.");
    setMessage(null);
    setDetailItems((prev) => [
      ...prev,
      {
        id: `${product.id}-${Date.now()}`,
        productoId: product.id,
        cantidad: detailQuantity,
        precioUnitario: detailPrice,
      },
    ]);
    setDetailProductId("");
    setDetailQuantity(1);
    setDetailPrice(0);
  };

  const removeDetailProduct = (id: string) => {
    setDetailItems((prev) => prev.filter((item) => item.id !== id));
  };

  const printTrabajo = (trabajo: RemachadoTrabajo) => {
    const details = trabajo.venta?.detalles || [];
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    const rows = details.map((detail) => `
      <tr>
        <td>${detail.producto?.codigo || detail.tipoLinea || ""}</td>
        <td>${detail.producto?.descripcion || detail.descripcion || "Detalle"}</td>
        <td class="right">${detail.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</td>
        <td class="right">${money(detail.precioUnitario)}</td>
        <td class="right">${money(detail.subtotal)}</td>
      </tr>
    `).join("");
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Detalle remachado</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 18px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border-bottom: 1px solid #ddd; padding: 7px 5px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            .right { text-align: right; }
            .total { margin-top: 14px; text-align: right; font-size: 18px; font-weight: 800; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Detalle de remachado</h1>
          <p>Medida: ${trabajo.medida?.medida || "-"}</p>
          <p>Trabajo: ${trabajo.tipoTrabajo === "MEDIO_JUEGO" ? "1/2 juego" : "1 juego"}</p>
          <p>Fecha: ${new Date(trabajo.createdAt).toLocaleString("es-BO")}</p>
          <table>
            <thead><tr><th>Codigo</th><th>Detalle</th><th class="right">Cant.</th><th class="right">Precio</th><th class="right">Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">Total: ${money(trabajo.total)}</div>
          <script>window.addEventListener("load", () => { window.print(); });</script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const submitTrabajo = async () => {
    if (!user) return setMessage("Debes iniciar sesion nuevamente.");
    if (!trabajoForm.medidaId) return setMessage("Selecciona la medida de balata.");
    setSaving(true);
    setMessage(null);
    try {
      const trabajo = await createRemachadoTrabajo({
        medidaId: trabajoForm.medidaId,
        remacheId: trabajoForm.remacheId || null,
        usuarioId: user.id,
        sucursalId: user.sucursalId,
        metodoPago: trabajoForm.metodoPago,
        tipoVenta: "CONTADO",
        tipoTrabajo: trabajoForm.tipoTrabajo,
        accesorios: detailItems.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
        notas: trabajoForm.notas || null,
      });
      setMessage("Remachado registrado, venta creada y stock descontado.");
      setDetailOpen(false);
      setDetailItems([]);
      setTrabajoForm((prev) => ({ ...prev, notas: "" }));
      await Promise.all([load(), refetchProducts({ silent: true })]);
      printTrabajo(trabajo);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitMedida = async () => {
    if (!medidaForm.medida.trim()) return setMessage("Escribe la medida de balata.");
    setSaving(true);
    setMessage(null);
    try {
      await createRemachadoMedida({
        ...medidaForm,
        descripcion: medidaForm.descripcion || null,
      });
      setMedidaForm({ medida: "", descripcion: "", stockJuegos: 0, stockMinimoJuegos: 1, precioJuego: 0, precioMedioJuego: 0, remachesPorJuego: 8, remachesPorMedioJuego: 4 });
      setMessage("Medida de balata creada.");
      await load();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitRemache = async () => {
    if (!remacheForm.codigo.trim() || !remacheForm.nombre.trim()) return setMessage("Codigo y nombre de remache son requeridos.");
    setSaving(true);
    setMessage(null);
    try {
      await createRemachadoRemache({
        ...remacheForm,
        medida: remacheForm.medida || null,
      });
      setRemacheForm({ codigo: "", nombre: "", medida: "", stock: 0, stockMinimo: 20 });
      setMessage("Remache creado.");
      await load();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitStockMedida = async () => {
    if (!stockMedida.medidaId) return setMessage("Selecciona una medida.");
    setSaving(true);
    setMessage(null);
    try {
      await adjustRemachadoMedidaStock(stockMedida.medidaId, {
        cantidadJuegos: stockMedida.cantidadJuegos,
        notas: stockMedida.notas || null,
      });
      setMessage("Stock de balata actualizado.");
      await load();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitStockRemache = async () => {
    if (!stockRemache.remacheId) return setMessage("Selecciona un remache.");
    setSaving(true);
    setMessage(null);
    try {
      await adjustRemachadoRemacheStock(stockRemache.remacheId, {
        cantidad: stockRemache.cantidad,
        notas: stockRemache.notas || null,
      });
      setMessage("Stock de remaches actualizado.");
      await load();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Cargando remachado...</div>;

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Hammer className="text-primary" /> Remachado
          </h2>
          <p className="mt-1 text-sm text-gray-400">Balatas por medida, remaches y trabajos por juego o medio juego</p>
        </div>
        <button onClick={() => void load()} className="btn-secondary flex items-center justify-center gap-2">
          <RefreshCcw size={18} /> Actualizar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(["TRABAJO", "BALATAS", "REMACHES", "HISTORIAL"] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`min-h-14 rounded-lg px-4 font-bold ${tab === item ? "bg-primary-gradient text-white" : "border border-white/10 bg-grafito-900/80 text-gray-200"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}

      {tab === "TRABAJO" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="glass-panel p-5">
            <h3 className="mb-4 text-xl font-bold text-white">Registrar trabajo</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Medida de balata" value={trabajoForm.medidaId} onChange={(value) => setTrabajoForm((prev) => ({ ...prev, medidaId: value }))}>
                {medidas.map((item) => <option key={item.id} value={item.id}>{item.medida} - stock {item.stockJuegos} juegos</option>)}
              </Select>
              <Select label="Remache a usar" value={trabajoForm.remacheId} onChange={(value) => setTrabajoForm((prev) => ({ ...prev, remacheId: value }))}>
                <option value="">Sin remache descontado</option>
                {remaches.map((item) => <option key={item.id} value={item.id}>{item.codigo} - {item.nombre} - stock {item.stock}</option>)}
              </Select>
              <Select label="Trabajo" value={trabajoForm.tipoTrabajo} onChange={(value) => setTrabajoForm((prev) => ({ ...prev, tipoTrabajo: value as "JUEGO" | "MEDIO_JUEGO" }))}>
                <option value="JUEGO">1 juego - 4 balatas</option>
                <option value="MEDIO_JUEGO">1/2 juego - 2 balatas</option>
              </Select>
              <Select label="Metodo de pago" value={trabajoForm.metodoPago} onChange={(value) => setTrabajoForm((prev) => ({ ...prev, metodoPago: value as PaymentMethod }))}>
                <option value="EFECTIVO">Efectivo</option>
                <option value="QR">QR</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
              </Select>
              <Input label="Notas" value={trabajoForm.notas} onChange={(value) => setTrabajoForm((prev) => ({ ...prev, notas: value }))} />
            </div>

            <button onClick={openDetail} disabled={saving} className="btn-primary mt-5 flex items-center gap-2 disabled:opacity-60">
              Pasar a detalle de venta <ArrowRight size={18} />
            </button>
          </div>

          <div className="glass-panel p-5">
            <h3 className="text-lg font-bold text-white">Resumen</h3>
            <div className="mt-4 space-y-3">
              <Stat label="Medida" value={selectedMedida?.medida || "-"} />
              <Stat label="Se descuenta" value={`${selectedJuegos} juego(s) / ${selectedBalatas} balatas`} />
              <Stat label="Remaches internos" value={String(selectedRemaches)} />
              <Stat label="Precio" value={money(selectedPrice)} />
              <Stat label="Total detalle" value={money(detailTotal)} />
            </div>
          </div>
        </div>
      )}

      {tab === "BALATAS" && (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          {isAdmin && (
            <div className="glass-panel p-5">
              <h3 className="mb-4 text-xl font-bold text-white">Nueva medida</h3>
              <div className="space-y-3">
                <Input label="Medida" value={medidaForm.medida} onChange={(value) => setMedidaForm((prev) => ({ ...prev, medida: value }))} />
                <Input label="Descripcion" value={medidaForm.descripcion} onChange={(value) => setMedidaForm((prev) => ({ ...prev, descripcion: value }))} />
                <Input label="Stock en juegos" type="number" value={medidaForm.stockJuegos} onChange={(value) => setMedidaForm((prev) => ({ ...prev, stockJuegos: Number(value) }))} />
                <Input label="Stock minimo" type="number" value={medidaForm.stockMinimoJuegos} onChange={(value) => setMedidaForm((prev) => ({ ...prev, stockMinimoJuegos: Number(value) }))} />
                <Input label="Precio juego" type="number" value={medidaForm.precioJuego} onChange={(value) => setMedidaForm((prev) => ({ ...prev, precioJuego: Number(value) }))} />
                <Input label="Precio medio juego" type="number" value={medidaForm.precioMedioJuego} onChange={(value) => setMedidaForm((prev) => ({ ...prev, precioMedioJuego: Number(value) }))} />
                <Input label="Remaches por juego" type="number" value={medidaForm.remachesPorJuego} onChange={(value) => setMedidaForm((prev) => ({ ...prev, remachesPorJuego: Number(value) }))} />
                <Input label="Remaches por medio juego" type="number" value={medidaForm.remachesPorMedioJuego} onChange={(value) => setMedidaForm((prev) => ({ ...prev, remachesPorMedioJuego: Number(value) }))} />
                <button onClick={submitMedida} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60"><Plus size={18} /> Crear medida</button>
              </div>

              <div className="mt-6 border-t border-gray-700 pt-4">
                <h4 className="mb-3 font-bold text-white">Ajustar stock</h4>
                <Select label="Medida" value={stockMedida.medidaId} onChange={(value) => setStockMedida((prev) => ({ ...prev, medidaId: value }))}>
                  {medidas.map((item) => <option key={item.id} value={item.id}>{item.medida}</option>)}
                </Select>
                <Input label="Cantidad juegos (+ ingreso / - ajuste)" type="number" value={stockMedida.cantidadJuegos} onChange={(value) => setStockMedida((prev) => ({ ...prev, cantidadJuegos: Number(value) }))} />
                <Input label="Notas" value={stockMedida.notas} onChange={(value) => setStockMedida((prev) => ({ ...prev, notas: value }))} />
                <button onClick={submitStockMedida} disabled={saving} className="btn-secondary mt-3 disabled:opacity-60">Actualizar stock</button>
              </div>
            </div>
          )}

          <div className="glass-panel overflow-hidden">
            <div className="border-b border-gray-700 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input className="premium-input pl-10" placeholder="Buscar medida..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-grafito-800/80 text-sm uppercase text-gray-400">
                <tr>
                  <th className="p-4">Medida</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Minimo</th>
                  <th className="p-4">Remaches</th>
                  <th className="p-4 text-right">Juego</th>
                  <th className="p-4 text-right">1/2 juego</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredMedidas.map((item) => (
                  <tr key={item.id}>
                    <td className="p-4"><p className="font-bold text-white">{item.medida}</p><p className="text-xs text-gray-500">{item.descripcion}</p></td>
                    <td className={item.stockJuegos <= item.stockMinimoJuegos ? "p-4 font-bold text-red-300" : "p-4 font-bold text-green-300"}>{item.stockJuegos} juegos</td>
                    <td className="p-4 text-gray-300">{item.stockMinimoJuegos}</td>
                    <td className="p-4 text-gray-300">{item.remachesPorJuego} / {item.remachesPorMedioJuego}</td>
                    <td className="p-4 text-right text-primary-light">{money(item.precioJuego)}</td>
                    <td className="p-4 text-right text-primary-light">{money(item.precioMedioJuego)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "REMACHES" && (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          {isAdmin && (
            <div className="glass-panel p-5">
              <h3 className="mb-4 text-xl font-bold text-white">Nuevo remache</h3>
              <div className="space-y-3">
                <Input label="Codigo" value={remacheForm.codigo} onChange={(value) => setRemacheForm((prev) => ({ ...prev, codigo: value }))} />
                <Input label="Nombre" value={remacheForm.nombre} onChange={(value) => setRemacheForm((prev) => ({ ...prev, nombre: value }))} />
                <Input label="Medida" value={remacheForm.medida} onChange={(value) => setRemacheForm((prev) => ({ ...prev, medida: value }))} />
                <Input label="Stock" type="number" value={remacheForm.stock} onChange={(value) => setRemacheForm((prev) => ({ ...prev, stock: Number(value) }))} />
                <Input label="Stock minimo" type="number" value={remacheForm.stockMinimo} onChange={(value) => setRemacheForm((prev) => ({ ...prev, stockMinimo: Number(value) }))} />
                <button onClick={submitRemache} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60"><Plus size={18} /> Crear remache</button>
              </div>

              <div className="mt-6 border-t border-gray-700 pt-4">
                <h4 className="mb-3 font-bold text-white">Ajustar stock</h4>
                <Select label="Remache" value={stockRemache.remacheId} onChange={(value) => setStockRemache((prev) => ({ ...prev, remacheId: value }))}>
                  {remaches.map((item) => <option key={item.id} value={item.id}>{item.codigo} - {item.nombre}</option>)}
                </Select>
                <Input label="Cantidad (+ ingreso / - ajuste)" type="number" value={stockRemache.cantidad} onChange={(value) => setStockRemache((prev) => ({ ...prev, cantidad: Number(value) }))} />
                <Input label="Notas" value={stockRemache.notas} onChange={(value) => setStockRemache((prev) => ({ ...prev, notas: value }))} />
                <button onClick={submitStockRemache} disabled={saving} className="btn-secondary mt-3 disabled:opacity-60">Actualizar stock</button>
              </div>
            </div>
          )}

          <TablePanel headers={["Codigo", "Nombre", "Medida", "Stock", "Minimo"]}>
            {remaches.map((item) => (
              <tr key={item.id}>
                <td className="p-4 font-mono text-gray-300">{item.codigo}</td>
                <td className="p-4 font-bold text-white">{item.nombre}</td>
                <td className="p-4 text-gray-300">{item.medida || "-"}</td>
                <td className={item.stock <= item.stockMinimo ? "p-4 font-bold text-red-300" : "p-4 font-bold text-green-300"}>{item.stock}</td>
                <td className="p-4 text-gray-300">{item.stockMinimo}</td>
              </tr>
            ))}
          </TablePanel>
        </div>
      )}

      {tab === "HISTORIAL" && (
        <TablePanel headers={["Fecha", "Medida", "Trabajo", "Balatas", "Accesorios", "Total"]}>
          {trabajos.map((item) => (
            <tr key={item.id}>
              <td className="p-4 text-gray-300">{new Date(item.createdAt).toLocaleString("es-BO")}</td>
              <td className="p-4 font-bold text-white">{item.medida?.medida || "-"}</td>
              <td className="p-4 text-gray-300">{item.tipoTrabajo === "MEDIO_JUEGO" ? "1/2 juego" : "1 juego"}</td>
              <td className="p-4 text-gray-300">{item.cantidadBalatas} balatas / {item.cantidadRemaches} remaches</td>
              <td className="p-4 text-gray-300">
                <span className="block">Resortes: {item.cantidadResortes}</span>
                <span className="block">Gomas: {item.cantidadGomas}</span>
                <span className="block">Seguros: {item.cantidadSeguros}</span>
              </td>
              <td className="p-4 text-right text-primary-light">{money(item.total)}</td>
            </tr>
          ))}
        </TablePanel>
      )}

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : () => setDetailOpen(false)} />
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
            <div className="flex items-center justify-between border-b border-gray-700 bg-grafito-900/80 p-5">
              <div>
                <h3 className="text-xl font-bold text-white">Detalle de venta</h3>
                <p className="text-sm text-gray-400">Agrega solo los productos que llevo este remachado.</p>
              </div>
              <button onClick={() => setDetailOpen(false)} disabled={saving} className="text-gray-400 hover:text-white disabled:opacity-50">
                <X size={22} />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-white">{selectedMedida?.medida || "Medida"} - {trabajoForm.tipoTrabajo === "MEDIO_JUEGO" ? "1/2 juego" : "1 juego"}</p>
                    <p className="text-sm text-gray-300">{selectedBalatas} balatas</p>
                  </div>
                  <p className="text-2xl font-black text-primary-light">{money(selectedPrice)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_120px_150px_auto] lg:items-end">
                <Select label="Producto del inventario" value={detailProductId} onChange={setDetailProductId}>
                  <option value="">Seleccionar producto</option>
                  {unitProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.codigo} - {product.descripcion} - stock {product.stock}
                    </option>
                  ))}
                </Select>
                <Input label="Cantidad" type="number" value={detailQuantity} onChange={(value) => setDetailQuantity(Number(value))} />
                <Input label="Precio" type="number" value={detailPrice} onChange={(value) => setDetailPrice(Number(value))} />
                <button onClick={addDetailProduct} className="btn-secondary flex h-12 items-center justify-center gap-2 rounded-lg px-4 py-0">
                  <Plus size={18} /> Agregar
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-gray-700">
                <table className="w-full text-left">
                  <thead className="bg-grafito-900 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-right">Precio</th>
                      <th className="p-3 text-right">Total linea</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {detailItems.map((item) => {
                      const product = products.find((entry) => entry.id === item.productoId);
                      return (
                        <tr key={item.id}>
                          <td className="p-3">
                            <p className="font-semibold text-white">{product?.descripcion || "Producto"}</p>
                            <p className="text-xs text-gray-500">{product?.codigo}</p>
                          </td>
                          <td className="p-3 text-center text-gray-300">{item.cantidad}</td>
                          <td className="p-3 text-right text-gray-300">{money(item.precioUnitario)}</td>
                          <td className="p-3 text-right font-bold text-primary-light">{money(item.cantidad * item.precioUnitario)}</td>
                          <td className="p-3 text-right">
                            <button onClick={() => removeDetailProduct(item.id)} className="rounded-lg p-2 text-gray-500 hover:bg-accent/10 hover:text-accent">
                              <Trash2 size={17} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {detailItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500">Sin productos adicionales.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end">
                <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-grafito-900/50 p-4">
                  <div className="flex justify-between text-gray-400">
                    <span>Remachado</span>
                    <span>{money(selectedPrice)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-gray-400">
                    <span>Productos</span>
                    <span>{money(detailSubtotal)}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-gray-700 pt-3 text-xl font-black text-white">
                    <span>Total</span>
                    <span className="text-primary-light">{money(detailTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-700 bg-grafito-900/60 p-5 sm:flex-row sm:justify-end">
              <button onClick={() => setDetailOpen(false)} disabled={saving} className="btn-secondary disabled:opacity-50">Volver</button>
              <button onClick={submitTrabajo} disabled={saving} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? "Registrando..." : "Registrar e imprimir"} <Printer size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      <input className="premium-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      <select className="premium-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-grafito-900/50 p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}

function TablePanel({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="glass-panel overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-grafito-800/80 text-sm uppercase text-gray-400">
          <tr>
            {headers.map((header) => <th key={header} className="p-4">{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">{children}</tbody>
      </table>
    </div>
  );
}
