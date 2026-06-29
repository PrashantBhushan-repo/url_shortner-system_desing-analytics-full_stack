function CopyButton({ text }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  return (
    <button
      onClick={copyToClipboard}
      className="bg-green-600 text-white px-4 py-2 rounded-lg"
    >
      Copy
    </button>
  );
}

export default CopyButton;