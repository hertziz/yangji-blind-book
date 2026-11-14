import { BookOpen, Star } from 'lucide-react';
import { motion } from 'motion/react';
import {
  getBookReviewStats,
  parseEnglishClue,
  type BookCharacter,
  type BookReview,
} from '../types/library';

interface BlindCardProps {
  book: BookCharacter;
  reviews: BookReview[];
  onReveal: (book: BookCharacter) => void;
  index: number;
}

export function BlindCard({ book, reviews, onReveal, index }: BlindCardProps) {
  const { looksAndClothes, specialTraits } = parseEnglishClue(book.englishClue);
  const { average, count } = getBookReviewStats(book.id, reviews);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.24), ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-6 transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"
    >
      <div>
        {/* Card Top: Category + Student Author as clean unboxed metadata */}
        <div className="flex items-center justify-between gap-3 text-[13px] text-slate-600 mb-4">
          <span className="font-semibold text-slate-800 whitespace-nowrap truncate">
            {book.category}
          </span>
          <span className="text-slate-500 whitespace-nowrap shrink-0">
            Written by <strong className="font-semibold text-slate-700">{book.studentAuthor}</strong>
          </span>
        </div>

        {/* Card Center: English Clues (Strictly hides book title and character name) */}
        <div className="space-y-4">
          {/* Mandatory Clue: Looks & Clothes */}
          <div className="bg-blue-50/85 border border-blue-200/80 rounded-xl p-4 sm:p-5">
            <div className="mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-tight text-blue-900 bg-blue-100 px-2.5 py-1 rounded-md">
                👀 생김새 &amp; 👕 옷차림 (필수 단서)
              </span>
            </div>
            <p className="text-lg leading-relaxed font-medium text-slate-900">
              “{looksAndClothes}”
            </p>
          </div>

          {/* Optional Enrichment Clue: Special Traits */}
          {specialTraits && (
            <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4">
              <div className="mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-tight text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md">
                  ✨ 특별한 특징 (심화 단서)
                </span>
              </div>
              <p className="text-base leading-relaxed text-slate-800">
                {specialTraits}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Card Bottom: Rating Summary & Reveal CTA */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-slate-600 tabular-nums whitespace-nowrap">
          <Star
            className={`w-4 h-4 shrink-0 ${
              count > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
            }`}
            aria-hidden="true"
          />
          {count > 0 ? (
            <span>
              <strong className="font-semibold text-slate-900">{average.toFixed(1)}</strong>
              <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
              <span>후기 {count}개</span>
            </span>
          ) : (
            <span className="text-slate-400">첫 후기를 남겨보세요</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onReveal(book)}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>이 인물 만나보기</span>
        </button>
      </div>
    </motion.article>
  );
}
