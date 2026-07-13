import os

file_path = "frontend/src/pages/Remachado.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Type
content = content.replace(
    'type Tab = "TRABAJO" | "BALATAS" | "REMACHES" | "HISTORIAL";',
    '''type Tab = "TRABAJO" | "BALATAS" | "REMACHES" | "HISTORIAL";
type CartTrabajo = {
  id: string;
  medidaId: string;
  remacheId: string;
  tipoTrabajo: "JUEGO" | "MEDIO_JUEGO";
  notas?: string;
};'''
)

# 2. State
content = content.replace(
    '  const [trabajos, setTrabajos] = useState<RemachadoTrabajo[]>([]);',
    '''  const [trabajos, setTrabajos] = useState<RemachadoTrabajo[]>([]);
  const [cartTrabajos, setCartTrabajos] = useState<CartTrabajo[]>([]);'''
)

# 3. openDetail & cart functions
content = content.replace(
    '''  const openDetail = () => {
    if (!trabajoForm.medidaId) return setMessage("Selecciona la medida de balata.");
    setMessage(null);
    setDetailOpen(true);
  };''',
    '''  const addToCart = () => {
    if (!trabajoForm.medidaId) return setMessage("Selecciona la medida de balata.");
    setCartTrabajos(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(),
        medidaId: trabajoForm.medidaId,
        remacheId: trabajoForm.remacheId,
        tipoTrabajo: trabajoForm.tipoTrabajo,
        notas: trabajoForm.notas
      }
    ]);
    setTrabajoForm(prev => ({...prev, notas: ""}));
    setMessage(null);
  };

  const removeFromCart = (id: string) => {
    setCartTrabajos(prev => prev.filter(t => t.id !== id));
  };

  const openDetail = () => {
    if (cartTrabajos.length === 0) return setMessage("Agrega al menos un trabajo a la lista.");
    setMessage(null);
    setDetailOpen(true);
  };'''
)

# 4. printTrabajo
content = content.replace(
    '''  const printTrabajo = (trabajo: RemachadoTrabajo) => {
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
  };''',
    '''  const printTrabajo = (trabajo: RemachadoTrabajo) => {
    const details = trabajo.venta?.detalles || [];
    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    const rows = details.map((detail) => `
      <tr>
        <td class="center">${detail.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</td>
        <td>${detail.producto?.descripcion || detail.descripcion || "Detalle"}</td>
        <td class="right">${money(detail.subtotal)}</td>
      </tr>
    `).join("");
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Ticket Remachado</title>
          <style>
            body { font-family: monospace; color: #000; padding: 0; margin: 0; width: 78mm; font-size: 12px; }
            h1 { font-size: 16px; margin: 5px 0; text-align: center; }
            p { margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border-bottom: 1px dashed #000; padding: 4px 2px; text-align: left; vertical-align: top; }
            .right { text-align: right; }
            .center { text-align: center; }
            .total { margin-top: 10px; text-align: right; font-size: 16px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; }
            @media print { body { padding: 0; margin: 0; } }
          </style>
        </head>
        <body>
          <h1>TICKET DE REMACHADO</h1>
          <p class="center">Fecha: ${new Date().toLocaleString("es-BO")}</p>
          <table>
            <thead><tr><th class="center">Cant.</th><th>Detalle</th><th class="right">Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">TOTAL: ${money(trabajo.venta?.total || trabajo.total)}</div>
          <p class="center" style="margin-top: 10px;">¡Gracias por su preferencia!</p>
          <script>window.addEventListener("load", () => { window.print(); });</script>
        </body>
      </html>`);
    printWindow.document.close();
  };'''
)

# 5. submitTrabajo
content = content.replace(
    '''  const submitTrabajo = async () => {
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
  };''',
    '''  const submitTrabajo = async () => {
    if (!user) return setMessage("Debes iniciar sesion nuevamente.");
    if (cartTrabajos.length === 0) return setMessage("Agrega al menos un trabajo a la lista.");
    setSaving(true);
    setMessage(null);
    try {
      const trabajo = await createRemachadoTrabajo({
        usuarioId: user.id,
        sucursalId: user.sucursalId,
        metodoPago: trabajoForm.metodoPago,
        tipoVenta: "CONTADO",
        trabajos: cartTrabajos.map(ct => ({
          medidaId: ct.medidaId,
          remacheId: ct.remacheId || null,
          tipoTrabajo: ct.tipoTrabajo,
          notas: ct.notas || null
        })),
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
      setCartTrabajos([]);
      setTrabajoForm((prev) => ({ ...prev, notas: "" }));
      await Promise.all([load(), refetchProducts({ silent: true })]);
      printTrabajo(trabajo);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };'''
)

# 6. cartTotal and detailTotal
content = content.replace(
    'const detailSubtotal = detailItems.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);',
    '''const cartTotal = cartTrabajos.reduce((sum, ct) => {
    const med = medidas.find(m => m.id === ct.medidaId);
    if (!med) return sum;
    return sum + (ct.tipoTrabajo === "MEDIO_JUEGO" ? med.precioMedioJuego : med.precioJuego);
  }, 0);
  const detailSubtotal = detailItems.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);'''
)
content = content.replace(
    'const detailTotal = selectedPrice + detailSubtotal;',
    'const detailTotal = cartTotal + detailSubtotal;'
)

# 7. TRABAJO UI tab - Add to list button and List
content = content.replace(
    '''            <button onClick={openDetail} disabled={saving} className="btn-primary mt-5 flex items-center gap-2 disabled:opacity-60">
              Pasar a detalle de venta <ArrowRight size={18} />
            </button>''',
    '''            <button onClick={addToCart} className="btn-secondary mt-5 flex items-center justify-center gap-2 w-full">
              <Plus size={18} /> Agregar a lista
            </button>
            
            {cartTrabajos.length > 0 && (
              <div className="mt-6">
                <h4 className="font-bold text-white mb-2">Trabajos en lista</h4>
                <div className="space-y-2">
                  {cartTrabajos.map(ct => {
                    const m = medidas.find(x => x.id === ct.medidaId);
                    const p = m ? (ct.tipoTrabajo === "MEDIO_JUEGO" ? m.precioMedioJuego : m.precioJuego) : 0;
                    return (
                      <div key={ct.id} className="flex justify-between items-center bg-grafito-900/50 p-2 rounded-lg border border-gray-700">
                        <div>
                          <p className="font-bold text-sm text-white">{m?.medida} - {ct.tipoTrabajo === "MEDIO_JUEGO" ? "1/2 juego" : "1 juego"}</p>
                          {ct.notas && <p className="text-xs text-gray-400">{ct.notas}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-primary-light font-bold">{money(p)}</p>
                          <button onClick={() => removeFromCart(ct.id)} className="text-red-400 hover:bg-red-400/20 p-1 rounded"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-3 font-bold text-lg text-white pt-2 border-t border-gray-700">
                  <span>Total lista:</span>
                  <span className="text-primary-light">{money(cartTotal)}</span>
                </div>
              </div>
            )}

            <button onClick={openDetail} disabled={saving || cartTrabajos.length === 0} className="btn-primary mt-5 flex items-center justify-center gap-2 w-full disabled:opacity-60">
              Pasar a detalle de venta <ArrowRight size={18} />
            </button>'''
)

# 8. Modifying Summary Panel (resumen) to show total items
content = content.replace(
    '''            <div className="mt-4 space-y-3">
              <Stat label="Medida" value={selectedMedida?.medida || "-"} />
              <Stat label="Se descuenta" value={`${selectedJuegos} juego(s) / ${selectedBalatas} balatas`} />
              <Stat label="Remaches internos" value={String(selectedRemaches)} />
              <Stat label="Precio" value={money(selectedPrice)} />
              <Stat label="Total detalle" value={money(detailTotal)} />
            </div>''',
    '''            <div className="mt-4 space-y-3">
              <Stat label="Total en lista" value={`${cartTrabajos.length} trabajos`} />
              <Stat label="Subtotal Remachado" value={money(cartTotal)} />
              <Stat label="Subtotal Accesorios" value={money(detailSubtotal)} />
              <div className="pt-3 border-t border-gray-700">
                <Stat label="Total general" value={money(detailTotal)} />
              </div>
            </div>'''
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("File updated successfully")
