import { PageSeoData } from "./crawler";

export interface KeywordData {
  keyword: string;
  count: number;
  density: number;
  isStuffing: boolean;
  locations: string[];
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "shall", "should", "may", "might", "must", "can", "could",
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "if", "while", "this", "that", "these", "those",
  "it", "its", "he", "she", "they", "them", "we", "you", "i", "my",
  "your", "his", "her", "our", "their", "what", "which", "who", "whom",
  "up", "about", "also",
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都",
  "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你",
  "会", "着", "没有", "看", "好", "自己", "这",
]);

const STUFFING_THRESHOLD = 3.5; // density > 3.5% is suspicious

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 2 &&
        !STOP_WORDS.has(word) &&
        !/^[0-9a-f]{6,}$/i.test(word)
    );
}

function findKeywordLocations(
  keyword: string,
  page: PageSeoData
): string[] {
  const locations: string[] = [];
  const lowerKeyword = keyword.toLowerCase();

  if (page.title?.toLowerCase().includes(lowerKeyword)) {
    locations.push("title");
  }
  if (page.metaDescription?.toLowerCase().includes(lowerKeyword)) {
    locations.push("meta_description");
  }

  for (const h of page.headings) {
    if (h.text.toLowerCase().includes(lowerKeyword)) {
      locations.push(h.tag);
      break;
    }
  }

  if (page.bodyText.toLowerCase().includes(lowerKeyword)) {
    locations.push("body");
  }

  for (const img of page.images) {
    if (img.alt?.toLowerCase().includes(lowerKeyword)) {
      locations.push("img_alt");
      break;
    }
  }

  return [...new Set(locations)];
}

export function analyzeKeywords(pages: PageSeoData[]): KeywordData[] {
  const globalWordFreq = new Map<string, number>();
  let totalWords = 0;

  for (const page of pages) {
    const words = tokenize(page.bodyText);
    totalWords += words.length;

    for (const word of words) {
      globalWordFreq.set(word, (globalWordFreq.get(word) || 0) + 1);
    }
  }

  if (totalWords === 0) return [];

  const sorted = [...globalWordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  return sorted.map(([keyword, count]) => {
    const density = Math.round((count / totalWords) * 100 * 100) / 100;
    const locations = pages.flatMap((p) => findKeywordLocations(keyword, p));
    const uniqueLocations = [...new Set(locations)];

    return {
      keyword,
      count,
      density,
      isStuffing: density > STUFFING_THRESHOLD,
      locations: uniqueLocations,
    };
  });
}
