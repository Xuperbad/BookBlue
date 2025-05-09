// app-init.js - 极简应用初始化

// 全局标志，用于避免重复加载书籍
window.bookLoaded = false;

// 应用初始化
document.addEventListener('DOMContentLoaded', async function() {
  console.log('初始化应用...');

  // 检查 Dropbox 授权状态
  const isAuthorized = checkDropboxAuthStatus();

  if (isAuthorized) {
    // 初始化数据存储
    await dataStore.init();

    // 加载书籍列表
    if (typeof loadDropboxBooks === 'function') {
      loadDropboxBooks();
    }

    // 加载当前书籍（如果有且未加载）
    if (!window.bookLoaded) {
      const currentBook = dataStore.getCurrentBook();
      if (currentBook) {
        console.log('app-init.js: 加载上次阅读的书籍:', currentBook.title);

        // 从 Dropbox 加载书籍文件
        const file = await dataStore.loadBookFile(currentBook.id);
        if (file) {
          // 标记书籍已加载
          window.bookLoaded = true;

          // 加载书籍
          loadBook(file, currentBook.progress);
        } else {
          console.error('无法加载书籍文件:', currentBook.id);
        }
      }
    }
  }

  // 设置笔记区域事件
  setupNotesArea();

  // 设置已读完对话框事件
  setupFinishDialog();
});

// 加载书籍函数
async function loadBook(file, progress = 0) {
  // 使用 dataStore.loadAndDisplayBook 加载并显示书籍
  await dataStore.loadAndDisplayBook(file);

  // 设置进度（如果有）
  if (progress > 0 && typeof window.updatePages === 'function') {
    setTimeout(() => {
      window.updatePages(progress);
    }, 1000);
  }
}

// 设置笔记区域
function setupNotesArea() {
  const notesTextarea = document.getElementById('notes');
  if (!notesTextarea) return;

  // 当笔记内容变化时保存
  notesTextarea.addEventListener('input', function() {
    const currentBookId = dataStore.getCurrentBookId();
    if (currentBookId) {
      dataStore.saveNote(currentBookId, notesTextarea.value);
    }
  });
}

// 设置已读完对话框
function setupFinishDialog() {
  const dialog = document.getElementById('finish-dialog');
  const yesButton = document.getElementById('finish-yes');
  const noButton = document.getElementById('finish-no');

  if (!dialog || !yesButton || !noButton) return;

  // 点击"是"按钮
  yesButton.addEventListener('click', () => {
    // 标记当前书籍为已读完
    const currentBookId = dataStore.getCurrentBookId();
    if (currentBookId) {
      dataStore.markAsFinished(currentBookId);
    }

    // 隐藏对话框
    dialog.style.display = 'none';
  });

  // 点击"否"按钮
  noButton.addEventListener('click', () => {
    // 隐藏对话框
    dialog.style.display = 'none';
  });
}

// 注意：window.handleFile 已被移除，请使用 dataStore.loadAndDisplayBook
// 这个注释保留在这里，以便开发者了解这个变更

// 检查是否到达书籍末尾
function checkBookEnd(currentLocation, totalLocations) {
  // 如果当前位置接近总位置的95%以上，认为已到达末尾
  if (currentLocation > totalLocations * 0.95) {
    // 显示已读完对话框
    const dialog = document.getElementById('finish-dialog');
    if (dialog) {
      dialog.style.display = 'block';
    }
  }
}

// 添加阅读记录函数 - 每次翻页记录1分钟
function recordReading() {
  if (window.currentBook) {
    // 使用当前书籍ID记录阅读时间
    const currentBookId = dataStore.getCurrentBook()?.id;
    if (currentBookId) {
      dataStore.recordReading(currentBookId, 1);
    } else {
      console.warn('无法记录阅读时间：未找到当前书籍ID');
    }
  }
}

// 修改现有的 updatePages 函数
window.updatePagesOriginal = window.updatePages;
window.updatePages = function(location) {
  // 调用原始函数
  window.updatePagesOriginal(location);

  // 保存进度
  if (window.currentBook) {
    // 使用当前书籍ID更新进度
    const currentBookId = dataStore.getCurrentBook()?.id;
    if (currentBookId) {
      dataStore.updateProgress(currentBookId, location);
    } else {
      console.warn('无法更新阅读进度：未找到当前书籍ID');
    }
  }
};

// 修改导航函数，添加阅读记录
window.navigateNextOriginal = window.navigateNext;
window.navigateNext = function() {
  window.navigateNextOriginal();
  recordReading();

  // 检查是否到达书籍末尾
  if (window.book && window.book.locations && window.currentLocation !== undefined) {
    checkBookEnd(window.currentLocation, window.book.locations.total);
  }
};

window.navigatePrevOriginal = window.navigatePrev;
window.navigatePrev = function() {
  window.navigatePrevOriginal();
  recordReading();
};
