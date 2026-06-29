// import { useState } from "react";
// import Result from "./Result";

// function UrlForm() {
//   const [longUrl, setLongUrl] = useState("");
//   const [shortUrl, setShortUrl] = useState("");

//   const handleShorten = () => {
//     if (!longUrl.trim()) return;

//     setShortUrl("https://snapurl.com/abc123");
//   };

//   return (
//     <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
//       <h2 className="text-xl font-semibold mb-4">
//         Enter Long URL
//       </h2>

//       <input
//         type="text"
//         placeholder="https://example.com/very-long-url"
//         value={longUrl}
//         onChange={(e) => setLongUrl(e.target.value)}
//         className="w-full border p-3 rounded-lg mb-4"
//       />

//       <button
//         onClick={handleShorten}
//         className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
//       >
//         Shorten URL
//       </button>

//       {shortUrl && <Result shortUrl={shortUrl} />}
//     </div>
//   );
// }

// export default UrlForm;





// import { useState } from "react";
// import API from "../services/urlApi";

// function UrlForm() {
//   const [longUrl, setLongUrl] = useState("");
//   const [shortUrl, setShortUrl] = useState("");

//   const handleShorten = async () => {
//     try {
//       const response = await API.post(
//         "/urls",
//         {
//           longUrl,
//         }
//       );

//       setShortUrl(
//         response.data.shortUrl
//       );

//     } catch (error) {
//       console.error(error);
//     }
//   };

//   return (
//     <>
//       <input
//         value={longUrl}
//         onChange={(e) =>
//           setLongUrl(e.target.value)
//         }
//       />

//       <button
//         onClick={handleShorten}
//       >
//         Shorten
//       </button>

//       {shortUrl && (
//         <p>{shortUrl}</p>
//       )}
//     </>
//   );
// }

// export default UrlForm;








import { useState } from "react";
import API from "../services/urlApi";

function UrlForm() {
  const [longUrl, setLongUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleShorten = async () => {
    if (!longUrl.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await API.post("/urls", {
        longUrl,
      });

      setShortUrl(response.data.shortUrl);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shortUrl);
    alert("Copied!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center px-4">

      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-8">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900">
            SnapURL
          </h1>

          <p className="text-slate-500 mt-2">
            Transform long URLs into clean,
            shareable links instantly.
          </p>
        </div>

        <div className="space-y-4">

          <input
            type="text"
            placeholder="https://example.com/very-long-url"
            value={longUrl}
            onChange={(e) =>
              setLongUrl(e.target.value)
            }
            className="w-full border border-slate-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleShorten}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading
              ? "Generating..."
              : "Shorten URL"}
          </button>

          {error && (
            <div className="bg-red-100 text-red-600 p-3 rounded-lg">
              {error}
            </div>
          )}

          {shortUrl && (
            <div className="bg-slate-100 rounded-xl p-5 border">

              <h3 className="font-semibold mb-3">
                Short URL Generated
              </h3>

              <div className="flex flex-col md:flex-row gap-3">

                <input
                  value={shortUrl}
                  readOnly
                  className="flex-1 bg-white border rounded-lg p-3"
                />

                <button
                  onClick={copyToClipboard}
                  className="bg-green-600 text-white px-5 py-3 rounded-lg hover:bg-green-700"
                >
                  Copy
                </button>

                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-800 text-white px-5 py-3 rounded-lg text-center hover:bg-slate-900"
                >
                  Visit
                </a>

              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

export default UrlForm;