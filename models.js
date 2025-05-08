// models.js - 极简数据存储模型

// 全局数据存储对象
const dataStore = {
  // 数据结构
  data: {
    books: {},           // 书籍元数据: { id: { title, path, progress } }
    notes: {},           // 笔记: { id: 内容 }
    readingStats: {      // 阅读统计
      minutes: {},       // 格式: { "YYYY-MM-DD": { total: 分钟数, books: { "bookId": 分钟数 } } }
      finished: []       // 已读完书籍ID列表
    },
    currentBookId: null  // 当前阅读的书籍ID
  },

  // 初始化
  async init() {
    console.log('初始化数据存储...');

    // 检查是否已连接 Dropbox
    const accessToken = localStorage.getItem('dropboxAccessToken');
    if (!accessToken) {
      console.log('未连接 Dropbox，无法初始化数据存储');
      return false;
    }

    try {
      // 从 Dropbox 加载数据
      await this.loadFromDropbox();

      // 更新UI上的阅读统计数据
      this.updateReadingUI();

      return true;
    } catch (error) {
      console.error('初始化数据存储失败:', error);
      return false;
    }
  },

  // 更新UI上的阅读统计数据
  updateReadingUI() {
    try {
      // 更新阅读天数
      const readingDaysElement = document.getElementById('reading-days');
      if (readingDaysElement) {
        const days = Object.keys(this.data.readingStats.minutes).length;
        readingDaysElement.textContent = `${days}天`;
      }

      // 更新阅读小时数
      const readingHoursElement = document.getElementById('reading-hours');
      if (readingHoursElement) {
        let totalMinutes = 0;
        Object.values(this.data.readingStats.minutes).forEach(day => {
          totalMinutes += day.total || 0;
        });
        const hours = Math.floor(totalMinutes / 60);
        readingHoursElement.textContent = `${hours}小时`;
      }

      // 更新已读完书籍数
      const booksFinishedElement = document.getElementById('books-finished');
      if (booksFinishedElement) {
        const finished = this.data.readingStats.finished.length;
        booksFinishedElement.textContent = `${finished}本`;
      }

      // 更新热力图
      this.generateMonthHeatmap();

      // 更新常读书籍列表
      this.updateFrequentBooks();
    } catch (error) {
      console.error('更新阅读统计UI失败:', error);
    }
  },

  // 生成月度热力图
  generateMonthHeatmap() {
    const heatmapGrid = document.getElementById('heatmap-grid');
    if (!heatmapGrid) return;

    // 清空现有内容
    heatmapGrid.innerHTML = '';

    // 获取当前日期
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 创建一个日期对象，设置为当月1日
    const firstDay = new Date(currentYear, currentMonth, 1);

    // 获取当月第一天是星期几（0-6，0表示星期日）
    const firstDayOfWeek = firstDay.getDay();

    // 获取当月天数
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // 创建前导空白格
    for (let i = 0; i < (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1); i++) {
      const emptyDay = document.createElement('div');
      emptyDay.className = 'heatmap-day empty';
      heatmapGrid.appendChild(emptyDay);
    }

    // 创建当月日期格
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement('div');
      dayElement.className = 'heatmap-day';

      // 格式化日期为YYYY-MM-DD
      const date = new Date(currentYear, currentMonth, day);
      const dateString = date.toISOString().split('T')[0];

      // 获取当天的阅读分钟数
      const dayData = this.data.readingStats.minutes[dateString];
      const minutes = dayData ? dayData.total || 0 : 0;

      // 根据阅读时间设置热力等级
      let level = 0;
      if (minutes > 0) {
        if (minutes < 30) level = 1;
        else if (minutes < 60) level = 2;
        else if (minutes < 120) level = 3;
        else level = 4;
      }

      dayElement.setAttribute('data-level', level);
      dayElement.setAttribute('title', `${dateString}: ${minutes}分钟`);

      // 如果是今天，添加特殊样式
      if (day === now.getDate()) {
        dayElement.style.border = '1px solid rgba(255, 255, 255, 0.5)';
      }

      heatmapGrid.appendChild(dayElement);
    }
  },

  // 更新常读书籍列表
  updateFrequentBooks() {
    const frequentBooksList = document.getElementById('frequent-books-list');
    if (!frequentBooksList) return;

    // 清空现有内容
    frequentBooksList.innerHTML = '';

    // 计算每本书的总阅读时间
    const bookTimes = {};
    Object.values(this.data.readingStats.minutes).forEach(day => {
      if (day.books) {
        Object.entries(day.books).forEach(([bookId, minutes]) => {
          if (!bookTimes[bookId]) bookTimes[bookId] = 0;
          bookTimes[bookId] += minutes;
        });
      }
    });

    // 转换为数组并排序
    const sortedBooks = Object.entries(bookTimes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // 只显示前5本

    // 添加到列表
    sortedBooks.forEach(([bookId, minutes]) => {
      const bookItem = document.createElement('div');
      bookItem.className = 'frequent-book-item';

      const bookName = document.createElement('div');
      bookName.className = 'frequent-book-name';
      bookName.textContent = bookId.replace('.epub', '');

      const bookTime = document.createElement('div');
      bookTime.className = 'frequent-book-time';

      // 格式化时间
      let timeText = '';
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        timeText = `${hours}小时${remainingMinutes > 0 ? remainingMinutes + '分钟' : ''}`;
      } else {
        timeText = `${minutes}分钟`;
      }

      bookTime.textContent = timeText;

      bookItem.appendChild(bookName);
      bookItem.appendChild(bookTime);
      frequentBooksList.appendChild(bookItem);
    });

    // 如果没有阅读记录，显示提示
    if (sortedBooks.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = '暂无阅读记录';
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.color = 'rgba(255, 255, 255, 0.5)';
      emptyMessage.style.padding = '10px 0';
      frequentBooksList.appendChild(emptyMessage);
    }
  },

  // 从 Dropbox 加载数据
  async loadFromDropbox() {
    try {
      const accessToken = localStorage.getItem('dropboxAccessToken');

      // 处理特殊字符
      const dropboxArg = JSON.stringify({
        path: '/BookBlue_Data.json'
      }).replace(/[\u007f-\uffff]/g, function(c) {
        return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
      });

      // 加载数据文件
      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': dropboxArg
        }
      });

      // 如果文件不存在，使用默认数据
      if (response.status === 409) {
        console.log('Dropbox 中没有数据文件，使用默认数据');
        return;
      }

      if (!response.ok) {
        console.error('从 Dropbox 加载数据失败:', response.status);
        return;
      }

      // 解析数据
      const loadedData = await response.json();

      // 更新数据
      if (loadedData.books) this.data.books = loadedData.books;
      if (loadedData.notes) this.data.notes = loadedData.notes;
      if (loadedData.readingStats) this.data.readingStats = loadedData.readingStats;
      if (loadedData.currentBookId) this.data.currentBookId = loadedData.currentBookId;

      console.log('从 Dropbox 加载数据成功');

      // 更新UI
      this.updateReadingUI();
    } catch (error) {
      console.error('从 Dropbox 加载数据失败:', error);
    }
  },

  // 保存数据到 Dropbox
  async saveToDropbox() {
    try {
      const accessToken = localStorage.getItem('dropboxAccessToken');
      if (!accessToken) return false;

      // 处理特殊字符
      const dropboxArg = JSON.stringify({
        path: '/BookBlue_Data.json',
        mode: 'overwrite'
      }).replace(/[\u007f-\uffff]/g, function(c) {
        return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
      });

      // 准备数据
      const dataToSave = JSON.stringify({
        ...this.data,
        lastUpdated: new Date().toISOString()
      });

      // 上传到 Dropbox
      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': dropboxArg
        },
        body: dataToSave
      });

      if (!response.ok) {
        console.error('保存数据到 Dropbox 失败:', response.status);
        return false;
      }

      // 成功保存，但不打印消息，避免与防抖保存消息重复
      return true;
    } catch (error) {
      console.error('保存数据到 Dropbox 失败:', error);
      return false;
    }
  },

  // 防抖保存 - 避免频繁写入
  debouncedSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      console.log('用户停留超过2秒，开始保存数据...');
      this.saveToDropbox().then(success => {
        if (success) {
          console.log('数据已防抖保存到 Dropbox');
        } else {
          console.error('防抖保存数据到 Dropbox 失败');
        }
      });
    }, 2000); // 2秒后保存
  },

  // 添加或更新书籍
  addBook(id, title, path) {
    this.data.books[id] = {
      title: title,
      path: path,
      progress: 0,
      lastRead: Date.now()
    };
    this.debouncedSave();
  },

  // 设置当前书籍
  setCurrentBook(id) {
    this.data.currentBookId = id;
    if (this.data.books[id]) {
      this.data.books[id].lastRead = Date.now();
    }
    this.debouncedSave();
  },

  // 获取当前书籍
  getCurrentBook() {
    const id = this.data.currentBookId;
    if (!id || !this.data.books[id]) return null;

    return {
      id: id,
      ...this.data.books[id]
    };
  },

  // 更新书籍进度
  updateProgress(id, progress, saveImmediately = false) {
    if (!this.data.books[id]) {
      console.log(`书籍不存在: ${id}`);
      // 创建书籍记录
      this.data.books[id] = {
        title: id.replace('.epub', ''),
        path: `/${id}`,
        progress: 0,
        lastRead: Date.now()
      };
    }

    console.log(`更新书籍进度: ${id}, 位置: ${progress}, 立即保存: ${saveImmediately}`);
    this.data.books[id].progress = progress;
    this.data.books[id].lastRead = Date.now();

    // 如果需要立即保存（如关闭书籍时），则立即保存
    if (saveImmediately) {
      this.saveToDropbox().then(success => {
        if (success) {
          console.log('进度已立即保存到 Dropbox');
        } else {
          console.error('立即保存进度到 Dropbox 失败');
        }
      });
    } else {
      // 否则使用防抖函数延迟保存，避免频繁保存
      this.debouncedSave();
    }
  },

  // 记录阅读活动
  recordReading(id, minutes) {
    if (!this.data.books[id]) return;

    // 获取今天的日期
    const today = new Date().toISOString().split('T')[0];

    // 确保该日期的数据存在
    if (!this.data.readingStats.minutes[today]) {
      this.data.readingStats.minutes[today] = { total: 0, books: {} };
    }

    // 确保该书的数据存在
    if (!this.data.readingStats.minutes[today].books[id]) {
      this.data.readingStats.minutes[today].books[id] = 0;
    }

    // 更新阅读时间
    this.data.readingStats.minutes[today].books[id] += minutes;
    this.data.readingStats.minutes[today].total += minutes;

    // 保存数据
    this.debouncedSave();

    // 更新UI
    this.updateReadingUI();
  },

  // 标记书籍为已读完
  markAsFinished(id) {
    if (!this.data.books[id]) return;

    if (!this.data.readingStats.finished.includes(id)) {
      this.data.readingStats.finished.push(id);
      this.debouncedSave();

      // 更新UI
      this.updateReadingUI();
    }
  },

  // 保存笔记
  saveNote(id, content) {
    this.data.notes[id] = content;
    this.debouncedSave();
  },

  // 获取笔记
  getNote(id) {
    return this.data.notes[id] || "";
  },

  // 从 Dropbox 加载书籍文件
  async loadBookFile(path) {
    try {
      // 确保路径是正确的格式
      const safePath = path.startsWith('/') ? path : `/${path}`;
      const fileName = safePath.split('/').pop();

      // 首先尝试从 IndexedDB 缓存中加载
      const cachedBook = await this.loadBookFromCache(fileName);
      if (cachedBook) {
        console.log(`从本地缓存加载书籍: ${fileName}`);

        // 预加载封面
        this.extractCoverFromEpub(cachedBook).catch(err => {
          console.warn('预加载封面失败:', err);
        });

        return cachedBook;
      }

      // 如果缓存中没有，从 Dropbox 加载
      const accessToken = localStorage.getItem('dropboxAccessToken');
      if (!accessToken) return null;

      console.log(`从 Dropbox 加载书籍: ${safePath}`);

      // 使用 encodeURIComponent 处理特殊字符
      const dropboxArg = JSON.stringify({
        path: safePath
      }).replace(/[\u007f-\uffff]/g, function(c) {
        return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
      });

      // 下载文件
      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': dropboxArg
        }
      });

      if (!response.ok) {
        console.error('从 Dropbox 下载书籍失败:', response.status);
        return null;
      }

      // 获取文件内容并创建 File 对象
      const arrayBuffer = await response.arrayBuffer();
      const file = new File(
        [new Blob([arrayBuffer], {type: 'application/epub+zip'})],
        fileName,
        {type: 'application/epub+zip'}
      );

      // 保存到缓存
      await this.saveBookToCache(fileName, arrayBuffer);

      // 预加载封面
      this.extractCoverFromEpub(file).catch(err => {
        console.warn('预加载封面失败:', err);
      });

      return file;
    } catch (error) {
      console.error('加载书籍文件失败:', error);
      return null;
    }
  },

  // 从缓存加载书籍
  async loadBookFromCache(fileName) {
    try {
      // 检查是否支持 IndexedDB
      if (!window.indexedDB) {
        console.log('浏览器不支持 IndexedDB，无法使用缓存');
        return null;
      }

      return new Promise((resolve) => {
        // 使用版本 2，与其他地方保持一致
        const request = indexedDB.open('BookBlueCache', 2);

        request.onupgradeneeded = function(event) {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('books')) {
            console.log('创建 books 对象存储');
            db.createObjectStore('books');
          }
          if (!db.objectStoreNames.contains('covers')) {
            console.log('创建 covers 对象存储');
            db.createObjectStore('covers');
          }
        };

        request.onerror = function(event) {
          console.error('打开 IndexedDB 失败:', event.target.error);
          resolve(null);
        };

        request.onsuccess = function(event) {
          const db = event.target.result;
          const transaction = db.transaction(['books'], 'readonly');
          const store = transaction.objectStore('books');
          const getRequest = store.get(fileName);

          getRequest.onerror = function(event) {
            console.error('从缓存获取书籍失败:', event.target.error);
            resolve(null);
          };

          getRequest.onsuccess = function(event) {
            const bookData = event.target.result;
            if (!bookData) {
              console.log(`缓存中没有找到书籍: ${fileName}`);
              resolve(null);
              return;
            }

            // 创建 File 对象
            const file = new File(
              [new Blob([bookData], {type: 'application/epub+zip'})],
              fileName,
              {type: 'application/epub+zip'}
            );

            resolve(file);
          };
        };
      });
    } catch (error) {
      console.error('从缓存加载书籍失败:', error);
      return null;
    }
  },

  // 保存书籍到缓存
  async saveBookToCache(fileName, arrayBuffer) {
    try {
      // 检查是否支持 IndexedDB
      if (!window.indexedDB) {
        console.log('浏览器不支持 IndexedDB，无法使用缓存');
        return false;
      }

      return new Promise((resolve) => {
        // 使用版本 2，与其他地方保持一致
        const request = indexedDB.open('BookBlueCache', 2);

        request.onupgradeneeded = function(event) {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('books')) {
            console.log('创建 books 对象存储');
            db.createObjectStore('books');
          }
          if (!db.objectStoreNames.contains('covers')) {
            console.log('创建 covers 对象存储');
            db.createObjectStore('covers');
          }
        };

        request.onerror = function(event) {
          console.error('打开 IndexedDB 失败:', event.target.error);
          resolve(false);
        };

        request.onsuccess = function(event) {
          const db = event.target.result;
          const transaction = db.transaction(['books'], 'readwrite');
          const store = transaction.objectStore('books');
          const putRequest = store.put(arrayBuffer, fileName);

          putRequest.onerror = function(event) {
            console.error('保存书籍到缓存失败:', event.target.error);
            resolve(false);
          };

          putRequest.onsuccess = function() {
            console.log(`书籍已保存到缓存: ${fileName}`);
            resolve(true);
          };
        };
      });
    } catch (error) {
      console.error('保存书籍到缓存失败:', error);
      return false;
    }
  },

  // 从EPUB文件提取封面
  async extractCoverFromEpub(file) {
    try {
      // 检查是否已经有缓存的封面
      const bookId = file.name;
      const cachedCover = await this.getCoverFromCache(bookId);
      if (cachedCover) {
        return cachedCover;
      }

      // 没有缓存，需要提取封面
      console.log('没有缓存的封面，开始提取:', bookId);

      // 创建临时的Book对象
      const book = ePub();

      // 读取文件为ArrayBuffer
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // 打开EPUB文件
      await book.open(arrayBuffer);

      // 尝试获取封面
      const coverPath = await book.loaded.cover;
      if (!coverPath) {
        console.log('EPUB文件没有封面:', file.name);
        return null;
      }

      // 获取封面URL
      const coverUrl = await book.archive.createUrl(coverPath, { base64: true });
      if (!coverUrl) {
        console.log('无法创建封面URL');
        return null;
      }

      // 缓存封面URL
      await this.saveCoverToCache(bookId, coverUrl);
      return coverUrl;
    } catch (error) {
      console.error('提取封面过程中出错:', error);
      return null;
    }
  },

  // 从缓存获取封面
  async getCoverFromCache(bookId) {
    try {
      // 检查是否支持 IndexedDB
      if (!window.indexedDB) {
        return null;
      }

      return new Promise((resolve) => {
        // 使用版本 2，与其他地方保持一致
        const request = indexedDB.open('BookBlueCache', 2);

        request.onupgradeneeded = function(event) {
          const db = event.target.result;
          // 检查并创建所有需要的对象存储
          if (!db.objectStoreNames.contains('books')) {
            console.log('创建 books 对象存储');
            db.createObjectStore('books');
          }
          if (!db.objectStoreNames.contains('covers')) {
            console.log('创建 covers 对象存储');
            db.createObjectStore('covers');
          }
        };

        request.onerror = function() {
          resolve(null);
        };

        request.onsuccess = function(event) {
          const db = event.target.result;
          const transaction = db.transaction(['covers'], 'readonly');
          const store = transaction.objectStore('covers');
          const getRequest = store.get(bookId);

          getRequest.onerror = function() {
            resolve(null);
          };

          getRequest.onsuccess = function(event) {
            const coverUrl = event.target.result;
            if (coverUrl) {
              console.log(`使用缓存的封面: ${bookId}`);
            }
            resolve(coverUrl);
          };
        };
      });
    } catch (error) {
      return null;
    }
  },

  // 保存封面到缓存
  async saveCoverToCache(bookId, coverUrl) {
    try {
      // 检查是否支持 IndexedDB
      if (!window.indexedDB) {
        return false;
      }

      return new Promise((resolve) => {
        const request = indexedDB.open('BookBlueCache', 2);

        request.onupgradeneeded = function(event) {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('books')) {
            console.log('创建 books 对象存储');
            db.createObjectStore('books');
          }
          if (!db.objectStoreNames.contains('covers')) {
            console.log('创建 covers 对象存储');
            db.createObjectStore('covers');
          }
        };

        request.onerror = function() {
          resolve(false);
        };

        request.onsuccess = function(event) {
          const db = event.target.result;
          const transaction = db.transaction(['covers'], 'readwrite');
          const store = transaction.objectStore('covers');
          const putRequest = store.put(coverUrl, bookId);

          putRequest.onerror = function() {
            resolve(false);
          };

          putRequest.onsuccess = function() {
            console.log(`封面已保存到缓存: ${bookId}`);
            resolve(true);
          };
        };
      });
    } catch (error) {
      return false;
    }
  }
};
