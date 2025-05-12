// app-init.js - 极简应用初始化

// 全局标志，用于避免重复加载书籍
window.bookLoaded = false;

// 记录上次翻页时间和阅读时长限制
let lastPageTurnTime = Date.now();
const MIN_READING_SECONDS = 3;   // 最小记录时长为3秒
const MAX_READING_SECONDS = 300; // 最大记录时长为5分钟(300秒)

// 应用初始化
document.addEventListener('DOMContentLoaded', async function() {
  console.log('初始化应用...');

  // 初始化上次翻页时间
  lastPageTurnTime = Date.now();
  console.log('app-init.js: 初始化上次翻页时间:', new Date(lastPageTurnTime).toLocaleTimeString());

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
  console.log(`app-init.js: 检查书籍末尾 - 当前位置: ${currentLocation}, 总位置: ${totalLocations}`);

  // 如果当前位置接近总位置的95%以上，认为已到达末尾
  if (currentLocation > totalLocations * 0.95) {
    console.log('app-init.js: 已到达书籍末尾，显示已读完对话框');

    // 显示已读完对话框
    const dialog = document.getElementById('finish-dialog');
    if (dialog) {
      dialog.style.display = 'block';
    } else {
      console.error('app-init.js: 未找到finish-dialog元素');
    }
  }
}

/**
 * 记录阅读时间函数
 * 每次翻页时调用此函数，根据页面停留时间记录阅读时长
 * 阅读时间按日期和书籍ID记录在dataStore.data.readingStats.minutes中
 * 格式: { "YYYY-MM-DD": { total: 分钟数, books: { "bookId": 分钟数 } } }
 */
function recordReading() {
  console.log('app-init.js: recordReading函数被调用');

  // 检查dataStore是否存在
  if (!dataStore) {
    console.error('app-init.js: dataStore对象不存在');
    return;
  }

  // 检查getCurrentBook方法是否存在
  if (typeof dataStore.getCurrentBook !== 'function') {
    console.error('app-init.js: dataStore.getCurrentBook方法不存在');
    return;
  }

  // 获取当前书籍
  const currentBook = dataStore.getCurrentBook();
  console.log('app-init.js: 当前书籍对象:', currentBook);

  // 获取当前书籍ID
  const currentBookId = currentBook?.id;
  console.log('app-init.js: 当前书籍ID:', currentBookId);

  if (currentBookId) {
    // 检查recordReading方法是否存在
    if (typeof dataStore.recordReading !== 'function') {
      console.error('app-init.js: dataStore.recordReading方法不存在');
      return;
    }

    // 计算页面停留时间（毫秒）
    const now = Date.now();
    const timeSpentMs = now - lastPageTurnTime;

    // 将毫秒转换为秒
    const timeSpentSeconds = Math.floor(timeSpentMs / 1000);

    // 更新上次翻页时间
    lastPageTurnTime = now;

    // 检查是否达到最小记录时长
    if (timeSpentSeconds < MIN_READING_SECONDS) {
      console.log(`app-init.js: 页面停留时间过短 (${timeSpentSeconds}秒 < ${MIN_READING_SECONDS}秒)，不记录阅读时间`);
      return;
    }

    // 应用上限，避免记录过长的时间
    let secondsToRecord = timeSpentSeconds;
    if (secondsToRecord > MAX_READING_SECONDS) {
      console.log(`app-init.js: 阅读时间超过上限 (${secondsToRecord}秒 > ${MAX_READING_SECONDS}秒)，将使用上限值`);
      secondsToRecord = MAX_READING_SECONDS;
    }

    // 将秒转换为分钟（保留两位小数）
    const minutesToRecord = parseFloat((secondsToRecord / 60).toFixed(2));

    console.log(`app-init.js: 页面停留时间: ${timeSpentSeconds}秒，记录为 ${minutesToRecord} 分钟`);

    // 调用dataStore的recordReading方法记录阅读时间
    console.log(`app-init.js: 调用dataStore.recordReading方法，记录 ${minutesToRecord} 分钟...`);
    dataStore.recordReading(currentBookId, minutesToRecord);
    console.log(`app-init.js: 记录阅读活动成功: ${currentBookId} +${minutesToRecord}分钟`);
  } else {
    console.warn('app-init.js: 无法记录阅读时间：未找到当前书籍ID');

    // 即使没有记录阅读时间，也要更新上次翻页时间
    lastPageTurnTime = Date.now();
  }
}

// 修改现有的 updatePages 函数
window.updatePagesOriginal = window.updatePages;
window.updatePages = function(location) {
  console.log(`app-init.js: 调用updatePages，位置=${location}`);

  // 调用原始函数
  window.updatePagesOriginal(location);

  // 保存进度
  // 直接使用dataStore.getCurrentBook()获取当前书籍ID
  // 不再依赖window.currentBook
  const currentBookId = dataStore.getCurrentBook()?.id;
  if (currentBookId) {
    // 保存位置索引
    dataStore.updateProgress(currentBookId, location);
    console.log(`app-init.js: 更新阅读进度，书籍=${currentBookId}, 位置=${location}`);
  } else {
    console.warn('无法更新阅读进度：未找到当前书籍ID');
  }
};

// 修改导航函数，添加阅读记录
// 注意：index.html中的原始函数已移除阅读记录逻辑，以避免重复记录
console.log('app-init.js: 准备重写导航函数...');

// 在文档完全加载后重写导航函数
document.addEventListener('DOMContentLoaded', function() {
  console.log('app-init.js: DOMContentLoaded事件触发，开始重写导航函数...');

  // 延迟执行，确保index.html中的所有脚本都已执行完毕
  setTimeout(function() {
    console.log('app-init.js: 延迟执行重写导航函数...');

    // 检查原始函数是否存在
    if (typeof window.navigateNext !== 'function' || typeof window.navigatePrev !== 'function') {
      console.error('app-init.js: 原始导航函数不存在，无法重写');
      return;
    }

    // 保存原始函数的引用
    window.navigateNextOriginal = window.navigateNext;
    window.navigatePrevOriginal = window.navigatePrev;

    console.log('app-init.js: 已保存原始导航函数的引用');

    // 重写向后翻页函数
    window.navigateNext = function() {
      console.log('app-init.js: 调用navigateNext...');

      // 首先调用原始函数进行基本的翻页操作
      window.navigateNextOriginal();
      console.log('app-init.js: 原始navigateNext执行完毕');

      // 然后记录阅读时间（每次翻页记录1分钟）
      console.log('app-init.js: 准备记录阅读时间...');
      recordReading();

      // 检查是否到达书籍末尾
      if (window.book && window.book.locations && window.currentLocation !== undefined) {
        console.log('app-init.js: 检查是否到达书籍末尾...');
        checkBookEnd(window.currentLocation, window.book.locations.total);
      }
    };

    // 重写向前翻页函数
    window.navigatePrev = function() {
      console.log('app-init.js: 调用navigatePrev...');

      // 首先调用原始函数进行基本的翻页操作
      window.navigatePrevOriginal();
      console.log('app-init.js: 原始navigatePrev执行完毕');

      // 然后记录阅读时间（每次翻页记录1分钟）
      console.log('app-init.js: 准备记录阅读时间...');
      recordReading();
    };

    console.log('app-init.js: 导航函数重写完成');
  }, 500); // 延迟500毫秒执行，确保index.html中的所有脚本都已执行完毕
});
