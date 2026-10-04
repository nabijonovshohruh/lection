import { apiRequest } from './api.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const app = document.getElementById('app');
let me = null;

async function ensureUser() {
  if (!me) {
    me = await apiRequest('/users/me');
  }
  return me;
}

function navTo(hash) {
  window.location.hash = hash;
}

async function renderCourses() {
  const courses = await apiRequest('/courses');

  app.innerHTML = `
    <h2>Mening kurslarim</h2>
    <div class="list">
      ${
        courses
          .map(
            (c) =>
              `<div class="card" data-id="${c.id}"><strong>${c.name}</strong><span class="badge">${c.status}</span></div>`
          )
          .join('') || '<p>Kurslar topilmadi</p>'
      }
    </div>
    <button id="warningsBtn" class="link-btn">Ogohlantirishlarim</button>
  `;

  app.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => navTo(`#course/${el.dataset.id}`));
  });
  document.getElementById('warningsBtn').addEventListener('click', () => navTo('#warnings'));
}

async function renderLessons(courseId) {
  const [lessons, progress] = await Promise.all([
    apiRequest(`/lessons/course/${courseId}`),
    apiRequest(`/progress/course/${courseId}`).catch(() => []),
  ]);

  const progressByLesson = new Map(progress.map((p) => [String(p.lesson_id), p]));

  app.innerHTML = `
    <button id="backBtn" class="link-btn">&larr; Kurslar</button>
    <h2>Darslar</h2>
    <div class="list">
      ${
        lessons
          .map((l) => {
            const p = progressByLesson.get(String(l.id));
            const percent = p ? Number(p.watch_percent).toFixed(0) : 0;
            return `<div class="card" data-id="${l.id}">
              <strong>${l.order_index}. ${l.title}</strong>
              <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
              <span class="badge">${percent}%${p?.is_completed ? ' ✅' : ''}</span>
            </div>`;
          })
          .join('') || '<p>Darslar topilmadi</p>'
      }
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => navTo('#courses'));
  app.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => navTo(`#lesson/${el.dataset.id}`));
  });
}

function renderHomeworkStatus(submission) {
  if (!submission) return '<p class="badge">Hali topshirilmagan</p>';

  const labels = { pending: "Ko'rib chiqilmoqda", approved: 'Tasdiqlandi ✅', rejected: 'Qaytarildi ❌' };
  const comment =
    submission.status === 'rejected' && submission.mentor_comment
      ? `<p>Izoh: ${submission.mentor_comment}</p>`
      : '';

  return `<p class="badge">${labels[submission.status]}</p>${comment}`;
}

async function renderLesson(lessonId) {
  const [lesson, progress, submission] = await Promise.all([
    apiRequest(`/lessons/${lessonId}`),
    apiRequest(`/progress/lesson/${lessonId}`),
    apiRequest(`/homework/lesson/${lessonId}/mine`).catch(() => null),
  ]);

  app.innerHTML = `
    <button id="backBtn" class="link-btn">&larr; Darslar</button>
    <h2>${lesson.title}</h2>
    <video id="player" controls src="${lesson.video_url || ''}" style="width:100%"></video>
    <p>${lesson.description || ''}</p>
    ${
      lesson.homework_text
        ? `<h3>Topshiriq</h3>
           <p>${lesson.homework_text}</p>
           <div id="homeworkSection">
             ${renderHomeworkStatus(submission)}
             <textarea id="homeworkInput" rows="4" placeholder="Javobingizni yozing..." style="width:100%;box-sizing:border-box">${
               submission?.content || ''
             }</textarea>
             <button id="homeworkSubmitBtn" class="link-btn">Topshirish</button>
           </div>`
        : ''
    }
  `;

  document
    .getElementById('backBtn')
    .addEventListener('click', () => navTo(`#course/${lesson.course_id}`));

  const homeworkBtn = document.getElementById('homeworkSubmitBtn');
  if (homeworkBtn) {
    homeworkBtn.addEventListener('click', async () => {
      const content = document.getElementById('homeworkInput').value.trim();
      if (!content) return;

      await apiRequest(`/homework/lesson/${lessonId}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      renderLesson(lessonId);
    });
  }

  const video = document.getElementById('player');
  let maxWatched = progress.max_watched_seconds || 0;
  video.currentTime = maxWatched;

  let lastSent = 0;
  const sendProgress = (position) => {
    apiRequest(`/progress/lesson/${lessonId}`, {
      method: 'POST',
      body: JSON.stringify({ position_seconds: Math.floor(position) }),
    }).catch(() => {});
  };

  video.addEventListener('timeupdate', () => {
    if (video.currentTime > maxWatched) {
      maxWatched = video.currentTime;
    }
    if (video.currentTime - lastSent >= 5) {
      lastSent = video.currentTime;
      sendProgress(video.currentTime);
    }
  });

  // Oldinga sakrab o'tkazib yuborishga (seek) yo'l qo'ymaslik, +5s bufer bilan
  video.addEventListener('seeking', () => {
    if (video.currentTime > maxWatched + 5) {
      video.currentTime = maxWatched;
    }
  });

  video.addEventListener('ended', () => sendProgress(video.duration));
}

async function renderWarnings() {
  const user = await ensureUser();
  const warnings = await apiRequest(`/warnings/user/${user.id}`);

  app.innerHTML = `
    <button id="backBtn" class="link-btn">&larr; Kurslar</button>
    <h2>Ogohlantirishlarim</h2>
    <div class="list">
      ${
        warnings
          .map((w) => `<div class="card"><strong>${w.warning_number}/4</strong><p>${w.reason}</p></div>`)
          .join('') || "<p>Ogohlantirishlar yo'q</p>"
      }
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => navTo('#courses'));
}

async function router() {
  try {
    await ensureUser();
    const [page, id] = (window.location.hash || '#courses').slice(1).split('/');

    if (page === 'course' && id) return renderLessons(id);
    if (page === 'lesson' && id) return renderLesson(id);
    if (page === 'warnings') return renderWarnings();
    return renderCourses();
  } catch (err) {
    app.innerHTML = `<p>Xatolik: ${err.message}</p>`;
  }
}

window.addEventListener('hashchange', router);
router();
