(() => {
  const $ = id => document.getElementById(id);
  const config = window.INVITATION_CONFIG;
  let key = new URLSearchParams(location.hash.slice(1)).get('key') || '';
  if (key) {
    try { sessionStorage.setItem('ricky-mail-key',key); } catch {}
    history.replaceState(null,'',location.pathname + location.search);
  } else {
    try { key = sessionStorage.getItem('ricky-mail-key') || ''; } catch {}
  }
  let loading = false;
  async function readMail() {
    if (loading) return;
    loading = true;
    $('mailStatus').textContent = '正在查看…';
    $('mailDetails').hidden = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(config.replyService + '/inbox', {headers:{Authorization:'Bearer ' + key},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
      if (response.status === 401) {
        $('login').hidden=false; $('reloadMail').hidden=true;
        $('mailStatus').textContent='查看码不匹配，请重新输入。'; return;
      }
      if (!response.ok) throw new Error('read failed');
      const {reply, toName = config.toName} = await response.json();
      try { sessionStorage.setItem('ricky-mail-key',key); } catch {}
      $('login').hidden=true; $('reloadMail').hidden=false;
      $('mailStatus').textContent = reply ? toName + ' 的最新回复' : '还没有收到 ' + toName + ' 的回复。';
      if (!reply) return;
      const details = [
        ['回应',{yes:'好呀，我赴约',later:'我们换个时间',no:'这次先不了'}[reply.answer]],
        ['口味',reply.answer==='no' ? '' : reply.food || '见面再决定'],
        ['晚餐时间',[reply.date,reply.time].filter(Boolean).join(' · ')],
        ['建议日期',reply.alternate],
        ['提交时间',new Date(reply.received).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) + '（北京时间）']
      ];
      $('mailDetails').replaceChildren();
      for (const [name,value] of details) if (value) {
        const term=document.createElement('dt'), desc=document.createElement('dd');
        term.textContent=name;desc.textContent=value;$('mailDetails').append(term,desc);
      }
      $('mailDetails').hidden=false;
    } catch {
      $('mailStatus').textContent='暂时无法连接收件页，请稍后重试。';
    } finally { clearTimeout(timer); loading=false; }
  }
  $('login').addEventListener('submit',event=>{event.preventDefault();key=$('mailKey').value.trim();readMail();});
  $('reloadMail').addEventListener('click',readMail);
  if (key) readMail();
})();
