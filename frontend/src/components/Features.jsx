function Features() {
  const features = [
    {
      title: "⚡ Fast",
      desc: "Generate URLs instantly",
    },
    {
      title: "🔒 Secure",
      desc: "Safe and reliable links",
    },
    {
      title: "📊 Analytics",
      desc: "Track link performance",
    },
  ];

  return (
    <section className="max-w-6xl mx-auto py-16 px-4">
      <h2 className="text-3xl font-bold text-center mb-10">
        Features
      </h2>

      <div className="grid md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-white p-6 rounded-xl shadow"
          >
            <h3 className="text-xl font-semibold mb-2">
              {feature.title}
            </h3>

            <p className="text-gray-600">
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Features;