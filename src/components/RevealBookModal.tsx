import { useEffect, useState, type FormEvent } from 'react';
import { BookMarked, Check, Copy, MapPin, Square, Star, Volume2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getBookReviewStats,
  parseEnglishClue,
  type BookCharacter,
  type BookReview,
} from '../types/library';
import { isTtsSupported, speakEnglishText, stopSpeaking } from '../utils/tts';

interface RevealBookModalProps {
  book: BookCharacter | null;
  reviews: BookReview[];
  onClose: () => void;
  onAddReview: (review: BookReview) => Promise<void> | void;
}

export function RevealBookModal({
  book,
  reviews,
  onClose,
  onAddReview,
}: RevealBookModalProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsRate, setTtsRate] = useState<1.0 | 0.8>(1.0);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [copiedCallNum, setCopiedCallNum] = useState(false);

  // Strict 3-field review form state
  const [reviewer, setReviewer] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const haltAudioImmediately = () => {
    stopSpeaking();
    setIsSpeaking(false);
  };

  useEffect(() => {
    haltAudioImmediately();
    setTtsError(null);
    setCopiedCallNum(false);
    setFormError(null);
    return () => {
      stopSpeaking();
    };
  }, [book?.id]);

  useEffect(() => {
    if (!book) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        haltAudioImmediately();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [book, onClose]);

  if (!book) return null;

  const { looksAndClothes, specialTraits, spokenText } = parseEnglishClue(book.englishClue);
  const bookReviews = reviews.filter((r) => r.bookId === book.id);
  const { average, count } = getBookReviewStats(book.id, reviews);
  const ttsAvailable = isTtsSupported();

  const handleCloseModal = () => {
    haltAudioImmediately();
    onClose();
  };

  const handleToggleTts = () => {
    if (isSpeaking) {
      haltAudioImmediately();
      return;
    }
    setTtsError(null);
    speakEnglishText(spokenText, {
      rate: ttsRate,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => {
        setIsSpeaking(false);
        setTtsError('음성을 재생하지 못했어요. 잠시 후 다시 눌러주세요.');
      },
    });
  };

  const handleRateChange = (nextRate: 1.0 | 0.8) => {
    setTtsRate(nextRate);
    if (isSpeaking) {
      haltAudioImmediately();
      speakEnglishText(spokenText, {
        rate: nextRate,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => {
          setIsSpeaking(false);
          setTtsError('음성을 재생하지 못했어요. 잠시 후 다시 눌러주세요.');
        },
      });
    }
  };

  const handleCopyCallNumber = async () => {
    haltAudioImmediately();
    try {
      await navigator.clipboard.writeText(book.callNumber);
      setCopiedCallNum(true);
      setTimeout(() => setCopiedCallNum(false), 1800);
    } catch {
      // Clipboard might be restricted in some iframes
    }
  };

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    haltAudioImmediately();

    const cleanReviewer = reviewer.trim();
    const cleanComment = comment.trim();

    if (!cleanReviewer) {
      setFormError('작성자 이름(또는 학반·닉네임)을 입력해 주세요.');
      return;
    }
    if (!cleanComment) {
      setFormError('한 줄 서평 내용을 입력해 주세요.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await onAddReview({
        bookId: book.id,
        reviewer: cleanReviewer,
        rating,
        comment: cleanComment,
      });
      setReviewer('');
      setRating(5);
      setComment('');
    } catch {
      setFormError('잠시 인터넷 연결을 확인하고 다시 눌러주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/55 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-character-title"
        onClick={handleCloseModal}
      >
        <div className="perspective-1200 w-full max-w-2xl">
          <motion.div
            key={book.id}
            initial={{ rotateY: 75, opacity: 0, scale: 0.96 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
          >
            {/* Modal Top Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white/95 backdrop-blur border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                <span className="font-semibold text-slate-900 whitespace-nowrap">{book.category}</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="truncate">Written by {book.studentAuthor}</span>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="창 닫기"
                className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-7 space-y-7">
              {/* Step 2: Revealed Identity & Eye-catching Library Ticket Call Number */}
              <section aria-label="등장인물 및 도서 정보">
                <p className="text-xs font-semibold text-blue-600 mb-1.5">
                  정체 공개 · Reveal Character &amp; Book
                </p>
                <h2
                  id="reveal-character-title"
                  className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
                >
                  {book.characterName}
                </h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-slate-700">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                    <BookMarked className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                    《{book.bookTitle}》
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>지은이: {book.author}</span>
                </div>

                {/* High-Visibility Library Shelf Ticket Box */}
                <div className="mt-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        도서관 서가에서 바로 찾아보세요!
                      </p>
                      <p className="text-sm sm:text-base font-bold text-amber-950 mt-1 flex flex-wrap items-center gap-2">
                        <span>📚 도서관 위치(청구기호):</span>
                        <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight bg-white px-3 py-1 rounded-lg border-2 border-dashed border-amber-400 text-amber-950">
                          {book.callNumber}
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCallNumber}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-white border border-amber-300 text-xs font-bold text-amber-950 hover:bg-amber-100 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    {copiedCallNum ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        <span>복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        <span>청구기호 복사</span>
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* English Description Recap + Web Speech API TTS */}
              <section className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    친구가 쓴 영어 인물 묘사 다시 보기
                  </h3>

                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className="inline-flex items-center p-0.5 bg-white border border-slate-200 rounded-lg"
                      role="group"
                      aria-label="음성 속도 선택"
                    >
                      <button
                        type="button"
                        onClick={() => handleRateChange(1.0)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          ttsRate === 1.0
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        1.0x 보통
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRateChange(0.8)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          ttsRate === 0.8
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        0.8x 천천히
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleTts}
                      disabled={!ttsAvailable}
                      className={`inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSpeaking
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                          <span>멈추기</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" aria-hidden="true" />
                          <span>🔊 영어로 듣기</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">
                      👀 생김새와 👕 옷차림 (필수 단서)
                    </p>
                    <p className="text-lg leading-relaxed font-medium text-slate-900">
                      {looksAndClothes}
                    </p>
                  </div>

                  {specialTraits && (
                    <div className="pt-3 border-t border-slate-200/80">
                      <p className="text-xs font-semibold text-amber-800 mb-1">
                        ✨ 특별한 특징 (심화 단서)
                      </p>
                      <p className="text-base leading-relaxed text-slate-700">
                        {specialTraits}
                      </p>
                    </div>
                  )}
                </div>

                {ttsError && (
                  <p className="text-xs font-medium text-rose-600" role="alert">
                    {ttsError}
                  </p>
                )}
                {!ttsAvailable && (
                  <p className="text-xs text-slate-500">
                    이 기기에서는 영어로 듣기 기능이 지원되지 않아요. 크롬(Chrome) 브라우저에서 이용해 보세요.
                  </p>
                )}
              </section>

              {/* Step 3: Reviews List & Strictly 3-Field Review Form */}
              <section className="pt-2 border-t border-slate-200 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    우리 학교 친구들의 한 줄 서평
                  </h3>
                  <div className="inline-flex items-center gap-1.5 text-sm text-slate-700 tabular-nums">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-500" aria-hidden="true" />
                    <strong className="font-bold text-slate-900">
                      {count > 0 ? average.toFixed(1) : '0.0'}
                    </strong>
                    <span className="text-slate-400">({count}개)</span>
                  </div>
                </div>

                {/* Review Form: Strictly 3 inputs (작성자, 별점, 한 줄 서평) */}
                <form
                  onSubmit={handleReviewSubmit}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="review-author"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        작성자
                      </label>
                      <input
                        id="review-author"
                        type="text"
                        value={reviewer}
                        onChange={(e) => setReviewer(e.target.value)}
                        placeholder="예: 6-2 책벌레"
                        maxLength={30}
                        className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                        별점 ({rating}점)
                      </span>
                      <div className="flex items-center gap-1 min-h-[42px]">
                        {[1, 2, 3, 4, 5].map((starValue) => {
                          const active = starValue <= (hoverRating ?? rating);
                          return (
                            <button
                              key={starValue}
                              type="button"
                              onClick={() => {
                                haltAudioImmediately();
                                setRating(starValue);
                              }}
                              onMouseEnter={() => setHoverRating(starValue)}
                              onMouseLeave={() => setHoverRating(null)}
                              aria-label={`${starValue}점 선택`}
                              className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-amber-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              <Star
                                className={`w-6 h-6 transition-colors ${
                                  active
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-300'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="review-comment"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      한 줄 서평
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        id="review-comment"
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="친구가 추천한 책과 영어 설명에 대해 고마운 마음과 바른말로 감상을 남겨 주세요"
                        maxLength={140}
                        className="flex-1 min-h-[44px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? '등록 중...' : '후기 등록하기'}
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <p className="text-xs font-medium text-rose-600" role="alert">
                      {formError}
                    </p>
                  )}
                </form>

                {/* Latest-first Review List */}
                <div className="space-y-3">
                  {bookReviews.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50/60 border border-dashed border-slate-200 rounded-xl">
                      <p className="text-sm text-slate-500">
                        아직 등록된 한 줄 서평이 없어요. 이 책을 읽었다면 첫 번째 서평을 남겨 보세요!
                      </p>
                    </div>
                  ) : (
                    bookReviews.map((review, idx) => (
                      <div
                        key={`${review.bookId}-${review.reviewer}-${idx}`}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3.5"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {review.reviewer}
                          </span>
                          <div
                            className="flex items-center gap-0.5 tabular-nums"
                            aria-label={`별점 ${review.rating}점`}
                          >
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= review.rating
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-200'
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700">{review.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
