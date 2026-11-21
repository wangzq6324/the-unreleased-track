(() => {
  'use strict';
  const config = window.INVITATION_CONFIG || {};
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
  const chapters = ['The Intro', 'The Lyrics', 'The Date', 'The Menu', 'The Choice', 'Bonus Track'];
  const endingIndex = scenes.indexOf($('ending'));
  let current = 0;
  let furthest = 0;
  let answer = '';
  let preferredDate = '';
  let transitionTimer, letterTimer, tapTimer, toastTimer;
  let taps = 0;
  let transitioning = false;

  document.title = 'The Unreleased Track · ' + fromName;
  put('recipientLine', 'Dear ' + toName + ',');
  put('fromSignature', fromName);
  put('ticketFrom', fromName);
  put('placeText', restaurant);
  put('timeText', time);
  put('personalLine', read('personalLine'));
  $('personalLine').hidden = !read('personalLine');
  if (read('date')) put('invitationWhen', read('date') + read('time') + '，');
  put('menuQuestion', toName + '，想吃点什么？');
  put('menuFrom', fromName);
  const foodOptions = Array.isArray(config.foodOptions) ? config.foodOptions : ['火锅', '烤肉'];
  function addFood(label, kind) {
    const row = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'food';
    radio.value = label;
    radio.dataset.kind = kind;
    radio.addEventListener('change', () => {
      $('dishWriteIn').hidden = kind !== 'custom';
      if (kind === 'custom') $('customDish').focus();
    });
    const title = document.createElement('span');
    title.textContent = label;
    row.append(radio, title);
    $('dishList').append(row);
  }
  for (const food of new Set(foodOptions)) {
    if (typeof food === 'string' && food.trim()) addFood(food.trim(), 'preset');
  }
  addFood('我有别的想法', 'custom');
  addFood('见面再决定', 'open');
  function dinnerFood() {
    const selected = $('dishList').querySelector('input:checked');
    if (selected?.dataset.kind === 'custom') return $('customDish').value.trim();
    return selected?.dataset.kind === 'preset' ? selected.value : '';
  }
  const lines = [...document.querySelectorAll('.line')].filter(el => !el.hidden);
  lines.forEach((el, i) => el.style.setProperty('--delay', (i * .61) + 's'));

  // 封套在 CSS 中首屏加载。慢连接给出状态，并保留可以立即操作的播放按钮。
  const art = new Image();
  let artTimer = setTimeout(() => put('artStatus', '正在打开封套…'), 350);
  art.onload = () => { clearTimeout(artTimer); put('artStatus', ''); };
  art.onerror = () => { clearTimeout(artTimer); put('artStatus', '封套插画暂未载入，可继续播放。'); };
  art.src = 'assets/sleeve.svg';

  function dinnerDate() { return preferredDate || read('date') || undecided; }
  const dates = Array.isArray(config.candidateDates)
    ? [...new Set(config.candidateDates.map(x => String(x).trim()).filter(Boolean))].slice(0, 3) : [];
  for (const date of dates) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = date;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      preferredDate = preferredDate === date ? '' : date;
      put('dateText', dinnerDate());
      put('menuWhen', dinnerDate() + read('time'));
      for (const item of $('candidateList').children) item.setAttribute('aria-pressed', String(item.textContent === preferredDate));
    });
    $('candidateList').append(btn);
  }
  $('dateOptions').hidden = !dates.length;
  put('dateText', dinnerDate());

  put('menuWhen', dinnerDate() + read('time'));

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
      if (!reduced.matches) letterTimer = setTimeout(revealLetter, lines.length * 610 + 100);
    }
    if (index === 2) setFlip(false);
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
    $('playStory').setAttribute('aria-busy','true');
    $('playStory').lastChild.textContent = '正在落针…';
    $('skipIntro').hidden = false;
    transitionTimer = setTimeout(() => showScene(1), 1850);
  });
  $('skipIntro').addEventListener('click', () => showScene(1));
  $('skipLetter').addEventListener('click', revealLetter);
  $('flipTicket').addEventListener('click', () => setFlip($('flipTicket').getAttribute('aria-pressed') !== 'true'));
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
    later: ['Another evening.', '好吃的晚餐，值得等一个彼此都有空的晚上。', '复制协商时间消息'],
    no: ['Thanks for listening.', '谢谢你把这张唱片听到这里。祝你有个愉快的晚上。', '复制回复']
  };
  function finish(kind) {
    answer = kind;
    document.body.dataset.answer = kind;
    const accepted = kind === 'yes';
    const [title, message, action] = endings[kind];
    put('endingTitle', title);
    put('endingAct', accepted ? 'ACT 06 / BONUS TRACK' : 'ACT 06 / OUTRO');
    tracks[endingIndex].lastChild.textContent = accepted ? chapters[endingIndex] : 'The Outro';
    put('endingMessage', message);
    put('copyReplyBtn', action);
    put('copyStatus', '');
    put('replyNote', '复制后，可自行粘贴发送给' + fromName + '。页面不会自动发送。');
    for (const id of ['keepsakeCard','saveTicketBtn','saveTip','closingQuote']) $(id).hidden = !accepted;
    $('alternateWrap').hidden = kind !== 'later';
    if (accepted) {
      try { renderTicket(); }
      catch {
        for (const id of ['keepsakeCard','saveTicketBtn','saveTip']) $(id).hidden = true;
        put('copyStatus','当前浏览器未能生成票根，仍可复制赴约回复。');
      }
      if (!reduced.matches) {
        transitioning = true;
        $('choice').classList.add('accepting');
        transitionTimer = setTimeout(() => showScene(endingIndex), 1000);
        return;
      }
    }
    showScene(endingIndex);
  }

  function renderTicket() {
    // 使用与封套配套的原创月海刻线。所有图元均本地绘制，file:// 也可导出。
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    const measure = canvas.getContext('2d');
    const textStyle = '53px Georgia, "Songti SC", serif';
    function wrap(text, width) {
      measure.font = textStyle;
      const result = [];
      let line = '';
      for (const ch of text) {
        if (line && measure.measureText(line + ch).width > width) { result.push(line); line = ''; }
        line += ch;
      }
      if (line) result.push(line);
      return result;
    }
    const fields = [
      ['FROM  /  邀请人', fromName], ['FOR  /  收件人', toName],
      ['WHEN  /  晚餐', dinnerDate() + (time !== undecided ? ' · ' + time : '')], ['WHERE  /  餐厅', restaurant],
      ['MENU  /  想吃', dinnerFood() || '见面再决定']
    ].map(([label, value]) => [label, wrap(value, 635)]);
    const firstHeight = 132 + Math.max(fields[0][1].length,fields[1][1].length)*67;
    const secondHeight = 122 + Math.max(fields[2][1].length,fields[3][1].length)*67;
    canvas.height = 650 + firstHeight + secondHeight + 110 + fields[4][1].length * 67;
    const h = canvas.height, c = canvas.getContext('2d'), cut = 1506;
    function type(text, x, y, font, color) { c.fillStyle = color; c.font = font; c.fillText(text, x, y); }
    function line(x,y,xx,yy,color) {
      c.strokeStyle=color;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();
    }
    c.fillStyle='#252533';c.fillRect(0,0,1920,h);
    const paper=c.createLinearGradient(cut,0,1920,h);paper.addColorStop(0,'#ead6b9');paper.addColorStop(1,'#d5afa5');
    c.fillStyle=paper;c.fillRect(cut,0,1920-cut,h);
    c.strokeStyle='#a28a76';c.lineWidth=2;c.strokeRect(24,24,1872,h-48);
    const gold='#d4b18f',cream='#f4e6d6',ink='#382e37';
    type('R I C K Y D O G    R E C O R D S',76,95,'29px monospace',gold);
    type('BONUS TRACK',1170,95,'28px monospace',gold);
    line(76,137,1435,137,'#786a62');
    type('The Unreleased',70,300,'138px Georgia',cream);
    type('Track',74,437,'italic 148px Georgia',gold);
    fields.forEach(([label, rows], i) => {
      const x=76+(i%2)*694, y=541+(i>1?firstHeight:0)+(i>3?secondHeight:0);
      type(label,x,y,'29px monospace',gold);
      rows.forEach((s,j)=>type(s,x,y+76+j*67,textStyle,cream));
    });
    line(76,h-79,1435,h-79,'#786a62');
    type('PRIVATE DINNER PRESSING',76,h-42,'21px monospace',gold);
    type('SIDE A   /   STEREO',1160,h-42,'21px monospace',gold);
    c.setLineDash([9,9]);line(cut,25,cut,h-25,'#8a7368');c.setLineDash([]);
    c.textAlign='center';const cx=1714;
    type('ONE OF ONE',cx,105,'33px monospace',ink);
    c.save();c.translate(cx,h*.44);c.scale(1.32,1.32);
    c.beginPath();c.arc(0,0,102,0,Math.PI*2);c.clip();
    c.fillStyle=ink;c.fillRect(-105,-105,210,210);
    c.fillStyle='#ead7bd';c.beginPath();c.arc(-2,-36,28,0,Math.PI*2);c.fill();
    c.fillStyle=ink;c.beginPath();c.arc(8,-45,26,0,Math.PI*2);c.fill();
    c.strokeStyle='#c1a594';c.lineWidth=2;
    for(let row=0;row<18;row++){
      c.beginPath();
      for(let x=-105;x<=105;x+=3){const y=6+row*6+Math.sin(x*.055+row*.8)*3+Math.cos(x*.029+row)*2;c.lineTo(x,y);}
      c.stroke();
    }
    c.restore();
    type('NO. 0013',cx,h-179,'51px Georgia',ink);
    let bx=cx-110;
    for(let i=0;i<44;i++){c.fillStyle=ink;const width=1+(i*13%5);c.fillRect(bx,h-134,width,65);bx+=width+2;}
    const url=canvas.toDataURL('image/png');
    $('ticketImage').src=url;
    $('ticketImage').alt='The Unreleased Track，'+fromName+' 与 '+toName+' 的晚餐票根。'+dinnerDate()+'，'+time+'，'+restaurant+'。想吃：'+(dinnerFood() || '见面再决定')+'。NO. 0013，ONE OF ONE。';
    $('saveTicketBtn').href=url;
  }

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
    if (kind==='yes' && dinnerDate() !== undecided) message+=' '+dinnerDate()+(read('time') || '')+'见。';
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
  function musicBeat(){
    if(!audible() || ctx?.state!=='running') return;
    const chord=chords[Math.floor(beat/8)%chords.length],now=ctx.currentTime+.025;
    if(beat%8===0) chord.forEach(hz=>tone(hz/2,now,3.2,.008));
    tone(chord[[0,2,1,3,2,1,0,2][beat%8]],now,1.25,.019);
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
    put('soundLabel',playing?'SOUND ON':'SOUND OFF');
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
  showScene(location.hash === '#menu' ? scenes.indexOf($('menu')) : 0, false);
})();
