import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Lock, X } from 'lucide-react';

interface PasscodeModalProps {
  isOpen: boolean;
  targetLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CLASSROOM_PASSCODE = '0505';

export function PasscodeModal({
  isOpen,
  targetLabel,
  onClose,
  onSuccess,
}: PasscodeModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError(null);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim() === CLASSROOM_PASSCODE) {
      setError(null);
      setCode('');
      onSuccess();
    } else {
      setError('비밀번호가 맞지 않아요. 선생님께 비밀번호를 확인해 보세요!');
      setCode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passcode-modal-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="passcode-modal-title" className="text-lg font-bold text-slate-900">
                수업 비밀번호 확인
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetLabel}에 들어가려면 비밀번호를 입력하세요.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="classroom-passcode-input" className="sr-only">
              비밀번호 4자리
            </label>
            <input
              ref={inputRef}
              id="classroom-passcode-input"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="숫자 4자리 입력"
              className="w-full min-h-[48px] px-4 py-2.5 text-center text-xl font-mono tracking-[0.35em] bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-sm placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 text-center" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              확인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
