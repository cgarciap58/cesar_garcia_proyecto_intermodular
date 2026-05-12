import { useState } from "react";

const initialForm = {
  fullName: "",
  email: "",
  role: "patient",
  licenseNumber: "",
  specialty: "",
  concerns: "",
};

export default function SignUpForm() {
  const [formData, setFormData] = useState(initialForm);

  const isPsychologist = formData.role === "psychologist";

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    console.log("Signup form payload:", formData);
  }

  return (
    <section id="signup" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 sm:p-8">
          <h2 className="text-3xl font-semibold">Create your account</h2>
          <p className="mt-2 text-gray-300">
            Sign up as a patient or psychologist. API integration can be added later.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm mb-2" htmlFor="fullName">Full name</label>
              <input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-sm mb-2" htmlFor="email">Email</label>
              <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
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
                <label className="block text-sm mb-2" htmlFor="concerns">Main concerns (optional)</label>
                <textarea id="concerns" name="concerns" rows="4" value={formData.concerns} onChange={handleChange} className="w-full rounded-lg bg-slate-900/70 border border-slate-700 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
            )}

            <button type="submit" className="w-full rounded-lg bg-blue-500 hover:bg-blue-400 transition-colors px-4 py-2 font-medium">
              Sign up
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
