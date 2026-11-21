// Load private data only after the server verifies the link. Ordinary previews use public copy.
async function openInvitation(settings) {
  const search = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const key = search.get('invite') ?? fragment.get('invite');
  const status = document.getElementById('inviteStatus');
  const preview = message => {
    status.textContent = message;
    return {config: settings, key: ''};
  };
  if (key === null) {
    if (location.protocol === 'file:' && settings.toName && settings.toName !== '你') return preview('本机预览 · 提交回复请打开专属邀请链接。');
    return preview('公开试听 · 专属邀请请从收到的完整链接打开。');
  }
  if (!/^[-_A-Za-z0-9]{32}$/.test(key)) return preview('邀请链接不完整。可以先试听，或请邀请人重发。');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(settings.replyService + '/invitation', {
      headers:{Authorization:'Bearer ' + key}, signal:controller.signal,
      credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'
    });
    if (response.status === 401) return preview('没有找到这张邀请。可以先试听，或请邀请人重发。');
    if (response.status === 410) return preview('这张邀请已到期。可以先试听，或联系邀请人重新约时间。');
    if (!response.ok) throw new Error('unavailable');
    const {invitation} = await response.json();
    if (!invitation || !invitation.toName) throw new Error('incomplete invitation');
    status.hidden = true;
    if (location.protocol === 'https:' || location.protocol === 'http:') {
      recordVisibleVisit(settings.replyService, key);
    }
    return {config:{...settings, ...invitation, replyService:settings.replyService}, key};
  } catch {
    const retry = document.getElementById('inviteRetry');
    retry.hidden = false;
    retry.addEventListener('click', () => location.reload());
    return preview('专属邀请暂时未能载入。可以重试，或先试听公开版本。');
  } finally { clearTimeout(timer); }
}

function recordVisibleVisit(service, key) {
  function whenVisible() {
    if (document.visibilityState !== 'visible' || document.prerendering) return;
    document.removeEventListener('visibilitychange', whenVisible);
    document.removeEventListener('prerenderingchange', whenVisible);
    // Only a visible, authenticated invitation counts. Chapter changes reuse this document.
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
    fetch(service + '/visit', {
      method:'POST', headers:{Authorization:'Bearer ' + key, 'Content-Type':'application/json'},
      body:JSON.stringify({id}), credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
      keepalive:true
    }).catch(() => {});
  }
  document.addEventListener('visibilitychange', whenVisible);
  document.addEventListener('prerenderingchange', whenVisible);
  whenVisible();
}
