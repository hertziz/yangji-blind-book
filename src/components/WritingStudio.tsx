import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Loader2,
  Lock,
  Mic,
  Rocket,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Star,
  Volume2,
} from 'lucide-react';
import { BOOK_CATEGORIES, type BookCharacter } from '../types/library';
import { requestCoachQuestion, requestCoachReview } from '../utils/aiCoach';
import { startEnglishSpeechInput, type SpeechController } from '../utils/speechInput';
import { isTtsSupported, speakEnglishText, stopSpeaking } from '../utils/tts';

interface WritingStudioProps {
  nextBookId: string;
  appsScriptUrl: string;
  onLockClassroom: () => void;
  onSubmitBook: (book: BookCharacter) => Promise<void>;
}

type ActiveStep = 1 | 2 | 3;

const WORD_POCKETS: Array<{
  id: string;
  title: string;
  words: string[];
}> = [
  {
    id: 'looks',
    title: '👀 생김새(필수)',
    words: [
      'tall',
      'short',
      'big eyes',
      'small nose',
      'long hair',
      'short hair',
      'curly hair',
      'straight hair',
      'glasses',
    ],
  },
  {
    id: 'clothes',
    title: '👕 옷차림(필수)',
    words: [
      'wearing a blue jacket',
      'red hat',
      'yellow raincoat',
      'white T-shirt',
      'black shorts',
      'dress',
      'boots',
      'cap',
    ],
  },
  {
    id: 'traits',
    title: '✨ 특징·취미·능력(심화 선택 - 다른 단원 표현 응용 가능)',
    words: [
      'smart',
      'brave',
      'kind',
      'funny',
      'curious',
      'likes solving mysteries',
      'likes animals',
      'can swim',
      'can fly',
      'has a magic wand',
    ],
  },
];

function ensureSentenceEnd(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function WritingStudio({
  nextBookId,
  appsScriptUrl,
  onLockClassroom,
  onSubmitBook,
}: WritingStudioProps) {
  // Left Column State
  const [isPocketOpen, setIsPocketOpen] = useState(true);
  const [activeStep, setActiveStep] = useState<ActiveStep>(1);
  const [step1Looks, setStep1Looks] = useState('');
  const [step2Clothes, setStep2Clothes] = useState('');
  const [step3Traits, setStep3Traits] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  // Voice Input State
  const [listeningStep, setListeningStep] = useState<ActiveStep | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const speechControllerRef = useRef<SpeechController | null>(null);

  const step1Ref = useRef<HTMLTextAreaElement>(null);
  const step2Ref = useRef<HTMLTextAreaElement>(null);
  const step3Ref = useRef<HTMLTextAreaElement>(null);

  // Right Column State: AI Coach & Mandatory Check Gate
  const [hasCheckedWithAi, setHasCheckedWithAi] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [questionInput, setQuestionInput] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsRate, setTtsRate] = useState<1.0 | 0.8>(1.0);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // Book Submission Form State
  const [category, setCategory] = useState<string>(BOOK_CATEGORIES[0]);
  const [characterName, setCharacterName] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [studentAuthor, setStudentAuthor] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      speechControllerRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  // Real-time combined English clue
  const mandatoryClue = [
    ensureSentenceEnd(step1Looks),
    ensureSentenceEnd(step2Clothes),
  ]
    .filter(Boolean)
    .join(' ');
  const optionalTraitsClue = ensureSentenceEnd(step3Traits);
  const combinedEnglishClue = optionalTraitsClue
    ? `${mandatoryClue} (심화) ${optionalTraitsClue}`.trim()
    : mandatoryClue;
  const spokenEnglishText = [mandatoryClue, optionalTraitsClue].filter(Boolean).join(' ');

  const canSubmit =
    Boolean(step1Looks.trim()) &&
    Boolean(step2Clothes.trim()) &&
    hasCheckedWithAi &&
    !submitLoading;

  const stopAnyActiveAudio = () => {
    stopSpeaking();
    setIsSpeaking(false);
  };

  const handleInsertWord = (word: string) => {
    const targetRef =
      activeStep === 1 ? step1Ref : activeStep === 2 ? step2Ref : step3Ref;
    const setter =
      activeStep === 1
        ? setStep1Looks
        : activeStep === 2
          ? setStep2Clothes
          : setStep3Traits;
    const currentValue =
      activeStep === 1 ? step1Looks : activeStep === 2 ? step2Clothes : step3Traits;

    const el = targetRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const before = currentValue.slice(0, start);
      const after = currentValue.slice(end);
      // Always insert with a leading space so words never stick together
      const prefixSpace = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
      const suffixSpace = after.length > 0 && !/^\s/.test(after) ? ' ' : '';
      const inserted = `${prefixSpace}${word}${suffixSpace}`;
      const nextValue = `${before}${inserted}${after}`;
      setter(nextValue);

      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + inserted.length;
        el.setSelectionRange(cursor, cursor);
      });
    } else {
      const trimmed = currentValue.trimEnd();
      const nextValue = trimmed ? `${trimmed} ${word}` : word;
      setter(nextValue);
      requestAnimationFrame(() => el?.focus());
    }
  };

  const handleToggleSpeechInput = (targetStep: ActiveStep) => {
    stopAnyActiveAudio();
    setSpeechNotice(null);
    setActiveStep(targetStep);

    // If clicking the currently listening mic button, stop recording
    if (listeningStep === targetStep) {
      speechControllerRef.current?.stop();
      speechControllerRef.current = null;
      setListeningStep(null);
      return;
    }

    // Stop previous step's recording if another step was active
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }

    const setter =
      targetStep === 1
        ? setStep1Looks
        : targetStep === 2
          ? setStep2Clothes
          : setStep3Traits;

    const controller = startEnglishSpeechInput({
      onStart: () => setListeningStep(targetStep),
      onTranscript: (spoken) => {
        setter((prev) => {
          const trimmed = prev.trimEnd();
          return trimmed ? `${trimmed} ${spoken}` : spoken;
        });
      },
      onEnd: () => {
        setListeningStep(null);
        speechControllerRef.current = null;
      },
      onError: (msg) => {
        setListeningStep(null);
        speechControllerRef.current = null;
        setSpeechNotice(msg);
      },
    });

    speechControllerRef.current = controller;
  };

  const handleAiReview = async () => {
    stopAnyActiveAudio();
    if (!step1Looks.trim() || !step2Clothes.trim()) {
      setReviewError('Step 1(생김새)과 Step 2(옷차림) 문장을 먼저 입력해 주세요.');
      return;
    }

    if (initialSnapshot === null && combinedEnglishClue) {
      setInitialSnapshot(combinedEnglishClue);
    }

    setReviewError(null);
    setReviewLoading(true);

    try {
      const feedback = await requestCoachReview({
        step1Looks,
        step2Clothes,
        step3Traits,
      });
      setAiFeedback(feedback);
      setHasCheckedWithAi(true);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : '잠시 인터넷 연결을 확인하고 다시 눌러주세요.'
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const handleAskQuestion = async (e: FormEvent) => {
    e.preventDefault();
    stopAnyActiveAudio();
    const cleanQ = questionInput.trim();
    if (!cleanQ) {
      setAskError('궁금한 표현이나 단어를 한국어로 입력해 주세요.');
      return;
    }

    setAskError(null);
    setAskLoading(true);
    try {
      const answer = await requestCoachQuestion({
        question: cleanQ,
        currentDraft: combinedEnglishClue,
      });
      setAiAnswer(answer);
    } catch (err) {
      setAskError(
        err instanceof Error ? err.message : '잠시 인터넷 연결을 확인하고 다시 눌러주세요.'
      );
    } finally {
      setAskLoading(false);
    }
  };

  const handleToggleTts = () => {
    if (isSpeaking) {
      stopAnyActiveAudio();
      return;
    }
    if (!spokenEnglishText) {
      setTtsError('먼저 Step 1과 Step 2에 영어 문장을 입력해 주세요.');
      return;
    }
    setTtsError(null);
    speakEnglishText(spokenEnglishText, {
      rate: ttsRate,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        setTtsError('음성을 재생하지 못했어요. 잠시 후 다시 눌러주세요.');
      },
    });
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLoading) return;
    stopAnyActiveAudio();
    setSubmitError(null);

    if (!step1Looks.trim() || !step2Clothes.trim()) {
      setSubmitError('Step 1(생김새)과 Step 2(옷차림) 필수 영어 문장을 입력해 주세요.');
      return;
    }
    if (!hasCheckedWithAi) {
      setSubmitError('먼저 [🔍 내 영어 문장 점검받기]를 눌러 문장을 점검해 보세요!');
      return;
    }
    if (
      !characterName.trim() ||
      !bookTitle.trim() ||
      !author.trim() ||
      !callNumber.trim() ||
      !studentAuthor.trim()
    ) {
      setSubmitError('도서 정보 6개 항목을 모두 입력해 주세요.');
      return;
    }

    setSubmitLoading(true);
    try {
      const newBook: BookCharacter = {
        id: nextBookId,
        category,
        englishClue: combinedEnglishClue,
        characterName: characterName.trim(),
        bookTitle: bookTitle.trim(),
        author: author.trim(),
        callNumber: callNumber.trim(),
        studentAuthor: studentAuthor.trim(),
      };

      await onSubmitBook(newBook);

      // Clear all inputs cleanly after submission
      setStep1Looks('');
      setStep2Clothes('');
      setStep3Traits('');
      setInitialSnapshot(null);
      setHasCheckedWithAi(false);
      setAiFeedback(null);
      setAiAnswer(null);
      setQuestionInput('');
      setCharacterName('');
      setBookTitle('');
      setAuthor('');
      setCallNumber('');
      setStudentAuthor('');
    } catch {
      setSubmitError('잠시 인터넷 연결을 확인하고 다시 눌러주세요.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleResetWriting = () => {
    stopAnyActiveAudio();
    setStep1Looks('');
    setStep2Clothes('');
    setStep3Traits('');
    setInitialSnapshot(null);
    setHasCheckedWithAi(false);
    setAiFeedback(null);
    setReviewError(null);
    setSpeechNotice(null);
  };

  const handleLockClick = () => {
    speechControllerRef.current?.stop();
    stopAnyActiveAudio();
    onLockClassroom();
  };

  return (
    <div className="space-y-6">
      {/* Studio Header with Classroom Lock Button */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            나의 북캐릭터 영어 소개글 쓰기 &amp; 스스로 점검
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            교과서 표현 주머니와 말하기 버튼으로 문장을 쓰고, AI 코치의 힌트를 받아 스스로 고쳐 보세요.
          </p>
        </div>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleLockClick}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
            <span>🔒 수업 끝 / 잠그기</span>
          </button>
        </div>
      </section>

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. Collapsible YBM(김) Expression Pocket */}
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPocketOpen((prev) => !prev)}
              aria-expanded={isPocketOpen}
              className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
            >
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  YBM(김) 3~5학년 교과서 표현 주머니
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  단어를 누르면 앞 띄어쓰기와 함께 Step {activeStep} 입력창에 바로 들어가요!
                </p>
              </div>
              <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">
                {isPocketOpen ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
              </span>
            </button>

            {isPocketOpen && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-blue-50/70 border border-blue-100 rounded-xl px-3.5 py-2">
                  <span>
                    현재 입력 칸:{' '}
                    <strong className="text-blue-800">
                      Step {activeStep} (
                      {activeStep === 1
                        ? '생김새'
                        : activeStep === 2
                          ? '옷차림'
                          : '특징·취미·능력'}
                      )
                    </strong>
                  </span>
                  <div className="flex items-center gap-1">
                    {([1, 2, 3] as const).map((stepNum) => (
                      <button
                        key={stepNum}
                        type="button"
                        onClick={() => setActiveStep(stepNum)}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                          activeStep === stepNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
                        }`}
                      >
                        Step {stepNum}
                      </button>
                    ))}
                  </div>
                </div>

                {WORD_POCKETS.map((pocket) => (
                  <div key={pocket.id} className="space-y-2">
                    <p className="text-xs font-bold text-slate-800">{pocket.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pocket.words.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() => handleInsertWord(word)}
                          className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          + {word}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. 3-Step English Writing Inputs + Voice Speech Input */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                3단계 영어 인물 묘사 쓰기
              </h2>
              <button
                type="button"
                onClick={handleResetWriting}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>글 비우기</span>
              </button>
            </div>

            {speechNotice && (
              <p
                role="status"
                className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5"
              >
                {speechNotice}
              </p>
            )}

            {/* Step 1: Mandatory Looks */}
            <div
              className={`rounded-xl p-4 border transition-colors ${
                activeStep === 1
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/60 border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <label htmlFor="studio-step-1" className="block text-sm font-bold text-slate-900">
                    Step 1. 생김새 묘사 (필수)
                  </label>
                  <span className="text-xs font-medium text-blue-700">
                    He is ... / She is ... 또는 He has ... / She has ...
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSpeechInput(1)}
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    listeningStep === 1
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {listeningStep === 1 ? (
                    <span>🔴 듣는 중...</span>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>🎤 말하기</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="studio-step-1"
                ref={step1Ref}
                rows={2}
                value={step1Looks}
                onFocus={() => setActiveStep(1)}
                onChange={(e) => setStep1Looks(e.target.value)}
                placeholder="예: He is tall and thin. He has sharp eyes."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Step 2: Mandatory Clothes */}
            <div
              className={`rounded-xl p-4 border transition-colors ${
                activeStep === 2
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/60 border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <label htmlFor="studio-step-2" className="block text-sm font-bold text-slate-900">
                    Step 2. 옷차림 묘사 (필수)
                  </label>
                  <span className="text-xs font-medium text-blue-700">
                    He is wearing ... / She is wearing ...
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSpeechInput(2)}
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    listeningStep === 2
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {listeningStep === 2 ? (
                    <span>🔴 듣는 중...</span>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>🎤 말하기</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="studio-step-2"
                ref={step2Ref}
                rows={2}
                value={step2Clothes}
                onFocus={() => setActiveStep(2)}
                onChange={(e) => setStep2Clothes(e.target.value)}
                placeholder="예: He is wearing a brown coat and a cap."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Step 3: Optional Special Traits */}
            <div
              className={`rounded-xl p-4 border transition-colors ${
                activeStep === 3
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/60 border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <label htmlFor="studio-step-3" className="block text-sm font-bold text-slate-900">
                    Step 3. 인물의 특징·취미·능력 (심화 선택)
                  </label>
                  <span className="text-xs text-slate-500">
                    He/She is ... · He/She likes ... · He/She can ...
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSpeechInput(3)}
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    listeningStep === 3
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {listeningStep === 3 ? (
                    <span>🔴 듣는 중...</span>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>🎤 말하기</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="studio-step-3"
                ref={step3Ref}
                rows={2}
                value={step3Traits}
                onFocus={() => setActiveStep(3)}
                onChange={(e) => setStep3Traits(e.target.value)}
                placeholder="예: He is very smart and likes solving mysteries."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {/* Real-time Combined Text & Initial vs Current Growth Comparison */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-700 mb-1.5">
                  합쳐진 최종 영어 설명 (시트에 저장될 문장)
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm leading-relaxed text-slate-900 min-h-[52px]">
                  {combinedEnglishClue || (
                    <span className="text-slate-400">
                      Step 1~3에 영어 문장을 입력하면 여기에 하나로 합쳐져서 나타나요.
                    </span>
                  )}
                </div>
              </div>

              {initialSnapshot && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      나의 문장 성장 비교 (처음 vs 지금)
                    </span>
                    {initialSnapshot !== combinedEnglishClue && (
                      <span className="text-[11px] font-semibold text-emerald-800">
                        스스로 고쳐 쓴 부분이 생겼어요!
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-white/90 border border-emerald-200/80 rounded-lg p-2.5">
                      <p className="font-bold text-slate-500 mb-1">[처음 쓴 문장]</p>
                      <p className="text-slate-700 leading-relaxed">{initialSnapshot}</p>
                    </div>
                    <div className="bg-white border border-emerald-300 rounded-lg p-2.5">
                      <p className="font-bold text-emerald-800 mb-1">[현재 문장]</p>
                      <p className="text-slate-900 font-medium leading-relaxed">
                        {combinedEnglishClue || '(입력 중)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. AI Coaching & Student Question Box */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  AI 스스로 점검 코치
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  정답을 대신 써주지 않고, 스스로 고칠 수 있는 힌트만 알려드려요.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAiReview}
                disabled={reviewLoading}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {reviewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>점검 중...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" aria-hidden="true" />
                    <span>🔍 내 영어 문장 점검받기</span>
                  </>
                )}
              </button>
            </div>

            {reviewError && (
              <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5" role="alert">
                {reviewError}
              </p>
            )}

            {aiFeedback ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                {aiFeedback}
              </div>
            ) : (
              <div className="bg-slate-50/70 border border-dashed border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
                왼쪽에 Step 1과 Step 2 문장을 쓴 뒤 <strong>[🔍 내 영어 문장 점검받기]</strong>를 누르면
                잘한 점, 스스로 고쳐볼 점, 생각 더하기 3줄 피드백을 받을 수 있어요.
              </div>
            )}

            {/* Question Input Box */}
            <form onSubmit={handleAskQuestion} className="pt-4 border-t border-slate-100 space-y-3">
              <label htmlFor="coach-question-input" className="block text-sm font-bold text-slate-900">
                🙋 표현·단어 질문하기
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="coach-question-input"
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="예: 줄무늬 셔츠는 영어로 어떻게 써요?"
                  maxLength={120}
                  className="flex-1 min-h-[42px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={askLoading}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  {askLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <HelpCircle className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{askLoading ? '생각 중...' : '질문하기'}</span>
                </button>
              </div>

              {askError && (
                <p className="text-xs font-medium text-rose-600" role="alert">
                  {askError}
                </p>
              )}

              {aiAnswer && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                  {aiAnswer}
                </div>
              )}
            </form>
          </section>

          {/* 2. Blind Card Preview + Web Speech API TTS */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                친구들에게 보일 블라인드 카드 미리보기
              </h2>

              <div className="flex items-center gap-2">
                <div
                  className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg"
                  role="group"
                  aria-label="발음 듣기 속도"
                >
                  <button
                    type="button"
                    onClick={() => {
                      stopAnyActiveAudio();
                      setTtsRate(1.0);
                    }}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                      ttsRate === 1.0 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    1.0x
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopAnyActiveAudio();
                      setTtsRate(0.8);
                    }}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                      ttsRate === 0.8 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    0.8x
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTts}
                  disabled={!isTtsSupported()}
                  className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                    isSpeaking
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {isSpeaking ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      <span>멈추기</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>🔊 내 문장 발음 들어보기</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {ttsError && (
              <p className="text-xs font-medium text-rose-600" role="alert">
                {ttsError}
              </p>
            )}

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600 mb-3.5">
                <span className="font-semibold text-slate-800">{category}</span>
                <span className="text-slate-500">
                  Written by{' '}
                  <strong className="font-semibold text-slate-700">
                    {studentAuthor.trim() || '5학년 꼬마작가'}
                  </strong>
                </span>
              </div>

              <div className="space-y-3">
                <div className="bg-blue-50/85 border border-blue-200/80 rounded-xl p-4">
                  <span className="inline-block text-[11px] font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-md mb-2">
                    👀 생김새 &amp; 👕 옷차림 (필수 단서)
                  </span>
                  <p className="text-lg leading-relaxed font-medium text-slate-900">
                    {mandatoryClue
                      ? `“${mandatoryClue}”`
                      : '“Step 1과 Step 2를 작성하면 여기에 카드가 채워져요.”'}
                  </p>
                </div>

                {optionalTraitsClue && (
                  <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4">
                    <span className="inline-block text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md mb-1.5">
                      ✨ 특별한 특징 (심화 단서)
                    </span>
                    <p className="text-base leading-relaxed text-slate-800">
                      {optionalTraitsClue}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Star className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                  <span>책 제목과 인물 이름은 가려져 있어요</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold">
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>이 인물 만나보기</span>
                </span>
              </div>
            </div>
          </section>

          {/* 3. Book Metadata & Mandatory AI Check Submit Form */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  도서 정보 입력 및 제출
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {appsScriptUrl
                    ? '제출하면 선생님 구글 시트와 추천 보드에 바로 올라갑니다.'
                    : '제출하면 추천 보드에 바로 등록됩니다. (구글 시트 연동은 선생님 DB 설정 후 사용)'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="submit-category" className="block text-xs font-semibold text-slate-700 mb-1">
                    1) 카테고리 (category)
                  </label>
                  <select
                    id="submit-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {BOOK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="submit-character" className="block text-xs font-semibold text-slate-700 mb-1">
                    2) 숨겨진 등장인물 이름 (characterName)
                  </label>
                  <input
                    id="submit-character"
                    type="text"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="예: 셜록 홈즈"
                    className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="submit-book-title" className="block text-xs font-semibold text-slate-700 mb-1">
                    3) 추천 도서명 (bookTitle)
                  </label>
                  <input
                    id="submit-book-title"
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="예: 어린이 셜록 홈즈 단편선"
                    className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="submit-author" className="block text-xs font-semibold text-slate-700 mb-1">
                    4) 저자 (author)
                  </label>
                  <input
                    id="submit-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="예: 아서 코난 도일"
                    className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="submit-call-number" className="block text-xs font-semibold text-slate-700 mb-1">
                    5) 학교도서관 청구기호 (callNumber)
                  </label>
                  <input
                    id="submit-call-number"
                    type="text"
                    value={callNumber}
                    onChange={(e) => setCallNumber(e.target.value)}
                    placeholder="예: 843-코19ㅅ"
                    className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="submit-student" className="block text-xs font-semibold text-slate-700 mb-1">
                    6) 작성 학생 학반·별칭 (studentAuthor)
                  </label>
                  <input
                    id="submit-student"
                    type="text"
                    value={studentAuthor}
                    onChange={(e) => setStudentAuthor(e.target.value)}
                    placeholder="예: 5-1 코난"
                    className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-xs font-medium text-rose-600" role="alert">
                  {submitError}
                </p>
              )}

              {!hasCheckedWithAi && (
                <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                  먼저 [🔍 내 영어 문장 점검받기]를 눌러 문장을 점검해 보세요!
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl bg-blue-600 text-white text-sm sm:text-base font-bold hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>제출 중입니다...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" aria-hidden="true" />
                    <span>🚀 구글 시트로 최종 제출하기</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
