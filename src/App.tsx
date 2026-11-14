import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Dices, PenLine } from 'lucide-react';
import { BlindCard } from './components/BlindCard';
import { PasscodeModal } from './components/PasscodeModal';
import { RevealBookModal } from './components/RevealBookModal';
import { SheetsSettingsModal } from './components/SheetsSettingsModal';
import { WritingStudio } from './components/WritingStudio';
import { INITIAL_BOOKS, INITIAL_REVIEWS } from './data/sampleData';
import {
  BOOK_CATEGORIES,
  type BookCharacter,
  type BookReview,
  type CategoryFilter,
  type SheetConfig,
} from './types/library';
import {
  pushBookToAppsScript,
  pushReviewToAppsScript,
  syncFromGoogleSheets,
} from './utils/sheetsSync';
import { stopSpeaking } from './utils/tts';

const STORAGE_KEYS = {
  books: 'blind_library_books_v1',
  reviews: 'blind_library_reviews_v1',
  sheetConfig: 'blind_library_sheet_config_v1',
};

const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxD89BjdUIjgMawGv2umMOa7HG34yyGrFRu4kxFfc3psexoy1XTk9KBA5xzUUT8iV1NBA/exec';

const DEFAULT_SHEET_CONFIG: SheetConfig = {
  booksCsvUrl: '',
  reviewsCsvUrl: '',
  appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
  lastSyncedAt: null,
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [books, setBooks] = useState<BookCharacter[]>(() =>
    loadFromStorage<BookCharacter[]>(STORAGE_KEYS.books, INITIAL_BOOKS)
  );
  const [reviews, setReviews] = useState<BookReview[]>(() =>
    loadFromStorage<BookReview[]>(STORAGE_KEYS.reviews, INITIAL_REVIEWS)
  );
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() => {
    const stored = loadFromStorage<SheetConfig>(
      STORAGE_KEYS.sheetConfig,
      DEFAULT_SHEET_CONFIG
    );
    return {
      ...DEFAULT_SHEET_CONFIG,
      ...stored,
      appsScriptUrl: stored.appsScriptUrl?.trim() || DEFAULT_APPS_SCRIPT_URL,
    };
  });

  // Always start locked on the Blind Recommendation Board
  const [activeTab, setActiveTab] = useState<'board' | 'studio'>('board');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcodeTarget, setPasscodeTarget] = useState<'studio' | 'settings' | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('전체(All)');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const sheetConfigRef = useRef(sheetConfig);
  sheetConfigRef.current = sheetConfig;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books));
    } catch {
      // Ignore storage quota issues
    }
  }, [books]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviews));
    } catch {
      // Ignore storage quota issues
    }
  }, [reviews]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.sheetConfig, JSON.stringify(sheetConfig));
    } catch {
      // Ignore storage quota issues
    }
  }, [sheetConfig]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Silent background Google Sheets sync (no refresh button anywhere)
  const syncFromSheetsSilently = useCallback(async (configOverride?: SheetConfig) => {
    const cfg = configOverride ?? sheetConfigRef.current;
    if (!cfg.appsScriptUrl && !cfg.booksCsvUrl && !cfg.reviewsCsvUrl) {
      return;
    }
    try {
      const synced = await syncFromGoogleSheets(cfg);
      if (synced.books && synced.books.length > 0) {
        setBooks(synced.books);
      }
      if (synced.reviews) {
        setReviews(synced.reviews);
      }
      const timestamp = new Date().toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      setSheetConfig((prev) => ({ ...prev, lastSyncedAt: timestamp }));
    } catch {
      // Silent background sync preserves local data on transient network errors
    }
  }, []);

  // ① Auto-sync on initial app load
  useEffect(() => {
    void syncFromSheetsSilently();
  }, [syncFromSheetsSilently]);

  const filteredBooks = useMemo(() => {
    if (selectedCategory === '전체(All)') {
      return books;
    }
    return books.filter((book) => book.category === selectedCategory);
  }, [books, selectedCategory]);

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) ?? null,
    [books, selectedBookId]
  );

  const nextBookId = useMemo(() => {
    const maxNum = books.reduce((max, b) => {
      const m = /^B(\d+)$/i.exec(b.id.trim());
      return m ? Math.max(max, Number(m[1])) : max;
    }, books.length);
    return `B${String(maxNum + 1).padStart(3, '0')}`;
  }, [books]);

  const handleSelectBoardTab = () => {
    stopSpeaking();
    setActiveTab('board');
    // ③ Auto-sync when switching to the Blind Recommendation Board tab
    void syncFromSheetsSilently();
  };

  const handleSelectStudioTab = () => {
    stopSpeaking();
    setSelectedBookId(null);
    if (isUnlocked) {
      setActiveTab('studio');
    } else {
      setPasscodeTarget('studio');
    }
  };

  const handleOpenSettingsFromFooter = () => {
    stopSpeaking();
    if (isUnlocked) {
      setIsSettingsOpen(true);
    } else {
      setPasscodeTarget('settings');
    }
  };

  const handlePasscodeSuccess = () => {
    const target = passcodeTarget;
    setIsUnlocked(true);
    setPasscodeTarget(null);
    if (target === 'studio') {
      setActiveTab('studio');
    } else if (target === 'settings') {
      setIsSettingsOpen(true);
    }
  };

  const handleLockClassroom = () => {
    stopSpeaking();
    setIsUnlocked(false);
    setIsSettingsOpen(false);
    setPasscodeTarget(null);
    setActiveTab('board');
    showToast('수업 화면이 안전하게 잠겼어요.');
  };

  const handleShuffleBooks = () => {
    stopSpeaking();
    setBooks((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    showToast('인물 카드를 새로운 순서로 섞었어요!');
  };

  const handleAddReview = async (newReview: BookReview) => {
    setReviews((prev) => [newReview, ...prev]);
    if (sheetConfig.appsScriptUrl) {
      await pushReviewToAppsScript(sheetConfig.appsScriptUrl, newReview);
      showToast('한 줄 서평이 등록되고 구글 시트에도 저장되었어요!');
    } else {
      showToast('소중한 한 줄 서평이 등록되었어요!');
    }
  };

  const handleStudioSubmitBook = async (newBook: BookCharacter): Promise<void> => {
    // Immediately reflect locally
    setBooks((prev) => [newBook, ...prev]);
    setSelectedCategory('전체(All)');

    if (sheetConfig.appsScriptUrl) {
      await pushBookToAppsScript(sheetConfig.appsScriptUrl, newBook);
      // ② Auto-sync right after submission completes
      window.setTimeout(() => {
        void syncFromSheetsSilently();
      }, 1200);
    }

    // Automatically return to Board tab with confirmation message
    setActiveTab('board');
    showToast('제출 완료! 추천 보드에서 내 카드를 확인해 보세요.');
  };

  const handleSaveAndSyncSheets = async (
    nextConfig: SheetConfig,
    shouldFetchNow: boolean
  ) => {
    if (!shouldFetchNow) {
      setSheetConfig(nextConfig);
      return;
    }

    const synced = await syncFromGoogleSheets(nextConfig);
    if (synced.books && synced.books.length > 0) {
      setBooks(synced.books);
    }
    if (synced.reviews) {
      setReviews(synced.reviews);
    }

    const timestamp = new Date().toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setSheetConfig({
      ...nextConfig,
      lastSyncedAt: timestamp,
    });
    showToast('Google Sheets 데이터를 불러와 화면에 반영했어요!');
  };

  const handleResetDefaults = () => {
    setBooks(INITIAL_BOOKS);
    setReviews(INITIAL_REVIEWS);
    setSelectedCategory('전체(All)');
    showToast('기본 샘플 도서 6권과 초기 후기로 복원했어요.');
  };

  const filterTabs: CategoryFilter[] = ['전체(All)', ...BOOK_CATEGORIES];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Clean Top Bar: Wordmark + 2 Primary Mode Tabs ONLY */}
      <header className="bg-white/95 backdrop-blur border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={handleSelectBoardTab}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            양지 Secret Book Library
          </button>

          <nav
            aria-label="화면 전환 탭"
            className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto"
          >
            <button
              type="button"
              onClick={handleSelectBoardTab}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'board'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>블라인드 도서 추천 보드</span>
            </button>
            <button
              type="button"
              onClick={handleSelectStudioTab}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'studio'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenLine className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>영어 문장쓰기 &amp; AI 코치</span>
            </button>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {activeTab === 'studio' && isUnlocked ? (
          <WritingStudio
            nextBookId={nextBookId}
            appsScriptUrl={sheetConfig.appsScriptUrl}
            onLockClassroom={handleLockClassroom}
            onSubmitBook={handleStudioSubmitBook}
          />
        ) : (
          <>
            {/* Step 1 Hero Header (clean, no duplicate action buttons) */}
            <section className="pb-8 border-b border-slate-200/80">
              <div className="max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-[1.15] [text-wrap:balance]">
                    Who is your favorite character?
                  </h1>
                  <svg
                    viewBox="0 0 48 48"
                    className="w-10 h-10 sm:w-11 sm:h-11 shrink-0"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect x="4" y="10" width="40" height="30" rx="5" fill="#DBEAFE" />
                    <path
                      d="M24 13.5C20.5 11.5 14 11.2 9 12.5V35.5C14 34.2 20.5 34.5 24 36.5C27.5 34.5 34 34.2 39 35.5V12.5C34 11.2 27.5 11.5 24 13.5Z"
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    <path d="M24 13.5V36.5" stroke="#2563EB" strokeWidth="2.2" />
                    <path d="M13 18.5H19.5" stroke="#93C5FD" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M13 24H19.5" stroke="#93C5FD" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M28.5 18.5H35" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M28.5 24H35" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                  5학년 친구들이 쓴 영어 인물 묘사 카드를 읽고, 가장 만나 보고 싶은 인물을 골라보세요!
                  <br />
                  그 인물이 등장하는 책을 추천해 줍니다!!
                </p>
              </div>
            </section>

            {/* Category Filter Tabs + Shuffle Button */}
            <section
              aria-label="테마 카테고리 및 카드 섞기"
              className="py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div
                className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200/70 rounded-2xl"
                role="tablist"
                aria-label="도서 테마 필터"
              >
                {filterTabs.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setSelectedCategory(category)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-3">
                <span className="text-xs sm:text-sm text-slate-500 tabular-nums whitespace-nowrap">
                  표시 중인 인물 <strong className="font-semibold text-slate-900">{filteredBooks.length}</strong>명
                </span>
                <button
                  type="button"
                  onClick={handleShuffleBooks}
                  className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Dices className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>🎲 랜덤보기(Shuffle)</span>
                </button>
              </div>
            </section>

            {/* Step 1: Blind Character Card Grid */}
            <section id="character-grid" aria-label="블라인드 캐릭터 카드 목록">
              {filteredBooks.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-3">
                  <p className="text-base font-semibold text-slate-800">
                    이 테마에 등록된 캐릭터 카드가 아직 없어요.
                  </p>
                  <p className="text-sm text-slate-500">
                    다른 카테고리를 살펴보거나 영어 문장쓰기 &amp; AI 코치 탭에서 새 카드를 작성해 보세요!
                  </p>
                  <div className="pt-2 flex flex-wrap justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('전체(All)')}
                      className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      전체 카드 보기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBooks.map((book, index) => (
                    <BlindCard
                      key={book.id}
                      book={book}
                      reviews={reviews}
                      onReveal={(b) => setSelectedBookId(b.id)}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer with Subtle Right-Corner Teacher DB Settings Only */}
      <footer className="border-t border-slate-200/80 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4 text-xs text-slate-400">
          <p>초등학교 5~6학년 영어·독서 연계 블라인드 캐릭터 도서 추천</p>
          <button
            type="button"
            onClick={handleOpenSettingsFromFooter}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            ⚙️ 교사용 DB 설정
          </button>
        </div>
      </footer>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-lg"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Classroom Passcode Gate (0505) */}
      <PasscodeModal
        isOpen={passcodeTarget !== null}
        targetLabel={
          passcodeTarget === 'settings' ? '교사용 DB 설정' : '영어 문장쓰기 & AI 코치'
        }
        onClose={() => setPasscodeTarget(null)}
        onSuccess={handlePasscodeSuccess}
      />

      {/* Step 2 & 3 Modal */}
      <RevealBookModal
        book={selectedBook}
        reviews={reviews}
        onClose={() => setSelectedBookId(null)}
        onAddReview={handleAddReview}
      />

      {/* Teacher DB Settings Modal */}
      <SheetsSettingsModal
        isOpen={isSettingsOpen}
        config={sheetConfig}
        onClose={() => setIsSettingsOpen(false)}
        onSaveAndSync={handleSaveAndSyncSheets}
        onResetDefaults={handleResetDefaults}
      />
    </div>
  );
}
