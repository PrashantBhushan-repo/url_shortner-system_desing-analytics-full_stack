function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">
          🔗 SnapURL
        </h1>

        <button className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
          GitHub
        </button>
      </div>
    </nav>
  );
}

export default Navbar;