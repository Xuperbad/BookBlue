/**
 * BookBlue 数据模型
 * 包含应用程序使用的主要数据结构定义
 */

// 生成唯一ID的辅助函数
function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * 书籍库 - 管理所有书籍信息
 */
class BookLibrary {
  constructor() {
    this.books = {};           // 存储所有书籍信息
    this.currentBookId = null; // 当前正在阅读的书籍ID
  }

  /**
   * 从本地存储加载数据
   */
  loadFromLocal() {
    try {
      // 加载书籍数据
      const savedBooks = localStorage.getItem('bookblue-library');
      if (savedBooks) {
        this.books = JSON.parse(savedBooks);
      }

      // 加载当前书籍ID
      const currentId = localStorage.getItem('bookblue-current-book');
      if (currentId) {
        this.currentBookId = currentId;
      }

      console.log('从本地存储加载了书籍库数据');
      return true;
    } catch (error) {
      console.error('加载书籍库数据失败:', error);
      return false;
    }
  }

  /**
   * 保存数据到本地存储
   */
  saveToLocal() {
    try {
      localStorage.setItem('bookblue-library', JSON.stringify(this.books));
      if (this.currentBookId) {
        localStorage.setItem('bookblue-current-book', this.currentBookId);
      }
      return true;
    } catch (error) {
      console.error('保存书籍库数据失败:', error);
      return false;
    }
  }

  /**
   * 添加新书籍
   * @param {Object} bookData - 书籍数据
   * @returns {String} 新书籍的ID
   */
  addBook(bookData) {
    // 生成唯一ID
    const bookId = generateId();

    // 创建新的书籍对象
    const newBook = {
      id: bookId,
      filename: bookData.filename || 'unknown.epub',
      title: bookData.title || bookData.filename || 'Unknown Title',
      author: bookData.author || 'Unknown Author',
      path: bookData.path || null,
      coverUrl: bookData.coverUrl || null,
      addedDate: new Date().toISOString().split('T')[0],
      lastRead: new Date().toISOString().split('T')[0],
      progress: {
        location: 0,
        percentage: 0,
        lastUpdated: new Date().toISOString()
      },
      isFinished: false,
      totalReadingTime: 0
    };

    // 添加到书籍集合
    this.books[bookId] = newBook;

    // 保存更改
    this.saveToLocal();

    return bookId;
  }

  /**
   * 更新书籍进度
   * @param {String} bookId - 书籍ID
   * @param {Number} location - 当前位置
   * @param {Number} percentage - 完成百分比 (0-1)
   */
  updateBookProgress(bookId, location, percentage = null) {
    if (!this.books[bookId]) {
      console.error(`更新进度失败: 未找到ID为 ${bookId} 的书籍`);
      return false;
    }

    this.books[bookId].progress.location = location;
    if (percentage !== null) {
      this.books[bookId].progress.percentage = percentage;
    }
    this.books[bookId].progress.lastUpdated = new Date().toISOString();
    this.books[bookId].lastRead = new Date().toISOString().split('T')[0];

    // 保存更改
    this.saveToLocal();
    return true;
  }

  /**
   * 设置当前阅读的书籍
   * @param {String} bookId - 书籍ID
   */
  setCurrentBook(bookId) {
    if (!this.books[bookId]) {
      console.error(`设置当前书籍失败: 未找到ID为 ${bookId} 的书籍`);
      return false;
    }

    this.currentBookId = bookId;
    this.books[bookId].lastRead = new Date().toISOString().split('T')[0];

    // 保存更改
    this.saveToLocal();
    return true;
  }

  /**
   * 获取当前阅读的书籍
   * @returns {Object|null} 当前书籍对象或null
   */
  getCurrentBook() {
    if (!this.currentBookId || !this.books[this.currentBookId]) {
      return null;
    }
    return this.books[this.currentBookId];
  }

  /**
   * 标记书籍为已读完
   * @param {String} bookId - 书籍ID
   */
  markAsFinished(bookId) {
    if (!this.books[bookId]) {
      console.error(`标记为已读完失败: 未找到ID为 ${bookId} 的书籍`);
      return false;
    }

    this.books[bookId].isFinished = true;

    // 保存更改
    this.saveToLocal();
    return true;
  }

  /**
   * 获取所有已读完的书籍
   * @returns {Array} 已读完书籍的数组
   */
  getFinishedBooks() {
    return Object.values(this.books).filter(book => book.isFinished);
  }

  /**
   * 增加书籍的阅读时间
   * @param {String} bookId - 书籍ID
   * @param {Number} minutes - 阅读分钟数
   */
  addReadingTime(bookId, minutes) {
    if (!this.books[bookId]) {
      console.error(`增加阅读时间失败: 未找到ID为 ${bookId} 的书籍`);
      return false;
    }

    this.books[bookId].totalReadingTime += minutes;
    this.books[bookId].lastRead = new Date().toISOString().split('T')[0];

    // 保存更改
    this.saveToLocal();
    return true;
  }

  /**
   * 获取最近阅读的书籍列表
   * @param {Number} limit - 返回的最大数量
   * @returns {Array} 最近阅读的书籍数组
   */
  getRecentBooks(limit = 10) {
    return Object.values(this.books)
      .sort((a, b) => new Date(b.lastRead) - new Date(a.lastRead))
      .slice(0, limit);
  }

  /**
   * 获取阅读时间最多的书籍列表
   * @param {Number} limit - 返回的最大数量
   * @returns {Array} 阅读时间最多的书籍数组
   */
  getMostReadBooks(limit = 10) {
    return Object.values(this.books)
      .sort((a, b) => b.totalReadingTime - a.totalReadingTime)
      .slice(0, limit);
  }
}

/**
 * 阅读活动管理器 - 跟踪用户的阅读活动
 */
class ReadingActivity {
  constructor() {
    this.dailyRecords = {};  // 每日阅读记录
    this.monthlySummary = {}; // 月度汇总数据
    this.stats = {           // 阅读统计
      totalBooksRead: 0,
      totalReadingTime: 0,
      averageDailyReading: 0,
      currentStreak: 0,
      longestStreak: 0
    };
  }

  /**
   * 从本地存储加载数据
   */
  loadFromLocal() {
    try {
      // 加载每日记录
      const savedDaily = localStorage.getItem('bookblue-daily-activity');
      if (savedDaily) {
        this.dailyRecords = JSON.parse(savedDaily);
      }

      // 加载月度汇总
      const savedMonthly = localStorage.getItem('bookblue-monthly-activity');
      if (savedMonthly) {
        this.monthlySummary = JSON.parse(savedMonthly);
      }

      // 加载统计数据
      const savedStats = localStorage.getItem('bookblue-reading-stats');
      if (savedStats) {
        this.stats = JSON.parse(savedStats);
      }

      console.log('从本地存储加载了阅读活动数据');
      return true;
    } catch (error) {
      console.error('加载阅读活动数据失败:', error);
      return false;
    }
  }

  /**
   * 保存数据到本地存储
   */
  saveToLocal() {
    try {
      localStorage.setItem('bookblue-daily-activity', JSON.stringify(this.dailyRecords));
      localStorage.setItem('bookblue-monthly-activity', JSON.stringify(this.monthlySummary));
      localStorage.setItem('bookblue-reading-stats', JSON.stringify(this.stats));
      return true;
    } catch (error) {
      console.error('保存阅读活动数据失败:', error);
      return false;
    }
  }

  /**
   * 记录阅读活动
   * @param {String} bookId - 书籍ID
   * @param {Number} minutes - 阅读分钟数
   */
  recordActivity(bookId, minutes) {
    // 获取今天的日期
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7); // YYYY-MM 格式

    // 更新每日记录
    if (!this.dailyRecords[today]) {
      this.dailyRecords[today] = {
        totalMinutes: 0,
        bookActivities: []
      };
    }

    // 查找该书籍的活动记录
    let bookActivity = this.dailyRecords[today].bookActivities.find(
      activity => activity.bookId === bookId
    );

    if (bookActivity) {
      // 更新现有记录
      bookActivity.minutes += minutes;
    } else {
      // 添加新记录
      this.dailyRecords[today].bookActivities.push({
        bookId: bookId,
        minutes: minutes
      });
    }

    // 更新当日总时间
    this.dailyRecords[today].totalMinutes += minutes;

    // 更新月度汇总
    this._updateMonthlySummary(month, bookId, minutes);

    // 更新统计数据
    this._updateStats();

    // 保存更改
    this.saveToLocal();

    return true;
  }

  /**
   * 更新月度汇总数据
   * @private
   */
  _updateMonthlySummary(month, bookId, minutes) {
    if (!this.monthlySummary[month]) {
      this.monthlySummary[month] = {
        totalMinutes: 0,
        daysRead: 0,
        bookSummaries: []
      };
    }

    // 更新总阅读时间
    this.monthlySummary[month].totalMinutes += minutes;

    // 更新阅读天数（检查是否是新的一天）
    const today = new Date().toISOString().split('T')[0];
    const monthDays = Object.keys(this.dailyRecords).filter(
      date => date.startsWith(month)
    );
    this.monthlySummary[month].daysRead = monthDays.length;

    // 更新书籍汇总
    let bookSummary = this.monthlySummary[month].bookSummaries.find(
      summary => summary.bookId === bookId
    );

    if (bookSummary) {
      // 更新现有汇总
      bookSummary.minutes += minutes;
    } else {
      // 添加新汇总
      this.monthlySummary[month].bookSummaries.push({
        bookId: bookId,
        minutes: minutes
      });
    }
  }

  /**
   * 更新统计数据
   * @private
   */
  _updateStats() {
    // 计算总阅读时间
    let totalTime = 0;
    Object.values(this.dailyRecords).forEach(day => {
      totalTime += day.totalMinutes;
    });
    this.stats.totalReadingTime = totalTime;

    // 计算平均每日阅读时间
    const totalDays = Object.keys(this.dailyRecords).length;
    this.stats.averageDailyReading = totalDays > 0
      ? Math.round(totalTime / totalDays)
      : 0;

    // 计算连续阅读天数
    this._calculateReadingStreak();
  }

  /**
   * 计算连续阅读天数
   * @private
   */
  _calculateReadingStreak() {
    const dates = Object.keys(this.dailyRecords)
      .filter(date => this.dailyRecords[date].totalMinutes > 0)
      .sort();

    if (dates.length === 0) {
      this.stats.currentStreak = 0;
      return;
    }

    // 检查今天是否有阅读
    const today = new Date().toISOString().split('T')[0];
    const hasReadToday = dates.includes(today);

    // 计算当前连续阅读天数
    let currentStreak = hasReadToday ? 1 : 0;
    let longestStreak = 1;

    // 如果有今天的记录，从今天开始向前检查
    // 否则从最后一个有记录的日期开始
    const startDate = hasReadToday ? today : dates[dates.length - 1];
    const startDateTime = new Date(startDate).getTime();

    // 向前检查连续天数
    for (let i = 1; i <= 1000; i++) { // 设置上限，避免无限循环
      const prevDate = new Date(startDateTime - i * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      if (dates.includes(prevDate)) {
        currentStreak++;
      } else {
        break;
      }
    }

    // 更新最长连续天数
    this.stats.longestStreak = Math.max(this.stats.longestStreak, currentStreak);
    this.stats.currentStreak = currentStreak;
  }

  /**
   * 获取指定月份的阅读数据
   * @param {String} month - 月份，格式为 YYYY-MM
   */
  getMonthData(month) {
    return this.monthlySummary[month] || null;
  }

  /**
   * 获取指定日期的阅读数据
   * @param {String} date - 日期，格式为 YYYY-MM-DD
   */
  getDayData(date) {
    return this.dailyRecords[date] || null;
  }

  /**
   * 获取阅读统计数据
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 清理旧数据（保留最近6个月的每日数据）
   */
  cleanupOldData() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];

    // 清理旧的每日数据
    const oldDates = Object.keys(this.dailyRecords).filter(date => date < cutoffDate);
    oldDates.forEach(date => {
      delete this.dailyRecords[date];
    });

    // 保存更改
    if (oldDates.length > 0) {
      console.log(`清理了 ${oldDates.length} 条旧的每日阅读记录`);
      this.saveToLocal();
    }

    return oldDates.length;
  }
}

/**
 * 同步管理器 - 处理数据同步
 */
class SyncManager {
  constructor(bookLibrary, readingActivity) {
    this.bookLibrary = bookLibrary;
    this.readingActivity = readingActivity;
    this.localVersion = 1;
    this.lastSyncTime = null;
    this.pendingChanges = {
      books: [],
      activity: false
    };
    this.syncStatus = 'idle'; // idle, syncing, error
  }

  /**
   * 从本地存储加载数据
   */
  loadFromLocal() {
    try {
      // 加载同步状态
      const savedSync = localStorage.getItem('bookblue-sync-state');
      if (savedSync) {
        const syncData = JSON.parse(savedSync);
        this.localVersion = syncData.version || 1;
        this.lastSyncTime = syncData.lastSyncTime || null;
        this.pendingChanges = syncData.pendingChanges || { books: [], activity: false };
      }

      console.log('从本地存储加载了同步状态');
      return true;
    } catch (error) {
      console.error('加载同步状态失败:', error);
      return false;
    }
  }

  /**
   * 保存数据到本地存储
   */
  saveToLocal() {
    try {
      const syncData = {
        version: this.localVersion,
        lastSyncTime: this.lastSyncTime,
        pendingChanges: this.pendingChanges
      };

      localStorage.setItem('bookblue-sync-state', JSON.stringify(syncData));
      return true;
    } catch (error) {
      console.error('保存同步状态失败:', error);
      return false;
    }
  }

  /**
   * 标记书籍有更改
   * @param {String} bookId - 书籍ID
   */
  markBookChanged(bookId) {
    if (!this.pendingChanges.books.includes(bookId)) {
      this.pendingChanges.books.push(bookId);
      this.saveToLocal();
    }
  }

  /**
   * 标记阅读活动有更改
   */
  markActivityChanged() {
    this.pendingChanges.activity = true;
    this.saveToLocal();
  }

  /**
   * 检查是否有待同步的更改
   */
  hasPendingChanges() {
    return this.pendingChanges.books.length > 0 || this.pendingChanges.activity;
  }

  /**
   * 获取同步状态
   */
  getStatus() {
    return {
      status: this.syncStatus,
      lastSync: this.lastSyncTime,
      pendingBooks: this.pendingChanges.books.length,
      pendingActivity: this.pendingChanges.activity
    };
  }
}

/**
 * 缓存管理器 - 管理书籍和封面的缓存
 */
class CacheManager {
  constructor() {
    this.config = {
      maxBookCacheSize: 500 * 1024 * 1024,  // 500MB
      maxCoverCacheSize: 50 * 1024 * 1024,  // 50MB
      bookExpiryDays: 30,                   // 30天未访问则过期
      coverExpiryDays: 90                   // 90天未访问则过期
    };

    this.stats = {
      bookCacheSize: 0,
      coverCacheSize: 0,
      totalItems: 0
    };

    // 初始化缓存
    this._initCache();
  }

  /**
   * 初始化缓存
   * @private
   */
  async _initCache() {
    try {
      // 检查是否支持IndexedDB
      if (!window.indexedDB) {
        console.error('您的浏览器不支持IndexedDB，缓存功能将不可用');
        return false;
      }

      // 加载缓存统计
      const savedStats = localStorage.getItem('bookblue-cache-stats');
      if (savedStats) {
        this.stats = JSON.parse(savedStats);
      }

      console.log('缓存管理器初始化完成');
      return true;
    } catch (error) {
      console.error('初始化缓存失败:', error);
      return false;
    }
  }

  /**
   * 保存缓存统计
   * @private
   */
  _saveStats() {
    try {
      localStorage.setItem('bookblue-cache-stats', JSON.stringify(this.stats));
      return true;
    } catch (error) {
      console.error('保存缓存统计失败:', error);
      return false;
    }
  }

  /**
   * 缓存书籍
   * @param {String} bookId - 书籍ID
   * @param {File} fileData - 书籍文件数据
   */
  async cacheBook(bookId, fileData) {
    try {
      // 检查缓存大小是否超过限制
      if (this.stats.bookCacheSize + fileData.size > this.config.maxBookCacheSize) {
        // 需要清理一些缓存
        await this._cleanupBookCache(fileData.size);
      }

      // 使用localStorage存储小文件，IndexedDB存储大文件
      if (fileData.size < 5 * 1024 * 1024) { // 小于5MB的文件
        // 转换为Base64存储
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
        });

        reader.readAsDataURL(fileData);
        const base64Data = await base64Promise;

        // 存储到localStorage
        const cacheKey = `book-cache-${bookId}`;
        const cacheMetaKey = `book-meta-${bookId}`;

        localStorage.setItem(cacheKey, base64Data);
        localStorage.setItem(cacheMetaKey, JSON.stringify({
          size: fileData.size,
          timestamp: Date.now(),
          type: fileData.type,
          name: fileData.name
        }));

        // 更新统计
        this.stats.bookCacheSize += fileData.size;
        this.stats.totalItems++;
        this._saveStats();

        console.log(`书籍 ${bookId} 已缓存到localStorage，大小: ${fileData.size} 字节`);
        return true;
      } else {
        // 大文件使用IndexedDB存储
        // 这里简化处理，实际实现需要完整的IndexedDB代码
        console.log(`书籍 ${bookId} 太大，无法缓存到localStorage`);
        return false;
      }
    } catch (error) {
      console.error(`缓存书籍 ${bookId} 失败:`, error);
      return false;
    }
  }

  /**
   * 获取缓存的书籍
   * @param {String} bookId - 书籍ID
   */
  async getCachedBook(bookId) {
    try {
      // 检查localStorage中是否有缓存
      const cacheKey = `book-cache-${bookId}`;
      const cacheMetaKey = `book-meta-${bookId}`;

      const cachedData = localStorage.getItem(cacheKey);
      const cachedMeta = localStorage.getItem(cacheMetaKey);

      if (cachedData && cachedMeta) {
        // 解析元数据
        const meta = JSON.parse(cachedMeta);

        // 更新访问时间
        meta.timestamp = Date.now();
        localStorage.setItem(cacheMetaKey, JSON.stringify(meta));

        // 从Base64创建Blob
        const base64Response = await fetch(cachedData);
        const blob = await base64Response.blob();

        // 创建File对象
        const file = new File([blob], meta.name, {
          type: meta.type || 'application/epub+zip'
        });

        console.log(`从缓存加载书籍 ${bookId}，大小: ${file.size} 字节`);
        return file;
      }

      // 如果localStorage中没有，检查IndexedDB
      // 这里简化处理，实际实现需要完整的IndexedDB代码

      console.log(`未找到书籍 ${bookId} 的缓存`);
      return null;
    } catch (error) {
      console.error(`获取缓存书籍 ${bookId} 失败:`, error);
      return null;
    }
  }

  /**
   * 缓存封面图片
   * @param {String} bookId - 书籍ID
   * @param {String} coverUrl - 封面图片URL或Base64数据
   */
  async cacheCover(bookId, coverUrl) {
    try {
      // 估计封面大小
      const estimatedSize = coverUrl.length;

      // 检查缓存大小是否超过限制
      if (this.stats.coverCacheSize + estimatedSize > this.config.maxCoverCacheSize) {
        // 需要清理一些缓存
        await this._cleanupCoverCache(estimatedSize);
      }

      // 存储到localStorage
      const cacheKey = `cover-cache-${bookId}`;
      const cacheMetaKey = `cover-meta-${bookId}`;

      localStorage.setItem(cacheKey, coverUrl);
      localStorage.setItem(cacheMetaKey, JSON.stringify({
        size: estimatedSize,
        timestamp: Date.now()
      }));

      // 更新统计
      this.stats.coverCacheSize += estimatedSize;
      this.stats.totalItems++;
      this._saveStats();

      console.log(`书籍 ${bookId} 的封面已缓存，大小: ${estimatedSize} 字节`);
      return true;
    } catch (error) {
      console.error(`缓存书籍 ${bookId} 的封面失败:`, error);
      return false;
    }
  }

  /**
   * 获取缓存的封面
   * @param {String} bookId - 书籍ID
   */
  async getCachedCover(bookId) {
    try {
      // 检查localStorage中是否有缓存
      const cacheKey = `cover-cache-${bookId}`;
      const cacheMetaKey = `cover-meta-${bookId}`;

      const cachedData = localStorage.getItem(cacheKey);
      const cachedMeta = localStorage.getItem(cacheMetaKey);

      if (cachedData && cachedMeta) {
        // 解析元数据
        const meta = JSON.parse(cachedMeta);

        // 更新访问时间
        meta.timestamp = Date.now();
        localStorage.setItem(cacheMetaKey, JSON.stringify(meta));

        console.log(`从缓存加载书籍 ${bookId} 的封面`);
        return cachedData;
      }

      console.log(`未找到书籍 ${bookId} 封面的缓存`);
      return null;
    } catch (error) {
      console.error(`获取缓存封面 ${bookId} 失败:`, error);
      return null;
    }
  }

  /**
   * 清理书籍缓存
   * @private
   * @param {Number} neededSpace - 需要释放的空间大小
   */
  async _cleanupBookCache(neededSpace) {
    try {
      // 获取所有书籍缓存的元数据
      const cacheItems = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('book-meta-')) {
          const bookId = key.replace('book-meta-', '');
          const meta = JSON.parse(localStorage.getItem(key));

          cacheItems.push({
            bookId,
            size: meta.size,
            timestamp: meta.timestamp
          });
        }
      }

      // 按最后访问时间排序
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);

      // 释放空间
      let freedSpace = 0;
      for (const item of cacheItems) {
        if (freedSpace >= neededSpace) break;

        // 删除缓存
        localStorage.removeItem(`book-cache-${item.bookId}`);
        localStorage.removeItem(`book-meta-${item.bookId}`);

        freedSpace += item.size;
        this.stats.bookCacheSize -= item.size;
        this.stats.totalItems--;

        console.log(`清理了书籍 ${item.bookId} 的缓存，释放了 ${item.size} 字节`);
      }

      // 保存统计
      this._saveStats();

      return freedSpace;
    } catch (error) {
      console.error('清理书籍缓存失败:', error);
      return 0;
    }
  }

  /**
   * 清理封面缓存
   * @private
   * @param {Number} neededSpace - 需要释放的空间大小
   */
  async _cleanupCoverCache(neededSpace) {
    try {
      // 获取所有封面缓存的元数据
      const cacheItems = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cover-meta-')) {
          const bookId = key.replace('cover-meta-', '');
          const meta = JSON.parse(localStorage.getItem(key));

          cacheItems.push({
            bookId,
            size: meta.size,
            timestamp: meta.timestamp
          });
        }
      }

      // 按最后访问时间排序
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);

      // 释放空间
      let freedSpace = 0;
      for (const item of cacheItems) {
        if (freedSpace >= neededSpace) break;

        // 删除缓存
        localStorage.removeItem(`cover-cache-${item.bookId}`);
        localStorage.removeItem(`cover-meta-${item.bookId}`);

        freedSpace += item.size;
        this.stats.coverCacheSize -= item.size;
        this.stats.totalItems--;

        console.log(`清理了书籍 ${item.bookId} 的封面缓存，释放了 ${item.size} 字节`);
      }

      // 保存统计
      this._saveStats();

      return freedSpace;
    } catch (error) {
      console.error('清理封面缓存失败:', error);
      return 0;
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache() {
    try {
      const now = Date.now();
      const bookExpiryTime = now - (this.config.bookExpiryDays * 24 * 60 * 60 * 1000);
      const coverExpiryTime = now - (this.config.coverExpiryDays * 24 * 60 * 60 * 1000);

      let expiredBooks = 0;
      let expiredCovers = 0;
      let freedSpace = 0;

      // 清理过期的书籍缓存
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('book-meta-')) {
          const bookId = key.replace('book-meta-', '');
          const meta = JSON.parse(localStorage.getItem(key));

          if (meta.timestamp < bookExpiryTime) {
            // 删除缓存
            localStorage.removeItem(`book-cache-${bookId}`);
            localStorage.removeItem(`book-meta-${bookId}`);

            freedSpace += meta.size;
            this.stats.bookCacheSize -= meta.size;
            this.stats.totalItems--;
            expiredBooks++;
          }
        } else if (key && key.startsWith('cover-meta-')) {
          const bookId = key.replace('cover-meta-', '');
          const meta = JSON.parse(localStorage.getItem(key));

          if (meta.timestamp < coverExpiryTime) {
            // 删除缓存
            localStorage.removeItem(`cover-cache-${bookId}`);
            localStorage.removeItem(`cover-meta-${bookId}`);

            freedSpace += meta.size;
            this.stats.coverCacheSize -= meta.size;
            this.stats.totalItems--;
            expiredCovers++;
          }
        }
      }

      // 保存统计
      this._saveStats();

      console.log(`清理了 ${expiredBooks} 本过期书籍和 ${expiredCovers} 个过期封面，释放了 ${freedSpace} 字节`);
      return { expiredBooks, expiredCovers, freedSpace };
    } catch (error) {
      console.error('清理过期缓存失败:', error);
      return { expiredBooks: 0, expiredCovers: 0, freedSpace: 0 };
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return { ...this.stats };
  }
}

// 导出模型
window.BookLibrary = BookLibrary;
window.ReadingActivity = ReadingActivity;
window.SyncManager = SyncManager;
window.CacheManager = CacheManager;