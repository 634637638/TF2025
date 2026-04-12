const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const TARGET_EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const hasUnifiedPagination = content.includes('<Pagination') || content.includes('<PaginationComponent');
  const hasElementPagination = content.includes('<el-pagination');
  const hasLegacyElementPaginationStyleRef = content.includes('.el-pagination');

  if (!hasUnifiedPagination && !hasElementPagination && !hasLegacyElementPaginationStyleRef) {
    return null;
  }

  return {
    file: path.relative(path.resolve(__dirname, '..'), filePath),
    unified: hasUnifiedPagination,
    element: hasElementPagination,
    legacyStyleRef: hasLegacyElementPaginationStyleRef
  };
}

function main() {
  const files = walk(SRC_DIR).map(scanFile).filter(Boolean);

  const summary = {
    totalFilesWithPagination: files.length,
    unifiedOnly: files.filter((item) => item.unified && !item.element).length,
    elementOnly: files.filter((item) => item.element && !item.unified).length,
    mixed: files.filter((item) => item.unified && item.element).length,
    legacyStyleRefs: files.filter((item) => item.legacyStyleRef).length
  };

  console.log(JSON.stringify({
    summary,
    files
  }, null, 2));
}

main();
