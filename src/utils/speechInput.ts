interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.webkitSpeechRecognition ?? win.SpeechRecognition ?? null;
}

export function isSpeechInputSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export interface SpeechController {
  stop: () => void;
}

export function startEnglishSpeechInput(callbacks: {
  onTranscript: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}): SpeechController | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    callbacks.onError?.(
      '이 기기에서는 키보드의 마이크 버튼을 눌러 영어로 말해 보세요!'
    );
    return null;
  }

  try {
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      callbacks.onEnd?.();
    };

    recognition.onresult = (event) => {
      const firstResult = event.results?.[0]?.[0]?.transcript ?? '';
      const cleaned = firstResult.trim();
      if (cleaned) {
        callbacks.onTranscript(cleaned);
      }
      finish();
    };

    recognition.onerror = () => {
      finish();
      callbacks.onError?.(
        '목소리가 잘 들리지 않았어요. 마이크 가까이에서 다시 말해 볼까요?'
      );
    };

    recognition.onend = () => {
      finish();
    };

    callbacks.onStart?.();
    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // Ignore stop errors
        }
        finish();
      },
    };
  } catch {
    callbacks.onError?.(
      '음성 입력을 시작하지 못했어요. 키보드 마이크를 사용해 보세요!'
    );
    return null;
  }
}
