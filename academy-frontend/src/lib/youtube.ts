// use client
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReadyPromise: Promise<any> | null = null;

/** Nạp YouTube IFrame API một lần và đợi ready */
export function loadYouTubeIframeAPI(): Promise<typeof window.YT> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window"));
  }

  // Đã có API & Player
  if (window.YT && typeof window.YT.Player === "function") {
    return Promise.resolve(window.YT);
  }

  // Đang nạp dở -> dùng lại promise
  if (ytReadyPromise) return ytReadyPromise;

  ytReadyPromise = new Promise((resolve) => {
    // Tránh chèn trùng script
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }

    // Callback global do YouTube gọi khi sẵn sàng
    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };
  });

  return ytReadyPromise;
}
