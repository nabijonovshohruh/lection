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

// YouTube/Vimeo havolalari <iframe> orqali, boshqa (fayl/Telegram) havolalar
// native <video> orqali ko'rsatiladi. Progress avtomatik kuzatuvi faqat <video>
// uchun ishlaydi — iframe ichidagi pleer holatini JS orqali bilib bo'lmaydi.
function getVideoEmbed(url) {
  if (!url) return null;

  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (youtube) return { type: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}` };

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };

  return { type: 'video', src: url };
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

  const embed = getVideoEmbed(lesson.video_url);

  app.innerHTML = `
    <button id="backBtn" class="link-btn">&larr; Darslar</button>
    <h2>${lesson.title}</h2>
    ${
      embed?.type === 'iframe'
        ? `<iframe width="100%" height="220" src="${embed.src}" frameborder="0" allowfullscreen></iframe>
           <p class="badge">Bu video uchun ko'rish foizi avtomatik kuzatilmaydi</p>`
        : `<video id="player" controls src="${embed?.src || ''}" style="width:100%"></video>`
    }
    <p>${lesson.description || ''}</p>
    ${lesson.resource_url ? `<p><a href="${lesson.resource_url}" target="_blank" rel="noopener">Qo'shimcha material (PDF/resurs)</a></p>` : ''}
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
          .map(
            (l) =>
              `<div class="card" data-id="${l.id}">
                <strong>${l.order_index}. ${l.title}</strong>
                <span class="badge">${l.is_published ? "E'lon qilingan" : 'Qoralama'}</span>
              </div>`
          )
          .join('') || "<p>Darslar yo'q</p>"
      }
    </div>
    <button id="newLessonBtn" class="btn">+ Yangi dars</button>
    <button id="studentsBtn" class="btn">O'quvchilar ro'yxati</button>
  `;

  wireAdminNav();

  app.querySelectorAll('.list .card').forEach((el) => {
    el.addEventListener('click', () => navTo(`#admin/course/${courseId}/lesson/${el.dataset.id}`));
  });
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

  app.innerHTML = `
    ${adminNavBar('courses')}
    <button class="link-btn" data-nav="admin/course/${courseId}">&larr; Kursga qaytish</button>
    <h2>${lesson ? 'Darsni tahrirlash' : 'Yangi dars'}</h2>
    <form id="lessonForm" class="form">
      <input type="text" id="lessonTitle" placeholder="Dars nomi" value="${lesson?.title || ''}" required />
      <textarea id="lessonDescription" placeholder="Tavsif">${lesson?.description || ''}</textarea>
      <input type="text" id="lessonVideoUrl" placeholder="Video havola (YouTube/Vimeo/fayl)" value="${lesson?.video_url || ''}" />
      <input type="text" id="lessonResourceUrl" placeholder="Material havola (PDF/resurs)" value="${lesson?.resource_url || ''}" />
      <input type="number" id="lessonDuration" placeholder="Davomiyligi (daqiqa)" value="${lesson ? Math.round((lesson.duration_seconds || 0) / 60) : ''}" />
      <textarea id="lessonHomework" placeholder="Topshiriq matni">${lesson?.homework_text || ''}</textarea>
      <input type="number" id="lessonOrder" placeholder="Tartib raqami" value="${defaultOrder}" />
      <label><input type="checkbox" id="lessonPublished" ${lesson?.is_published ? 'checked' : ''}/> E'lon qilingan</label>
      <button type="submit" class="btn">Saqlash</button>
      ${lesson ? '<button type="button" id="deleteLessonBtn" class="btn btn-danger">O\'chirish</button>' : ''}
    </form>
  `;

  wireAdminNav();

  document.getElementById('lessonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('lessonTitle').value.trim(),
      description: document.getElementById('lessonDescription').value.trim(),
      video_url: document.getElementById('lessonVideoUrl').value.trim(),
      resource_url: document.getElementById('lessonResourceUrl').value.trim(),
      duration_seconds: Number(document.getElementById('lessonDuration').value || 0) * 60,
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

    <h3>O'quvchi qo'shish</h3>
    <form id="grantForm" class="form">
      <input type="text" id="studentTelegramId" placeholder="O'quvchi Telegram ID" required />
      <button type="submit" class="btn">Kirish berish</button>
    </form>
  `;

  wireAdminNav();

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

  document.getElementById('grantForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const telegramId = document.getElementById('studentTelegramId').value.trim();
    if (!telegramId) return;

    const users = await apiRequest('/users');
    const student = users.find((u) => String(u.telegram_id) === telegramId);
    if (!student) {
      notify("Bu Telegram ID bo'yicha foydalanuvchi topilmadi. U avval botda /start bosishi kerak.");
      return;
    }

    await apiRequest('/enrollments', {
      method: 'POST',
      body: JSON.stringify({ user_id: student.id, course_id: Number(courseId) }),
    });
    renderAdminCourseStudents(courseId);
  });
}

async function renderAdminStudents() {
  const students = await apiRequest('/users?role=student');

  app.innerHTML = `
    ${adminNavBar('students')}
    <h2>O'quvchilar</h2>
    <div class="list">
      ${
        students
          .map(
            (s) =>
              `<div class="card" data-id="${s.id}">
                <strong>${s.full_name}</strong>
                <span class="badge">${s.username ? '@' + s.username : s.telegram_id}</span>
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
}

async function renderAdminStudentDetail(userId) {
  const student = await apiRequest(`/users/${userId}`);

  app.innerHTML = `
    ${adminNavBar('students')}
    <button class="link-btn" data-nav="admin/students">&larr; O'quvchilar</button>
    <h2>${student.full_name}</h2>
    <p class="badge">${student.username ? '@' + student.username : student.telegram_id} · ${student.phone || "telefon yo'q"}</p>
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
    const user = await ensureUser();
    const defaultHash = user.role === 'admin' ? '#admin' : '#courses';
    const parts = (window.location.hash || defaultHash).slice(1).split('/');

    if (user.role === 'admin' && parts[0] === 'admin') {
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
