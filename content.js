// content.js

class FindyListManager {
  constructor() {
    this.favoriteList = [];
    this.trashList = [];
    this.processedElements = new WeakSet();
    this.init();
  }

  async init() {
    console.log("Findy Code List Manager: 初期化中...");

    // Chrome Storageから保存データを読み込み
    await this.loadData();

    // 初回処理を少し遅延させて、ページの読み込みを待つ
    setTimeout(() => {
      this.processListItems();
    }, 1000);

    // DOM変更を監視（動的に追加される要素に対応）
    this.observeDOM();
  }

  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["findyFavoriteList", "findyTrashList"],
        (result) => {
          this.favoriteList = result.findyFavoriteList || [];
          this.trashList = result.findyTrashList || [];
          console.log("Findy Code List Manager: データ読み込み完了", {
            favorites: this.favoriteList.length,
            trash: this.trashList.length,
          });
          resolve();
        }
      );
    });
  }

  async saveData() {
    chrome.storage.local.set({
      findyFavoriteList: this.favoriteList,
      findyTrashList: this.trashList,
    });
  }

  processListItems() {
    // SPビュー（スマホ）とPCビューの両方に対応
    const selectors = [
      '[class*="work-list-item_sp__"]',
      '[class*="work-list-item_pc__"]',
    ];

    let totalItems = 0;

    selectors.forEach((selector) => {
      const items = document.querySelectorAll(selector);

      if (items.length > 0) {
        console.log(
          `Findy Code List Manager: ${selector} で ${items.length}個のアイテムを発見`
        );
        totalItems += items.length;

        items.forEach((item) => {
          if (!this.processedElements.has(item)) {
            this.addButtons(item);
            this.applyStoredState(item);
            this.processedElements.add(item);
          }
        });
      }
    });

    if (totalItems === 0) {
      console.log("Findy Code List Manager: リストアイテムが見つかりません");
    }
  }

  addButtons(element) {
    // 既にボタンが追加されているかチェック
    if (element.querySelector(".findy-manager-buttons")) {
      return;
    }

    // ヘッダー要素を探す（PCビューの場合）
    const headerElement = element.querySelector(
      '[class*="work-list-item-pc_component_header__"]'
    );

    // ボタンコンテナを作成
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "findy-manager-buttons";

    const okButton = document.createElement("button");
    okButton.className = "findy-manager-btn findy-manager-ok";
    okButton.innerHTML = "⭐ OK";
    okButton.title = "お気に入りに追加";

    const ngButton = document.createElement("button");
    ngButton.className = "findy-manager-btn findy-manager-ng";
    ngButton.innerHTML = "🗑️ NG";
    ngButton.title = "非表示にする";

    // クリックイベントの設定
    okButton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.handleOK(element);
    });

    ngButton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.handleNG(element);
    });

    buttonContainer.appendChild(okButton);
    buttonContainer.appendChild(ngButton);

    // PCビューのヘッダーがある場合は、その中に配置
    if (headerElement) {
      // 「閲覧済み」ラベルを探す
      const actionLabel = headerElement.querySelector('[class*="actionLabel"]');

      if (actionLabel) {
        // 「閲覧済み」ラベルの直後に配置
        actionLabel.insertAdjacentElement("afterend", buttonContainer);
      } else {
        // 「閲覧済み」ラベルがない場合は、ヘッダーの最後に追加
        headerElement.appendChild(buttonContainer);
      }

      // ヘッダー内配置用のスタイルクラスを追加
      buttonContainer.classList.add("findy-manager-buttons-inline");
    } else {
      // SPビューまたはヘッダーがない場合は、要素の最初に配置
      const computedStyle = getComputedStyle(element);
      if (computedStyle.position === "static") {
        element.style.position = "relative";
      }
      element.insertBefore(buttonContainer, element.firstChild);
    }
  }

  getItemInfo(element) {
    // 求人情報を抽出
    // タイトルを探す（異なるクラス名に対応）
    const titleElement = element.querySelector(
      '[class*="title"] a, h3 a, h4 a'
    );
    const titleText = titleElement ? titleElement.textContent.trim() : "";
    const url = titleElement ? titleElement.href : window.location.href;

    // 企業名を探す（事業内容から抽出）
    const businessElement = element.querySelector('[class*="business"]');
    const company = businessElement ? businessElement.textContent.trim() : "";

    // 単価情報を探す
    const wageElement = element.querySelector('[class*="monthlyWage"]');
    const wage = wageElement ? wageElement.textContent.trim() : "";

    // 稼働日数を探す
    const workDaysElements = element.querySelectorAll("dd");
    let workDays = "";
    workDaysElements.forEach((dd) => {
      if (dd.textContent.includes("週")) {
        workDays = dd.textContent.trim();
      }
    });

    // 働き方を探す
    let workStyle = "";
    workDaysElements.forEach((dd) => {
      if (
        dd.textContent.includes("リモート") ||
        dd.textContent.includes("出社")
      ) {
        workStyle = dd.textContent.trim();
      }
    });

    const text =
      `${company} | ${titleText} | ${wage}円/月 | ${workDays} | ${workStyle}`.trim();

    // 一意なIDを生成
    const id = this.generateId(url + titleText);

    return {
      id,
      text,
      title: titleText,
      company,
      url,
      wage,
      workDays,
      workStyle,
    };
  }

  generateId(text) {
    // テキストから一意なIDを生成
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `findy_${Math.abs(hash)}`;
  }

  handleOK(element) {
    const itemInfo = this.getItemInfo(element);

    // URLベースで重複をチェック
    this.trashList = this.trashList.filter((item) => item.url !== itemInfo.url);

    // favoriteリストに追加（URLで重複チェック）
    const existingIndex = this.favoriteList.findIndex(
      (item) => item.url === itemInfo.url
    );

    if (existingIndex === -1) {
      this.favoriteList.push({
        ...itemInfo,
        timestamp: new Date().toISOString(),
        domain: "findy-code.io",
      });

      console.log("Findy Code List Manager: お気に入りに追加", itemInfo.title);
    }

    // 見た目を更新
    element.classList.add("findy-manager-favorite");
    element.classList.remove("findy-manager-trash");
    element.style.display = "";

    // ボタンのスタイルを更新
    const buttons = element.querySelector(".findy-manager-buttons");
    if (buttons) {
      const okBtn = buttons.querySelector(".findy-manager-ok");
      const ngBtn = buttons.querySelector(".findy-manager-ng");
      if (okBtn) okBtn.classList.add("active");
      if (ngBtn) ngBtn.classList.remove("active");
    }

    this.saveData();
  }

  handleNG(element) {
    const itemInfo = this.getItemInfo(element);

    // URLベースで重複をチェック
    this.favoriteList = this.favoriteList.filter(
      (item) => item.url !== itemInfo.url
    );

    // trashリストに追加（URLで重複チェック）
    const existingIndex = this.trashList.findIndex(
      (item) => item.url === itemInfo.url
    );

    if (existingIndex === -1) {
      this.trashList.push({
        ...itemInfo,
        timestamp: new Date().toISOString(),
        domain: "findy-code.io",
      });

      console.log("Findy Code List Manager: 非表示に追加", itemInfo.title);
    }

    // 要素を非表示（アニメーション付き）
    element.classList.add("findy-manager-trash");
    element.classList.remove("findy-manager-favorite");

    setTimeout(() => {
      element.style.display = "none";
    }, 300);

    this.saveData();
  }

  applyStoredState(element) {
    const itemInfo = this.getItemInfo(element);

    // URLベースでチェック
    const isFavorite = this.favoriteList.some(
      (item) => item.url === itemInfo.url
    );
    const isTrash = this.trashList.some((item) => item.url === itemInfo.url);

    if (isFavorite) {
      element.classList.add("findy-manager-favorite");
      const buttons = element.querySelector(".findy-manager-buttons");
      if (buttons) {
        const okBtn = buttons.querySelector(".findy-manager-ok");
        if (okBtn) okBtn.classList.add("active");
      }
    }

    if (isTrash) {
      element.classList.add("findy-manager-trash");
      element.style.display = "none";
    }
  }

  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      // 新しく追加された要素を処理
      let shouldProcess = false;

      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // Element node
              const className = node.className || "";
              if (
                typeof className === "string" &&
                (className.includes("work-list") ||
                  className.includes("work-list-item"))
              ) {
                shouldProcess = true;
              }
            }
          });
        }
      });

      if (shouldProcess) {
        setTimeout(() => {
          this.processListItems();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// 拡張機能の初期化
console.log("Findy Code List Manager: スクリプト読み込み完了");
const findyListManager = new FindyListManager();

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "removeFromFavorite") {
    findyListManager.favoriteList = findyListManager.favoriteList.filter(
      (item) => item.id !== request.itemId
    );
    findyListManager.saveData();
    location.reload();
  } else if (request.action === "removeFromTrash") {
    findyListManager.trashList = findyListManager.trashList.filter(
      (item) => item.id !== request.itemId
    );
    findyListManager.saveData();
    location.reload();
  } else if (request.action === "getStats") {
    sendResponse({
      favoriteCount: findyListManager.favoriteList.length,
      trashCount: findyListManager.trashList.length,
    });
  }
});
