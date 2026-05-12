const testimonials = [
  { quote: "GetBetter helped me find the right therapist in two days.", author: "Patient, New York" },
  { quote: "My online practice grew with better discovery and booking.", author: "Psychologist, California" },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center">What users say</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {testimonials.map((item) => (
            <blockquote key={item.author} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <p className="text-lg text-gray-100">“{item.quote}”</p>
              <footer className="mt-4 text-sm text-gray-400">— {item.author}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}