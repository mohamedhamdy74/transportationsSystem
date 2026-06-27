import React from 'react';

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  isRtl = true,
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const pages = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (
      page === 1 ||
      page === totalPages ||
      (page >= currentPage - 1 && page <= currentPage + 1)
    ) {
      pages.push({ type: 'page', page });
    } else if (page === currentPage - 2 || page === currentPage + 2) {
      pages.push({ type: 'ellipsis', page });
    }
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3 border-t border-gray-200 bg-gray-50 ${className}`}>
      <span className="text-xs text-gray-500 text-center sm:text-start">
        {isRtl
          ? `يعرض ${start} إلى ${end} من أصل ${totalItems}`
          : `Showing ${start} to ${end} of ${totalItems}`}
      </span>
      <div className="flex flex-wrap justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 text-xs rounded bg-white border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          {isRtl ? 'السابق' : 'Prev'}
        </button>
        {pages.map((item, idx) =>
          item.type === 'ellipsis' ? (
            <span key={`e-${item.page}-${idx}`} className="px-1 text-gray-400">...</span>
          ) : (
            <button
              key={item.page}
              type="button"
              onClick={() => onPageChange(item.page)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                currentPage === item.page
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.page}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 text-xs rounded bg-white border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          {isRtl ? 'التالي' : 'Next'}
        </button>
      </div>
    </div>
  );
}
