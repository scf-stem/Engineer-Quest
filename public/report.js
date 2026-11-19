const api = '/api/quest/v1';
const token = location.hash.slice(1);
const form = document.querySelector('#unlock');
const status = document.querySelector('#status');
const code = document.querySelector('#access-code');
const report = document.querySelector('#report');
const followup = document.querySelector('#follow-up');
const allowButton = document.querySelector('#follow-up-allow');
const withdrawButton = document.querySelector('#follow-up-withdraw');
const followupStatus = document.querySelector('#follow-up-state');
let verifiedCode;
let decision;

function renderDecision(data) {
  decision = data;
  followup.hidden = false;
  document.querySelector('#follow-up-notice').textContent = data.notice;
  followupStatus.textContent = data.allowed ? '已授权本次回访。' : '本次回访未授权。';
  allowButton.hidden = data.allowed;
  withdrawButton.hidden = !data.allowed;
}

async function recordDecision(allowed) {
  allowButton.disabled = withdrawButton.disabled = true;
  try {
    const response = await fetch(`${api}/report-access/follow-up`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ token, access_code: verifiedCode, allowed,
        notice_version: decision.notice_version, expected_revision: decision.revision }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw Error(result.error || '暂时无法更新回访授权。');
    renderDecision(result.data);
  } catch (error) {
    followupStatus.textContent = error.message === 'Failed to fetch' ? '网络连接中断，请重试。' : error.message;
  } finally {
    allowButton.disabled = withdrawButton.disabled = false;
  }
}

allowButton.addEventListener('click', () => void recordDecision(true));
withdrawButton.addEventListener('click', () => void recordDecision(false));

function render(data) {
  const append = (target, tag, text) => {
    const element = document.createElement(tag);
    element.textContent = text;
    target.append(element);
  };
  form.hidden = true;
  code.value = '';
  status.textContent = '';
  report.replaceChildren();
  append(report, 'p', `${data.batch.title} · 已审核 · 第 ${data.version} 版`);
  for (const section of data.content.sections) {
    append(report, 'h2', section.title);
    for (const line of section.lines) append(report, 'p', line);
  }
  append(report, 'h2', '下一次可以尝试');
  append(report, 'p', data.content.suggestion);
  report.hidden = false;
  if (data.follow_up) renderDecision(data.follow_up);
}

async function load(path, options) {
  status.textContent = '正在读取报告…';
  try {
    const response = await fetch(`${api}/${path}`, { cache: 'no-store', ...options });
    const result = await response.json();
    if (!response.ok || !result.success) throw Error(result.error || '暂时无法查看报告。');
    render(result.data);
  } catch (error) {
    status.textContent = error.message === 'Failed to fetch' ? '网络连接中断，请重试。' : error.message;
  }
}

if (/^[0-9a-f]{64}$/.test(token)) {
  form.hidden = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    verifiedCode = code.value;
    await load('report-access/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, access_code: verifiedCode }),
    });
    button.disabled = false;
  });
} else {
  document.querySelector('#back').hidden = false;
  void load('report');
}

window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
