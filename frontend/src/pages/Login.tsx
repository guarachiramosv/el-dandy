import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import bgLogin from "../assets/bg-login.png";
import BrandLogo from "../components/BrandLogo";
import {
  login,
  loginCustomer,
  registerCustomer,
  saveCustomerSession,
  saveSession,
} from "../services/auth";
import { getErrorMessage } from "../utils/errors";

type AccessType = "STAFF" | "CUSTOMER";
type CustomerMode = "LOGIN" | "REGISTER";

export default function Login() {
  const navigate = useNavigate();
  const [accessType, setAccessType] = useState<AccessType>("STAFF");
  const [customerMode, setCustomerMode] = useState<CustomerMode>("LOGIN");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerNit, setCustomerNit] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerPasswordConfirm, setCustomerPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const session = await login(email, password);
      saveSession(session.user, session.token);
      navigate(session.user.role === "ADMIN" ? "/admin" : "/seller");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo iniciar sesion"));
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (customerMode === "REGISTER" && customerPassword !== customerPasswordConfirm) {
      setError("Las contrasenas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const session =
        customerMode === "REGISTER"
          ? await registerCustomer({
              nombre: customerName,
              email: customerEmail.trim().toLowerCase(),
              password: customerPassword,
              telefono: customerPhone || null,
              ciudad: customerCity || null,
              nit: customerNit || null,
              direccion: customerAddress || null,
            })
          : await loginCustomer(customerEmail.trim().toLowerCase(), customerPassword);

      saveCustomerSession(session.customer, session.token);
      setCustomerPassword("");
      setCustomerPasswordConfirm("");
      navigate("/cliente");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo completar la solicitud"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-end p-6 lg:p-12 overflow-hidden bg-grafito-900">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgLogin})`, opacity: 0.5 }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-grafito-900/80 via-grafito-900/40 to-grafito-900/90" />

      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md glass-panel p-8"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
            className="mx-auto mb-5 flex justify-center"
          >
            <BrandLogo imageClassName="h-20 w-auto max-w-full drop-shadow-2xl" />
          </motion.div>
          <p className="text-secondary mt-2 font-semibold">ERP Premium de Repuestos</p>
        </div>

        <div className="flex p-1 bg-grafito-900/50 rounded-xl mb-6 border border-gray-700">
          <button
            type="button"
            onClick={() => {
              setAccessType("STAFF");
              resetMessages();
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              accessType === "STAFF" ? "bg-primary text-white shadow-lg" : "text-gray-400 hover:text-white"
            }`}
          >
            <ShieldCheck size={18} /> Personal
          </button>
          <button
            type="button"
            onClick={() => {
              setAccessType("CUSTOMER");
              setCustomerMode("LOGIN");
              resetMessages();
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              accessType === "CUSTOMER" ? "bg-primary text-white shadow-lg" : "text-gray-400 hover:text-white"
            }`}
          >
            <UserPlus size={18} /> Cliente
          </button>
        </div>

        {accessType === "STAFF" ? (
          <form onSubmit={handleStaffLogin} className="space-y-6">
            <div className="space-y-4">
              {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Correo del usuario"
                  className="premium-input pl-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="relative">
                <KeyRound className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contrasena"
                  className="premium-input pl-12 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex justify-center items-center gap-2 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar al Sistema"}
            </motion.button>
          </form>
        ) : (
          <form onSubmit={handleCustomerAuth} className="space-y-5">
            <div className="space-y-3">
              {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
              {success && <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-100">{success}</div>}

              {customerMode === "REGISTER" && (
                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    className="premium-input pl-12"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Correo electronico"
                  className="premium-input pl-12"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </div>

              {customerMode === "REGISTER" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                      <input
                        type="tel"
                        placeholder="Telefono"
                        className="premium-input pl-12"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Ciudad"
                        className="premium-input pl-12"
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <IdCard className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="NIT o CI"
                      className="premium-input pl-12"
                      value={customerNit}
                      onChange={(e) => setCustomerNit(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Direccion"
                      className="premium-input pl-12"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <KeyRound className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contrasena"
                  className="premium-input pl-12 pr-12"
                  value={customerPassword}
                  onChange={(e) => setCustomerPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {customerMode === "REGISTER" && (
                <div className="relative">
                  <KeyRound className="absolute left-4 top-3.5 text-gray-500 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirmar contrasena"
                    className="premium-input pl-12"
                    value={customerPasswordConfirm}
                    onChange={(e) => setCustomerPasswordConfirm(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex justify-center items-center gap-2 disabled:opacity-60"
            >
              {loading ? "Procesando..." : customerMode === "REGISTER" ? "Crear cuenta de cliente" : "Entrar como cliente"}
            </motion.button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode(customerMode === "REGISTER" ? "LOGIN" : "REGISTER");
                resetMessages();
              }}
              className="w-full text-center text-sm font-semibold text-primary-light hover:text-white"
            >
              {customerMode === "REGISTER" ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
