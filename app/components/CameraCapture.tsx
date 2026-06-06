"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          setError("이 브라우저에서는 카메라를 사용할 수 없습니다.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          // 모바일은 후면 카메라 우선, 데스크톱은 자동으로 내장 캠 사용
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS Safari 대응
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        if (e instanceof Error) {
          if (e.name === "NotAllowedError" || e.name === "SecurityError") {
            setError(
              "카메라 권한이 거부되었습니다. 브라우저 주소창 옆 자물쇠 아이콘을 눌러 카메라를 '허용'으로 변경해 주세요."
            );
          } else if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
            setError(
              "사용 가능한 카메라를 찾지 못했습니다. 외장 카메라가 연결되어 있는지 확인해 주세요."
            );
          } else {
            setError(`카메라를 열 수 없습니다: ${e.message}`);
          }
        } else {
          setError("카메라를 열 수 없습니다.");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onShoot = () => {
    const video = videoRef.current;
    if (!video || !ready || shooting) return;
    setShooting(true);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setShooting(false);
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setShooting(false);
            return;
          }
          const file = new File([blob], `logo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file);
        },
        "image/jpeg",
        0.92
      );
    } catch {
      setShooting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="카메라 촬영"
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-medium">
            {ready ? "카메라 라이브" : error ? "오류" : "카메라 준비 중..."}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white/10 transition"
          aria-label="닫기"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 비디오 영역 — 전체 화면 활용 */}
      <div className="flex-1 flex items-center justify-center px-0 overflow-hidden">
        {error ? (
          <div className="max-w-md text-center text-white/90 space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-rose-500/20 flex items-center justify-center">
              <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
              </svg>
            </div>
            <p className="text-base leading-relaxed">{error}</p>
            <button onClick={onClose} className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium hover:bg-white/20 transition">닫기</button>
          </div>
        ) : (
          <div className="relative w-full h-full bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  카메라 연결 중...
                </div>
              </div>
            )}
            {/* 가이드 프레임 — 중앙 정사각형 */}
            {ready && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
                <div className="w-full max-w-[min(75vw,75vh)] aspect-square border-2 border-white/30 rounded-2xl shadow-[inset_0_0_0_2000px_rgba(0,0,0,0.25)]" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 컨트롤 */}
      {!error && (
        <div className="px-4 py-6 flex flex-col items-center gap-3">
          <button
            onClick={onShoot}
            disabled={!ready || shooting}
            className="group relative h-20 w-20 rounded-full bg-white disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95"
            aria-label="촬영"
          >
            <span className="absolute inset-2 rounded-full ring-4 ring-black/30 group-hover:ring-indigo-500 transition" />
            {shooting && (
              <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
            )}
          </button>
          <p className="text-xs text-white/60">
            가이드 안에 로고를 맞추고 버튼을 누르세요 · ESC로 닫기
          </p>
        </div>
      )}
    </div>
  );
}
