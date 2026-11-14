import type { BookCharacter, BookReview, SheetConfig } from '../types/library';

/**
 * RFC 4180 compliant CSV parser handling quoted fields, escaped quotes (""), and embedded newlines.
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const cleanText = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell !== ''));
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, '');
}

export function parseBooksFromCsv(csvText: string): BookCharacter[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const idx = {
    id: headers.findIndex((h) => h === 'id' || h === '고유id' || h === '도서id'),
    category: headers.findIndex((h) => h === 'category' || h === '카테고리'),
    englishClue: headers.findIndex(
      (h) => h === 'englishclue' || h === '영어인물묘사' || h === '영어묘사'
    ),
    characterName: headers.findIndex(
      (h) => h === 'charactername' || h === '등장인물이름' || h === '인물이름'
    ),
    bookTitle: headers.findIndex((h) => h === 'booktitle' || h === '도서명' || h === '책제목'),
    author: headers.findIndex((h) => h === 'author' || h === '저자'),
    callNumber: headers.findIndex(
      (h) => h === 'callnumber' || h === '청구기호' || h === '도서관청구기호'
    ),
    studentAuthor: headers.findIndex(
      (h) => h === 'studentauthor' || h === '작성학생' || h === '작성자'
    ),
  };

  const books: BookCharacter[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const englishClue = idx.englishClue >= 0 ? row[idx.englishClue] || '' : row[2] || '';
    const bookTitle = idx.bookTitle >= 0 ? row[idx.bookTitle] || '' : row[4] || '';
    const characterName = idx.characterName >= 0 ? row[idx.characterName] || '' : row[3] || '';

    if (!englishClue && !bookTitle) continue;

    books.push({
      id: (idx.id >= 0 ? row[idx.id] : row[0]) || `B${String(i).padStart(3, '0')}`,
      category: (idx.category >= 0 ? row[idx.category] : row[1]) || '💛 우정·일상',
      englishClue,
      characterName: characterName || '비밀 인물',
      bookTitle: bookTitle || '추천 도서',
      author: (idx.author >= 0 ? row[idx.author] : row[5]) || '작가 미상',
      callNumber: (idx.callNumber >= 0 ? row[idx.callNumber] : row[6]) || '도서관 문의',
      studentAuthor: (idx.studentAuthor >= 0 ? row[idx.studentAuthor] : row[7]) || '5학년 친구',
    });
  }

  return books;
}

export function parseReviewsFromCsv(csvText: string): BookReview[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const idx = {
    bookId: headers.findIndex((h) => h === 'bookid' || h === '도서id' || h === 'id'),
    reviewer: headers.findIndex((h) => h === 'reviewer' || h === '작성자' || h === '닉네임'),
    rating: headers.findIndex((h) => h === 'rating' || h === '별점'),
    comment: headers.findIndex((h) => h === 'comment' || h === '한줄서평' || h === '서평'),
  };

  const reviews: BookReview[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const bookId = idx.bookId >= 0 ? row[idx.bookId] || '' : row[0] || '';
    const reviewer = idx.reviewer >= 0 ? row[idx.reviewer] || '' : row[1] || '';
    const ratingRaw = idx.rating >= 0 ? row[idx.rating] || '5' : row[2] || '5';
    const comment = idx.comment >= 0 ? row[idx.comment] || '' : row[3] || '';

    if (!bookId || !comment) continue;
    const numericRating = Math.min(5, Math.max(1, Math.round(Number(ratingRaw) || 5)));

    reviews.push({
      bookId,
      reviewer: reviewer || '익명 독자',
      rating: numericRating,
      comment,
    });
  }

  return reviews;
}

export async function syncFromGoogleSheets(config: SheetConfig): Promise<{
  books?: BookCharacter[];
  reviews?: BookReview[];
}> {
  const result: { books?: BookCharacter[]; reviews?: BookReview[] } = {};

  // 1. Prefer Apps Script doGet when provided and CSV URLs are not specified
  if (config.appsScriptUrl && !config.booksCsvUrl && !config.reviewsCsvUrl) {
    const res = await fetch(config.appsScriptUrl);
    if (!res.ok) {
      throw new Error('잠시 인터넷 연결을 확인하고 다시 시도하거나, 선생님께 DB 연결 설정을 요청해 주세요.');
    }
    const data = await res.json();
    if (Array.isArray(data.books)) {
      result.books = data.books.map((b: BookCharacter, idx: number) => ({
        id: String(b.id || `B${String(idx + 1).padStart(3, '0')}`),
        category: String(b.category || '💛 우정·일상'),
        englishClue: String(b.englishClue || ''),
        characterName: String(b.characterName || '비밀 인물'),
        bookTitle: String(b.bookTitle || '추천 도서'),
        author: String(b.author || '작가 미상'),
        callNumber: String(b.callNumber || '도서관 문의'),
        studentAuthor: String(b.studentAuthor || '5학년 친구'),
      }));
    }
    if (Array.isArray(data.reviews)) {
      result.reviews = data.reviews.map((r: BookReview) => ({
        bookId: String(r.bookId || ''),
        reviewer: String(r.reviewer || '익명 독자'),
        rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
        comment: String(r.comment || ''),
      }));
    }
    return result;
  }

  // 2. Fetch published CSV URLs
  if (config.booksCsvUrl) {
    const res = await fetch(config.booksCsvUrl);
    if (!res.ok) {
      throw new Error('선생님께 DB 연결 설정을 요청해 주세요.');
    }
    const text = await res.text();
    const parsedBooks = parseBooksFromCsv(text);
    if (parsedBooks.length === 0) {
      throw new Error('시트에서 도서 정보를 찾지 못했어요. 선생님께 DB 연결 설정을 요청해 주세요.');
    }
    result.books = parsedBooks;
  }

  if (config.reviewsCsvUrl) {
    const res = await fetch(config.reviewsCsvUrl);
    if (!res.ok) {
      throw new Error('선생님께 DB 연결 설정을 요청해 주세요.');
    }
    const text = await res.text();
    result.reviews = parseReviewsFromCsv(text);
  }

  return result;
}

export async function pushBookToAppsScript(
  appsScriptUrl: string,
  book: BookCharacter
): Promise<boolean> {
  if (!appsScriptUrl.trim()) return false;
  try {
    await fetch(appsScriptUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'addBook',
        id: book.id,
        category: book.category,
        englishClue: book.englishClue,
        characterName: book.characterName,
        bookTitle: book.bookTitle,
        author: book.author,
        callNumber: book.callNumber,
        studentAuthor: book.studentAuthor,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function pushReviewToAppsScript(
  appsScriptUrl: string,
  review: BookReview
): Promise<boolean> {
  if (!appsScriptUrl.trim()) return false;
  try {
    await fetch(appsScriptUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'addReview',
        bookId: review.bookId,
        reviewer: review.reviewer,
        rating: review.rating,
        comment: review.comment,
        data: review,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export const APPS_SCRIPT_TEMPLATE = `function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var booksSheet = ss.getSheetByName('Books');
  var reviewsSheet = ss.getSheetByName('Reviews');
  return ContentService
    .createTextOutput(JSON.stringify({
      books: sheetToObjects(booksSheet),
      reviews: sheetToObjects(reviewsSheet)
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (payload.action === 'addBook') {
    var b = payload.data || payload;
    var booksSheet = ss.getSheetByName('Books');
    var nextId = b.id || ('B' + String(booksSheet.getLastRow()).padStart(3, '0'));
    booksSheet.appendRow([
      nextId, b.category, b.englishClue, b.characterName,
      b.bookTitle, b.author, b.callNumber, b.studentAuthor
    ]);
  } else if (payload.action === 'addReview') {
    var r = payload.data || payload;
    ss.getSheetByName('Reviews').appendRow([
      r.bookId, r.reviewer, r.rating, r.comment
    ]);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = row[idx]; });
    return obj;
  });
}`;
