    const state = { tree: null, currentPath: null, version: 0, firstPath: null, collapsed: new Set() };
    const rootLabel = document.getElementById("rootLabel");
    const treeRoot = document.getElementById("treeRoot");
    const docRoot = document.getElementById("docRoot");
    const docMeta = document.getElementById("docMeta");
    const statusText = document.getElementById("statusText");

    function currentPathFromUrl() {
      const params = new URLSearchParams(window.location.search);
      return params.get("path");
    }

    function updateUrl(path) {
      const url = new URL(window.location.href);
      if (path) {
        url.searchParams.set("path", path);
      } else {
        url.searchParams.delete("path");
      }
      history.replaceState({}, "", url);
    }

    function ancestorDirectoryPaths(path) {
      if (!path) {
        return [];
      }
      const parts = path.split("/");
      const directories = [];
      for (let index = 0; index < parts.length - 1; index += 1) {
        directories.push(parts.slice(0, index + 1).join("/"));
      }
      return directories;
    }

    function isCollapsed(path) {
      if (!path) {
        return false;
      }
      return state.collapsed.has(path) && !ancestorDirectoryPaths(state.currentPath).includes(path);
    }

    function toggleDirectory(path) {
      if (state.collapsed.has(path)) {
        state.collapsed.delete(path);
      } else {
        state.collapsed.add(path);
      }
      if (state.tree) {
        renderTree(state.tree);
      }
    }

    function renderTreeNode(node) {
      if (node.type === "directory") {
        const wrapper = document.createElement("li");
        wrapper.className = "tree-item";
        if (isCollapsed(node.path)) {
          wrapper.classList.add("collapsed");
        }
        const label = document.createElement("button");
        label.className = "folder";
        label.type = "button";
        label.onclick = () => toggleDirectory(node.path);
        const caret = document.createElement("span");
        caret.className = "folder-caret";
        caret.textContent = "▾";
        const text = document.createElement("span");
        text.textContent = node.name;
        label.append(caret, text);
        wrapper.appendChild(label);
        const list = document.createElement("ul");
        for (const child of node.children) {
          list.appendChild(renderTreeNode(child));
        }
        wrapper.appendChild(list);
        return wrapper;
      }
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "node";
      if (node.path === state.currentPath) {
        button.classList.add("active");
      }
      button.textContent = node.name;
      button.onclick = () => loadDoc(node.path);
      item.appendChild(button);
      return item;
    }

    function renderTree(tree) {
      treeRoot.innerHTML = "";
      const list = document.createElement("ul");
      list.className = "tree";
      for (const child of tree.children) {
        list.appendChild(renderTreeNode(child));
      }
      treeRoot.appendChild(list);
      scrollActiveNodeIntoView();
    }

    function scrollActiveNodeIntoView() {
      const activeNode = treeRoot.querySelector(".node.active");
      if (activeNode) {
        activeNode.scrollIntoView({ block: "nearest" });
      }
    }

    async function refreshTree(preferredPath = null) {
      const response = await fetch("/api/tree");
      const payload = await response.json();
      state.tree = payload.tree;
      state.version = payload.version;
      state.firstPath = payload.first_path;
      rootLabel.textContent = payload.root;
      const target = preferredPath ?? state.currentPath ?? payload.first_path;
      if (target) {
        await loadDoc(target, { skipTree: true });
        renderTree(payload.tree);
      } else {
        renderTree(payload.tree);
      }
    }

    async function loadDoc(path, options = {}) {
      const response = await fetch(`/api/doc?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        if (!options.fallbackPathTried && state.tree) {
          const fallbackPath = state.firstPath ?? state.currentPath;
          if (fallbackPath && fallbackPath !== path) {
            return loadDoc(fallbackPath, { ...options, fallbackPathTried: true });
          }
        }
        docMeta.textContent = path;
        docRoot.className = "empty";
        docRoot.textContent = "ファイルを読み込めませんでした。";
        return;
      }
      const payload = await response.json();
      state.currentPath = payload.path;
      updateUrl(payload.path);
      docMeta.textContent = payload.path;
      docRoot.className = "";
      docRoot.innerHTML = payload.html;
      if (!options.skipTree && state.tree) {
        renderTree(state.tree);
      }
    }

    const events = new EventSource("/events");
    events.onmessage = async (event) => {
      const payload = JSON.parse(event.data);
      statusText.textContent = `監視中 / 更新 ${new Date(payload.timestamp * 1000).toLocaleTimeString()}`;
      await refreshTree(state.currentPath);
    };
    events.onerror = () => {
      statusText.textContent = "接続を再試行中";
    };

    window.addEventListener("popstate", () => {
      const path = currentPathFromUrl();
      if (path) {
        loadDoc(path);
      }
    });

    refreshTree(currentPathFromUrl());
