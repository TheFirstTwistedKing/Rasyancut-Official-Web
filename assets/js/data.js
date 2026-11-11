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
      title: 'Patch v-1.0.2',
      date: '2026.11.11',
      tag: '공지',
      body: [
        '디자인 다듬기: 화면 전체의 글자 크기와 간격을 정해진 단계로 통일했습니다.',
        '작은 라벨 글자를 더 밝게 바꿔 어두운 배경에서도 잘 읽히게 했습니다.',
        '소설 입구를 두 짝의 문으로 바꿨습니다. 마우스를 올리면 문이 열리며 안쪽의 빛이 드러납니다.'
      ]
    },
    {
      title: 'Patch v-1.0.1',
      date: '2026.11.11',
      tag: '공지',
      body: [
        '애니메이션 속도를 전체적으로 늦췄습니다.',
        '화면 전환(사선 와이프), 구역 등장, 캐릭터·국가 넘김, 글자 해독 연출이 더 천천히 재생됩니다.',
        '국가 3D 모델의 형태 변화와 지도 이동도 더 부드럽게 바뀌었습니다.'
      ]
    },
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
