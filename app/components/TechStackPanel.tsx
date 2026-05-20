// 기술 스택 분포 + 언어 분포 패널
// - 단순 막대바 형태로 시각화 (count 기반 정렬)
// - 너무 길어지면 상위 N 개만 표시

type DistributionItem = { name: string; count: number };

type Props = {
  techStack: DistributionItem[];
  languages: Array<{ language: string; count: number }>;
};

function Bar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-track" aria-hidden>
      <div className="bar-fill" style={{ width: `${ratio}%` }} />
    </div>
  );
}

export default function TechStackPanel({ techStack, languages }: Props) {
  const techTop = techStack.slice(0, 8);
  const langTop = languages.slice(0, 6);
  const techMax = techTop[0]?.count ?? 1;
  const langMax = langTop[0]?.count ?? 1;

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>기술 스택 분포</h3>
      </header>
      {techTop.length === 0 ? (
        <p className="muted small">감지된 기술 스택이 없습니다. 설정 파일이 부족할 수 있습니다.</p>
      ) : (
        <ul className="bar-list">
          {techTop.map((item) => (
            <li key={item.name} className="bar-row">
              <span className="bar-label">{item.name}</span>
              <Bar value={item.count} max={techMax} />
              <span className="bar-count">{item.count}</span>
            </li>
          ))}
        </ul>
      )}

      <header className="panel-header" style={{ marginTop: "1rem" }}>
        <h3>주요 언어</h3>
      </header>
      {langTop.length === 0 ? (
        <p className="muted small">언어 정보를 가져오지 못했습니다.</p>
      ) : (
        <ul className="bar-list">
          {langTop.map((item) => (
            <li key={item.language} className="bar-row">
              <span className="bar-label">{item.language}</span>
              <Bar value={item.count} max={langMax} />
              <span className="bar-count">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
