import { useState } from "react";
import { validateSignUpForm } from "../utils/sanitize";

const initialForm = {
  fullName: "",
  email: "",
  role: "patient",
  licenseNumber: "",
  specialty: "",
  concerns: "",
  password: "",
  confirmPassword: "",
};

const initialErrors = {
  fullName: [],
  email: [],
  concerns: [],
};

export default function SignUpForm() {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState(initialErrors);
  const [isPasswordStep, setIsPasswordStep] = useState(false);

  const isPsychologist = formData.role === "psychologist";

  const passwordStrength = getPasswordStrength(formData.password);

  async function safeParseResponse(response) {
    const raw = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const expectsJson = contentType.toLowerCase().includes("application/json");

    if (!expectsJson || !raw) {
      return { payload: {}, raw, expectsJson };
    }

    try {
      return { payload: JSON.parse(raw), raw, expectsJson };
    } catch {
      return { payload: {}, raw, expectsJson };
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: [] }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isPasswordStep) {
      const validationErrors = validateSignUpForm(formData);
      setErrors(validationErrors);

      const hasErrors = Object.values(validationErrors).some((fieldErrors) => fieldErrors.length > 0);

      if (hasErrors) {
        return;
      }

      setIsPasswordStep(true);
      return;
    }

    if (!formData.password || formData.password !== formData.confirmPassword) {
      alert("Please enter matching passwords.");
      return;
    }

    try {
      const response = await fetch("/api/auth/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const { payload } = await safeParseResponse(response);

      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }

      alert(`Account created for ${payload.email}`);
      setFormData(initialForm);
      setErrors(initialErrors);
      setIsPasswordStep(false);
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <section id="signup" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 sm:p-8">
          <h2 className="text-3xl font-semibold">Create your account</h2>
          <p className="mt-2 text-gray-300">
            {isPasswordStep ? "Set a secure password for your account." : "Sign up as a patient or psychologist."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!isPasswordStep ? (
              <>
                <div>
                  <label className="block text-sm mb-2" htmlFor="fullName">Full name</label>
                  <input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
                  {errors.fullName.length > 0 && (
                    <div className="mt-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {errors.fullName.map((error) => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm mb-2" htmlFor="email">Email</label>
                  <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
                  {errors.email.length > 0 && (
                    <div className="mt-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {errors.email.map((error) => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm mb-2" htmlFor="role">I am a</label>
                  <select id="role" name="role" value={formData.role} onChange={handleChange} className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400">
                    <option value="patient">Patient</option>
                    <option value="psychologist">Psychologist</option>
                  </select>
                </div>

                {isPsychologist ? (
                  <>
                    <div>
                      <label className="block text-sm mb-2" htmlFor="licenseNumber">License number</label>
                      <input id="licenseNumber" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} required={isPsychologist} className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-sm mb-2" htmlFor="specialty">Specialty</label>
                      <input id="specialty" name="specialty" value={formData.specialty} onChange={handleChange} required={isPsychologist} className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm mb-2" htmlFor="concerns">Message (optional)</label>
                    <textarea id="concerns" name="concerns" rows="4" value={formData.concerns} onChange={handleChange} className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
                    {errors.concerns.length > 0 && (
                      <div className="mt-2 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {errors.concerns.map((error) => (
                          <p key={error}>{error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="block text-sm mb-2" htmlFor="password">Password</label>
                <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} required className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
                <div className="mt-3 h-2 w-full rounded-full bg-slate-700">
                  <div
                    className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.score * 25}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-300">Strength: {passwordStrength.label}</p>

                <label className="mt-4 block text-sm mb-2" htmlFor="confirmPassword">Confirm password</label>
                <input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
            )}

            <button type="submit" className="w-full rounded-lg bg-blue-500 hover:bg-blue-400 transition-colors px-4 py-2 font-medium">
              {isPasswordStep ? "Create account" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function getPasswordStrength(password = "") {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score === 3) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}
