export interface TtsOptions {
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakEnglishText(text: string, options: TtsOptions = {}): void {
  const { rate = 1.0, onStart, onEnd, onError } = options;

  if (!isTtsSupported()) {
    onError?.('이 브라우저에서는 음성 듣기(TTS) 기능을 지원하지 않습니다.');
    return;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    onError?.('읽을 영어 문장이 없습니다.');
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang === 'en-US' && v.localService) ||
      voices.find((v) => v.lang.startsWith('en-US')) ||
      voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      onStart?.();
    };
    utterance.onend = () => {
      onEnd?.();
    };
    utterance.onerror = () => {
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    onError?.('음성 재생 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }
}
