/**
 * BookBlue 应用程序初始化
 * 负责初始化数据模型并将其与现有功能集成
 */

// 应用程序命名空间
const BookBlueApp = {
  // 数据模型实例
  models: {
    bookLibrary: null,
    readingActivity: null,
    syncManager: null,
    cacheManager: null
  },

  // 初始化标志
  initialized: false,

  /**
   * 初始化应用程序
   */
  async init() {
    console.log('初始化 BookBlue 应用程序...');

    try {
      // 初始化数据模型
      await this._initModels();

      // 迁移旧数据
      await this._migrateOldData();

      // 集成到现有功能
      this._integrateWithExistingFeatures();

      this.initialized = true;
      console.log('BookBlue 应用程序初始化完成');

      return true;
    } catch (error) {
      console.error('初始化 BookBlue 应用程序失败:', error);
      return false;
    }
  },

  /**
   * 初始化数据模型
   * @private
   */
  async _initModels() {
    // 创建模型实例
    this.models.bookLibrary = new BookLibrary();
    this.models.readingActivity = new ReadingActivity();
    this.models.cacheManager = new CacheManager();

    // 加载数据
    await Promise.all([
      this.models.bookLibrary.loadFromLocal(),
      this.models.readingActivity.loadFromLocal()
    ]);

    // 创建同步管理器（依赖于其他模型）
    this.models.syncManager = new SyncManager(
      this.models.bookLibrary,
      this.models.readingActivity
    );
    await this.models.syncManager.loadFromLocal();

    console.log('数据模型初始化完成');
  },

  /**
   * 迁移旧数据到新的数据结构
   * @private
   */
  async _migrateOldData() {
    console.log('开始迁移旧数据...');

    try {
      // 迁移书籍进度数据
      await this._migrateBookProgress();

      // 迁移阅读活动数据
      await this._migrateReadingActivity();

      // 迁移已读完书籍数据
      await this._migrateFinishedBooks();

      console.log('数据迁移完成');
      return true;
    } catch (error) {
      console.error('数据迁移失败:', error);
      return false;
    }
  },

  /**
   * 迁移书籍进度数据
   * @private
   */
  async _migrateBookProgress() {
    // 查找所有旧的进度数据
    const oldProgressKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith('-progress') && !key.startsWith('bookblue-')) {
        oldProgressKeys.push(key);
      }
    }

    console.log(`找到 ${oldProgressKeys.length} 条旧的进度数据`);

    // 迁移每条进度数据
    for (const key of oldProgressKeys) {
      try {
        const bookFilename = key.replace('-progress', '');
        const progressValue = localStorage.getItem(key);

        // 创建新的书籍记录
        const bookId = this.models.bookLibrary.addBook({
          filename: bookFilename,
          title: bookFilename.replace('.epub', '')
        });

        // 更新进度
        this.models.bookLibrary.updateBookProgress(bookId, parseInt(progressValue, 10) || 0);

        console.log(`迁移了书籍 ${bookFilename} 的进度数据`);
      } catch (error) {
        console.error(`迁移书籍进度数据 ${key} 失败:`, error);
      }
    }

    // 迁移当前阅读的书籍
    const currentBook = localStorage.getItem('_currentReadingBook');
    if (currentBook) {
      // 查找对应的书籍ID
      const books = Object.values(this.models.bookLibrary.books);
      const matchingBook = books.find(book => book.filename === currentBook);

      if (matchingBook) {
        this.models.bookLibrary.setCurrentBook(matchingBook.id);
        console.log(`设置当前阅读的书籍: ${currentBook}`);
      }
    }
  },

  /**
   * 迁移阅读活动数据
   * @private
   */
  async _migrateReadingActivity() {
    // 获取旧的阅读活动数据
    const oldActivityData = localStorage.getItem('reading-activity-data');
    if (!oldActivityData) {
      console.log('没有找到旧的阅读活动数据');
      return;
    }

    try {
      const activityData = JSON.parse(oldActivityData);

      // 遍历每一天的数据
      for (const dateStr in activityData) {
        const dayData = activityData[dateStr];

        // 遍历该日期的每本书
        for (const bookName in dayData.books) {
          const minutes = dayData.books[bookName];

          // 查找对应的书籍ID
          const books = Object.values(this.models.bookLibrary.books);
          const matchingBook = books.find(book => book.filename === bookName);

          if (matchingBook) {
            // 记录阅读活动
            this.models.readingActivity.recordActivity(matchingBook.id, minutes);

            // 更新书籍的总阅读时间
            this.models.bookLibrary.addReadingTime(matchingBook.id, minutes);

            console.log(`迁移了 ${dateStr} 的阅读活动: ${bookName}, ${minutes}分钟`);
          } else {
            // 如果找不到匹配的书籍，创建一个新的
            const bookId = this.models.bookLibrary.addBook({
              filename: bookName,
              title: bookName.replace('.epub', '')
            });

            // 记录阅读活动
            this.models.readingActivity.recordActivity(bookId, minutes);

            // 更新书籍的总阅读时间
            this.models.bookLibrary.addReadingTime(bookId, minutes);

            console.log(`为未知书籍 ${bookName} 创建了新记录并迁移了阅读活动`);
          }
        }
      }

      console.log('阅读活动数据迁移完成');
    } catch (error) {
      console.error('迁移阅读活动数据失败:', error);
    }
  },

  /**
   * 迁移已读完书籍数据
   * @private
   */
  async _migrateFinishedBooks() {
    // 获取旧的已读完书籍数据
    const oldFinishedData = localStorage.getItem('finished-books');
    if (!oldFinishedData) {
      console.log('没有找到旧的已读完书籍数据');
      return;
    }

    try {
      const finishedBooks = JSON.parse(oldFinishedData);

      // 遍历每本已读完的书
      for (const bookName of finishedBooks) {
        // 查找对应的书籍ID
        const books = Object.values(this.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 标记为已读完
          this.models.bookLibrary.markAsFinished(matchingBook.id);
          console.log(`标记书籍 ${bookName} 为已读完`);
        } else {
          // 如果找不到匹配的书籍，创建一个新的
          const bookId = this.models.bookLibrary.addBook({
            filename: bookName,
            title: bookName.replace('.epub', '')
          });

          // 标记为已读完
          this.models.bookLibrary.markAsFinished(bookId);
          console.log(`为未知书籍 ${bookName} 创建了新记录并标记为已读完`);
        }
      }

      // 更新统计数据
      this.models.readingActivity.stats.totalBooksRead = this.models.bookLibrary.getFinishedBooks().length;
      this.models.readingActivity.saveToLocal();

      console.log('已读完书籍数据迁移完成');
    } catch (error) {
      console.error('迁移已读完书籍数据失败:', error);
    }
  },

  /**
   * 将新的数据模型集成到现有功能中
   * @private
   */
  _integrateWithExistingFeatures() {
    console.log('集成新的数据模型到现有功能...');

    // 替换现有的readingTracker功能
    this._integrateReadingTracker();

    // 替换现有的progressSync功能
    this._integrateProgressSync();

    // 替换现有的缓存功能
    this._integrateCache();

    console.log('功能集成完成');
  },

  /**
   * 集成阅读追踪功能
   * @private
   */
  _integrateReadingTracker() {
    // 保存原始的readingTracker引用，以便在需要时访问
    if (window.readingTracker) {
      window._originalReadingTracker = window.readingTracker;
    }

    // 创建新的readingTracker对象，保持与原始API兼容
    window.readingTracker = {
      // 初始化函数 - 保持与原始API兼容
      init: function() {
        console.log('使用新的数据模型初始化readingTracker');
        // 不需要做任何事情，因为数据已经在BookBlueApp.init()中加载
      },

      // 记录阅读活动
      recordActivity: function(bookName, minutes) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 使用新的数据模型记录活动
          BookBlueApp.models.readingActivity.recordActivity(matchingBook.id, minutes);
          BookBlueApp.models.bookLibrary.addReadingTime(matchingBook.id, minutes);
        } else {
          // 如果找不到匹配的书籍，创建一个新的
          const bookId = BookBlueApp.models.bookLibrary.addBook({
            filename: bookName,
            title: bookName.replace('.epub', '')
          });

          BookBlueApp.models.readingActivity.recordActivity(bookId, minutes);
          BookBlueApp.models.bookLibrary.addReadingTime(bookId, minutes);
        }

        // 标记为需要同步
        BookBlueApp.models.syncManager.markActivityChanged();

        // 更新UI
        this.updateHeatmap();
        this.updateStats();
        this.updateFrequentBooks();
      },

      // 更新热力图
      updateHeatmap: function() {
        // 使用与原始相同的方法更新UI
        if (typeof window._originalReadingTracker?.updateHeatmap === 'function') {
          window._originalReadingTracker.updateHeatmap();
        }
      },

      // 更新统计信息
      updateStats: function() {
        // 使用与原始相同的方法更新UI
        if (typeof window._originalReadingTracker?.updateStats === 'function') {
          window._originalReadingTracker.updateStats();
        }
      },

      // 更新常读书籍列表
      updateFrequentBooks: function() {
        // 使用与原始相同的方法更新UI
        if (typeof window._originalReadingTracker?.updateFrequentBooks === 'function') {
          window._originalReadingTracker.updateFrequentBooks();
        }
      },

      // 标记书籍为已读完
      markBookAsFinished: function(bookName) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 使用新的数据模型标记为已读完
          BookBlueApp.models.bookLibrary.markAsFinished(matchingBook.id);
        } else {
          // 如果找不到匹配的书籍，创建一个新的
          const bookId = BookBlueApp.models.bookLibrary.addBook({
            filename: bookName,
            title: bookName.replace('.epub', '')
          });

          BookBlueApp.models.bookLibrary.markAsFinished(bookId);
        }

        // 更新统计数据
        BookBlueApp.models.readingActivity.stats.totalBooksRead =
          BookBlueApp.models.bookLibrary.getFinishedBooks().length;
        BookBlueApp.models.readingActivity.saveToLocal();

        // 标记为需要同步
        BookBlueApp.models.syncManager.markActivityChanged();

        // 更新UI
        this.updateStats();
      },

      // 检查是否到达书籍末尾
      checkBookEnd: function(currentLocation, totalLocations) {
        // 使用与原始相同的方法
        if (typeof window._originalReadingTracker?.checkBookEnd === 'function') {
          window._originalReadingTracker.checkBookEnd(currentLocation, totalLocations);
        }
      },

      // 获取阅读活动数据 - 兼容旧API
      getActivityData: function() {
        // 转换新的数据结构为旧的格式
        const result = {};

        // 遍历每日记录
        Object.entries(BookBlueApp.models.readingActivity.dailyRecords).forEach(([date, dayData]) => {
          result[date] = {
            totalMinutes: dayData.totalMinutes,
            books: {}
          };

          // 遍历该日期的每本书
          dayData.bookActivities.forEach(activity => {
            const book = BookBlueApp.models.bookLibrary.books[activity.bookId];
            if (book) {
              result[date].books[book.filename] = activity.minutes;
            }
          });
        });

        return result;
      },

      // 获取已读完的书籍 - 兼容旧API
      getFinishedBooks: function() {
        // 转换新的数据结构为旧的格式
        return BookBlueApp.models.bookLibrary.getFinishedBooks().map(book => book.filename);
      }
    };
  },

  /**
   * 集成进度同步功能
   * @private
   */
  _integrateProgressSync() {
    // 保存原始的progressSync引用，以便在需要时访问
    if (window.progressSync) {
      window._originalProgressSync = window.progressSync;
    }

    // 创建新的progressSync对象，保持与原始API兼容
    window.progressSync = {
      // 初始化函数 - 保持与原始API兼容
      init: function() {
        console.log('使用新的数据模型初始化progressSync');
        // 不需要做任何事情，因为数据已经在BookBlueApp.init()中加载
      },

      // 保存进度
      saveProgress: function(bookName, location) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 使用新的数据模型保存进度
          BookBlueApp.models.bookLibrary.updateBookProgress(matchingBook.id, location);
        } else {
          // 如果找不到匹配的书籍，创建一个新的
          const bookId = BookBlueApp.models.bookLibrary.addBook({
            filename: bookName,
            title: bookName.replace('.epub', '')
          });

          BookBlueApp.models.bookLibrary.updateBookProgress(bookId, location);
        }

        // 标记为需要同步
        BookBlueApp.models.syncManager.markBookChanged(matchingBook ? matchingBook.id : bookId);
      },

      // 加载进度
      loadProgress: function(bookName) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          return matchingBook.progress.location.toString();
        }

        return null;
      },

      // 设置当前阅读的书籍
      setCurrentBook: function(bookName) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 使用新的数据模型设置当前书籍
          BookBlueApp.models.bookLibrary.setCurrentBook(matchingBook.id);
        } else {
          // 如果找不到匹配的书籍，创建一个新的
          const bookId = BookBlueApp.models.bookLibrary.addBook({
            filename: bookName,
            title: bookName.replace('.epub', '')
          });

          BookBlueApp.models.bookLibrary.setCurrentBook(bookId);
        }
      },

      // 获取当前阅读的书籍
      getCurrentBook: function() {
        const currentBook = BookBlueApp.models.bookLibrary.getCurrentBook();
        return currentBook ? currentBook.filename : null;
      },

      // 从Dropbox加载进度信息
      loadFromDropbox: async function() {
        try {
          const accessToken = localStorage.getItem('dropboxAccessToken');
          if (!accessToken) {
            console.log('未连接Dropbox，无法加载进度');
            return false;
          }

          console.log('从Dropbox加载阅读进度...');

          // 进度文件路径
          const progressFilePath = '/BookBlue_Progress.json';

          // 尝试从Dropbox获取进度文件
          const response = await fetch('https://content.dropboxapi.com/2/files/download', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({ path: progressFilePath })
            }
          });

          // 如果文件不存在，创建一个空的进度数据并初始化文件
          if (response.status === 409) {
            console.log('Dropbox中没有进度文件，创建新的进度数据');
            // 立即创建进度文件
            await this.syncData();
            console.log('已在Dropbox中创建进度文件');
            return true;
          }

          if (!response.ok) {
            console.error('从Dropbox加载进度失败:', response.status);
            return false;
          }

          // 解析进度数据
          const data = await response.json();
          console.log('从Dropbox加载的进度数据:', data);

          // 处理新格式的数据 (version 2.0)
          if (data.version === "2.0" && data.books) {
            console.log('检测到新格式的进度数据 (version 2.0)');

            // 导入书籍数据
            for (const bookId in data.books) {
              const bookData = data.books[bookId];

              // 检查书籍是否已存在
              if (!BookBlueApp.models.bookLibrary.books[bookId]) {
                // 添加新书籍
                BookBlueApp.models.bookLibrary.books[bookId] = bookData;
              } else {
                // 更新现有书籍
                const existingBook = BookBlueApp.models.bookLibrary.books[bookId];

                // 更新进度
                existingBook.progress = bookData.progress;

                // 更新其他属性
                existingBook.isFinished = bookData.isFinished;
                existingBook.totalReadingTime = bookData.totalReadingTime;
                existingBook.lastRead = bookData.lastRead;
              }
            }

            // 设置当前书籍
            if (data.currentBookId && BookBlueApp.models.bookLibrary.books[data.currentBookId]) {
              BookBlueApp.models.bookLibrary.currentBookId = data.currentBookId;
            }

            // 保存更改
            BookBlueApp.models.bookLibrary.saveToLocal();

            // 导入阅读活动数据
            if (data.readingStats && data.readingStats.activityData) {
              BookBlueApp.models.readingActivity.dailyRecords = data.readingStats.activityData;
              BookBlueApp.models.readingActivity.saveToLocal();
            }

            return true;
          }

          // 处理旧格式的数据
          console.log('处理旧格式的进度数据');

          // 处理书籍进度
          for (const key in data) {
            if (key !== '_currentBook' && key !== '_readingStats' &&
                key !== 'books' && key !== 'meta' && key !== 'readingStats' &&
                key !== 'version' && key !== 'currentBookId') {

              const bookFilename = key;
              const progressValue = data[key];

              // 查找对应的书籍
              const books = Object.values(BookBlueApp.models.bookLibrary.books);
              const matchingBook = books.find(book => book.filename === bookFilename);

              if (matchingBook) {
                // 更新进度
                BookBlueApp.models.bookLibrary.updateBookProgress(matchingBook.id, parseInt(progressValue, 10) || 0);
              } else {
                // 创建新书籍
                const bookId = BookBlueApp.models.bookLibrary.addBook({
                  filename: bookFilename,
                  title: bookFilename.replace('.epub', '')
                });

                // 更新进度
                BookBlueApp.models.bookLibrary.updateBookProgress(bookId, parseInt(progressValue, 10) || 0);
              }
            }
          }

          // 处理当前书籍
          if (data._currentBook) {
            const books = Object.values(BookBlueApp.models.bookLibrary.books);
            const matchingBook = books.find(book => book.filename === data._currentBook);

            if (matchingBook) {
              BookBlueApp.models.bookLibrary.setCurrentBook(matchingBook.id);
            }
          }

          // 处理阅读统计
          if (data._readingStats && data._readingStats.activityData) {
            // 遍历每一天的数据
            for (const dateStr in data._readingStats.activityData) {
              const dayData = data._readingStats.activityData[dateStr];

              // 遍历该日期的每本书
              for (const bookName in dayData.books) {
                const minutes = dayData.books[bookName];

                // 查找对应的书籍
                const books = Object.values(BookBlueApp.models.bookLibrary.books);
                const matchingBook = books.find(book => book.filename === bookName);

                if (matchingBook) {
                  // 记录阅读活动
                  BookBlueApp.models.readingActivity.recordActivity(matchingBook.id, minutes);

                  // 更新书籍的总阅读时间
                  BookBlueApp.models.bookLibrary.addReadingTime(matchingBook.id, minutes);
                }
              }
            }
          }

          // 处理已读完书籍
          if (data._readingStats && data._readingStats.finishedBooks) {
            for (const bookName of data._readingStats.finishedBooks) {
              const books = Object.values(BookBlueApp.models.bookLibrary.books);
              const matchingBook = books.find(book => book.filename === bookName);

              if (matchingBook) {
                BookBlueApp.models.bookLibrary.markAsFinished(matchingBook.id);
              }
            }
          }

          return true;
        } catch (error) {
          console.error('从Dropbox加载进度失败:', error);
          return false;
        }
      },

      // 同步数据到Dropbox
      syncData: async function() {
        try {
          const accessToken = localStorage.getItem('dropboxAccessToken');
          if (!accessToken) {
            console.log('未连接Dropbox，无法保存进度');
            return false;
          }

          console.log('保存阅读进度到Dropbox...');

          // 获取格式化的进度数据
          const progressData = this.getProgressData();

          // 进度文件路径
          const progressFilePath = '/BookBlue_Progress.json';

          // 将进度数据转换为JSON字符串
          const progressContent = JSON.stringify(progressData, null, 2); // 使用格式化的JSON，便于阅读

          console.log('准备保存进度到Dropbox:', progressFilePath);
          console.log('进度数据:', progressContent);

          // 上传到Dropbox
          console.log('发送保存进度请求...');
          const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({
                path: progressFilePath,
                mode: 'overwrite'
              })
            },
            body: progressContent
          });

          console.log(`保存进度响应状态: ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('保存进度到Dropbox失败:', response.status, errorText);
            return false;
          }

          // 解析响应
          const result = await response.json();
          console.log('成功保存进度到Dropbox:', result);

          // 清除待同步的更改
          BookBlueApp.models.syncManager.pendingChanges = {
            books: [],
            activity: false
          };
          BookBlueApp.models.syncManager.lastSyncTime = new Date().toISOString();
          BookBlueApp.models.syncManager.saveToLocal();

          return true;
        } catch (error) {
          console.error('保存进度到Dropbox失败:', error);
          return false;
        }
      },

      // 加载当前正在阅读的书籍
      loadCurrentBook: async function() {
        try {
          // 获取当前书籍
          const currentBook = BookBlueApp.models.bookLibrary.getCurrentBook();
          if (!currentBook) {
            console.log('没有当前正在阅读的书籍');
            return false;
          }

          console.log('尝试加载当前书籍:', currentBook.filename);

          // 如果有原始的加载方法，调用它
          if (typeof window._originalProgressSync?.loadCurrentBook === 'function') {
            return await window._originalProgressSync.loadCurrentBook();
          }

          return false;
        } catch (error) {
          console.error('加载当前书籍失败:', error);
          return false;
        }
      },

      // 获取进度数据 - 使用更可靠的ID和结构化数据
      getProgressData: function() {
        try {
          // 创建新的数据结构 - 使用简单的对象，避免复杂嵌套
          const result = {
            // 版本信息
            version: "2.0"
          };

          // 添加当前阅读的书籍ID
          if (BookBlueApp.models.bookLibrary.currentBookId) {
            result.currentBookId = BookBlueApp.models.bookLibrary.currentBookId;
          }

          // 为了向后兼容，添加当前书籍文件名
          const currentBook = BookBlueApp.models.bookLibrary.getCurrentBook();
          if (currentBook) {
            result["_currentBook"] = currentBook.filename;
          }

          // 添加每本书的数据 - 使用扁平化结构
          result.books = {};
          Object.values(BookBlueApp.models.bookLibrary.books).forEach(book => {
            // 使用ID作为键
            result.books[book.id] = {
              id: book.id,
              filename: book.filename,
              title: book.title || book.filename.replace('.epub', ''),
              author: book.author || 'Unknown Author',
              location: book.progress.location,
              percentage: book.progress.percentage || 0,
              lastUpdated: book.progress.lastUpdated,
              isFinished: book.isFinished || false,
              totalReadingTime: book.totalReadingTime || 0,
              lastRead: book.lastRead
            };
          });

          // 为了向后兼容，添加文件名到位置的映射
          Object.values(BookBlueApp.models.bookLibrary.books).forEach(book => {
            result[book.filename] = book.progress.location.toString();
          });

          // 添加阅读活动数据 - 直接使用原始数据，避免嵌套
          const activityData = window.readingTracker.getActivityData();
          const finishedBooks = window.readingTracker.getFinishedBooks();

          // 为了向后兼容，添加旧格式的阅读统计
          result["_readingStats"] = {
            activityData: activityData,
            finishedBooks: finishedBooks
          };

          // 添加新格式的阅读统计
          result.readingStats = {
            activityData: activityData,
            finishedBooks: finishedBooks
          };

          // 确保没有 [object Object] 问题 - 递归检查所有属性
          const ensureSerializable = (obj) => {
            if (obj === null || obj === undefined) return obj;

            // 处理特殊对象类型，避免 [object Object] 问题
            if (obj.toString && obj.toString() === '[object Object]' && obj.constructor !== Object) {
              // 对于非普通对象，转换为字符串
              return obj.toString();
            }

            if (typeof obj === 'object') {
              // 处理数组
              if (Array.isArray(obj)) {
                return obj.map(item => ensureSerializable(item));
              }

              // 处理对象
              const newObj = {};
              for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                  newObj[key] = ensureSerializable(obj[key]);
                }
              }
              return newObj;
            }

            // 返回原始值
            return obj;
          };

          // 应用序列化检查
          const serializable = ensureSerializable(result);

          // 测试序列化
          const testJson = JSON.stringify(serializable);
          if (testJson.includes('[object Object]')) {
            console.error('序列化后仍然包含 [object Object]:', testJson);

            // 尝试更强力的修复
            const deepStringify = (obj) => {
              const newObj = {};
              for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                  const value = obj[key];
                  if (value === null) {
                    newObj[key] = null;
                  } else if (typeof value === 'object') {
                    // 对象和数组都直接转为JSON字符串
                    newObj[key] = JSON.stringify(value);
                  } else {
                    newObj[key] = value;
                  }
                }
              }
              return newObj;
            };

            return deepStringify(serializable);
          }

          return serializable;
        } catch (error) {
          console.error('生成进度数据时出错:', error);

          // 返回简单的备用数据
          const fallback = {
            version: "1.0"
          };

          // 添加当前书籍
          const currentBook = BookBlueApp.models.bookLibrary.getCurrentBook();
          if (currentBook) {
            fallback["_currentBook"] = currentBook.filename;
          }

          // 添加书籍进度
          Object.values(BookBlueApp.models.bookLibrary.books).forEach(book => {
            fallback[book.filename] = book.progress.location.toString();
          });

          return fallback;
        }
      }
    };
  },

  /**
   * 集成缓存功能
   * @private
   */
  _integrateCache() {
    // 保存原始的缓存引用，以便在需要时访问
    if (window.bookCache) {
      window._originalBookCache = window.bookCache;
    }

    // 创建新的缓存对象，保持与原始API兼容
    window.bookCache = {
      // 缓存书籍
      cacheBook: async function(bookName, fileData) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 使用新的数据模型缓存书籍
          return await BookBlueApp.models.cacheManager.cacheBook(matchingBook.id, fileData);
        } else {
          // 如果找不到匹配的书籍，创建一个新的
          const bookId = BookBlueApp.models.bookLibrary.addBook({
            filename: bookName,
            title: bookName.replace('.epub', '')
          });

          return await BookBlueApp.models.cacheManager.cacheBook(bookId, fileData);
        }
      },

      // 获取缓存的书籍
      getCachedBook: async function(bookName) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          return await BookBlueApp.models.cacheManager.getCachedBook(matchingBook.id);
        }

        return null;
      },

      // 缓存封面
      cacheCover: async function(bookName, coverUrl) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 使用新的数据模型缓存封面
          const success = await BookBlueApp.models.cacheManager.cacheCover(matchingBook.id, coverUrl);

          // 更新书籍信息
          if (success) {
            matchingBook.coverUrl = coverUrl;
            BookBlueApp.models.bookLibrary.saveToLocal();
          }

          return success;
        } else {
          // 如果找不到匹配的书籍，创建一个新的
          const bookId = BookBlueApp.models.bookLibrary.addBook({
            filename: bookName,
            title: bookName.replace('.epub', ''),
            coverUrl: coverUrl
          });

          return await BookBlueApp.models.cacheManager.cacheCover(bookId, coverUrl);
        }
      },

      // 获取缓存的封面
      getCachedCover: async function(bookName) {
        // 查找对应的书籍ID
        const books = Object.values(BookBlueApp.models.bookLibrary.books);
        const matchingBook = books.find(book => book.filename === bookName);

        if (matchingBook) {
          // 首先检查书籍对象中是否有封面URL
          if (matchingBook.coverUrl) {
            return matchingBook.coverUrl;
          }

          // 否则尝试从缓存中获取
          return await BookBlueApp.models.cacheManager.getCachedCover(matchingBook.id);
        }

        return null;
      },

      // 清理缓存
      cleanCache: async function() {
        return await BookBlueApp.models.cacheManager.cleanupExpiredCache();
      }
    };
  }
};

// 在页面加载完成后初始化应用程序
document.addEventListener('DOMContentLoaded', async function() {
  // 等待库加载完成
  if (window.librariesReady) {
    await BookBlueApp.init();
  } else {
    // 如果库尚未加载完成，等待库加载完成后再初始化
    const checkInterval = setInterval(async function() {
      if (window.librariesReady) {
        clearInterval(checkInterval);
        await BookBlueApp.init();
      }
    }, 500);
  }
});
