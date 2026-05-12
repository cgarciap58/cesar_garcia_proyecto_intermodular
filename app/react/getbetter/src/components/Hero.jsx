export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 sm:pt-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute top-20 left-4 sm:left-10 w-48 sm:w-72 h-48 sm:h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-4 sm:right-10 w-64 sm:w-96 h-64 sm:h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative max-w-4xl text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
          Mental health support that helps you <span className="text-blue-400">get better</span>
        </h1>
        <p className="mt-6 text-lg text-gray-300">
          Connect with licensed psychologists and take control of your emotional wellbeing.
        </p>
        <a href="#signup" className="inline-block mt-8 rounded-lg bg-blue-500 hover:bg-blue-400 px-6 py-3 font-medium transition-colors">
          Get started
        </a>
      </div>
    </section>
  );
}