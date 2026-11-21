(async () => {
  'use strict';
  const {config, key:guestKey} = await openInvitation(window.INVITATION_CONFIG);
  const $ = id => document.getElementById(id);
  const put = (id, value) => { $(id).textContent = value; };
  const read = key => String(config[key] ?? '').trim();
  const fromName = read('fromName') || '我';
  const toName = read('toName') || '你';
  const undecided = '等待我们一起决定';
  const restaurant = read('restaurant') || undecided;
  const time = read('time') || undecided;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const chapters = ['封面', '来信', '门票', '菜单', '回应', '纪念票根'];
  const endingIndex = scenes.indexOf($('ending'));
  let current = 0;
  let furthest = 0;
  let answer = '';
  let preferredDate = '';
  const canSubmit = !!guestKey;
  let requestKey = '', requestId = '', delivered = '', sending = false;
  function replyData() {
    return {
      answer,
      food: answer === 'no' ? '' : dinnerFood(),
      date: answer === 'yes' ? dinnerDate() : '',
      time: answer === 'yes' ? dinnerTime() : '',
      alternate: answer === 'later' ? $('alternateDate').value : ''
    };
  }
  function refreshSubmit() {
    const same = delivered === JSON.stringify(replyData());
    $('submitReply').hidden = !canSubmit;
    $('submitReply').disabled = same || sending;
    put('submitReply', sending ? '正在提交…' : same ? '已提交给 ' + fromName : '提交给 ' + fromName);
    put('sendStatus', same ? '已保存到 ' + fromName + ' 的收件页。' : '');
  }
  $('alternateDate').addEventListener('input', refreshSubmit);
  $('submitReply').addEventListener('click', async () => {
    if (!canSubmit || sending || current !== endingIndex) return;
    const data = replyData(), signature = JSON.stringify(data);
    if (signature === delivered) return;
    if (requestKey !== signature) {
      requestId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const n = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
        return (c === 'x' ? n : (n & 3) | 8).toString(16);
      });
      requestKey = signature;
    }
    sending = true;
    refreshSubmit();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let saved = false, failure = 0;
    try {
      const response = await fetch(read('replyService') + '/reply', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer ' + guestKey},
        body:JSON.stringify({...data, id:requestId}), signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer'
      });
      failure = response.status;
      saved = response.ok && (await response.json()).saved === true;
      if (saved) delivered = signature;
    } catch { /* 网络断开时保留重试和手动复制。 */ }
    finally { clearTimeout(timer); sending = false; refreshSubmit(); }
    if (!saved && current === endingIndex && signature === JSON.stringify(replyData())) {
      if (failure === 401 || failure === 410) {
        put('sendStatus', '邀请链接已失效。你可以复制回复发给 ' + fromName + '。');
      } else {
        put('submitReply', '重试提交');
        put('sendStatus','尚未确认收到。可以重试，也可以复制回复发给 ' + fromName + '。');
      }
    }
  });
  let transitionTimer, letterTimer, tapTimer, toastTimer;
  let taps = 0;
  let transitioning = false;

  document.title = 'The Unreleased Track · ' + fromName;
  put('recipientLine', toName === '你' ? '给正在读信的你，' : toName + '，');
  put('fromSignature', fromName);
  put('ticketFrom', fromName);
  put('placeText', restaurant);
  put('timeText', time);
  put('menuFrom', fromName);
  const [opening, ...bodyLines] = config.letter;
  put('lyricsTitle', opening);
  const body = $('letterBody');
  for (const text of [...bodyLines, read('personalLine')].filter(Boolean)) {
    const line = document.createElement('p');
    line.className = 'line'; line.textContent = text; body.append(line);
  }
  const question = document.createElement('p');
  question.className = 'line stanza'; body.append(question);
  const lines = [...document.querySelectorAll('.line')];
  lines.forEach((line,i) => line.style.setProperty('--delay', (i * .55) + 's'));

  const featured = [
    ['日料','日料','慢慢吃，慢慢聊','japanese','那就留一晚，慢慢吃日料。'],
    ['意大利菜','意大利菜','一点烛光，一点浪漫','italian','意面和烛光，记下了。'],
    ['火锅','火锅','热热闹闹也不错','hotpot','锅底和蘸料，见面一起挑。'],
    ['交给你啦','交给你啦','把惊喜留到见面','surprise','那我来挑一家，到时揭晓。']
  ];
  function addFood(label, value, kind, photo) {
    const row = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'food'; radio.value = value; radio.dataset.kind = kind;
    const title = document.createElement('span'); title.textContent = label;
    row.append(radio);
    if (photo) {
      const picture = document.createElement('img');
      picture.src = 'assets/images/menu-' + photo[3] + '.webp';
      picture.alt = ''; picture.width = 600; picture.height = 390; picture.loading = 'lazy'; picture.decoding = 'async';
      const note = document.createElement('small'); note.textContent = photo[2];
      row.append(picture, title, note);
    } else row.append(title);
    radio.addEventListener('change', () => {
      $('dishWriteIn').hidden = kind !== 'custom';
      if (kind === 'custom') $('customDish').focus();
      put('dishFeedback', photo ? photo[4] : kind === 'custom' ? '把你惦记的那道菜写下来。' : kind === 'open' ? '好，留到见面再决定。' : label + '，已经记在菜单上了。');
      interactionSound('pick');
    });
    $(photo ? 'featuredDishes' : 'dishList').append(row);
  }
  for (const item of featured) addFood(item[0],item[1],'preset',item);
  for (const value of new Set(config.foodOptions || [])) {
    if (typeof value === 'string' && value.trim() && !featured.some(item=>item[1] === value)) addFood(value,value,'preset');
  }
  addFood('我有别的想法','','custom');
  addFood('见面再决定','','open');
  function dinnerFood() {
    const selected = $('menu').querySelector('input[name="food"]:checked');
    if (selected?.dataset.kind === 'custom') return $('customDish').value.trim();
    return selected?.value || '';
  }

  function datePassed() {
    if (!read('dateISO')) return false;
    // 此邀请的日期按上海时区结算，避免设备所在时区不同而提早过期。
    return new Date(Date.now() + 8 * 3600000).toISOString().slice(0,10) > read('dateISO');
  }
  function dinnerDate() { return datePassed() ? '日期待重新确认' : preferredDate || read('date') || undecided; }
  function dinnerTime() { return datePassed() ? '' : read('time'); }
  function updateDate() {
    put('dateText', dinnerDate()); put('timeText', dinnerTime() || undecided);
    put('menuWhen', [dinnerDate(), dinnerTime()].filter(Boolean).join(' · '));
    question.textContent = datePassed() ? '我们再挑一个彼此都有空的晚上，好吗？' : read('date') ? dinnerDate() + dinnerTime() + '，一起吃顿饭，好吗？' : '找个晚上，一起吃顿饭，好吗？';
    $('dateOptions').hidden = !dates.length || datePassed();
  }
  const dates = Array.isArray(config.candidateDates) ? [...new Set(config.candidateDates)].filter(Boolean).slice(0,3) : [];
  for (const date of dates) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = date; btn.setAttribute('aria-pressed','false');
    btn.addEventListener('click', () => {
      preferredDate = preferredDate === date ? '' : date; updateDate();
      for (const item of $('candidateList').children) item.setAttribute('aria-pressed', String(item.textContent === preferredDate));
    });
    $('candidateList').append(btn);
  }
  let wasPast = datePassed();
  function refreshDay() {
    if (document.hidden) return;
    updateDate();
    const past = datePassed();
    if (past !== wasPast && current === endingIndex && answer === 'yes') {
      renderTicket();
      refreshSubmit();
    }
    wasPast = past;
  }
  document.addEventListener('visibilitychange',refreshDay);
  let dayTimer;
  function scheduleDayRefresh() {
    clearTimeout(dayTimer);
    if (!read('dateISO')) return;
    const rollover = Date.parse(read('dateISO') + 'T00:00:00+08:00') + 86400000;
    const delay = rollover - Date.now();
    if (delay > 0) dayTimer = setTimeout(() => { refreshDay(); scheduleDayRefresh(); }, Math.min(delay+50, 2147483647));
  }
  window.addEventListener('pagehide',()=>clearTimeout(dayTimer));
  window.addEventListener('pageshow',scheduleDayRefresh);
  scheduleDayRefresh();

  const tracks = chapters.map((name, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const number = document.createElement('span');
    number.textContent = '0' + (index + 1);
    btn.append(number, name);
    btn.addEventListener('click', () => { if (current !== index) showScene(index); });
    document.querySelector('.tracks').append(btn);
    return btn;
  });
  function revealLetter() {
    clearTimeout(letterTimer);
    $('lyrics').classList.add('revealed');
    if (document.activeElement === $('skipLetter')) $('lyrics').querySelector('[data-next]').focus({preventScroll:true});
    $('skipLetter').hidden = true;
  }
  function setFlip(reverse) {
    $('flipTicket').setAttribute('aria-pressed', String(reverse));
    $('flipTicket').setAttribute('aria-label', reverse ? "The best part isn't the place. It's the company. 不是餐厅有多特别，而是我想和你一起去。翻回门票正面" : '查看晚餐安排，翻看门票背面');
    document.querySelector('.ticket-reverse').setAttribute('aria-hidden', String(!reverse));
    document.querySelector('.ticket-front').setAttribute('aria-hidden', String(reverse));
    if (reverse) $('flipTicket').removeAttribute('aria-describedby');
    else $('flipTicket').setAttribute('aria-describedby', 'dateText timeText placeText ticketFrom');
    put('flipHint', reverse ? '再轻点一次，回到正面' : '轻点门票，翻看背面');
  }
  function clearSceneTimers() {
    [transitionTimer, letterTimer, tapTimer, toastTimer].forEach(clearTimeout);
    transitioning = false;
    taps = 0;
    $('intro').classList.remove('starting');
    $('choice').classList.remove('accepting');
    $('skipIntro').hidden = true;
    $('playStory').removeAttribute('aria-busy');
    $('playStory').lastChild.textContent = '播放这段故事';
    put('secret', '');
    $('toast').classList.remove('show');
  }
  function showScene(index, focus = true) {
    if (!scenes[index]) return;
    clearSceneTimers();
    current = index;
    updateDate();
    // 回到选择或更早的一幕，就要重新作答才能打开相应结尾。
    furthest = index === endingIndex ? endingIndex : Math.max(Math.min(furthest, endingIndex - 1), index);
    if (index !== endingIndex) tracks[endingIndex].lastChild.textContent = chapters[endingIndex];
    document.body.dataset.act = String(index);
    if (focus) document.body.classList.add('has-entered');
    scenes.forEach((scene, i) => {
      scene.hidden = i !== index;
      scene.inert = i !== index;
      scene.classList.toggle('active', i === index);
      tracks[i].disabled = i > furthest;
      if (i === index) tracks[i].setAttribute('aria-current', 'step');
      else tracks[i].removeAttribute('aria-current');
    });
    put('actCount', '0' + (index + 1) + ' / 0' + scenes.length);
    if (index === 1) {
      $('lyrics').classList.toggle('revealed', reduced.matches);
      $('skipLetter').hidden = reduced.matches;
      if (!reduced.matches) letterTimer = setTimeout(revealLetter, lines.length * 550 + 110);
    }
    if (index === 2) setFlip(false);
    if (index === 4) loadTicketPaper();
    if (focus) scenes[index].querySelector('h1,h2').focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
  $('brandHome').addEventListener('click', e => { e.preventDefault(); showScene(0); });
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-next],[data-back],[data-answer]');
    if (!btn || !scenes[current].contains(btn) || transitioning) return;
    if (btn.dataset.answer) finish(btn.dataset.answer);
    else showScene(Number(btn.dataset.next ?? btn.dataset.back));
  });
  $('playStory').addEventListener('click', () => {
    if (transitioning) return;
    if (reduced.matches) { showScene(1); return; }
    transitioning = true;
    $('intro').classList.add('starting');
    interactionSound('needle');
    $('playStory').setAttribute('aria-busy','true');
    $('playStory').lastChild.textContent = '正在落针…';
    $('skipIntro').hidden = false;
    transitionTimer = setTimeout(() => showScene(1), 1850);
  });
  $('skipIntro').addEventListener('click', () => showScene(1));
  $('skipLetter').addEventListener('click', revealLetter);
  $('flipTicket').addEventListener('click', () => { setFlip($('flipTicket').getAttribute('aria-pressed') !== 'true'); interactionSound('paper'); });
  // 手指横拨唱片改变盘面角度。纵向手势始终交给页面滚动。
  const disc = $('record');
  let gesture = null;
  let rotation = 0;
  let ignoreDiscClick = false;
  disc.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || transitioning) return;
    ignoreDiscClick = false;
    if (reduced.matches) return;
    gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, start:rotation};
    disc.setPointerCapture(event.pointerId);
  });
  disc.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    if (!ignoreDiscClick && (Math.abs(dx) < 7 || Math.abs(dx) <= Math.abs(event.clientY - gesture.y))) return;
    ignoreDiscClick = true;
    rotation = (gesture.start + dx * 1.4) % 360;
    disc.style.setProperty('--scrub', rotation + 'deg');
  });
  disc.addEventListener('lostpointercapture', () => { gesture = null; });
  const assembly = document.querySelector('.assembly');
  assembly.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reduced.matches || transitioning) return;
    const box = assembly.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - .5;
    const y = (event.clientY - box.top) / box.height - .5;
    assembly.style.setProperty('--tilt-x', (-y * 9) + 'deg');
    assembly.style.setProperty('--tilt-y', (x * 12) + 'deg');
    assembly.style.setProperty('--foil-x', (35 + x * 100) + '%');
  });
  assembly.addEventListener('pointerleave', () => {
    for (const key of ['--tilt-x','--tilt-y','--foil-x']) assembly.style.removeProperty(key);
  });
  disc.addEventListener('click', event => {
    if (ignoreDiscClick && event.detail) { ignoreDiscClick = false; return; }
    if (transitioning) return;
    clearTimeout(tapTimer);
    if (++taps === 13) {
      taps = 0;
      put('secret', '其实这首歌，从一开始就想写给你。');
    } else tapTimer = setTimeout(() => { taps = 0; }, 5000);
  });

  function toast(message) {
    clearTimeout(toastTimer);
    put('toast', message);
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
  }
  const endings = {
    yes: ["It's a date.", '那么，这首歌就留给见面那天。', '复制赴约回复'],
    later: ['那就改天见。', '好吃的晚餐，值得等一个彼此都有空的晚上。', '复制协商时间消息'],
    no: ['谢谢你读到这里。', '谢谢你把这张唱片听到这里。祝你有个愉快的晚上。', '复制回复']
  };
  const constellation = document.querySelector('.constellation g');
  const starPoints=[[7,76],[25,66],[39,58],[63,65],[84,70],[112,38],[151,43],[180,52],[205,32],[242,46],[275,18],[315,31],[348,9]];
  constellation.replaceChildren();
  starPoints.forEach(([x,y],i)=>{
    const point=document.createElementNS('http://www.w3.org/2000/svg','circle');
    point.setAttribute('cx',x);point.setAttribute('cy',y);point.setAttribute('r',i%3?1.8:2.7);
    point.style.setProperty('--arrival',i*45+'ms'); constellation.append(point);
  });
  function finish(kind) {
    answer = kind;
    document.body.dataset.answer = kind;
    const accepted = kind === 'yes';
    const [title, message, action] = endings[kind];
    put('endingTitle', title);
    put('endingAct', accepted ? '第六幕 / 纪念票根' : '第六幕 / 尾声');
    tracks[endingIndex].lastChild.textContent = accepted ? chapters[endingIndex] : '尾声';
    put('endingMessage', message);
    put('copyReplyBtn', action);
    put('copyStatus', '');
    refreshSubmit();
    put('replyNote', canSubmit ? '点提交后，' + fromName + ' 可以看到' + ({yes:'你的赴约选择和晚餐口味。',later:'你的改期意愿、所选日期和晚餐口味。',no:'你这次先不了的回复。'})[kind] : '复制后，可自行粘贴发送给 ' + fromName + '。');
    for (const id of ['keepsakeCard','saveTicketBtn','saveTip','closingQuote']) $(id).hidden = !accepted;
    $('alternateWrap').hidden = kind !== 'later';
    if (accepted) {
      renderTicket();
      if (!reduced.matches) {
        transitioning = true;
        $('choice').classList.add('accepting');
        transitionTimer = setTimeout(() => showScene(endingIndex), 1000);
        return;
      }
    }
    showScene(endingIndex);
  }

  let ticketRevision = 0, lastExport = 0;
  async function renderTicket() {
    const revision = ++ticketRevision;
    const details = {
      from:fromName, to:toName,
      date:[dinnerDate(), dinnerTime()].filter(Boolean).join(' · '),
      venue:restaurant, food:dinnerFood() || '见面再决定'
    };
    $('ticketImage').removeAttribute('src');
    $('saveTicketBtn').removeAttribute('href');
    $('saveTicketBtn').hidden=true;
    put('saveTip','正在压印纪念票根…');
    try {
      const url = await composeTicket(details);
      if (revision !== ticketRevision || answer !== 'yes') return;
      $('ticketImage').src=url;
      $('ticketImage').alt=fromName+' × '+toName+'。'+details.date+'，'+restaurant+'，'+details.food+'。NO. 0013。';
      $('saveTicketBtn').href=url; $('saveTicketBtn').hidden=false;
      put('saveTip','手机可长按票根保存图片');
    } catch {
      if (revision !== ticketRevision || answer !== 'yes') return;
      $('keepsakeCard').hidden=true;
      put('saveTip','当前浏览器未能生成票根。你仍可以复制或提交回复。');
    }
  }
  $('saveTicketBtn').addEventListener('click', e=>{
    if (Date.now()-lastExport < 1100) { e.preventDefault(); return; }
    lastExport=Date.now();
  });

  async function clipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* 本地复制降级 */ }
    }
    const field=document.createElement('textarea');
    field.value=text;field.style.cssText='position:fixed;top:0;left:0;opacity:0';
    document.body.append(field);
    try { field.select(); return document.execCommand('copy'); }
    finally { field.remove(); $('copyReplyBtn').focus({preventScroll:true}); }
  }
  $('copyReplyBtn').addEventListener('click', async () => {
    const kind=answer;
    const key={yes:'replyYes',later:'replyLater',no:'replyNo'}[kind];
    let message=read(key) || {yes:'好呀，我赴约。',later:'我们换个时间吧。',no:'谢谢邀请，这次先不了。'}[kind];
    if (kind==='yes' && dinnerDate() !== undecided) message+=' '+dinnerDate()+(datePassed() ? '，我们再约个晚上。' : dinnerTime()+'见。');
    if (kind==='yes' && dinnerFood()) message+=' 我想吃'+dinnerFood()+'。';
    if (kind==='later' && $('alternateDate').value) message+=' 我方便的日期是 '+$('alternateDate').value+'。';
    let ok=false;
    try { ok=await clipboard(message); } catch { /* 保留手动复制路径 */ }
    if (current!==endingIndex || answer!==kind) return;
    put('copyStatus',ok?'已复制，可粘贴到聊天框。':'请长按或选中复制：'+message);
  });

  // 保留初版和声。单个上下文和单个节拍器跟随用户意图及实际音频状态。
  const chords=[[261.63,329.63,392,493.88],[220,261.63,329.63,392],[174.61,220,261.63,349.23],[196,246.94,293.66,392]];
  let ctx=null, interval=null, beat=0, wantsSound=false, pageAway=false, audioRequest=0;
  const voices=new Set();
  function audible() {return wantsSound && !document.hidden && !pageAway;}
  function tone(hz, when, duration, level) {
    const osc=ctx.createOscillator(), filter=ctx.createBiquadFilter(), gain=ctx.createGain();
    osc.type='sine';osc.frequency.value=hz;filter.type='lowpass';filter.frequency.value=1550;
    osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    gain.gain.setValueAtTime(.0001,when);
    gain.gain.exponentialRampToValueAtTime(level,when+.10);
    gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
    voices.add(osc);
    osc.onended=()=>{voices.delete(osc);osc.disconnect();filter.disconnect();gain.disconnect();};
    osc.start(when);osc.stop(when+duration+.02);
  }
  function interactionSound(kind) {
    if (!audible() || ctx?.state !== 'running') return;
    const now = ctx.currentTime + .01;
    if (kind === 'pick') { tone(440,now,.2,.011); return; }
    const duration = kind === 'needle' ? .11 : .19;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1,length,ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i=0; i<length; i++) samples[i]=(Math.random()*2-1)*Math.exp(-6*i/length);
    const source = ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain();
    source.buffer=buffer; filter.type='lowpass'; filter.frequency.value=kind==='needle'?760:1800;
    gain.gain.value=.035; source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    voices.add(source); source.onended=()=>{voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
    source.start(now);
  }
  function musicBeat(){
    if(!audible() || ctx?.state!=='running') return;
    const chord=chords[Math.floor(beat/8)%chords.length],now=ctx.currentTime+.025;
    if(beat%8===0) chord.forEach(hz=>tone(hz/2,now,3.2,.008));
    const note=chord[[0,2,1,3,2,1,0,2][beat%8]];
    if (current !== endingIndex || beat % 2 === 0) tone(note,now,current >= 4 ? 1.8 : 1.25,current === endingIndex ? .012 : .019);
    if (current === 4 && beat%4 === 0) tone(note*2,now+.12,1.45,.006);
    beat++;
  }
  function stopBeat(){
    clearInterval(interval);interval=null;
    for(const osc of voices) {try {osc.stop();} catch { /* 已结束 */ }}
    voices.clear();
  }
  function updateAudio(){
    const playing=audible() && ctx?.state==='running';
    if(playing && interval===null) {musicBeat();interval=setInterval(musicBeat,550);}
    if(!playing) stopBeat();
    put('soundLabel',playing?'音乐开':'音乐关');
    $('soundBtn').setAttribute('aria-pressed',String(!!playing));
    $('soundBtn').setAttribute('aria-label',playing?'关闭背景音乐':'开启背景音乐');
  }
  async function syncAudio(){
    const request=++audioRequest;
    try {
      if(audible()){
        if(!ctx){
          const Audio=window.AudioContext || window.webkitAudioContext;
          if(!Audio) throw new Error('audio unavailable');
          ctx=new Audio();
          ctx.addEventListener('statechange',updateAudio);
        }
        await ctx.resume();
      } else {
        stopBeat();
        if(ctx && ctx.state!=='closed') await ctx.suspend();
      }
    } catch {
      if(request===audioRequest){wantsSound=false;toast('当前无法播放背景音，仍可继续阅读。');}
    }
    if(request===audioRequest) updateAudio();
  }
  $('soundBtn').addEventListener('click',()=>{
    // 系统音频中断后，再次触摸可恢复。
    wantsSound=!!(wantsSound && ctx?.state==='interrupted') || !wantsSound;
    syncAudio();
  });
  document.addEventListener('visibilitychange',syncAudio);
  window.addEventListener('pagehide',()=>{pageAway=true;syncAudio();clearSceneTimers();});
  window.addEventListener('pageshow',()=>{pageAway=false;syncAudio();if(current===1) revealLetter();});
  $('playStory').disabled = false;
  showScene(location.hash === '#menu' ? scenes.indexOf($('menu')) : 0, false);
})();
