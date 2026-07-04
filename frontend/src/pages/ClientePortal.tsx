import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, MessageCircle, PackageSearch, Search } from "lucide-react";
import { clearCustomerSession, getCurrentCustomer, getCustomerToken } from "../services/auth";
import { fetchCustomerCatalog } from "../services/customerPortal";
import ImageLightbox from "../components/ImageLightbox";
import BrandLogo from "../components/BrandLogo";
import { productImageUrl } from "../utils/images";
import { getErrorMessage } from "../utils/errors";
import type { Product } from "../types";

const onlyDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const whatsappUrl = (product: Product) => {
  const message = `Hola, quiero informacion del precio y disponibilidad del repuesto ${product.descripcion} (codigo ${product.codigo}).`;
  const phone = onlyDigits(product.sucursal?.whatsapp);
  return phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
};

const getCoverImage = (product: Product) => product.imagenes?.[0]?.url || product.imagen;

export default function ClientePortal() {
  const navigate = useNavigate();
  const customer = useMemo(() => getCurrentCustomer(), []);
  const customerToken = useMemo(() => getCustomerToken(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);

  const load = useCallback(async (term = search) => {
    setError(null);
    setLoading(true);
    try {
      setProducts(await fetchCustomerCatalog(term));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudieron cargar los productos"));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!customer || !customerToken) {
      navigate("/login", { replace: true });
      return;
    }
    const timer = window.setTimeout(() => {
      void load("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [customer, customerToken, load, navigate]);

  const logout = () => {
    clearCustomerSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-grafito-900 text-white selection:bg-primary selection:text-white">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-grafito-900/60 backdrop-blur-xl shadow-glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <BrandLogo compact imageClassName="h-11 w-11 rounded-xl shadow-glass-glow" />
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Diesel Dandy</h1>
              <p className="text-xs font-medium text-primary-light">Bienvenido, {customer?.nombre}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-secondary flex items-center gap-2 px-5 py-2.5 text-sm">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-10 text-center animate-fade-in">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Encuentra tu repuesto ideal
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Busca por código, marca o descripción y contáctanos directamente para más información.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row max-w-3xl mx-auto">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
            <input
              className="premium-input pl-12 h-14 text-lg"
              placeholder="Ej. Filtro de aceite..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load(search);
              }}
            />
          </div>
          <button onClick={() => load(search)} className="btn-primary px-8 h-14 text-lg">
            Buscar
          </button>
        </div>

        {error && <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-center">{error}</div>}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-primary-light animate-pulse-slow">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-medium">Cargando catálogo...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <PackageSearch size={64} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">No se encontraron productos.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const image = productImageUrl(getCoverImage(product));
              const lowStock = product.stock <= (product.stockMinimo || 5);
              return (
                <article key={product.id} className="glass-panel group flex flex-col">
                  {image ? (
                    <div className="relative h-48 w-full overflow-hidden bg-grafito-800">
                      <button
                        type="button"
                        onClick={() => setLightboxImage({ url: image, alt: product.descripcion })}
                        className="h-full w-full"
                      >
                        <img src={image} alt={product.descripcion} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      </button>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-grafito-900 via-transparent to-transparent opacity-80" />
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-grafito-800/50 text-gray-600">
                      <PackageSearch size={48} className="opacity-50" />
                    </div>
                  )}
                  
                  <div className="flex flex-col flex-1 p-5">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-mono text-xs font-bold text-primary-light px-2 py-1 bg-primary/10 rounded-md">{product.codigo}</p>
                      <p className={`text-xs font-bold px-2 py-1 rounded-md ${lowStock ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                        {product.stock} disp.
                      </p>
                    </div>
                    
                    <h2 className="line-clamp-2 text-lg font-bold text-white mb-1 group-hover:text-primary-light transition-colors">{product.descripcion}</h2>
                    <p className="text-sm text-gray-400 mb-4 line-clamp-1">
                      {product.marca} · {product.categoria?.nombre || "General"}
                    </p>
                    
                    <div className="mt-auto">
                      <div className="flex items-end justify-between mb-4">
                        <p className="text-xs text-gray-500 font-medium">{product.sucursal?.nombre || "Sucursal"}</p>
                        <p className="text-2xl font-black text-white tracking-tight">Bs {product.precioVenta.toFixed(2)}</p>
                      </div>
                      <a
                        href={whatsappUrl(product)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-whatsapp w-full"
                      >
                        <MessageCircle size={18} /> Pedir por WhatsApp
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <ImageLightbox imageUrl={lightboxImage?.url || null} alt={lightboxImage?.alt} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
