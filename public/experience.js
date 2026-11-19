const api = '/api/quest/v1';
const requestedPhase = new URLSearchParams(location.search).get('phase');
let phase = ['pre', 'post'].includes(requestedPhase) ? requestedPhase : 'course';
const select = selector => document.querySelector(selector);
const form = select('#answers');
const status = select('#status');
const retry = select('#retry');

let experience, response, submission;
let answers = {};
let pages = [];
let pageIndex = 0;
let noticeChecked = false;
let reportShare = false;
let dirty = false;
let pending = false;

async function request(path, options) {
  const result = await fetch(`${api}/${path}`, { cache: 'no-store', ...options });
  const payload = await result.json();
  if (!result.ok || !payload.success) throw Error(payload.error || '暂时无法处理，请稍后重试。');
  return payload.data;
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function showStatus(message = '', error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function isAnswered(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

function requiredMissing(question) {
  return question.required !== false && !isAnswered(answers[question.id]);
}

function textLength(question, value) {
  return question.text_length_unit === 'codepoint'
    ? Array.from(value.replace(/\r\n?/g, '\n').trim()).length
    : value.length;
}

function updateProgress() {
  const count = pages.filter(question => isAnswered(answers[question.id])).length;
  select('#answered-count').textContent = `已答 ${count} / ${pages.length} 题`;
  select('#survey-meter').value = count;
  select('.progress-segments').childNodes.forEach((segment, index) => {
    segment.classList.toggle('is-answered', isAnswered(answers[pages[index].id]));
  });
}

function questionField(question) {
  const field = element('fieldset', null, 'survey-question');
  field.id = `question-${question.id}`;
  const legend = element('legend', question.label);
  legend.tabIndex = -1;
  if (question.required === false) legend.append('（选填）');
  field.append(legend);
  const hintId = `hint-${question.id}`;
  const feedback = element('p', null, 'question-feedback');
  feedback.id = `feedback-${question.id}`;
  feedback.setAttribute('role', 'status');
  field.setAttribute('aria-describedby', question.hint ? `${hintId} ${feedback.id}` : feedback.id);
  if (question.hint) {
    const hint = element('p', question.hint, 'question-hint');
    hint.id = hintId;
    field.append(hint);
  }

  function updateAnswer(value) {
    if (isAnswered(value)) answers[question.id] = value;
    else delete answers[question.id];
    dirty = true;
    feedback.textContent = '';
    field.removeAttribute('aria-invalid');
    updateProgress();
  }

  if (question.type === 'text') {
    const input = element('textarea');
    input.name = question.id;
    input.setAttribute('aria-label', question.label);
    input.rows = 3;
    if (question.text_length_unit !== 'codepoint') input.maxLength = question.max_length;
    input.value = answers[question.id] ?? '';
    const counter = element('p', `${textLength(question, input.value)} / ${question.max_length}`, 'text-count');
    counter.id = `count-${question.id}`;
    input.setAttribute('aria-describedby', [question.hint && hintId, counter.id, feedback.id].filter(Boolean).join(' '));
    input.addEventListener('input', () => {
      updateAnswer(input.value);
      const count = textLength(question, input.value);
      counter.textContent = `${count} / ${question.max_length}`;
      if (count > question.max_length) {
        feedback.textContent = `这题最多填写 ${question.max_length} 个字符。`;
        field.setAttribute('aria-invalid', 'true');
      }
    });
    field.append(input, counter);
    if (question.footnote) field.append(element('p', question.footnote, 'question-hint'));
  } else {
    const multiple = question.type === 'multi_choice';
    const options = element('div', null, 'question-options');
    const inputs = [];
    for (const option of question.options) {
      const label = element('label', null, 'survey-option');
      label.classList.toggle('is-exclusive', question.exclusive_options?.includes(option.id) ?? false);
      const input = element('input');
      input.type = multiple ? 'checkbox' : 'radio';
      input.name = question.id;
      input.value = option.id;
      input.checked = multiple ? (answers[question.id] ?? []).includes(option.id) : answers[question.id] === option.id;
      inputs.push(input);
      input.addEventListener('change', () => {
        if (!multiple) {
          updateAnswer(option.id);
          return;
        }
        const exclusive = question.exclusive_options ?? [];
        if (input.checked) {
          for (const other of inputs) {
            if (other !== input && (exclusive.includes(option.id) || exclusive.includes(other.value))) {
              other.checked = false;
            }
          }
        }
        const selected = inputs.filter(control => control.checked).map(control => control.value);
        if (selected.length > question.max_choices) {
          input.checked = false;
          feedback.textContent = `最多选 ${question.max_choices} 项。先取消一项就可以改选。`;
          return;
        }
        updateAnswer(selected);
      });
      label.append(input, element('span', option.label));
      options.append(label);
    }
    field.append(options);
  }
  field.append(feedback);
  return field;
}

function noticeControl() {
  const container = element('div', null, 'survey-notice');
  const details = element('details');
  details.open = true;
  const description = element('p', experience.notice.text);
  description.id = 'notice-text';
  details.append(element('summary', '答卷如何使用'), description);
  const label = element('label', null, 'notice');
  const checkbox = element('input');
  checkbox.type = 'checkbox';
  checkbox.name = 'notice';
  checkbox.setAttribute('aria-describedby', description.id);
  checkbox.checked = noticeChecked;
  checkbox.addEventListener('change', () => { noticeChecked = checkbox.checked; });
  label.append(checkbox, '我已阅读并确认答卷使用说明');
  container.append(details, label);
  return container;
}

function renderPage({ focus = false, direction = 'forward' } = {}) {
  form.replaceChildren();
  form.dataset.direction = direction;
  select('#experience-intro').hidden = pageIndex !== 0;
  const question = pages[pageIndex];
  const lastPage = pageIndex === pages.length - 1;
  const meter = element('div', null, 'survey-progress');
  const progressLabel = element('div', null, 'progress-label');
  const answered = element('span');
  answered.id = 'answered-count';
  progressLabel.append(element('strong', `第 ${pageIndex + 1} / ${pages.length} 题`), answered);
  const progress = element('progress');
  progress.id = 'survey-meter';
  progress.setAttribute('aria-labelledby', answered.id);
  progress.max = pages.length;
  const segments = element('div', null, 'progress-segments');
  segments.setAttribute('aria-hidden', 'true');
  pages.forEach((_, index) => segments.append(element('span', null, index === pageIndex ? 'is-current' : undefined)));
  meter.append(progressLabel, progress, segments);
  const field = questionField(question);
  const kind = {choice: '单选', multi_choice: '多选', text: '简答'}[question.type];
  const typeLabel = element('span', kind, 'question-type');
  form.append(meter, typeLabel, field);
  if (!experience.notice_confirmed && pageIndex === 0) form.append(noticeControl());

  if (lastPage && phase === 'post' && !experience.self_service) {
    const label = element('label', null, 'notice');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = reportShare;
    checkbox.addEventListener('change', () => { reportShare = checkbox.checked; });
    label.append(checkbox, `（选填）${experience.report_share_notice.text}`);
    form.append(label);
  }

  const actions = element('div', null, 'survey-controls');
  const draft = element('button', '保存草稿', 'save-draft');
  draft.type = 'button';
  draft.addEventListener('click', () => void save(false));
  const previous = element('button', '上一题', 'secondary');
  previous.type = 'button';
  previous.hidden = pageIndex === 0;
  previous.addEventListener('click', () => { pageIndex -= 1; renderPage({ focus: true, direction: 'back' }); });
  const submitText = phase === 'pre' ? '提交课前问卷' : experience.self_service ? '提交并完成体验' : '提交课后问卷';
  const next = element('button', lastPage ? submitText : '下一题');
  next.type = 'submit';
  if (!lastPage) next.append(element('span', '→', 'next-arrow'));
  next.querySelector('.next-arrow')?.setAttribute('aria-hidden', 'true');
  actions.append(draft, previous, next);
  const footer = element('div', null, 'survey-footer');
  footer.append(status, actions);
  form.append(footer);
  updateProgress();
  showStatus();
  if (focus) {
    field.querySelector('legend').focus({ preventScroll: true });
    select('.experience-content').scrollIntoView({ block: 'start' });
  }
}

function drawSubmittedAnswers() {
  const container = select('#submitted-answers');
  container.replaceChildren();
  for (const [sheet, title] of [[experience.pre, '课前答卷'], [experience.post, '课后答卷']]) {
    if (!sheet?.submitted_at) continue;
    const details = element('details');
    details.append(element('summary', title));
    const list = element('dl');
    for (const question of sheet.questions) {
      const value = sheet.answers[question.id];
      const values = Array.isArray(value) ? value : [value];
      const label = values.map(item => question.options?.find(option => option.id === item)?.label ?? item).join('、');
      list.append(element('dt', question.label), element('dd', label || '未填写'));
    }
    details.append(list);
    container.append(details);
  }
}

function updateStep(selector, label, current, complete = false) {
  const step = select(selector);
  step.querySelector('small').textContent = label;
  step.classList.toggle('is-complete', complete);
  if (current) step.setAttribute('aria-current', 'step');
  else step.removeAttribute('aria-current');
}

function renderExperience() {
  const preDone = Boolean(experience.pre.submitted_at);
  const postDone = Boolean(experience.post?.submitted_at);
  const preForm = phase === 'pre' && !preDone;
  const postForm = phase === 'post' && preDone && !postDone && Boolean(response);
  const overview = !preDone && !preForm;
  const lesson = preDone && !postForm && !postDone;
  document.body.dataset.view = preForm || postForm ? 'survey' : postDone ? 'done' : lesson ? 'lesson' : 'overview';
  const preCount = experience.pre.questions.length;
  const heading = select('#experience-title');
  const intro = select('#experience-intro');
  if (postDone) {
    heading.textContent = '体验记录已提交';
    intro.textContent = '你可以在这里回看两份答卷。';
  } else if (lesson) {
    heading.textContent = '上课 · 工程工位';
    intro.textContent = '课前答卷已提交。接下来，动手做一盏天暗了会自动亮的小灯。';
  } else if (preForm) {
    heading.textContent = '课前问卷';
    intro.textContent = response.intro ?? '想一想你以前做过什么、今天想先试哪一步。';
  } else if (postForm) {
    heading.textContent = '课后问卷';
    intro.textContent = response.intro ?? '回到刚才的小灯任务，想想你做了什么、看到了什么。';
  } else {
    heading.textContent = '做一盏天暗了会自动亮的小灯';
    intro.textContent = '先想一想，再进工位动手，最后记下你发现的事。';
  }
  intro.hidden = false;
  select('#batch').textContent = experience.self_service ? 'Engineer Quest' : experience.batch.title;
  select('#steps').hidden = false;
  updateStep('#pre-step', preDone ? '已提交' : `${preCount} 题`, !preDone, preDone);
  updateStep('#workshop-step', preDone ? '可进入' : '课前提交后开始', lesson);
  updateStep('#post-step', postDone ? '已提交' : postForm ? '填写中' : preDone ? '已开放' : '课前提交后开放', postForm, postDone);
  select('#course-overview').hidden = !overview;
  select('#pre-summary').textContent = `先答 ${preCount} 道题，说说你想怎么开始。`;
  select('#lesson-brief').hidden = !lesson;
  select('#post-access').hidden = !lesson || !experience.post;
  const start = select('#start-pre');
  start.hidden = !overview;
  start.textContent = experience.pre.revision ? '继续课前问卷' : '开始课前问卷';
  select('#workshop').hidden = !lesson || !experience.workspace_key;
  select('#report-link').hidden = experience.self_service || !postDone;
  select('#back').hidden = !preForm && !postForm;
  const links = select('#links');
  links.hidden = !links.querySelector('a:not([hidden])');
  links.classList.toggle('back-link', preForm || postForm);
  select('#completion').hidden = !postDone && !lesson;
  if (postDone || lesson) drawSubmittedAnswers();
  form.hidden = !preForm && !postForm;
  if (!form.hidden) renderPage();
  else {
    form.after(status);
    form.replaceChildren();
  }
}

async function loadExperience({ focus = false } = {}) {
  retry.hidden = true;
  showStatus('正在读取体验…');
  try {
    experience = await request('learning?form=4');
    response = experience[phase];
    answers = { ...response?.answers };
    pages = response?.questions ?? [];
    const incomplete = pages.findIndex(requiredMissing);
    pageIndex = incomplete < 0 ? 0 : incomplete;
    dirty = false;
    noticeChecked = experience.notice_confirmed;
    reportShare = false;
    submission = null;
    showStatus();
    renderExperience();
    if (focus) select('#experience-title').focus();
  } catch (error) {
    showStatus(error instanceof TypeError ? '网络暂不可用，请重新读取。' : error.message, true);
    retry.hidden = false;
  }
}

function requireNotice() {
  if (experience.notice_confirmed || noticeChecked) return true;
  pageIndex = 0;
  renderPage({ focus: true });
  const notice = select('.survey-notice');
  notice.querySelector('details').open = true;
  notice.querySelector('input').focus();
  showStatus('请先看一下答卷使用说明并勾选确认。', true);
  return false;
}

function locateQuestionError(question, hint) {
  pageIndex = pages.findIndex(item => item.id === question.id);
  renderPage({ focus: true });
  const field = document.getElementById(`question-${question.id}`);
  field.setAttribute('aria-invalid', 'true');
  field.querySelector('.question-feedback').textContent = hint;
  field.querySelector('input, textarea')?.focus();
}

async function save(submit) {
  if (pending || !requireNotice()) return;
  const tooLong = response.questions.find(question => question.type === 'text'
    && textLength(question, answers[question.id] ?? '') > question.max_length);
  if (tooLong) {
    locateQuestionError(tooLong, `这题最多填写 ${tooLong.max_length} 个字符。`);
    return;
  }
  if (submit) {
    const missing = response.questions.find(requiredMissing);
    if (missing) {
      locateQuestionError(missing, '请先回答这一题。');
      showStatus('还有题目未回答，已跳到第一道未答题。', true);
      return;
    }
  }

  const body = JSON.stringify({ context: experience.context, version: experience.version,
    expected_revision: response.revision, notice_version: experience.notice.version,
    report_share_notice: reportShare ? experience.report_share_notice.version : null, answers });
  if (submit && submission?.body !== body) submission = { body, key: crypto.randomUUID() };
  const controls = form.querySelectorAll('input, textarea, button');
  pending = true;
  for (const control of controls) control.disabled = true;
  showStatus(submit ? '正在提交…' : '正在保存草稿…');
  try {
    const saved = await request(`responses/${phase}/${submit ? 'submit' : 'draft'}`, {
      method: submit ? 'POST' : 'PUT', body,
      headers: { 'Content-Type': 'application/json', ...(submit ? { 'Idempotency-Key': submission.key } : {}) },
    });
    dirty = false;
    experience.notice_confirmed = true;
    experience[phase] = response = saved;
    if (submit) {
      showStatus();
      renderExperience();
      if (phase === 'pre') {
        phase = 'course';
        history.replaceState(null, '', '/experience.html');
        await loadExperience({ focus: true });
      }
      else select('#experience-title').focus();
    } else {
      form.querySelector('.survey-notice')?.remove();
      showStatus('草稿已保存，下次可从未答题接着填写。');
    }
  } catch (error) {
    showStatus(error instanceof TypeError ? '网络连接中断，当前页面保留了你的答案。联网后可以重试。' : error.message, true);
  } finally {
    pending = false;
    for (const control of controls) control.disabled = false;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (pending) return;
  if (pageIndex === pages.length - 1) void save(true);
  else {
    pageIndex += 1;
    renderPage({ focus: true });
  }
});
retry.addEventListener('click', () => void loadExperience({ focus: true }));
window.addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });
window.addEventListener('pageshow', event => { if (event.persisted && !dirty) void loadExperience(); });

await loadExperience();
