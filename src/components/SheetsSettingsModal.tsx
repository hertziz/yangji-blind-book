import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Loader2, RotateCcw, Save, X } from 'lucide-react';
import type { SheetConfig } from '../types/library';
import { APPS_SCRIPT_TEMPLATE } from '../utils/sheetsSync';

interface SheetsSettingsModalProps {
  isOpen: boolean;
  config: SheetConfig;
  onClose: () => void;
  onSaveAndSync: (nextConfig: SheetConfig, shouldFetchNow: boolean) => Promise<void>;
  onResetDefaults: () => void;
}

export function SheetsSettingsModal({
  isOpen,
  config,
  onClose,
  onSaveAndSync,
  onResetDefaults,
}: SheetsSettingsModalProps) {
  const [booksCsvUrl, setBooksCsvUrl] = useState(config.booksCsvUrl);
  const [reviewsCsvUrl, setReviewsCsvUrl] = useState(config.reviewsCsvUrl);
  const [appsScriptUrl, setAppsScriptUrl] = useState(config.appsScriptUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBooksCsvUrl(config.booksCsvUrl);
      setReviewsCsvUrl(config.reviewsCsvUrl);
      setAppsScriptUrl(config.appsScriptUrl);
      setStatusMessage(null);
    }
  }, [isOpen, config]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const nextConfig: SheetConfig = {
      booksCsvUrl: booksCsvUrl.trim(),
      reviewsCsvUrl: reviewsCsvUrl.trim(),
      appsScriptUrl: appsScriptUrl.trim(),
      lastSyncedAt: config.lastSyncedAt,
    };

    const hasAnyUrl = Boolean(
      nextConfig.booksCsvUrl || nextConfig.reviewsCsvUrl || nextConfig.appsScriptUrl
    );

    setIsSaving(true);
    setStatusMessage(null);
    try {
      await onSaveAndSync(nextConfig, hasAnyUrl);
      setStatusMessage({
        type: 'success',
        text: hasAnyUrl
          ? 'DB 설정을 저장하고 Google Sheets 데이터를 자동으로 불러왔습니다.'
          : '연동 설정이 저장되었습니다.',
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : '잠시 인터넷 연결을 확인하고 다시 눌러주세요.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheets-settings-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white/95 backdrop-blur border-b border-slate-100">
          <div>
            <h2 id="sheets-settings-title" className="font-display text-xl font-bold text-slate-900">
              교사용 DB 설정 (Google Sheets 연동)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Apps Script Web App URL 또는 CSV 공개 URL을 저장하면 앱 시작·탭 전환·제출 시 자동으로 동기화됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="apps-script-url" className="block text-xs font-bold text-slate-800 mb-1.5">
                1. Apps Script Web App URL (doGet 자동 불러오기 + doPost 제출 저장)
              </label>
              <input
                id="apps-script-url"
                type="url"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="books-csv-url" className="block text-xs font-bold text-slate-800 mb-1.5">
                2. Books 시트 CSV 공개 URL (선택 · 읽기 전용)
              </label>
              <input
                id="books-csv-url"
                type="url"
                value={booksCsvUrl}
                onChange={(e) => setBooksCsvUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../pub?gid=0&single=true&output=csv"
                className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="reviews-csv-url" className="block text-xs font-bold text-slate-800 mb-1.5">
                3. Reviews 시트 CSV 공개 URL (선택 · 읽기 전용)
              </label>
              <input
                id="reviews-csv-url"
                type="url"
                value={reviewsCsvUrl}
                onChange={(e) => setReviewsCsvUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../pub?gid=123456&single=true&output=csv"
                className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {config.lastSyncedAt && (
              <p className="text-xs text-slate-500">
                마지막 자동 동기화: <span className="font-mono">{config.lastSyncedAt}</span>
              </p>
            )}

            {statusMessage && (
              <div
                role="status"
                className={`p-3.5 rounded-xl text-xs font-medium border ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
              <button
                type="button"
                onClick={onResetDefaults}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>기본 샘플 데이터(6권) 복원</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>저장 및 연결 중...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" aria-hidden="true" />
                    <span>설정 저장 및 자동 연결</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Teacher Setup Guide */}
          <div className="pt-5 border-t border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              교사용 Google Sheets 구조 안내 (2개 탭)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <p className="font-bold text-slate-900">시트 1: Books 탭 첫 행(헤더)</p>
                <p className="font-mono text-[11px] leading-relaxed text-slate-700 break-all">
                  id, category, englishClue, characterName, bookTitle, author, callNumber, studentAuthor
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <p className="font-bold text-slate-900">시트 2: Reviews 탭 첫 행(헤더)</p>
                <p className="font-mono text-[11px] leading-relaxed text-slate-700 break-all">
                  bookId, reviewer, rating, comment
                </p>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Google Apps Script 예시 코드 (doGet / doPost)
                </span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 transition-colors cursor-pointer"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      <span>복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>코드 복사</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] font-mono leading-relaxed text-slate-300 overflow-x-auto max-h-44">
                {APPS_SCRIPT_TEMPLATE}
              </pre>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
