import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, RefreshCw, Check, RotateCcw, AlertTriangle, Eye } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [availableCamerasCount, setAvailableCamerasCount] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);

  // Check available video devices
  useEffect(() => {
    if (!isOpen) return;

    const countCameras = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputCount = devices.filter((d) => d.kind === 'videoinput').length;
          setAvailableCamerasCount(videoInputCount || 1);
        }
      } catch (e) {
        console.warn('Could not enumerate media devices:', e);
      }
    };
    countCameras();
  }, [isOpen]);

  // Handle stream lifecycle
  useEffect(() => {
    let isSubscribed = true;

    if (isOpen && !capturedImage) {
      startCamera(isSubscribed);
    } else {
      stopCamera();
    }

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [isOpen, facingMode, capturedImage]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (isSubscribed: boolean = true) => {
    setIsInitializing(true);
    setError(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (isSubscribed) {
        setError('Il browser in uso non supporta l’accesso alla fotocamera (MediaDevices API non disponibile).');
        setIsInitializing(false);
      }
      return;
    }

    let mediaStream: MediaStream | null = null;

    // 1st attempt: try requested facingMode
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err1) {
      console.warn('1st getUserMedia attempt with facingMode failed, falling back to basic video:', err1);
      // 2nd attempt fallback: basic video stream (works on all PC webcams)
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err2: any) {
        console.error('2nd getUserMedia attempt failed:', err2);
        if (isSubscribed) {
          if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
            setError('Accesso alla fotocamera negato. Abilita i permessi fotocamera nelle impostazioni del tuo browser.');
          } else if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') {
            setError('Nessuna fotocamera rilevata sul dispositivo.');
          } else {
            setError('Impossibile avviare la fotocamera. Verifica che non sia in uso da un’altra applicazione.');
          }
          setIsInitializing(false);
        }
        return;
      }
    }

    if (!isSubscribed) {
      mediaStream?.getTracks().forEach((t) => t.stop());
      return;
    }

    setStream(mediaStream);

    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      try {
        await videoRef.current.play();
      } catch (e) {
        console.warn('Video play error:', e);
      }
    }
    setIsInitializing(false);
  };

  const getSnapshotDataUrl = (): string | null => {
    const video = videoRef.current;
    if (!video) return null;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    if (vw === 0 || vh === 0) {
      return null;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    const targetSize = 400;
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const cropSize = Math.min(vw, vh);
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;

    ctx.save();
    // Mirror horizontally for front camera (user mode)
    if (facingMode === 'user') {
      ctx.translate(targetSize, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);
    ctx.restore();

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        return dataUrl;
      }
      return null;
    } catch (e) {
      console.error('Error generating image dataUrl:', e);
      return null;
    }
  };

  // Direct 1-click: Take Snapshot and immediately save to athlete
  const handleDirectCaptureAndSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const dataUrl = getSnapshotDataUrl();
    if (!dataUrl) {
      setError('Attendi qualche istante che la fotocamera sia pronta prima di scattare.');
      return;
    }

    // Trigger visual shutter flash
    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
      stopCamera();
      onCapture(dataUrl);
      onClose();
    }, 150);
  };

  // 2-step: Freeze frame to inspect before saving
  const handlePreviewCapture = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const dataUrl = getSnapshotDataUrl();
    if (!dataUrl) {
      setError('Attendi qualche istante che la fotocamera sia pronta prima di scattare.');
      return;
    }

    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
      setCapturedImage(dataUrl);
      stopCamera();
    }, 150);
  };

  const handleRetake = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCapturedImage(null);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const toggleFacingMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-[#11141d] border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 relative z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Fotocamera Profilo
              </h3>
              <p className="text-xs text-slate-400">Scatta una foto per la scheda atleta</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera View / Captured Image Preview */}
        <div className="relative aspect-square w-full bg-[#0b0e14] rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          {/* Shutter Flash Animation */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-20 pointer-events-none animate-out fade-out duration-150" />
          )}

          {error ? (
            <div className="p-6 text-center text-rose-400 text-xs space-y-3">
              <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 opacity-80" />
              <p className="font-semibold text-slate-200">{error}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera(true);
                }}
                className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Riprova Connessione
              </button>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Foto Scattata"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => setIsInitializing(false)}
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
              {isInitializing && (
                <div className="absolute inset-0 bg-[#0b0e14]/90 flex items-center justify-center text-xs text-slate-400 font-semibold gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  Avvio Fotocamera...
                </div>
              )}
            </>
          )}

          {/* Hidden Canvas for High-Resolution Snapshot Processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Actions Controls */}
        <div className="flex items-center justify-between gap-2.5 pt-2">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Riprova Scatto
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Conferma e Salva
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={isInitializing || Boolean(error)}
                className={`p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                  availableCamerasCount <= 1 ? 'opacity-80' : ''
                }`}
                title={
                  availableCamerasCount > 1
                    ? 'Inverti Fotocamera (Fronte / Retro)'
                    : 'Switch Fotocamera (Fronte / Retro)'
                }
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Inverti</span>
              </button>

              <button
                type="button"
                onClick={handlePreviewCapture}
                disabled={isInitializing || Boolean(error)}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Visualizza un fermo immagine prima di confermare"
              >
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Anteprima</span>
              </button>

              <button
                type="button"
                onClick={handleDirectCaptureAndSave}
                disabled={isInitializing || Boolean(error)}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Scatta e Salva Foto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

