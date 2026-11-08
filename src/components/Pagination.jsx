export default function Pagination({ page, setPage, totalItems, pageSize = 10 }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  if (totalItems <= pageSize) return null;

  let pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  if (totalPages > 7) {
    const first = Math.max(1, safePage - 1);
    const last = Math.min(totalPages, safePage + 1);
    const middle = [];
    for (let pageNumber = first; pageNumber <= last; pageNumber += 1) middle.push(pageNumber);
    pages = [1, ...middle.filter((number) => number !== 1), ...middle.filter((number) => number !== totalPages), totalPages]
      .filter((number, index, values) => values.indexOf(number) === index);
  }

  return (
    <div className="pagination">
      <small className="muted">Showing {start}-{end} of {totalItems}</small>
      <div className="pagination-controls">
        <button className="btn small" type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</button>
        {pages.map((pageNumber, index) => (
          index > 0 && pageNumber > pages[index - 1] + 1 ? (
            <span key={`ellipsis-${pageNumber}`} className="pagination-ellipsis">...</span>
          ) : (
          <button
            key={pageNumber}
            className={pageNumber === safePage ? "chip active pagination-page" : "chip pagination-page"}
            type="button"
            onClick={() => setPage(pageNumber)}
          >
            {pageNumber}
          </button>
          )
        ))}
        <button className="btn small" type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next</button>
      </div>
    </div>
  );
}
