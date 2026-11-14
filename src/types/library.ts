export const BOOK_CATEGORIES = [
  '🔍 추리·미스터리',
  '🌿 동물·자연',
  '🚀 모험·판타지',
  '💛 우정·일상',
  '😂 유머·재미',
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];
export type CategoryFilter = '전체(All)' | BookCategory;

export interface BookCharacter {
  id: string;
  category: string;
  englishClue: string;
  characterName: string;
  bookTitle: string;
  author: string;
  callNumber: string;
  studentAuthor: string;
}

export interface BookReview {
  bookId: string;
  reviewer: string;
  rating: number;
  comment: string;
}

export interface SheetConfig {
  booksCsvUrl: string;
  reviewsCsvUrl: string;
  appsScriptUrl: string;
  lastSyncedAt: string | null;
}

export interface ParsedClue {
  looksAndClothes: string;
  specialTraits: string | null;
  spokenText: string;
}

export function parseEnglishClue(englishClue: string): ParsedClue {
  const normalized = englishClue.trim();
  const markerRegex = /\(\s*심화\s*\)/;
  const match = markerRegex.exec(normalized);

  if (!match) {
    return {
      looksAndClothes: normalized,
      specialTraits: null,
      spokenText: normalized,
    };
  }

  const index = match.index;
  const looksAndClothes = normalized.slice(0, index).trim();
  const specialTraits = normalized.slice(index + match[0].length).trim();

  return {
    looksAndClothes,
    specialTraits: specialTraits.length > 0 ? specialTraits : null,
    spokenText: [looksAndClothes, specialTraits].filter(Boolean).join(' '),
  };
}

export function getBookReviewStats(bookId: string, reviews: BookReview[]) {
  const bookReviews = reviews.filter((r) => r.bookId === bookId);
  const count = bookReviews.length;
  if (count === 0) {
    return { average: 0, count: 0 };
  }
  const sum = bookReviews.reduce((acc, cur) => acc + Number(cur.rating || 0), 0);
  return {
    average: Math.round((sum / count) * 10) / 10,
    count,
  };
}
