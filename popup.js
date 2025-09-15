// popup.js

class FindyPopupManager {
  constructor() {
    this.favoriteList = [];
    this.trashList = [];
    this.currentTab = "favorite";
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.render();
  }

  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["findyFavoriteList", "findyTrashList"],
        (result) => {
          this.favoriteList = result.findyFavoriteList || [];
          this.trashList = result.findyTrashList || [];
          resolve();
        }
      );
    });
  }

  async saveData() {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          findyFavoriteList: this.favoriteList,
          findyTrashList: this.trashList,
        },
        () => {
          resolve();
        }
      );
    });
  }

  setupEventListeners() {
    // タブ切り替え
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // 検索
    document
      .getElementById("favorite-search")
      .addEventListener("input", (e) => {
        this.filterList("favorite", e.target.value);
      });

    document.getElementById("trash-search").addEventListener("input", (e) => {
      this.filterList("trash", e.target.value);
    });
  }

  switchTab(tab) {
    this.currentTab = tab;

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });

    document.getElementById("favorite-tab").style.display =
      tab === "favorite" ? "block" : "none";
    document.getElementById("trash-tab").style.display =
      tab === "trash" ? "block" : "none";
  }

  render() {
    this.renderFavoriteList();
    this.renderTrashList();
    this.updateCounts();
  }

  renderFavoriteList() {
    const container = document.getElementById("favorite-list");
    const searchBox = document.getElementById("favorite-search-box");

    if (this.favoriteList.length === 0) {
      container.innerHTML = '<p class="empty-message">まだ何もありません</p>';
      searchBox.style.display = "none"; // 検索ボックスを非表示
      return;
    }

    searchBox.style.display = "block"; // 検索ボックスを表示

    container.innerHTML = this.favoriteList
      .map(
        (item) => `
      <div class="list-item" data-id="${item.id}">
        <div class="item-content">
          <div class="item-title">${this.escapeHtml(
            item.title || "タイトルなし"
          )}</div>
          <div class="item-company">${this.escapeHtml(
            item.company || "企業名なし"
          )}</div>
          <div class="item-meta">
            <a href="${
              item.url
            }" target="_blank" class="item-url">🔗 求人を見る</a>
            <span class="item-date">${new Date(
              item.timestamp
            ).toLocaleDateString("ja-JP")}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="action-btn delete-btn" data-id="${
            item.id
          }" title="削除">❌</button>
        </div>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.removeItem("favorite", btn.dataset.id);
      });
    });
  }

  renderTrashList() {
    const container = document.getElementById("trash-list");
    const searchBox = document.getElementById("trash-search-box");

    if (this.trashList.length === 0) {
      container.innerHTML = '<p class="empty-message">まだ何もありません</p>';
      searchBox.style.display = "none"; // 検索ボックスを非表示
      return;
    }

    searchBox.style.display = "block"; // 検索ボックスを表示

    container.innerHTML = this.trashList
      .map(
        (item) => `
      <div class="list-item" data-id="${item.id}">
        <div class="item-content">
          <div class="item-title">${this.escapeHtml(
            item.title || "タイトルなし"
          )}</div>
          <div class="item-company">${this.escapeHtml(
            item.company || "企業名なし"
          )}</div>
          <div class="item-meta">
            <a href="${
              item.url
            }" target="_blank" class="item-url">🔗 求人を見る</a>
            <span class="item-date">${new Date(
              item.timestamp
            ).toLocaleDateString("ja-JP")}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="action-btn restore-btn" data-id="${
            item.id
          }" title="復元">♻️</button>
        </div>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".restore-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.removeItem("trash", btn.dataset.id);
      });
    });
  }

  async removeItem(type, itemId) {
    if (type === "favorite") {
      this.favoriteList = this.favoriteList.filter(
        (item) => item.id !== itemId
      );
    } else {
      this.trashList = this.trashList.filter((item) => item.id !== itemId);
    }

    await this.saveData(); // 保存を待つ
    this.render();

    // コンテンツスクリプトに通知（必要に応じて）
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs
          .sendMessage(tabs[0].id, {
            action:
              type === "favorite" ? "removeFromFavorite" : "removeFromTrash",
            itemId: itemId,
          })
          .catch(() => {
            // エラーを無視
          });
      }
    });
  }

  filterList(type, query) {
    const items = document.querySelectorAll(`#${type}-list .list-item`);

    items.forEach((item) => {
      const title =
        item.querySelector(".item-title")?.textContent.toLowerCase() || "";
      const company =
        item.querySelector(".item-company")?.textContent.toLowerCase() || "";
      const matches =
        title.includes(query.toLowerCase()) ||
        company.includes(query.toLowerCase());
      item.style.display = matches ? "flex" : "none";
    });
  }

  updateCounts() {
    document.getElementById("favorite-count").textContent =
      this.favoriteList.length;
    document.getElementById("trash-count").textContent = this.trashList.length;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// ポップアップの初期化
new FindyPopupManager();
