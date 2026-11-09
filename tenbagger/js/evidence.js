// Research behind the quant indicators: what each source found, which site
// indicator measures it, and its limits. Confirmed from abstracts and search
// excerpts (the PDFs were not opened from the build environment); wording is
// a faithful summary, not a quotation. Pure data, no imports.
export const EVIDENCE_CHECKED = "2026-11-09";

export const EVIDENCE = [
  { id: "yartseva2025", title: "The Alchemy of Multibagger Stocks", who: "Yartseva · Birmingham City University CAFE Working Paper 33 · 2025",
    url: "https://www.open-access.bcu.ac.uk/16180/",
    finding: "2009–2024년 10배 이상 오른 미국 주식 표본에서 소형·가치(높은 B/M)·수익성 요인이 여전히 유의했고, 높은 FCF 수익률도 주요 동인으로 제시. 자산 증가율이 EBITDA 증가율보다 높은 해에는 다음 해 초과수익이 대략 4–11%p 낮았고, 매수 시점이 12개월 가격 범위의 저점에 가까울수록 유리했다고 보고.",
    indicators: ["팩터 점수(크기·가치·수익성·FCF 수익률)", "자산증가 − EBITDA증가", "12개월 가격 범위 위치"],
    caveat: "10배를 달성한 종목만 표본(생존 편향). 금리 상승기의 수익률 저하는 특정 추정법에서만 유의. 소형주라는 것만으로는 충분조건이 아니라고 명시." },
  { id: "novymarx2013", title: "The Other Side of Value: The Gross Profitability Premium", who: "Novy-Marx · Journal of Financial Economics · 2013",
    url: "https://doi.org/10.1016/j.jfineco.2013.01.003",
    finding: "매출총이익 ÷ 총자산으로 잰 수익성이 B/M과 비슷한 수준으로 이후 평균 수익률의 횡단면 차이를 예측.",
    indicators: ["총이익/자산"], caveat: "포트폴리오 평균 수익률에 대한 결과이며 개별 종목 예측이 아님." },
  { id: "cooper2008", title: "Asset Growth and the Cross-Section of Stock Returns", who: "Cooper · Gulen · Schill · Journal of Finance · 2008",
    url: "https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.2008.01370.x",
    finding: "총자산 증가율이 높을수록 이후 비정상 수익률이 낮았고, 이 예측력은 대형주에서도 유지.",
    indicators: ["자산증가 − EBITDA증가"], caveat: "자산 증가 자체를 벌점으로 보는 이 연구와 달리 Yartseva는 이익보다 빠른 자산 증가만 문제로 봄 — 사이트는 후자의 차이를 표시." },
  { id: "chan1996", title: "Momentum Strategies", who: "Chan · Jegadeesh · Lakonishok · Journal of Finance · 1996",
    url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1996.tb05222.x",
    finding: "과거 수익률과 과거 이익 서프라이즈(애널리스트 추정치 수정 포함)가 서로를 통제해도 각각 이후 수익률의 큰 추세를 예측.",
    indicators: ["EPS 추정치 30·90일 변화", "모멘텀 z", "산업 대비 상대 강도"], caveat: "1977–1993년 미국 표본. 추세는 주로 6–12개월 안에 나타남." },
  { id: "pontiff2008", title: "Share Issuance and Cross-sectional Returns", who: "Pontiff · Woodgate · Journal of Finance · 2008",
    url: "https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2008.01335.x",
    finding: "1970년 이후 주식 발행(희석)이 이후 수익률을 강하게 예측(발행이 많을수록 낮음). 1970년 이전에는 유의하지 않음.",
    indicators: ["3년 주식 수 증가", "1년 희석"], caveat: "기간에 따라 결과가 다름." },
  { id: "bessembinder2018", title: "Do Stocks Outperform Treasury Bills?", who: "Bessembinder · Journal of Financial Economics · 2018",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0304405X18301521",
    finding: "1926년 이후 CRSP 보통주 7개 중 4개는 평생 보유 수익률이 1개월 국채보다 낮았고, 상위 4% 기업이 미국 주식시장 순 부(富) 증가 전체를 설명.",
    indicators: ["과거 10배 기본률(코호트)"], caveat: "요인이 아니라 기본률 맥락: 10배 종목은 드물고 수익은 소수에 집중." },
  { id: "mayer2015", title: "100 Baggers", who: "Christopher Mayer · 2015 (인터뷰·서평 기준)",
    url: "https://www.theinvestorspodcast.com/millennial-investing/finding-100-bagger-stocks/",
    finding: "1962–2014년 100배 종목의 공통점으로 큰 매출·이익 성장, 재투자 여지가 있는 높은 자본수익률, 작은 출발 규모, 경영자 지분, 이익 성장과 밸류에이션 배수 확대의 결합, 긴 보유 기간을 제시.",
    indicators: ["매출 3년 CAGR", "ROE", "내부자 지분", "시가총액"], caveat: "사후적 승자 연구(생존 편향). 책 원문이 아닌 인터뷰·서평으로 확인." },
];
