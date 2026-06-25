import CopyButton from "./CopyButton";

function Result({ shortUrl }) {
  return (
    <div className="mt-6 p-4 bg-green-50 rounded-lg border">
      <h3 className="font-semibold mb-2">
        Short URL Generated
      </h3>

      <div className="flex justify-between items-center gap-4">
        <a
          href={shortUrl}
          className="text-blue-600 break-all"
        >
          {shortUrl}
        </a>

        <CopyButton text={shortUrl} />
      </div>
    </div>
  );
}

export default Result;