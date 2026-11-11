/* RASYANCUT — 사이트 데이터.
   이름·설명·이미지는 아직 정해지지 않아 전부 빈 자리로 둔다.
   값을 채우면 화면에 그대로 반영된다. image 는 파일 경로(비우면 빈 자리 표시). */
window.RSC_DATA = {
  characters: [1, 2, 3, 4, 5, 6].map(function (n) {
    var id = String(n).padStart(2, '0');
    return {
      id: id,
      code: 'RSC-C' + id,
      name: '미등록',          // 캐릭터 이름
      nameEn: 'UNREGISTERED',  // 세로 대제목용 영문 표기
      title: '',               // 이명
      quote: '',
      specs: [['소속', '미등록'], ['종족', '미등록'], ['역할', '미등록']],
      profile: [],             // 문단 배열
      ability: [],
      record: [],
      image: '',               // 전신 일러스트
      thumb: ''                // 선택 창 배너
    };
  }),

  nations: [1, 2, 3, 4].map(function (n) {
    var id = String(n).padStart(2, '0');
    return {
      id: id,
      code: 'RSC-N' + id,
      name: '미등록 국가',
      nameEn: 'UNCHARTED',
      desc: '',
      shape: n - 1,                                   // 0 첨탑 · 1 고리 · 2 결정 · 3 돔
      map: [[720, 520], [1560, 420], [1180, 1040], [1980, 1180]][n - 1]  // 지도 위 좌표
    };
  }),

  games: [1, 2, 3].map(function (n) {
    var id = String(n).padStart(2, '0');
    return { id: id, code: 'RSC-G' + id, name: '미등록', genre: '미정', platform: '미정', status: '준비 중', url: '', image: '' };
  }),

  clues: [1, 2, 3, 4, 5].map(function (n) {
    var id = String(n).padStart(2, '0');
    return { id: id, code: 'RSC-X' + id, text: '' };   // text 를 채우면 해독 시 표시
  }),

  notices: [
    {
      title: 'Patch v-1.0.0',
      date: '2026.11.11',
      tag: '공지',
      body: [
        '라시안컷 공식 홈페이지를 열었습니다.',
        '메인 화면: 캐릭터, 국가 소개(3D 모델), 2D 지도, 게임 목록, 떡밥, 소설, 공지, 갤러리 구역 추가',
        '캐릭터 창: 캐릭터 선택 화면과 일러스트 배치 화면 추가',
        '갤러리 창과 소설 창으로 가는 입구 추가',
        '이미지는 아직 등록되지 않아 모든 이미지 자리가 비어 있습니다.'
      ]
    }
  ],

  gallery: [
    { ratio: '3/4' }, { ratio: '16/9' }, { ratio: '1/1' }, { ratio: '4/5' },
    { ratio: '16/9' }, { ratio: '3/4' }, { ratio: '1/1' }, { ratio: '21/9' }
  ].map(function (g, i) {
    g.id = String(i + 1).padStart(2, '0'); g.code = 'RSC-A' + g.id; g.title = ''; g.image = ''; return g;
  })
};
