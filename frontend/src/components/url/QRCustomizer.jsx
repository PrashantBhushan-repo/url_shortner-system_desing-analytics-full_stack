import React, { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { 
  Palette, 
  Sliders, 
  Image as ImageIcon, 
  Download, 
  X, 
  Check, 
  Trash2, 
  SlidersHorizontal, 
  Sparkles,
  Info,
  Maximize2,
  Share2
} from "lucide-react";

function contrastRatio(hex1, hex2) {
  const toL = (hex) => {
    if (!hex) return 1;
    const h = hex.replace('#','');
    const r = parseInt(h.substring(0,2),16)/255;
    const g = parseInt(h.substring(2,4),16)/255;
    const b = parseInt(h.substring(4,6),16)/255;
    const RsRGB = r<=0.03928 ? r/12.92 : Math.pow((r+0.055)/1.055,2.4);
    const GsRGB = g<=0.03928 ? g/12.92 : Math.pow((g+0.055)/1.055,2.4);
    const BsRGB = b<=0.03928 ? b/12.92 : Math.pow((b+0.055)/1.055,2.4);
    return 0.2126*RsRGB + 0.7152*GsRGB + 0.0722*BsRGB;
  };
  const L1 = toL(hex1);
  const L2 = toL(hex2);
  const lighter = Math.max(L1,L2);
  const darker = Math.min(L1,L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function QRCustomizer({ url, onClose }) {
  const ref = useRef(null);
  const qrRef = useRef(null);
  const containerRef = useRef(null);

  const [qrColor, setQrColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [dotStyle, setDotStyle] = useState("square");
  const [cornerStyle, setCornerStyle] = useState("square");
  const [cornerDotStyle, setCornerDotStyle] = useState("square");
  const [size, setSize] = useState(512);
  const [logo, setLogo] = useState(null);
  const [frame, setFrame] = useState("none");

  // Presets
  const presets = [
    { fg: '#000000', bg: '#ffffff', label: 'Classic Black' },
    { fg: '#0f172a', bg: '#f8fafc', label: 'Slate Gray' },
    { fg: '#1e3b8b', bg: '#ffffff', label: 'Royal Navy' },
    { fg: '#0d9488', bg: '#ffffff', label: 'Ocean Teal' },
    { fg: '#2563eb', bg: '#eff6ff', label: 'Tech Blue' },
    { fg: '#7c3aed', bg: '#faf5ff', label: 'Violet Glow' },
    { fg: '#e11d48', bg: '#fff1f2', label: 'Crimson Red' },
    { fg: '#ffffff', bg: '#0f172a', label: 'Dark Mode' }
  ];

  useEffect(() => {
    if (!url) return;

    if (qrRef.current) {
      qrRef.current.update({ data: url });
      return;
    }

    const qr = new QRCodeStyling({
      width: size,
      height: size,
      data: url,
      image: logo || undefined,
      dotsOptions: {
        color: qrColor,
        type: dotStyle,
      },
      cornersSquareOptions: {
        type: cornerStyle,
        color: qrColor,
      },
      cornersDotOptions: {
        type: cornerDotStyle,
        color: qrColor,
      },
      backgroundOptions: {
        color: bgColor,
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5,
      },
    });

    qrRef.current = qr;
    if (ref.current) {
      ref.current.innerHTML = "";
      qr.append(ref.current);
    }

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      try { qrRef.current = null; } catch(e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!qrRef.current) return;
    qrRef.current.update({
      width: size,
      height: size,
      dotsOptions: { color: qrColor, type: dotStyle },
      cornersSquareOptions: { type: cornerStyle, color: qrColor },
      cornersDotOptions: { type: cornerDotStyle, color: qrColor },
      backgroundOptions: { color: bgColor },
      image: logo || undefined,
    });
  }, [qrColor, bgColor, dotStyle, cornerStyle, cornerDotStyle, size, logo]);

  const handleDownload = (ext) => {
    try {
      qrRef.current.download({ name: "short-url-qr", extension: ext });
    } catch (err) {
      qrRef.current.getRawData(ext).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `short-url-qr.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }
  };

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const ratio = contrastRatio(qrColor, bgColor).toFixed(2);
  const contrastOk = Number(ratio) >= 4.5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" role="dialog" aria-modal="true">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div 
        ref={containerRef} 
        className="relative bg-slate-900 border border-white/10 text-white rounded-3xl shadow-[0_0_80px_-20px_rgba(59,130,246,0.35)] w-full max-w-7xl max-h-[92vh] overflow-y-auto flex flex-col p-6 md:p-8" 
        aria-labelledby="qr-customizer-title"
      >
        
        {/* Header Section */}
        <div className="flex items-start justify-between pb-6 border-b border-white/5 mb-6">
          <div className="space-y-1">
            <h3 id="qr-customizer-title" className="text-2xl font-bold flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-blue-400" /> Customize QR Code
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Design a professional QR code by selecting custom shapes, brand colors, frame designs, and uploading your own logo.
            </p>
          </div>
          <button 
            onClick={onClose} 
            aria-label="Close" 
            className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Workspace: 2 Column Layout (Left: Controls, Right: Preview) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Settings Panel (8 cols wide) */}
          <div className="lg:col-span-8 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Colors & Presets */}
              <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 pb-2 border-b border-white/5">
                  <Palette className="w-4 h-4 text-blue-400" /> Colors & Theme
                </h4>
                
                {/* Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">QR Color</label>
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl p-2 h-12">
                      <input 
                        type="color" 
                        value={qrColor} 
                        onChange={(e) => setQrColor(e.target.value)} 
                        className="h-8 w-12 rounded cursor-pointer border-none bg-transparent" 
                        aria-label="QR foreground color"
                      />
                      <span className="text-xs font-mono text-slate-300 font-medium">{qrColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Background</label>
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl p-2 h-12">
                      <input 
                        type="color" 
                        value={bgColor} 
                        onChange={(e) => setBgColor(e.target.value)} 
                        className="h-8 w-12 rounded cursor-pointer border-none bg-transparent" 
                        aria-label="QR background color"
                      />
                      <span className="text-xs font-mono text-slate-300 font-medium">{bgColor.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Presets */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-medium block">Professional Swatches</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {presets.map((p, idx) => (
                      <button 
                        key={idx} 
                        type="button"
                        onClick={() => { setQrColor(p.fg); setBgColor(p.bg); }} 
                        className="flex items-center gap-2 h-10 px-2 rounded-xl border border-white/5 bg-slate-900/60 hover:bg-slate-900 transition text-left cursor-pointer"
                        aria-label={`Preset ${p.label}`}
                      >
                        <div className="flex shrink-0 w-5 h-5 rounded border border-white/10 overflow-hidden">
                          <div className="w-1/2 h-full" style={{ backgroundColor: p.fg }} />
                          <div className="w-1/2 h-full" style={{ backgroundColor: p.bg }} />
                        </div>
                        <span className="text-[10px] font-medium text-slate-300 truncate">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Box 2: Branding (Logo & Frames) */}
              <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 pb-2 border-b border-white/5">
                  <ImageIcon className="w-4 h-4 text-emerald-400" /> Branding & Frames
                </h4>
                
                {/* Logo Uploader */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-medium block">Center Logo</label>
                  
                  {!logo ? (
                    <div className="border border-dashed border-white/10 hover:border-blue-500/50 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-slate-900/40 transition cursor-pointer relative group">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogo} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        aria-label="Upload logo file"
                      />
                      <ImageIcon className="w-6 h-6 text-slate-400 mb-1.5 group-hover:text-blue-400 transition" />
                      <span className="text-xs font-semibold text-slate-300">Upload Logo</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPEG (Square layout)</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-slate-900/60 border border-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-2.5">
                        <img src={logo} alt="Logo preview" className="w-8 h-8 rounded object-contain bg-white p-0.5 border border-white/10" />
                        <div>
                          <span className="text-xs text-slate-200 block font-semibold">Custom Logo</span>
                          <span className="text-[10px] text-emerald-400 font-medium">Applied</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setLogo(null)} 
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 transition cursor-pointer"
                        title="Remove Logo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Frames Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-medium block">Frame Layout</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setFrame('none')} 
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${frame === 'none' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/5 bg-slate-900/60 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                    >
                      <div className="w-7 h-7 border border-slate-500 rounded-sm mb-1 flex items-center justify-center text-[8px] font-bold text-slate-500">None</div>
                      <span className="text-[10px] font-medium">No Frame</span>
                    </button>
                    <button 
                      onClick={() => setFrame('outline')} 
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${frame === 'outline' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/5 bg-slate-900/60 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                    >
                      <div className="w-7 h-7 border-2 border-dashed border-blue-400 rounded-sm mb-1 flex items-center justify-center text-[8px] font-bold text-blue-400">Frame</div>
                      <span className="text-[10px] font-medium">Outline</span>
                    </button>
                    <button 
                      onClick={() => setFrame('scan')} 
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${frame === 'scan' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/5 bg-slate-900/60 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                    >
                      <div className="w-7 h-7 border border-slate-400 rounded-sm mb-1 flex flex-col items-stretch justify-between overflow-hidden">
                        <div className="h-4 flex items-center justify-center text-[6px] text-slate-500 font-bold">QR</div>
                        <div className="bg-slate-800 text-white text-[4px] text-center py-0.5 font-bold tracking-tighter">SCAN ME</div>
                      </div>
                      <span className="text-[10px] font-medium">Scan Me</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 3: QR Shapes & Styles (Spacious Row) */}
            <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 space-y-5">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2 pb-2 border-b border-white/5">
                <Sliders className="w-4 h-4 text-indigo-400" /> Pattern Shapes & Styles
              </h4>
              
              {/* Dot Style Tiles */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Dot Style (Body Pattern)</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    {
                      id: 'square',
                      label: 'Square',
                      svg: (
                        <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                        </svg>
                      )
                    },
                    {
                      id: 'rounded',
                      label: 'Rounded',
                      svg: (
                        <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="3" y="3" width="7" height="7" rx="2" />
                          <rect x="14" y="3" width="7" height="7" rx="2" />
                          <rect x="3" y="14" width="7" height="7" rx="2" />
                          <rect x="14" y="14" width="7" height="7" rx="2" />
                        </svg>
                      )
                    },
                    {
                      id: 'dots',
                      label: 'Dots',
                      svg: (
                        <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="6.5" cy="6.5" r="3.5" />
                          <circle cx="17.5" cy="6.5" r="3.5" />
                          <circle cx="6.5" cy="17.5" r="3.5" />
                          <circle cx="17.5" cy="17.5" r="3.5" />
                        </svg>
                      )
                    },
                    {
                      id: 'extra-rounded',
                      label: 'Bubble',
                      svg: (
                        <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="6.5" cy="6.5" r="4.5" />
                          <circle cx="17.5" cy="6.5" r="4.5" />
                          <circle cx="6.5" cy="17.5" r="4.5" />
                          <circle cx="17.5" cy="17.5" r="4.5" />
                        </svg>
                      )
                    },
                    {
                      id: 'classy',
                      label: 'Classy',
                      svg: (
                        <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.5,3 L10,6.5 L6.5,10 L3,6.5 Z" />
                          <path d="M17.5,3 L21,6.5 L17.5,10 L14,6.5 Z" />
                          <path d="M6.5,14 L10,17.5 L6.5,21 L3,17.5 Z" />
                          <path d="M17.5,14 L21,17.5 L17.5,21 L14,17.5 Z" />
                        </svg>
                      )
                    },
                    {
                      id: 'classy-rounded',
                      label: 'Elegant',
                      svg: (
                        <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.5,3 C8.5,3 10,4.5 10,6.5 C10,8.5 8.5,10 6.5,10 C4.5,10 3,8.5 3,6.5 C3,4.5 4.5,3 6.5,3 Z" />
                          <path d="M17.5,3 C17.5,5.5 15.5,7.5 13,7.5 L13,6.5 C13,4.5 14.5,3 17.5,3 Z" />
                          <path d="M6.5,14 C9,14 11,16 11,18.5 L10,18.5 C10,16.5 8.5,15 6.5,15 Z" />
                          <path d="M17.5,14 C19.5,14 21,15.5 21,17.5 C21,19.5 19.5,21 17.5,21 C15.5,21 14,19.5 14,17.5 C14,15.5 15.5,14 17.5,14 Z" />
                        </svg>
                      )
                    }
                  ].map((item) => (
                    <button 
                      key={item.id}
                      type="button"
                      onClick={() => setDotStyle(item.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${dotStyle === item.id ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/5 bg-slate-900/60 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                    >
                      {item.svg}
                      <span className="text-[10px] font-medium tracking-tight mt-1">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Corner Shapes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                
                {/* Corner Squares */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Corner Ring Shape</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: 'square',
                        label: 'Square',
                        svg: (
                          <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="0" />
                            <rect x="8" y="8" width="8" height="8" fill="currentColor" stroke="none" />
                          </svg>
                        )
                      },
                      {
                        id: 'extra-rounded',
                        label: 'Rounded',
                        svg: (
                          <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="4.5" />
                            <rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />
                          </svg>
                        )
                      },
                      {
                        id: 'dot',
                        label: 'Circle',
                        svg: (
                          <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
                          </svg>
                        )
                      }
                    ].map((item) => (
                      <button 
                        key={item.id}
                        type="button"
                        onClick={() => setCornerStyle(item.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${cornerStyle === item.id ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/5 bg-slate-900/60 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                      >
                        {item.svg}
                        <span className="text-[10px] font-medium tracking-tight mt-1">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corner Dots */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Corner Eye Center</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: 'square',
                        label: 'Square',
                        svg: (
                          <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="7" y="7" width="10" height="10" />
                          </svg>
                        )
                      },
                      {
                        id: 'dot',
                        label: 'Circle',
                        svg: (
                          <svg className="w-6 h-6 mb-1 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="5" />
                          </svg>
                        )
                      }
                    ].map((item) => (
                      <button 
                        key={item.id}
                        type="button"
                        onClick={() => setCornerDotStyle(item.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${cornerDotStyle === item.id ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/5 bg-slate-900/60 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                      >
                        {item.svg}
                        <span className="text-[10px] font-medium tracking-tight mt-1">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Preview & Export Panel (4 cols wide) */}
          <div className="lg:col-span-4 bg-slate-800/40 border border-white/5 rounded-3xl p-6 flex flex-col gap-6 justify-between self-stretch">
            
            {/* Live Preview Wrapper */}
            <div className="space-y-3 flex flex-col items-center w-full">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block w-full text-left">Live Preview</span>
              
              <div 
                className={`p-6 rounded-2xl shadow-xl transition-all w-full aspect-square flex flex-col items-center justify-center border border-white/5 relative overflow-hidden`} 
                style={{ background: bgColor }}
              >
                {/* QR Canvas Destination */}
                <div 
                  ref={ref} 
                  className="flex items-center justify-center w-full max-w-[280px] aspect-square overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>canvas]:w-full [&>canvas]:h-auto [&>svg]:max-w-full [&>canvas]:max-w-full [&>svg]:mx-auto" 
                />
                
                {frame === 'outline' && (
                  <div className="absolute inset-2 border-2 border-slate-300/40 rounded-xl pointer-events-none" />
                )}
                
                {frame === 'scan' && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 text-white border border-white/10 px-5 py-1.5 rounded-full text-[10px] font-bold tracking-widest shadow-lg">
                    SCAN ME
                  </div>
                )}
              </div>
              
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-2 justify-center">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Point camera to scan & verify
              </p>
            </div>

            {/* Quality & Contrast Checks */}
            <div className="space-y-3 bg-slate-900/60 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-400" /> Color Contrast
                </span>
                <span className={`text-xs font-bold ${contrastOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {ratio}:1
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${contrastOk ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]'}`} />
                <span className="text-[11px] text-slate-300 font-medium">
                  {contrastOk ? 'Excellent scannability rating' : 'Low contrast, scans may fail'}
                </span>
              </div>
            </div>

            {/* Size Slider & Export Actions */}
            <div className="space-y-4 pt-2">
              
              {/* Size slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" /> Output Size
                  </label>
                  <span className="font-mono text-slate-400 text-[10px]">{size}x{size}px</span>
                </div>
                <input 
                  aria-label="Export size" 
                  type="range" 
                  min="256" 
                  max="1024" 
                  step="128"
                  value={size} 
                  onChange={(e) => setSize(Number(e.target.value))} 
                  className="w-full accent-blue-500 h-1 bg-slate-900 rounded-lg cursor-pointer appearance-none" 
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-medium px-0.5">
                  <span>Small (256px)</span>
                  <span>Medium (512px)</span>
                  <span>Print (1024px)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownload('png')} 
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/10 flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PNG
                  </button>
                  <button 
                    onClick={() => handleDownload('svg')} 
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl border border-white/5 flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-indigo-400" /> Export SVG
                  </button>
                </div>
                <button 
                  onClick={onClose} 
                  className="w-full border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold py-2.5 rounded-xl transition duration-200 cursor-pointer"
                >
                  Close Editor
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export default QRCustomizer;
