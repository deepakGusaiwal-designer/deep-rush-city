import React from 'react';
import { MonitorX, RefreshCw, Cpu, Globe, ExternalLink } from 'lucide-react';

interface WebGLErrorScreenProps {
  detail: string;
  onRetry: () => void;
}

/** Shown instead of the game when the browser cannot create a WebGL context. */
export const WebGLErrorScreen: React.FC<WebGLErrorScreenProps> = ({ detail, onRetry }) => {
  const isChromium = /Chrome|Edg/.test(navigator.userAgent);
  const isEdge = /Edg/.test(navigator.userAgent);
  const settingsUrl = isEdge ? 'edge://settings/system' : 'chrome://settings/system';
  const gpuUrl = isEdge ? 'edge://gpu' : 'chrome://gpu';

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-950 text-white p-6 select-text">
      <div className="glass-panel-glow max-w-xl w-full rounded-3xl border border-rose-500/40 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <MonitorX className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-300">Deep Rush City</div>
            <h1 className="text-2xl font-black leading-tight">3D graphics are unavailable</h1>
          </div>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">
          Your browser refused to create a WebGL context, so the city can't be rendered. This is a
          browser / GPU setting, not a problem with your PC's power — it usually means hardware
          acceleration is switched off or the GPU is blocklisted.
        </p>

        <div className="mt-4 rounded-xl bg-black/40 border border-white/10 p-3 text-[11px] font-mono text-rose-200 break-words">
          {detail}
        </div>

        <h2 className="mt-5 text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5" /> How to fix it
        </h2>
        <ol className="mt-2 space-y-2 text-sm text-gray-200 list-decimal list-inside">
          {isChromium ? (
            <>
              <li>
                Open <code className="px-1 py-0.5 rounded bg-white/10 text-cyan-200">{settingsUrl}</code> and turn on
                <span className="font-semibold"> "Use graphics acceleration when available"</span>, then relaunch the browser.
              </li>
              <li>
                Check <code className="px-1 py-0.5 rounded bg-white/10 text-cyan-200">{gpuUrl}</code> — <em>WebGL</em> and <em>WebGL2</em>
                should say <span className="text-emerald-300 font-semibold">Hardware accelerated</span>. If they say
                "Disabled", the GPU was blocklisted or crashed: relaunch, update your graphics driver, or enable
                <code className="px-1 py-0.5 rounded bg-white/10 text-cyan-200 ml-1">chrome://flags/#ignore-gpu-blocklist</code>.
              </li>
              <li>
                No working GPU at all? Launch with the software renderer:
                <code className="block mt-1 px-2 py-1.5 rounded bg-white/10 text-cyan-200 text-[11px]">
                  chrome.exe --enable-unsafe-swiftshader --ignore-gpu-blocklist
                </code>
              </li>
            </>
          ) : (
            <>
              <li>Enable hardware acceleration / WebGL in your browser settings and relaunch.</li>
              <li>Update your graphics driver, or try the latest Chrome, Edge or Firefox.</li>
            </>
          )}
          <li>Close other GPU-heavy tabs (many open 3D tabs can exhaust the browser's WebGL context limit) and retry.</li>
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-black text-sm flex items-center gap-2 hover:bg-cyan-300 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-cyan-500/30"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <a
            href="https://get.webgl.org/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl border border-white/15 text-gray-200 text-sm font-bold flex items-center gap-2 hover:bg-white/10 transition-colors"
          >
            <Globe className="w-4 h-4" /> Test WebGL support <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      </div>
    </div>
  );
};
