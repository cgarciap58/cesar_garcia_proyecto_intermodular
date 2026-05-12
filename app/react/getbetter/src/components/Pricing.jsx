const plans = [
  { name: "Starter", price: "$0", details: "Browse psychologists and create your profile." },
  { name: "Care", price: "$29/mo", details: "Book sessions and get progress tools for ongoing care." },
  { name: "Pro", price: "$79/mo", details: "For psychologists: profile boosts and practice management." },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center">Simple pricing</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="mt-2 text-3xl font-bold">{plan.price}</p>
              <p className="mt-3 text-gray-300">{plan.details}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}