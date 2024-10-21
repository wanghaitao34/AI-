let currentPopup = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "interpret") {
    chrome.storage.sync.get(['apiProvider', 'apiEndpoint', 'apiKey', 'model', 'interpreter'], (settings) => {
      if (currentPopup) {
        document.body.removeChild(currentPopup);
      }
      interpretText(request.text, settings, request.interpreterType);
    });
  } else if (request.action === "openDialog") {
    if (currentPopup) {
      document.body.removeChild(currentPopup);
    }
    const popup = createPopup("AI解读助手");
    document.body.appendChild(popup);
    currentPopup = popup;
  }
});

async function interpretText(text, settings, interpreterType) {
  let interpreterTitle;
  let prompt;

  switch (interpreterType) {
    case "simpleExplanation":
      interpreterTitle = "简单解释";
      prompt = "请简单解释以下文本的主要内容：";
      break;
    case "detailedAnalysis":
      interpreterTitle = "详细分析";
      prompt = "请对以下文本进行详细分析，包括主要观点、论据和潜在影响：";
      break;
    case "keySummary":
      interpreterTitle = "关键点总结";
      prompt = "请总结以下文本的关键点，并列出3-5个要点：";
      break;
    default:
      interpreterTitle = settings.interpreter;
      prompt = settings.prompt;
  }

  const popup = createPopup(interpreterTitle);
  document.body.appendChild(popup);
  currentPopup = popup;
  await sendMessageToAI(text, popup, {...settings, prompt: prompt});
}

async function sendMessageToAI(text, popup, settings) {
  const content = popup.querySelector('.content');
  
  const apiUrl = settings.apiProvider === 'azure' 
    ? `${settings.apiEndpoint}/openai/deployments/${settings.model}/chat/completions?api-version=2023-05-15`
    : 'https://api.openai.com/v1/chat/completions';

  const headers = settings.apiProvider === 'azure'
    ? { 'Content-Type': 'application/json', 'api-key': settings.apiKey }
    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` };

  const prompt = settings.prompt || "请回答以下问题：";

  const body = JSON.stringify({
    messages: [{ role: 'user', content: `${prompt}\n\n${text}` }],
    model: settings.model,
    stream: true
  });

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let aiMessage = createMessageBubble('', 'ai');
    content.appendChild(aiMessage);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0].delta.content;
            if (content) {
              aiMessage.innerHTML = renderMarkdown(aiMessage.innerHTML + content);
              aiMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
          } catch (error) {
            console.error("Error parsing JSON:", error);
          }
        }
      }
    }
  } catch (error) {
    console.error('解读失败:', error);
    alert('解读失败,请检查您的API设置和网络连接');
  }
}

function createPopup(title) {
  const popup = document.createElement('div');
  popup.className = 'ai-interpreter-popup';
  popup.innerHTML = `
    <div class="header">
      <span class="title">${title}</span>
      <button class="close">×</button>
    </div>
    <div class="content"></div>
    <div class="input-area">
      <textarea placeholder="输入您的问题..."></textarea>
      <button class="send">发送</button>
    </div>
  `;
  
  const popupStyle = `
    position: fixed;
    top: 100px;
    left: 100px;
    width: 300px;
    height: auto;
    min-height: 200px;
    max-height: 80vh;
    background: #f0f0f0;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    font-family: Arial, sans-serif;
    overflow: hidden;
    z-index: 10000;
    transition: width 0.3s, height 0.3s;
  `;
  popup.style.cssText = popupStyle;

  const header = popup.querySelector('.header');
  header.style.cssText = `
    padding: 10px;
    background: #6c5ce7;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  `;

  const content = popup.querySelector('.content');
  content.style.cssText = `
    flex-grow: 1;
    padding: 10px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    resize: vertical;
    min-height: 100px;
    max-height: calc(100vh - 150px);
  `;

  const inputArea = popup.querySelector('.input-area');
  inputArea.style.cssText = `
    display: flex;
    padding: 10px;
    background: white;
  `;

  const textarea = inputArea.querySelector('textarea');
  textarea.style.cssText = `
    flex-grow: 1;
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 5px;
    margin-right: 10px;
    min-height: 36px;
    max-height: 150px;
    resize: vertical;
  `;

  const sendButton = inputArea.querySelector('.send');
  sendButton.style.cssText = `
    padding: 5px 15px;
    background: #6c5ce7;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    align-self: flex-end;
  `;

  // 拖动功能
  let isDragging = false;
  let startX, startY;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - popup.offsetLeft;
    startY = e.clientY - popup.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      popup.style.left = `${e.clientX - startX}px`;
      popup.style.top = `${e.clientY - startY}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // 关闭按钮功能
  popup.querySelector('.close').addEventListener('click', () => {
    document.body.removeChild(popup);
    currentPopup = null;
  });

  // 发送按钮功能
  function sendMessage() {
    const question = textarea.value.trim();
    if (question) {
      const userMessage = createMessageBubble(question, 'user');
      content.appendChild(userMessage);
      chrome.storage.sync.get(['apiProvider', 'apiEndpoint', 'apiKey', 'model', 'interpreter'], (settings) => {
        sendMessageToAI(question, popup, settings);
      });
      textarea.value = '';
      textarea.style.height = 'auto'; // 重置高度
    }
  }

  sendButton.addEventListener('click', sendMessage);

  // 添加键盘事件监听
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 自动调整高度
  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });

  return popup;
}

function createMessageBubble(text, type) {
  const bubble = document.createElement('div');
  bubble.className = `message ${type}`;
  bubble.innerHTML = type === 'user' ? `<p>${text}</p>` : renderMarkdown(text);
  bubble.style.cssText = `
    max-width: 85%;
    padding: 12px 16px;
    margin-bottom: 12px;
    border-radius: 18px;
    ${type === 'user' ? 
      'background: #6c5ce7; color: white; align-self: flex-end;' : 
      'background: #f8f9fa; color: #333; align-self: flex-start; box-shadow: 0 1px 2px rgba(0,0,0,0.1);'}
    overflow-wrap: break-word;
  `;
  return bubble;
}

function renderMarkdown(text) {
  // 代码块
  text = text.replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // 内联代码
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 标题
  text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  
  // 粗体和斜体
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // 列表
  text = text.replace(/^\s*[-*+]\s+(.*)/gm, '<li>$1</li>');
  text = text.replace(/<\/li>\s*<li>/g, '</li><li>');
  text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // 有序列表
  text = text.replace(/^\d+\.\s+(.*)/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
  
  // 链接
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // 换行
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

// 更新样式
const style = document.createElement('style');
style.textContent = `
  .ai-interpreter-popup {
    font-size: 14px;
    line-height: 1.6;
    width: 300px;
    height: 400px;
  }
  .ai-interpreter-popup .content::-webkit-scrollbar {
    width: 6px;
  }
  .ai-interpreter-popup .content::-webkit-scrollbar-thumb {
    background-color: #888;
    border-radius: 3px;
  }
  .ai-interpreter-popup .close:hover {
    color: #ff6b6b;
  }
  .ai-interpreter-popup .send:hover {
    background: #5f4dd0;
  }
  .ai-interpreter-popup .message.ai {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  .ai-interpreter-popup .message.ai h1,
  .ai-interpreter-popup .message.ai h2,
  .ai-interpreter-popup .message.ai h3 {
    margin-top: 16px;
    margin-bottom: 8px;
    font-weight: 600;
    line-height: 1.3;
  }
  .ai-interpreter-popup .message.ai h1 { font-size: 1.5em; }
  .ai-interpreter-popup .message.ai h2 { font-size: 1.3em; }
  .ai-interpreter-popup .message.ai h3 { font-size: 1.1em; }
  .ai-interpreter-popup .message.ai ul,
  .ai-interpreter-popup .message.ai ol {
    padding-left: 24px;
    margin-bottom: 16px;
  }
  .ai-interpreter-popup .message.ai li {
    margin-bottom: 8px;
  }
  .ai-interpreter-popup .message.ai p {
    margin-bottom: 12px;
  }
  .ai-interpreter-popup .message.ai code {
    background-color: #f0f0f0;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.9em;
  }
  .ai-interpreter-popup .message.ai pre {
    background-color: #f8f9fa;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin-bottom: 16px;
    border: 1px solid #e9ecef;
  }
  .ai-interpreter-popup .message.ai pre code {
    background-color: transparent;
    padding: 0;
    font-size: 0.9em;
    line-height: 1.5;
  }
  .ai-interpreter-popup .message.ai a {
    color: #0066cc;
    text-decoration: none;
  }
  .ai-interpreter-popup .message.ai a:hover {
    text-decoration: underline;
  }
  .ai-interpreter-popup .message.ai strong {
    font-weight: 600;
  }
  .ai-interpreter-popup .message.ai em {
    font-style: italic;
  }
`;
document.head.appendChild(style);
