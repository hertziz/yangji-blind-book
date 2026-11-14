import type { BookCharacter, BookReview } from '../types/library';

export const INITIAL_BOOKS: BookCharacter[] = [
  {
    id: 'B001',
    category: '🔍 추리·미스터리',
    englishClue:
      'He is tall and thin. He has sharp eyes and is wearing a brown coat and a checkered cap. (심화) He is very smart and likes solving mysteries.',
    characterName: '셜록 홈즈',
    bookTitle: '어린이 셜록 홈즈 단편선',
    author: '아서 코난 도일',
    callNumber: '843-코19ㅅ',
    studentAuthor: '5-1 코난',
  },
  {
    id: 'B002',
    category: '🚀 모험·판타지',
    englishClue:
      'He has messy black hair and green eyes. He is wearing round glasses and a long black robe. (심화) He is brave and can fly on a broomstick.',
    characterName: '해리 포터',
    bookTitle: '해리 포터와 마법사의 돌',
    author: 'J.K. 롤링',
    callNumber: '843-롤29ㅎ',
    studentAuthor: '5-2 마법사',
  },
  {
    id: 'B003',
    category: '💛 우정·일상',
    englishClue:
      'She is small and has red pigtails and freckles. She is wearing a blue dress and two different stockings. (심화) She is very strong and funny.',
    characterName: '삐삐 롱스타킹',
    bookTitle: '내 친구 삐삐 롱스타킹',
    author: '아스트리드 린드그렌',
    callNumber: '859-린27ㄴ',
    studentAuthor: '5-3 비타민',
  },
  {
    id: 'B004',
    category: '🌿 동물·자연',
    englishClue:
      'He is a small boy with curly blond hair. He is wearing a long coat and a yellow scarf. (심화) He loves his rose and travels to many planets.',
    characterName: '어린 왕자',
    bookTitle: '어린 왕자',
    author: '앙투안 드 생텍쥐페리',
    callNumber: '863-생84ㅇ',
    studentAuthor: '5-1 별똥별',
  },
  {
    id: 'B005',
    category: '😂 유머·재미',
    englishClue:
      'He has big eyes and a small nose. He is wearing a white T-shirt, black shorts, and a backpack.',
    characterName: '그렉 헤플리',
    bookTitle: '윔피 키드 1',
    author: '제프 키니',
    callNumber: '843-키23ㅇ',
    studentAuthor: '5-4 웃음왕',
  },
  {
    id: 'B006',
    category: '🔍 추리·미스터리',
    englishClue:
      'She has short brown hair and bright eyes. She is wearing a yellow raincoat and red boots. (심화) She is curious and always carries a small notebook.',
    characterName: '에놀라 홈즈',
    bookTitle: '에놀라 홈즈와 사라진 후작',
    author: '낸시 스프링어',
    callNumber: '843-스89ㅇ',
    studentAuthor: '5-2 탐정소녀',
  },
];

export const INITIAL_REVIEWS: BookReview[] = [
  {
    bookId: 'B001',
    reviewer: '6-1 셜록팬',
    rating: 5,
    comment: '영어 설명에 나온 체크무늬 모자를 떠올리며 읽으니 추리가 훨씬 실감 났어요!',
  },
  {
    bookId: 'B001',
    reviewer: '5-3 책탐험가',
    rating: 5,
    comment: '사건의 단서를 찾아내는 장면이 정말 똑똑하고 흥미진진해서 단숨에 다 읽었습니다.',
  },
  {
    bookId: 'B002',
    reviewer: '5-4 번개별',
    rating: 5,
    comment: '동그란 안경을 쓴 마법사라는 소개를 보고 바로 빌렸는데, 마법 학교 이야기가 최고예요.',
  },
  {
    bookId: 'B002',
    reviewer: '6-2 책벌레',
    rating: 4,
    comment: '두껍지만 빗자루 타고 날아다니는 장면부터 시간 가는 줄 모르고 읽었어요.',
  },
  {
    bookId: 'B003',
    reviewer: '5-1 해바라기',
    rating: 5,
    comment: '양말을 짝짝이로 신은 삐삐가 너무 유쾌하고 힘이 세서 읽는 내내 웃었어요!',
  },
  {
    bookId: 'B004',
    reviewer: '6-3 별빛소녀',
    rating: 5,
    comment: '노란 목도리를 두른 어린 왕자가 장미꽃을 아끼는 마음이 따뜻하게 느껴졌어요.',
  },
  {
    bookId: 'B005',
    reviewer: '5-2 장난꾸러기',
    rating: 4,
    comment: '만화랑 같이 있어서 술술 읽히고 그렉의 일기가 우리 반 이야기 같아서 엄청 웃겨요.',
  },
  {
    bookId: 'B006',
    reviewer: '6-1 노란우비',
    rating: 5,
    comment: '수첩을 늘 들고 다니며 스스로 사건을 해결하는 에놀라가 정말 멋졌어요!',
  },
];
