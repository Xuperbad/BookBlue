// models.js - 极简数据存储模型

// 验证并修正日期函数 - 确保日期年份在合理范围内
function validateDate(date, context = '') {
  // 检查日期是否合理（年份在2020-2030之间）
  if (date.getFullYear() < 2020 || date.getFullYear() > 2030) {
    console.error(`${context}检测到不合理的系统日期: ${date.toISOString()}`);
    // 使用当前时间戳创建一个新的日期对象，确保使用正确的年份
    date.setFullYear(new Date().getFullYear());
    console.log(`已修正为: ${date.toISOString()}`);
  }
  return date;
}

// 格式化时间为更友好的显示格式（使用中文）
function formatReadingTime(minutes) {
  // 如果分钟数为0，返回0秒
  if (minutes === 0) return '0秒';

  // 将分钟转换为秒
  const totalSeconds = Math.round(minutes * 60);

  // 计算小时、分钟和秒
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  // 构建显示字符串
  let result = '';
  if (hours > 0) {
    result += `${hours}时`;
  }
  if (mins > 0 || hours > 0) {
    result += `${mins}分`;
  }
  if (secs > 0) {
    result += `${secs}秒`;
  }

  return result;
}

// 获取IndexedDB数据库的通用函数
async function getDatabase(dbName = 'BookBlueCache', version = 2, storeNames = ['books', 'covers']) {
  return new Promise((resolve, reject) => {
    // 检查是否支持 IndexedDB
    if (!window.indexedDB) {
      console.log('浏览器不支持 IndexedDB');
      reject(new Error('浏览器不支持 IndexedDB'));
      return;
    }

    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = function(event) {
      const db = event.target.result;

      // 创建所有需要的对象存储
      storeNames.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          console.log(`创建 ${storeName} 对象存储`);
          db.createObjectStore(storeName);
        }
      });
    };

    request.onerror = function(event) {
      console.error('打开 IndexedDB 失败:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = function(event) {
      const db = event.target.result;
      resolve(db);
    };
  });
}

// Dropbox API 辅助函数
const dropboxHelper = {
  // 从Dropbox下载文件
  async downloadFile(path, options = {}) {
    try {
      // 确保路径以斜杠开头
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      console.log(`从Dropbox下载文件 (原始路径): ${path}`);

      // 使用更安全的方式处理路径
      // 1. 先将路径转换为JSON字符串
      // 2. 然后处理Unicode字符
      const dropboxArg = JSON.stringify({
        path: path
      }).replace(/[\u007f-\uffff]/g, function(c) {
        return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
      });

      console.log(`Dropbox API 参数: ${dropboxArg}`);

      // 发送请求
      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.dropboxAccessToken}`,
          'Dropbox-API-Arg': dropboxArg
        }
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Dropbox下载失败: ${response.status} ${response.statusText}`, errorText);
        return null;
      }

      // 根据选项返回不同格式的数据
      if (options.returnResponse) {
        // 返回完整的响应对象，让调用者决定如何处理
        return response;
      } else if (options.returnArrayBuffer) {
        return await response.arrayBuffer();
      } else if (options.returnBlob) {
        return await response.blob();
      } else if (options.returnJson) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('从Dropbox下载文件时出错:', error);
      return null;
    }
  },

  // 上传文件到Dropbox
  async uploadFile(path, content, options = {}) {
    try {
      // 确保路径以斜杠开头
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      console.log(`上传文件到Dropbox (原始路径): ${path}`);

      // 构建请求参数
      const params = {
        path: path,
        mode: options.mode || 'overwrite',
        autorename: options.autorename || false,
        mute: options.mute || false
      };

      // 使用更安全的方式处理路径和参数
      // 1. 先将参数转换为JSON字符串
      // 2. 然后处理Unicode字符
      const dropboxArg = JSON.stringify(params).replace(/[\u007f-\uffff]/g, function(c) {
        return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
      });

      console.log(`Dropbox API 参数: ${dropboxArg}`);

      // 发送请求
      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.dropboxAccessToken}`,
          'Dropbox-API-Arg': dropboxArg,
          'Content-Type': 'application/octet-stream'
        },
        body: content
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Dropbox上传失败: ${response.status} ${response.statusText}`, errorText);
        return false;
      }

      const result = await response.json();
      console.log(`文件已上传到Dropbox: ${result.path_display}`);
      return true;
    } catch (error) {
      console.error('上传文件到Dropbox时出错:', error);
      return false;
    }
  }
}

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

      // 更新阅读时长
      const readingHoursElement = document.getElementById('reading-hours');
      if (readingHoursElement) {
        let totalMinutes = 0;
        Object.values(this.data.readingStats.minutes).forEach(day => {
          totalMinutes += day.total || 0;
        });
        // 使用新的格式化函数格式化总阅读时间
        const formattedTime = formatReadingTime(totalMinutes);
        readingHoursElement.textContent = formattedTime;
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

    // 获取当前日期并验证
    const now = validateDate(new Date(), '热力图');
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

      // 格式化阅读时间
      const formattedTime = formatReadingTime(minutes);

      dayElement.setAttribute('data-level', level);
      dayElement.setAttribute('title', `${dateString}: ${formattedTime}`);

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
      // 使用书籍标题而不是ID
      const bookInfo = this.data.books[bookId];
      bookName.textContent = bookInfo ? bookInfo.title : bookId.replace('.epub', '');

      const bookTime = document.createElement('div');
      bookTime.className = 'frequent-book-time';

      // 使用新的格式化函数格式化时间
      const timeText = formatReadingTime(minutes);

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
      // 检查是否有访问令牌
      if (!window.dropboxAccessToken) {
        console.error('未找到 Dropbox 访问令牌，无法加载数据');
        return;
      }

      // 使用 dropboxHelper 下载文件
      const jsonData = await dropboxHelper.downloadFile('/BookBlue_Data.json', { returnJson: true });

      // 如果没有数据，使用默认数据
      if (!jsonData) {
        console.log('Dropbox 中没有数据文件，使用默认数据');
        return;
      }

      // 更新数据
      if (jsonData.books) this.data.books = jsonData.books;
      if (jsonData.notes) this.data.notes = jsonData.notes;
      if (jsonData.readingStats) this.data.readingStats = jsonData.readingStats;
      if (jsonData.currentBookId) this.data.currentBookId = jsonData.currentBookId;

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
      // 检查是否有访问令牌
      if (!window.dropboxAccessToken) {
        console.error('未找到 Dropbox 访问令牌，无法保存数据');
        return false;
      }

      // 准备数据，验证日期
      const now = validateDate(new Date(), '保存数据');
      const dataToSave = JSON.stringify({
        ...this.data,
        lastUpdated: now.toISOString()
      });

      // 使用 dropboxHelper 上传文件
      const success = await dropboxHelper.uploadFile('/BookBlue_Data.json', dataToSave);

      // 成功保存，但不打印消息，避免与防抖保存消息重复
      return success;
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

  // 从EPUB提取ISBN
  async extractISBNFromEpub(file) {
    try {
      const book = ePub();
      const arrayBuffer = await file.arrayBuffer();
      await book.open(arrayBuffer);
      const metadata = await book.loaded.metadata;

      // 尝试从identifier中提取ISBN
      if (metadata.identifier) {
        let identifiers = Array.isArray(metadata.identifier) ?
          metadata.identifier : [metadata.identifier];

        for (let id of identifiers) {
          if (typeof id === 'string' && id.toLowerCase().includes('isbn')) {
            // 提取数字和X
            const isbn = id.replace(/[^0-9X]/g, '');
            if (isbn && (isbn.length === 10 || isbn.length === 13)) {
              console.log(`找到ISBN: ${isbn}`);
              return isbn;
            }
          }
        }
      }

      // 如果没有找到ISBN，返回null
      console.log('未找到ISBN');
      return null;
    } catch (error) {
      console.error('提取ISBN失败:', error);
      return null;
    }
  },

  // 生成书籍ID
  async generateBookId(file) {
    // 首先尝试提取ISBN
    const isbn = await this.extractISBNFromEpub(file);
    if (isbn) {
      return `isbn:${isbn}`;
    }

    // 如果没有ISBN，回退到使用文件名
    return `file:${file.name}`;
  },

  // 添加或更新书籍
  async addBook(file, path) {
    // 生成书籍ID
    const id = await this.generateBookId(file);

    // 默认标题（如果元数据提取失败）
    let title = file.name.replace('.epub', '');

    try {
      // 从EPUB元数据中提取标题
      const book = ePub();
      const arrayBuffer = await file.arrayBuffer();
      await book.open(arrayBuffer);
      const metadata = await book.loaded.metadata;

      // 如果元数据中有标题，使用元数据中的标题
      if (metadata && metadata.title) {
        title = metadata.title;
        console.log(`从元数据中提取标题: ${title}`);
      } else {
        console.log(`未找到元数据标题，使用文件名: ${title}`);
      }
    } catch (error) {
      console.error('从元数据提取标题失败:', error);
      // 如果提取失败，继续使用文件名作为标题
    }

    console.log(`添加书籍: ID=${id}, 标题=${title}, 路径=${path}`);

    // 保存书籍信息，使用验证过的日期
    const now = validateDate(new Date(), '添加书籍');
    this.data.books[id] = {
      title: title,
      path: path,
      progress: 0,
      lastRead: now.getTime()
    };

    this.debouncedSave();
    return id;
  },

  // 获取当前书籍ID
  getCurrentBookId() {
    return this.data.currentBookId;
  },

  // 通用的查找书籍函数 - 根据ID、路径或文件名查找书籍
  findBook(id) {
    // 首先按ID查找
    let bookId = id;
    let bookInfo = this.data.books[id];

    // 如果没有找到，尝试按路径或文件名查找
    if (!bookInfo) {
      // 查找所有书籍，检查路径是否匹配
      for (const [existingId, book] of Object.entries(this.data.books)) {
        // 检查路径是否匹配
        if (book.path === id || book.path === `/${id}`) {
          bookId = existingId;
          bookInfo = book;
          console.log(`通过路径找到书籍: ${id} -> ${bookId}`);
          break;
        }

        // 检查文件名是否匹配
        const fileName = book.path.split('/').pop();
        if (fileName === id) {
          bookId = existingId;
          bookInfo = book;
          console.log(`通过文件名找到书籍: ${id} -> ${bookId}`);
          break;
        }
      }
    }

    return { bookId, bookInfo };
  },

  // 设置当前书籍
  setCurrentBook(id) {
    // 查找书籍
    const { bookId, bookInfo } = this.findBook(id);

    // 设置当前书籍ID
    this.data.currentBookId = bookId;

    // 如果找到了书籍，更新最后阅读时间
    if (bookInfo) {
      const now = validateDate(new Date(), '设置当前书籍');
      this.data.books[bookId].lastRead = now.getTime();
    } else {
      console.log(`警告：设置当前书籍为 ${bookId}，但该书籍不存在于数据中`);
    }

    this.debouncedSave();

    console.log(`设置当前书籍: ${bookId}`);
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
    // 查找书籍
    const { bookId, bookInfo } = this.findBook(id);

    // 如果没有找到，记录错误并返回
    if (!bookInfo) {
      console.log(`书籍不存在: ${id}`);
      return;
    }

    console.log(`更新书籍进度: ${bookId}, 位置: ${progress}, 立即保存: ${saveImmediately}`);
    this.data.books[bookId].progress = progress;
    const now = validateDate(new Date(), '更新进度');
    this.data.books[bookId].lastRead = now.getTime();

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

  /**
   * 记录阅读活动
   * 此函数用于记录用户的阅读时间，按日期和书籍ID进行统计
   *
   * @param {string} id - 书籍ID或路径
   * @param {number} minutes - 要记录的分钟数，通常为1（每次翻页记录1分钟）
   */
  recordReading(id, minutes) {
    // 查找书籍（支持通过ID、路径或文件名查找）
    const { bookId, bookInfo } = this.findBook(id);

    // 如果没有找到，记录错误并返回
    if (!bookInfo) {
      console.log(`书籍不存在: ${id}`);
      return;
    }

    // 获取今天的日期并验证（确保日期年份在合理范围内）
    const now = validateDate(new Date(), '记录阅读');
    const today = now.toISOString().split('T')[0]; // 格式化为YYYY-MM-DD

    // 确保该日期的数据结构存在
    if (!this.data.readingStats.minutes[today]) {
      this.data.readingStats.minutes[today] = { total: 0, books: {} };
    }

    // 确保该书的数据存在
    if (!this.data.readingStats.minutes[today].books[bookId]) {
      this.data.readingStats.minutes[today].books[bookId] = 0;
    }

    // 更新阅读时间
    this.data.readingStats.minutes[today].books[bookId] += minutes;
    this.data.readingStats.minutes[today].total += minutes;

    console.log(`记录阅读时间: ${bookId}, ${minutes}分钟, 日期: ${today}`);

    // 使用防抖函数延迟保存数据，避免频繁保存
    this.debouncedSave();

    // 更新UI显示（阅读天数、小时数、热力图等）
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

  // 加载并显示书籍（高级方法，整合了多个操作）
  async loadAndDisplayBook(file, path = null) {
    try {
      // 1. 添加书籍并获取ID
      const bookId = await this.addBook(file, path || `/${file.name}`);

      // 2. 设置当前书籍
      this.setCurrentBook(bookId);

      // 3. 加载笔记
      const notesTextarea = document.getElementById('notes');
      if (notesTextarea) {
        notesTextarea.value = this.getNote(bookId);
      }

      // 4. 调用原始的处理函数
      window.handleFileInternal(file);

      console.log(`书籍加载并显示完成: ID=${bookId}, 标题=${file.name.replace('.epub', '')}`);

      return bookId;
    } catch (error) {
      console.error('加载并显示书籍失败:', error);
      throw error;
    }
  },

  // 从 Dropbox 加载书籍文件
  async loadBookFile(id) {
    try {
      // 获取书籍信息
      const bookInfo = this.data.books[id];
      if (!bookInfo) {
        console.error(`未找到书籍信息: ${id}`);
        return null;
      }

      // 使用保存的路径，从路径中提取文件名
      const path = bookInfo.path;
      const fileName = path.split('/').pop();

      console.log(`加载书籍: ID=${id}, 文件名=${fileName}, 路径=${path}`);

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
      if (!window.dropboxAccessToken) {
        console.error('未找到 Dropbox 访问令牌');
        return null;
      }

      console.log(`从 Dropbox 加载书籍: ${path}`);

      // 使用 dropboxHelper 下载文件
      const response = await dropboxHelper.downloadFile(path, { returnResponse: true });

      if (!response) {
        console.error(`从 Dropbox 下载书籍失败: ${path}`);
        return null;
      }

      // 获取响应的 ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();

      if (!arrayBuffer) {
        console.error(`无法从响应中获取 ArrayBuffer: ${path}`);
        return null;
      }

      // 创建 File 对象
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
      // 获取数据库
      const db = await getDatabase();

      // 从数据库中获取书籍数据
      const transaction = db.transaction(['books'], 'readonly');
      const store = transaction.objectStore('books');

      return new Promise((resolve) => {
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
      });
    } catch (error) {
      console.error('从缓存加载书籍失败:', error);
      return null;
    }
  },

  // 保存书籍到缓存
  async saveBookToCache(fileName, arrayBuffer) {
    try {
      // 获取数据库
      const db = await getDatabase();

      // 保存书籍数据到数据库
      const transaction = db.transaction(['books'], 'readwrite');
      const store = transaction.objectStore('books');

      return new Promise((resolve) => {
        const putRequest = store.put(arrayBuffer, fileName);

        putRequest.onerror = function(event) {
          console.error('保存书籍到缓存失败:', event.target.error);
          resolve(false);
        };

        putRequest.onsuccess = function() {
          console.log(`书籍已保存到缓存: ${fileName}`);
          resolve(true);
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
      // 确定缓存键
      let cacheKey;
      if (typeof file === 'string') {
        // 如果是字符串，直接使用
        cacheKey = file;
      } else if (file && typeof file.name === 'string') {
        // 如果是File对象，使用文件名
        cacheKey = file.name;
      } else {
        console.error('无法确定封面缓存键:', file);
        return null;
      }

      // 检查是否已经有缓存的封面
      const cachedCover = await this.getCoverFromCache(cacheKey);
      if (cachedCover) {
        return cachedCover;
      }

      // 没有缓存，需要提取封面
      console.log('没有缓存的封面，开始提取:', cacheKey);

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
      await this.saveCoverToCache(cacheKey, coverUrl);
      return coverUrl;
    } catch (error) {
      console.error('提取封面过程中出错:', error);
      return null;
    }
  },

  // 从缓存获取封面
  async getCoverFromCache(bookId) {
    try {
      // 获取数据库
      const db = await getDatabase();

      // 从数据库中获取封面数据
      const transaction = db.transaction(['covers'], 'readonly');
      const store = transaction.objectStore('covers');

      return new Promise((resolve) => {
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
      });
    } catch (error) {
      return null;
    }
  },

  // 保存封面到缓存
  async saveCoverToCache(bookId, coverUrl) {
    try {
      // 获取数据库
      const db = await getDatabase();

      // 保存封面数据到数据库
      const transaction = db.transaction(['covers'], 'readwrite');
      const store = transaction.objectStore('covers');

      return new Promise((resolve) => {
        const putRequest = store.put(coverUrl, bookId);

        putRequest.onerror = function() {
          resolve(false);
        };

        putRequest.onsuccess = function() {
          console.log(`封面已保存到缓存: ${bookId}`);
          resolve(true);
        };
      });
    } catch (error) {
      return false;
    }
  }
};
