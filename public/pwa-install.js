(() => {
  let deferredPrompt = null;

  function createInstallButton() {
    if (document.getElementById('pwaInstallButton')) return;

    const button = document.createElement('button');
    button.id = 'pwaInstallButton';
    button.type = 'button';
    button.textContent = '📱 安装楷模实验室App';
    button.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 24px;
      z-index: 9999;
      padding: 12px 18px;
      border: 0;
      border-radius: 999px;
      background: #2563eb;
      color: white;
      font-size: 15px;
      box-shadow: 0 8px 20px rgba(37,99,235,.25);
      display: none;
    `;

    button.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.style.display = 'none';
    });

    document.body.appendChild(button);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const button = document.getElementById('pwaInstallButton');
    if (button) button.style.display = 'block';
  });

  window.addEventListener('appinstalled', () => {
    const button = document.getElementById('pwaInstallButton');
    if (button) button.style.display = 'none';
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createInstallButton);
  } else {
    createInstallButton();
  }
})();
