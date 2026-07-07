type BreadcrumbsProps = {
  path: string;
  onNavigate: (path: string) => void;
};

export function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  const segments = path.split("/").filter(Boolean);

  return (
    <nav className="breadcrumbs" aria-label="路径导航">
      <button className="breadcrumbs__item" type="button" onClick={() => onNavigate("")}>
        笔记
      </button>
      {segments.map((segment, index) => {
        const target = segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;

        return (
          <span className="breadcrumbs__segment" key={target}>
            <span className="breadcrumbs__separator">/</span>
            {isLast ? (
              <span className="breadcrumbs__current">{segment}</span>
            ) : (
              <button
                className="breadcrumbs__item"
                type="button"
                onClick={() => onNavigate(target)}
              >
                {segment}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
