/**
 * BM25 검색 공용 모듈
 *
 * memory-v2의 BM25 검색 로직을 범용적으로 사용할 수 있도록 추출한 모듈
 *
 * Usage:
 *   const { createSearchEngine, search } = require('./bm25-search.js');
 *
 *   // 방법 1: 재사용 가능한 엔진 생성
 *   const engine = createSearchEngine({ summary: 3, tags: 2, body: 1 });
 *   engine.addDoc({ summary: 'test', tags: 'foo bar', body: 'content' }, 0);
 *   engine.consolidate();
 *   const results = engine.search('test');
 *
 *   // 방법 2: 일회성 검색 (내부에서 엔진 생성)
 *   const results = search(docs, 'keyword', { summary: 3, tags: 2 });
 */

const bm25 = require('wink-bm25-text-search');
const nlp = require('wink-nlp-utils');

/**
 * BM25 검색 엔진 생성
 * @param {Object} fieldWeights - 필드별 가중치 (예: { summary: 3, tags: 2, body: 1 })
 * @returns {Object} wink-bm25-text-search 엔진 인스턴스
 */
function createSearchEngine(fieldWeights = {}) {
  const engine = bm25();

  // 필드 가중치 설정
  engine.defineConfig({ fldWeights: fieldWeights });

  // 전처리 태스크 정의 (영어 기본)
  engine.definePrepTasks([
    nlp.string.lowerCase,
    nlp.string.tokenize0,
    nlp.tokens.removeWords,
    nlp.tokens.stem
  ]);

  return engine;
}

/**
 * 문서 배열에서 BM25 검색 수행
 * @param {Array} docs - 검색할 문서 배열 (각 문서는 fieldWeights의 키에 해당하는 속성 보유)
 * @param {String} query - 검색 쿼리
 * @param {Object} fieldWeights - 필드별 가중치 (예: { summary: 3, tags: 2, body: 1 })
 * @param {Object} options - 추가 옵션
 * @param {Number} options.maxBodyLength - body 필드 최대 길이 (기본: 500)
 * @param {Boolean} options.returnScores - 점수 포함 여부 (기본: true)
 * @returns {Array} 검색 결과 (점수 내림차순 정렬)
 */
function search(docs, query, fieldWeights = { summary: 3, tags: 2, body: 1 }, options = {}) {
  const { maxBodyLength = 500, returnScores = true } = options;

  if (!docs || docs.length === 0) {
    return [];
  }

  // 엔진 생성 및 설정
  const engine = createSearchEngine(fieldWeights);

  // 문서 인덱싱
  docs.forEach((doc, idx) => {
    const indexDoc = {};

    // fieldWeights에 정의된 필드만 인덱싱
    for (const field of Object.keys(fieldWeights)) {
      let value = doc[field];

      // 배열인 경우 문자열로 변환
      if (Array.isArray(value)) {
        value = value.join(' ');
      }

      // body는 길이 제한
      if (field === 'body' && value && typeof value === 'string') {
        value = value.substring(0, maxBodyLength);
      }

      indexDoc[field] = value || '';
    }

    engine.addDoc(indexDoc, idx);
  });

  // 검색 실행
  engine.consolidate();
  const searchResults = engine.search(query);

  // 결과 변환
  if (returnScores) {
    return searchResults.map(([idx, score]) => ({
      ...docs[idx],
      _score: Math.round(score * 100) / 100
    }));
  } else {
    return searchResults.map(([idx]) => docs[idx]);
  }
}

/**
 * 한글 키워드 매칭 검색 (BM25 대신 단순 단어 매칭)
 * @param {Array} docs - 검색할 문서 배열
 * @param {String} query - 검색 쿼리
 * @param {Array} fields - 검색할 필드 목록 (예: ['summary', 'tags', 'body'])
 * @returns {Array} 검색 결과 (매치 카운트 내림차순 정렬)
 */
function koreanKeywordSearch(docs, query, fields = ['summary', 'tags', 'body']) {
  if (!docs || docs.length === 0) {
    return [];
  }

  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  const results = docs.map(doc => {
    // 검색 대상 텍스트 생성
    const searchText = fields.map(field => {
      let value = doc[field];
      if (Array.isArray(value)) {
        value = value.join(' ');
      }
      return value || '';
    }).join(' ').toLowerCase();

    // 매칭 단어 수 계산
    const matchCount = words.filter(word => searchText.includes(word)).length;

    return { ...doc, _score: matchCount };
  })
  .filter(item => item._score > 0)
  .sort((a, b) => b._score - a._score);

  return results;
}

module.exports = {
  createSearchEngine,
  search,
  koreanKeywordSearch
};
