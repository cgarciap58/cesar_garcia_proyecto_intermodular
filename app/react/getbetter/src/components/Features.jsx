const features = [
  {
    title: "Matched therapists",
    description: "Find psychologists by specialty, language, and care style.",
  },
  {
    title: "Secure sessions",
    description: "Private online sessions and follow-ups that fit your schedule.",
  },
  {
    title: "Progress tracking",
    description: "Simple check-ins to measure mood, habits, and recovery over time.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center">Built for better mental health care</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="mt-3 text-gray-300">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}