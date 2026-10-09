import { apiRequest } from './api.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const app = document.getElementById('app');
let me = null;

// Qasddan keshlanmaydi: Telegram WebView ko'pincha JS kontekstini ochiq
// saqlab qoladi (sessiya davomida "qayta ochish" aslida sovuq qayta
// yuklanmasligi mumkin), shuning uchun agar bir marta "student" keshlansa,
// server tomonda rol tuzatilgandan keyin ham eski qiymat ko'rsatiladi.
// Har bir navigatsiyada /users/me'ni yangidan so'raymiz.
async function ensureUser() {
  me = await apiRequest('/users/me');
  return me;
}

function navTo(hash) {
  window.location.hash = hash;
}

function confirmAction(message) {
  return new Promise((resolve) => {
    if (tg?.showConfirm) {
      tg.showConfirm(message, (ok) => resolve(ok));
    } else {
      resolve(window.confirm(message));
    }
  });
}

function notify(message) {
  if (tg?.showAlert) tg.showAlert(message);
  else window.alert(message);
}

function openModal(contentHtml) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box">${contentHtml}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
}

// Kurs ichida talaba Ism-familiyasi bo'yicha qidirib, bir bosishda
// tanlangan kursga biriktirish uchun qidiruv modali.
function openAddStudentModal(courseId, onAdded) {
  openModal(`
    <div class="modal-header">
      <h3>O'quvchi qo'shish</h3>
      <button id="modalCloseBtn" class="link-btn" type="button">&times;</button>
    </div>
    <input type="text" id="studentSearchInput" placeholder="Ism-familiya bo'yicha qidiring..." autocomplete="off" />
    <div id="studentSearchResults" class="list"></div>
  `);

  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

  const input = document.getElementById('studentSearchInput');
  const results = document.getElementById('studentSearchResults');
  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    if (query.length < 2) {
      results.innerHTML = '<p class="badge">Kamida 2 ta harf kiriting</p>';
      return;
    }

    debounceTimer = setTimeout(async () => {
      const students = await apiRequest(`/users?role=student&search=${encodeURIComponent(query)}`);

      results.innerHTML =
        students
          .map(
            (s) =>
              `<div class="card" data-id="${s.id}">
                <strong>${s.full_name}</strong>
                <span class="badge">${s.username ? '@' + s.username : s.telegram_id}</span>
              </div>`
          )
          .join('') || "<p>Hech kim topilmadi</p>";

      results.querySelectorAll('.card').forEach((el) => {
        el.addEventListener('click', async () => {
          await apiRequest('/enrollments', {
            method: 'POST',
            body: JSON.stringify({ user_id: Number(el.dataset.id), course_id: Number(courseId) }),
          });
          closeModal();
          onAdded?.();
        });
      });
    }, 300);
  });

  input.focus();
}

function wireAdminNav() {
  app.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => navTo(`#${el.dataset.nav}`));
  });
}

function adminNavBar(active) {
  return `
    <div class="admin-nav">
      <button class="tab-btn ${active === 'courses' ? 'active' : ''}" data-nav="admin">Kurslar</button>
      <button class="tab-btn ${active === 'students' ? 'active' : ''}" data-nav="admin/students">O'quvchilar</button>
    </div>
  `;
}

const LESSON_TYPE_LABELS = { lecture: 'Leksiya', seminar: 'Seminar', review: 'Takrorlash' };
const LESSON_TYPE_ICONS = { lecture: '🎥', seminar: '💬', review: '🔁' };

// Postgres DATE ustuni JSON orqali "2026-10-08T00:00:00.000Z" shaklida keladi —
// shuni qisqa, o'qish uchun qulay formatga o'giradi.
function formatScheduledDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
}

// YouTube havolalari IFrame Player API orqali (progress/anti-skip kuzatuvi bilan),
// Vimeo oddiy <iframe> orqali (kuzatuvsiz), boshqa (fayl/Telegram) havolalar
// native <video> orqali (timeupdate/seeking asosida kuzatuv bilan) ko'rsatiladi.
function getVideoEmbed(url) {
  if (!url) return null;

  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (youtube) return { type: 'youtube', videoId: youtube[1] };

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };

  return { type: 'video', src: url };
}

// YouTube IFrame Player API skripti faqat kerak bo'lganda (birinchi YouTube
// darsi ochilganda) bir marta yuklanadi.
let youtubeApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

// Darsdan chiqishda (navigatsiya yoki qayta render) eski pleerning fon
// so'rovlarini (seek-nazorati uchun polling) to'xtatish — aks holda ko'rinmas
// pleer uchun tozalanmagan interval abadiy ishlab, keraksiz so'rov yuboraveradi.
let activeYoutubePoll = null;
function clearYoutubePoll() {
  if (activeYoutubePoll) {
    clearInterval(activeYoutubePoll);
    activeYoutubePoll = null;
  }
}

async function goToNextLesson(courseId, currentLessonId) {
  try {
    const lessons = await apiRequest(`/lessons/course/${courseId}`);
    const sorted = lessons.slice().sort((a, b) => a.order_index - b.order_index);
    const currentIndex = sorted.findIndex((l) => l.id === currentLessonId);
    const next = currentIndex >= 0 ? sorted[currentIndex + 1] : null;

    navTo(next ? `#lesson/${next.id}` : `#course/${courseId}`);
  } catch {
    navTo(`#course/${courseId}`);
  }
}

// YouTube pleerida HTML5 <video>'dagidek tabiiy "seeking" hodisasi yo'q,
// shuning uchun joriy vaqtni har soniyada so'rab, oldinga keskin sakrashni
// (+5s bufer) qo'lda aniqlab, player.seekTo() bilan orqaga qaytaramiz.
// Progress har 3s haqiqiy ilgarilashda serverga yuboriladi (backend'ning
// +5s anti-skip bufer bilan yaxshi mos kelishi uchun ozroq qilib olingan),
// video ENDED bo'lganda esa darhol "Bajarildi" deb belgilanadi va keyingi
// darsga o'tiladi.
async function setupYouTubePlayer(videoId, lessonId, lesson, progress) {
  // Agar shu funksiya qayta chaqirilsa (masalan, uy vazifasi topshirilgach
  // renderLesson() o'sha darsni qayta chizsa), avvalgi pleerning polling
  // interval'i darhol to'xtatiladi — yangi pleer tayyor bo'lishini kutmasdan.
  clearYoutubePoll();

  const YT = await loadYouTubeApi();

  let maxWatched = progress.max_watched_seconds || 0;
  let lastReported = maxWatched;
  let ended = false;

  const sendProgress = (position) =>
    apiRequest(`/progress/lesson/${lessonId}`, {
      method: 'POST',
      body: JSON.stringify({ position_seconds: Math.floor(position) }),
    }).catch(() => {});

  new YT.Player('ytPlayer', {
    videoId,
    playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onReady(event) {
        if (maxWatched > 0) {
          event.target.seekTo(maxWatched, true);
        }

        clearYoutubePoll();
        activeYoutubePoll = setInterval(() => {
          if (ended) return;

          const current = event.target.getCurrentTime();

          // Oldinga sakrab o'tkazib yuborishni cheklash
          if (current > maxWatched + 5) {
            event.target.seekTo(maxWatched, true);
            return;
          }

          if (current > maxWatched) {
            maxWatched = current;
          }
          if (current - lastReported >= 3) {
            lastReported = current;
            sendProgress(current);
          }
        }, 1000);
      },
      async onStateChange(event) {
        if (event.data !== YT.PlayerState.ENDED || ended) return;

        ended = true;
        clearYoutubePoll();
        await sendProgress(event.target.getDuration());
        goToNextLesson(lesson.course_id, lesson.id);
      },
    },
  });
}

/* ---------------- Talaba sahifalari ---------------- */

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
            const icon = LESSON_TYPE_ICONS[l.type] || LESSON_TYPE_ICONS.lecture;
            const dateLabel = formatScheduledDate(l.scheduled_date);

            if (l.type === 'seminar' || l.type === 'review') {
              const typeLabel = LESSON_TYPE_LABELS[l.type];
              const timeLabel = l.start_time ? ` · ${l.start_time}${l.end_time ? '–' + l.end_time : ''}` : '';
              return `<div class="card" data-id="${l.id}">
                <strong>${l.order_index}. ${icon} ${l.title}</strong>
                <span class="badge">${typeLabel}${dateLabel ? ' · ' + dateLabel : ''}${timeLabel}</span>
              </div>`;
            }

            const p = progressByLesson.get(String(l.id));
            const percent = p ? Number(p.watch_percent).toFixed(0) : 0;
            return `<div class="card" data-id="${l.id}">
              <strong>${l.order_index}. ${icon} ${l.title}</strong>
              <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
              <span class="badge">${percent}%${p?.is_completed ? ' ✅' : ''}${dateLabel ? ' · ' + dateLabel : ''}</span>
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

function renderHomeworkSection(homeworkText, submission) {
  if (!homeworkText) return '';
  return `<h3>Topshiriq</h3>
     <p>${homeworkText}</p>
     <div id="homeworkSection">
       ${renderHomeworkStatus(submission)}
       <textarea id="homeworkInput" rows="4" placeholder="Javobingizni yozing..." style="width:100%;box-sizing:border-box">${
         submission?.content || ''
       }</textarea>
       <button id="homeworkSubmitBtn" class="link-btn">Topshirish</button>
     </div>`;
}

function wireHomeworkForm(lessonId) {
  const homeworkBtn = document.getElementById('homeworkSubmitBtn');
  if (!homeworkBtn) return;

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

// SEMINAR/REVIEW darslarida video yo'q — kuzatiladigan progress ham yo'q,
// shuning uchun bu turlar uchun alohida, maxsus kartochka ko'rsatiladi.
function renderSeminarOrReviewLesson(lesson, submission) {
  const isSeminar = lesson.type === 'seminar';
  const icon = LESSON_TYPE_ICONS[lesson.type];
  const dateLabel = formatScheduledDate(lesson.scheduled_date);
  const timeLabel = lesson.start_time ? `${lesson.start_time}${lesson.end_time ? ' – ' + lesson.end_time : ''}` : '';

  app.innerHTML = `
    <button id="backBtn" class="link-btn">&larr; Darslar</button>
    <h2>${icon} ${lesson.title}</h2>
    <div class="card">
      <strong>${isSeminar ? 'Seminar darsi' : 'Takrorlash kuni'}</strong>
      ${dateLabel || timeLabel ? `<span class="badge">${[dateLabel, timeLabel].filter(Boolean).join(' · ')}</span>` : ''}
      ${isSeminar && lesson.mentor_name ? `<p>Mentor: <strong>${lesson.mentor_name}</strong></p>` : ''}
      ${isSeminar && lesson.topics ? `<p>Mavzular: ${lesson.topics}</p>` : ''}
      ${lesson.description ? `<p>${lesson.description}</p>` : ''}
    </div>
    ${lesson.resource_url ? `<p><a href="${lesson.resource_url}" target="_blank" rel="noopener">Qo'shimcha material (PDF/resurs)</a></p>` : ''}
    ${renderHomeworkSection(lesson.homework_text, submission)}
  `;

  document
    .getElementById('backBtn')
    .addEventListener('click', () => navTo(`#course/${lesson.course_id}`));

  wireHomeworkForm(lesson.id);
}

async function renderLesson(lessonId) {
  const lesson = await apiRequest(`/lessons/${lessonId}`);

  const [progress, submission] = await Promise.all([
    lesson.type === 'lecture' ? apiRequest(`/progress/lesson/${lessonId}`) : Promise.resolve(null),
    apiRequest(`/homework/lesson/${lessonId}/mine`).catch(() => null),
  ]);

  if (lesson.type !== 'lecture') {
    return renderSeminarOrReviewLesson(lesson, submission);
  }

  const embed = getVideoEmbed(lesson.video_url);

  app.innerHTML = `
    <button id="backBtn" class="link-btn">&larr; Darslar</button>
    <h2>${lesson.title}</h2>
    ${
      embed?.type === 'youtube'
        ? `<div id="ytPlayer"></div>`
        : embed?.type === 'iframe'
          ? `<iframe width="100%" height="220" src="${embed.src}" frameborder="0" allowfullscreen></iframe>
             <p class="badge">Bu video uchun ko'rish foizi avtomatik kuzatilmaydi</p>`
          : `<video id="player" controls src="${embed?.src || ''}" style="width:100%"></video>`
    }
    <p>${lesson.description || ''}</p>
    ${lesson.resource_url ? `<p><a href="${lesson.resource_url}" target="_blank" rel="noopener">Qo'shimcha material (PDF/resurs)</a></p>` : ''}
    ${renderHomeworkSection(lesson.homework_text, submission)}
  `;

  document
    .getElementById('backBtn')
    .addEventListener('click', () => navTo(`#course/${lesson.course_id}`));

  wireHomeworkForm(lessonId);

  if (embed?.type === 'youtube') {
    setupYouTubePlayer(embed.videoId, lessonId, lesson, progress);
    return;
  }

  const video = document.getElementById('player');
  if (video) {
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

/* ---------------- Admin sahifalari ---------------- */

async function renderAdminHome() {
  const courses = await apiRequest('/courses');

  app.innerHTML = `
    ${adminNavBar('courses')}
    <h2>Kurslar</h2>
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
    <button id="newCourseBtn" class="btn">+ Yangi kurs</button>
    <form id="newCourseForm" class="form hidden">
      <input type="text" id="courseName" placeholder="Kurs nomi" required />
      <label>Boshlanish sanasi<input type="date" id="courseStart" /></label>
      <label>Tugash sanasi<input type="date" id="courseEnd" /></label>
      <button type="submit" class="btn">Yaratish</button>
    </form>
  `;

  wireAdminNav();

  app.querySelectorAll('.list .card').forEach((el) => {
    el.addEventListener('click', () => navTo(`#admin/course/${el.dataset.id}`));
  });

  document.getElementById('newCourseBtn').addEventListener('click', () => {
    document.getElementById('newCourseForm').classList.toggle('hidden');
  });

  document.getElementById('newCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('courseName').value.trim();
    if (!name) return;

    await apiRequest('/courses', {
      method: 'POST',
      body: JSON.stringify({
        name,
        start_date: document.getElementById('courseStart').value,
        end_date: document.getElementById('courseEnd').value,
      }),
    });
    renderAdminHome();
  });
}

async function renderAdminCourseDetail(courseId) {
  const [course, lessons] = await Promise.all([
    apiRequest(`/courses/${courseId}`),
    apiRequest(`/lessons/course/${courseId}`),
  ]);

  app.innerHTML = `
    ${adminNavBar('courses')}
    <button class="link-btn" data-nav="admin">&larr; Kurslar</button>
    <h2>${course.name}</h2>
    <form id="courseForm" class="form">
      <input type="text" id="courseName" value="${course.name}" placeholder="Kurs nomi" />
      <textarea id="courseDescription" placeholder="Tavsif">${course.description || ''}</textarea>
      <select id="courseStatus">
        ${['upcoming', 'active', 'completed', 'archived']
          .map((s) => `<option value="${s}" ${s === course.status ? 'selected' : ''}>${s}</option>`)
          .join('')}
      </select>
      <button type="submit" class="btn">Saqlash</button>
      <button type="button" id="deleteCourseBtn" class="btn btn-danger">Kursni o'chirish</button>
    </form>

    <h3>Darslar</h3>
    <div class="list">
      ${
        lessons
          .map((l) => {
            const icon = LESSON_TYPE_ICONS[l.type] || LESSON_TYPE_ICONS.lecture;
            const dateLabel = formatScheduledDate(l.scheduled_date);
            return `<div class="card" data-id="${l.id}">
              <strong>${l.order_index}. ${icon} ${l.title}</strong>
              <span class="badge">${LESSON_TYPE_LABELS[l.type] || LESSON_TYPE_LABELS.lecture} · ${l.is_published ? "e'lon qilingan" : 'qoralama'}${dateLabel ? ' · ' + dateLabel : ''}</span>
            </div>`;
          })
          .join('') || "<p>Darslar yo'q</p>"
      }
    </div>
    <button id="newLessonBtn" class="btn">+ Yangi dars</button>
    <button id="studentsBtn" class="btn">O'quvchilar ro'yxati</button>
    <button id="addStudentBtn" class="btn">O'quvchi qo'shish</button>
  `;

  wireAdminNav();

  app.querySelectorAll('.list .card').forEach((el) => {
    el.addEventListener('click', () => navTo(`#admin/course/${courseId}/lesson/${el.dataset.id}`));
  });
  document
    .getElementById('addStudentBtn')
    .addEventListener('click', () => openAddStudentModal(courseId, () => renderAdminCourseDetail(courseId)));
  document
    .getElementById('newLessonBtn')
    .addEventListener('click', () => navTo(`#admin/course/${courseId}/lesson/new`));
  document
    .getElementById('studentsBtn')
    .addEventListener('click', () => navTo(`#admin/course/${courseId}/students`));

  document.getElementById('courseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await apiRequest(`/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: document.getElementById('courseName').value.trim(),
        description: document.getElementById('courseDescription').value.trim(),
        status: document.getElementById('courseStatus').value,
      }),
    });
    renderAdminCourseDetail(courseId);
  });

  document.getElementById('deleteCourseBtn').addEventListener('click', async () => {
    const ok = await confirmAction(
      "Kursni butunlay o'chirmoqchimisiz? Barcha darslar, guruhlar va yozilishlar ham o'chadi."
    );
    if (!ok) return;

    await apiRequest(`/courses/${courseId}`, { method: 'DELETE' });
    navTo('#admin');
  });
}

async function renderAdminLessonForm(courseId, lessonId) {
  const lesson = lessonId ? await apiRequest(`/lessons/${lessonId}`) : null;
  const existingLessons = lesson ? [] : await apiRequest(`/lessons/course/${courseId}`);
  const defaultOrder = lesson ? lesson.order_index : existingLessons.length + 1;
  const lessonType = lesson?.type || 'lecture';

  app.innerHTML = `
    ${adminNavBar('courses')}
    <button class="link-btn" data-nav="admin/course/${courseId}">&larr; Kursga qaytish</button>
    <h2>${lesson ? 'Darsni tahrirlash' : 'Yangi dars'}</h2>
    <form id="lessonForm" class="form">
      <input type="text" id="lessonTitle" placeholder="Dars nomi" value="${lesson?.title || ''}" required />
      <select id="lessonType">
        ${Object.entries(LESSON_TYPE_LABELS)
          .map(([value, label]) => `<option value="${value}" ${value === lessonType ? 'selected' : ''}>${label}</option>`)
          .join('')}
      </select>
      <label>Sana<input type="date" id="lessonScheduledDate" value="${lesson?.scheduled_date?.slice(0, 10) || ''}" /></label>

      <div id="lectureFields" class="form-group">
        <textarea id="lessonDescription" placeholder="Tavsif">${lesson?.description || ''}</textarea>
        <input type="text" id="lessonVideoUrl" placeholder="Video havola (YouTube/Vimeo/fayl)" value="${lesson?.video_url || ''}" />
        <input type="text" id="lessonResourceUrl" placeholder="Material havola (PDF/resurs)" value="${lesson?.resource_url || ''}" />
        <input type="number" id="lessonDuration" placeholder="Davomiyligi (daqiqa)" value="${lesson ? Math.round((lesson.duration_seconds || 0) / 60) : ''}" />
      </div>

      <div id="seminarFields" class="form-group">
        <input type="text" id="lessonMentorName" placeholder="Seminarni kim o'tkazadi" value="${lesson?.mentor_name || ''}" />
        <textarea id="lessonTopics" placeholder="Savol-javob qilinadigan mavzular">${lesson?.topics || ''}</textarea>
        <label>Boshlanish vaqti<input type="text" id="lessonStartTime" placeholder="19:00" value="${lesson?.start_time || ''}" /></label>
        <label>Tugash vaqti<input type="text" id="lessonEndTime" placeholder="20:30" value="${lesson?.end_time || ''}" /></label>
      </div>

      <textarea id="lessonHomework" placeholder="Topshiriq matni">${lesson?.homework_text || ''}</textarea>
      <input type="number" id="lessonOrder" placeholder="Tartib raqami" value="${defaultOrder}" />
      <label><input type="checkbox" id="lessonPublished" ${lesson?.is_published ? 'checked' : ''}/> E'lon qilingan</label>
      <button type="submit" class="btn">Saqlash</button>
      ${lesson ? '<button type="button" id="deleteLessonBtn" class="btn btn-danger">O\'chirish</button>' : ''}
    </form>
  `;

  wireAdminNav();

  const typeSelect = document.getElementById('lessonType');
  const lectureFields = document.getElementById('lectureFields');
  const seminarFields = document.getElementById('seminarFields');

  const syncFieldVisibility = () => {
    const isSeminar = typeSelect.value === 'seminar';
    seminarFields.classList.toggle('hidden', !isSeminar);
    lectureFields.classList.toggle('hidden', isSeminar);
  };
  syncFieldVisibility();
  typeSelect.addEventListener('change', syncFieldVisibility);

  document.getElementById('lessonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('lessonTitle').value.trim(),
      type: typeSelect.value,
      scheduled_date: document.getElementById('lessonScheduledDate').value,
      description: document.getElementById('lessonDescription').value.trim(),
      video_url: document.getElementById('lessonVideoUrl').value.trim(),
      resource_url: document.getElementById('lessonResourceUrl').value.trim(),
      duration_seconds: Number(document.getElementById('lessonDuration').value || 0) * 60,
      mentor_name: document.getElementById('lessonMentorName').value.trim(),
      topics: document.getElementById('lessonTopics').value.trim(),
      start_time: document.getElementById('lessonStartTime').value.trim(),
      end_time: document.getElementById('lessonEndTime').value.trim(),
      homework_text: document.getElementById('lessonHomework').value.trim(),
      order_index: Number(document.getElementById('lessonOrder').value || defaultOrder),
      is_published: document.getElementById('lessonPublished').checked,
    };

    if (lesson) {
      await apiRequest(`/lessons/${lesson.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await apiRequest('/lessons', {
        method: 'POST',
        body: JSON.stringify({ ...payload, course_id: Number(courseId) }),
      });
    }
    navTo(`#admin/course/${courseId}`);
  });

  const deleteBtn = document.getElementById('deleteLessonBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmAction("Darsni o'chirmoqchimisiz?");
      if (!ok) return;

      await apiRequest(`/lessons/${lesson.id}`, { method: 'DELETE' });
      navTo(`#admin/course/${courseId}`);
    });
  }
}

async function renderAdminCourseStudents(courseId) {
  const [enrollments, progress] = await Promise.all([
    apiRequest(`/enrollments/course/${courseId}`),
    apiRequest(`/progress/course/${courseId}`).catch(() => []),
  ]);
  const progressByUser = new Map(progress.map((p) => [String(p.user_id), p]));

  app.innerHTML = `
    ${adminNavBar('courses')}
    <button class="link-btn" data-nav="admin/course/${courseId}">&larr; Kursga qaytish</button>
    <h2>O'quvchilar</h2>
    <div class="list">
      ${
        enrollments
          .map((e) => {
            const p = progressByUser.get(String(e.user_id));
            const stats = p ? `${p.completed_lessons}/${p.total_lessons} dars` : '';
            return `<div class="card">
              <strong>${e.full_name}</strong>
              <span class="badge">${e.group_name || 'guruhsiz'} · ${e.status}${stats ? ' · ' + stats : ''}</span>
              ${
                e.status === 'active'
                  ? `<button class="btn btn-danger" data-revoke="${e.user_id}">Kirishni bekor qilish</button>`
                  : `<button class="btn" data-grant="${e.user_id}">Kirishni qaytarish</button>`
              }
            </div>`;
          })
          .join('') || "<p>Hali hech kim yo'q</p>"
      }
    </div>

    <button id="addStudentBtn" class="btn">O'quvchi qo'shish</button>
  `;

  wireAdminNav();

  document
    .getElementById('addStudentBtn')
    .addEventListener('click', () => openAddStudentModal(courseId, () => renderAdminCourseStudents(courseId)));

  app.querySelectorAll('[data-revoke]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await apiRequest('/enrollments/revoke', {
        method: 'POST',
        body: JSON.stringify({ user_id: Number(btn.dataset.revoke), course_id: Number(courseId) }),
      });
      renderAdminCourseStudents(courseId);
    });
  });

  app.querySelectorAll('[data-grant]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await apiRequest('/enrollments', {
        method: 'POST',
        body: JSON.stringify({ user_id: Number(btn.dataset.grant), course_id: Number(courseId) }),
      });
      renderAdminCourseStudents(courseId);
    });
  });
}

// Qidiruv bo'sh bo'lsa — faqat studentlar (sahifa nomiga mos standart ko'rinish);
// qidiruv yozilsa — barcha rollar bo'yicha (shu jumladan avval admin qilingan
// seminaristlarni ham topib, kerak bo'lsa qayta studentga qaytarish uchun).
async function renderAdminStudents(query) {
  const students = query
    ? await apiRequest(`/users?search=${encodeURIComponent(query)}`)
    : await apiRequest('/users?role=student');

  app.innerHTML = `
    ${adminNavBar('students')}
    <h2>O'quvchilar</h2>
    <input type="text" id="studentsSearchInput" placeholder="Ism-familiya yoki username bo'yicha qidirish..." value="${query || ''}" autocomplete="off" />
    <div class="list">
      ${
        students
          .map(
            (s) =>
              `<div class="card" data-id="${s.id}">
                <strong>${s.full_name}</strong>
                <span class="badge">${s.username ? '@' + s.username : s.telegram_id}${s.role !== 'student' ? ' · ' + s.role : ''}</span>
              </div>`
          )
          .join('') || "<p>O'quvchilar topilmadi</p>"
      }
    </div>
  `;

  wireAdminNav();
  app.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => navTo(`#admin/student/${el.dataset.id}`));
  });

  const searchInput = document.getElementById('studentsSearchInput');
  let debounceTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderAdminStudents(searchInput.value.trim()), 300);
  });
  searchInput.focus();
  searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
}

function openAssignGroupModal(studentId, onAssigned) {
  apiRequest('/groups').then((groups) => {
    openModal(`
      <div class="modal-header">
        <h3>Guruhga biriktirish</h3>
        <button id="modalCloseBtn" class="link-btn" type="button">&times;</button>
      </div>
      <select id="groupSelect">
        ${
          groups
            .map((g) => `<option value="${g.id}">${g.course_name} — ${g.name} (${g.student_count}/${g.capacity})</option>`)
            .join('') || '<option disabled>Guruhlar topilmadi</option>'
        }
      </select>
      <button id="assignGroupBtn" class="btn">Saqlash</button>
    `);

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

    document.getElementById('assignGroupBtn').addEventListener('click', async () => {
      const groupId = document.getElementById('groupSelect').value;
      if (!groupId) return;

      try {
        await apiRequest(`/groups/${groupId}/students`, {
          method: 'POST',
          body: JSON.stringify({ user_id: Number(studentId) }),
        });
        closeModal();
        onAssigned?.();
      } catch (err) {
        notify(err.message);
      }
    });
  });
}

async function renderAdminStudentDetail(userId) {
  const student = await apiRequest(`/users/${userId}`);
  const isAdmin = student.role === 'admin';

  app.innerHTML = `
    ${adminNavBar('students')}
    <button class="link-btn" data-nav="admin/students">&larr; O'quvchilar</button>
    <h2>${student.full_name}</h2>
    <p class="badge">${student.username ? '@' + student.username : student.telegram_id} · ${student.phone || "telefon yo'q"} · rol: ${student.role}</p>

    <button id="assignGroupBtn" class="btn">Guruhga biriktirish</button>
    <button id="toggleRoleBtn" class="btn ${isAdmin ? 'btn-danger' : ''}">
      ${isAdmin ? "Studentga qaytarish" : 'Admin qilish'}
    </button>

    <h3>Kurslar</h3>
    <div class="list">
      ${
        student.enrollments
          .map(
            (e) =>
              `<div class="card">
                <strong>${e.course_name}</strong>
                <span class="badge">${e.group_name || 'guruhsiz'} · ${e.status}</span>
              </div>`
          )
          .join('') || "<p>Hali hech qaysi kursga yozilmagan</p>"
      }
    </div>
  `;

  wireAdminNav();

  document
    .getElementById('assignGroupBtn')
    .addEventListener('click', () => openAssignGroupModal(userId, () => renderAdminStudentDetail(userId)));

  document.getElementById('toggleRoleBtn').addEventListener('click', async () => {
    const nextRole = isAdmin ? 'student' : 'admin';
    const ok = await confirmAction(
      isAdmin
        ? `${student.full_name}ni studentga qaytarmoqchimisiz?`
        : `${student.full_name}ga admin huquqini bermoqchimisiz?`
    );
    if (!ok) return;

    await apiRequest(`/users/${userId}`, { method: 'PUT', body: JSON.stringify({ role: nextRole }) });
    renderAdminStudentDetail(userId);
  });
}

function routeAdmin(parts) {
  const [section, id, sub, subId] = parts;

  if (!section) return renderAdminHome();
  if (section === 'course' && id && sub === 'lesson') {
    return renderAdminLessonForm(id, subId === 'new' ? null : subId);
  }
  if (section === 'course' && id && sub === 'students') return renderAdminCourseStudents(id);
  if (section === 'course' && id) return renderAdminCourseDetail(id);
  if (section === 'students') return renderAdminStudents();
  if (section === 'student' && id) return renderAdminStudentDetail(id);
  return renderAdminHome();
}

/* ---------------- Router ---------------- */

async function router() {
  try {
    // Har qanday navigatsiyada (orqaga, boshqa darsga o'tish va h.k.) YouTube
    // pleerining fon polling'ini to'xtatamiz, aks holda u ko'rinmas holda
    // ishlab, keraksiz so'rovlar yuboraveradi.
    clearYoutubePoll();
    closeModal();

    const user = await ensureUser();
    const defaultHash = user.role === 'admin' ? '#admin' : '#courses';
    const parts = (window.location.hash || defaultHash).slice(1).split('/');

    // Rol har doim hal qiluvchi: agar WebView avvalgi sessiyadan qolgan eski
    // hash'ni saqlab qolgan bo'lsa (masalan, rol hali "student" bo'lgan
    // paytdagi "#courses"), uni shunchaki e'tiborsiz qoldirmasdan, to'g'ri
    // bo'limga majburan qayta yo'naltiramiz.
    if (user.role === 'admin' && parts[0] !== 'admin') {
      return navTo('#admin');
    }
    if (user.role !== 'admin' && parts[0] === 'admin') {
      return navTo('#courses');
    }

    if (user.role === 'admin') {
      return routeAdmin(parts.slice(1));
    }

    const [page, id] = parts;
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
