const form = document.querySelector('#registration');
const account = document.querySelector('#account');
const courses = document.querySelector('#courses');
const status = document.querySelector('#status');
const submit = document.querySelector('#submit-account');
const switchMode = document.querySelector('#switch-mode');
const studentName = form.elements.student_name;
let register = true;

async function request(path, data) {
  const options = data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {};
  const response = await fetch(`/api/quest/v1/${path}`, { cache: 'no-store', ...options });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const error = new Error(payload.error || '暂时无法处理，请稍后重试。');
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload.data;
}

function drawCourses(data) {
  status.textContent = '';
  account.hidden = true;
  courses.hidden = false;
  document.querySelector('#student-greeting').textContent = `${data.student_name}，你好。`;
  const options = document.querySelector('#course-options');
  options.replaceChildren();
  if (!data.courses.length) {
    options.textContent = '目前没有开放的体验课。';
    return;
  }
  for (const course of data.courses) {
    const article = document.createElement('article');
    article.className = 'course-option';
    const photo = document.createElement('img');
    photo.src = '/art/eq-night-lab-v2.webp';
    photo.alt = '';
    photo.width = 1672;
    photo.height = 941;
    const copy = document.createElement('div');
    copy.className = 'course-copy';
    const heading = document.createElement('h3');
    heading.textContent = course.name;
    const description = document.createElement('p');
    description.textContent = course.description;
    const start = document.createElement('button');
    start.type = 'button';
    start.textContent = data.selected === course.id ? '继续体验' : '开始体验';
    start.addEventListener('click', async () => {
      start.disabled = true;
      status.textContent = '';
      try {
        await request('courses', { course_id: course.id });
        location.assign('/experience.html');
      } catch (error) {
        status.textContent = error.message;
        start.disabled = false;
      }
    });
    copy.append(heading, description, start);
    article.append(photo, copy);
    options.append(article);
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  const data = Object.fromEntries(new FormData(form));
  submit.disabled = true;
  switchMode.disabled = true;
  status.textContent = '';
  try {
    const { notice, ...profileFields } = data;
    const profile = await request(register ? 'registration' : 'student-login', { ...profileFields, notice_version: notice });
    form.reset();
    drawCourses(profile);
  } catch (error) {
    if (error.code === 'school_grade_required') {
      showSchoolGradeFields(true);
      form.elements.school.focus();
    }
    status.textContent = error.message;
  } finally {
    switchMode.disabled = false;
    submit.disabled = false;
  }
});

function showSchoolGradeFields(visible) {
  for (const field of form.querySelectorAll('[data-school-grade]')) {
    field.hidden = !visible;
    field.querySelector('input').disabled = !visible;
  }
}

function showAccount(isRegister, name = '') {
  register = isRegister;
  courses.hidden = true;
  account.hidden = false;
  form.reset();
  studentName.value = name;
  document.querySelector('#mode-title').textContent = register ? '注册体验平台' : '登录体验平台';
  submit.textContent = register ? '注册并选课' : '登录并选课';
  form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
  const notice = form.elements.notice;
  notice.closest('label').hidden = !register;
  notice.disabled = !register;
  showSchoolGradeFields(register);
  switchMode.textContent = register ? '已有账号？登录' : '没有账号？注册';
  status.textContent = '';
}

switchMode.addEventListener('click', () => showAccount(!register, studentName.value));
document.querySelector('#switch-student').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  try {
    await request('student-logout', {});
    showAccount(false);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    document.querySelector('#switch-student').disabled = false;
  }
});

try {
  const profile = await request('courses');
  if (profile.registered) drawCourses(profile);
  else showAccount(true, profile.student_name);
} catch (error) {
  if (error.status === 401) showAccount(true);
  else status.textContent = error.message;
}
