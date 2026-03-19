// user.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUserId = null;
let userGrade = null;
let activeSemester = "Ganjil";

export async function initUser() {
    console.log('User Module Initialized');
    currentUserId = auth.currentUser.uid;

    // Set today's date in UI
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const shortDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const todayLabel = document.getElementById('today-date-label');
    if (todayLabel) todayLabel.textContent = dateStr;
    const habitDate = document.getElementById('today-habit-date');
    if (habitDate) habitDate.textContent = shortDate;

    // Fetch User Profile (Grade)
    const userSnap = await getDoc(doc(db, 'users', currentUserId));
    if (userSnap.exists()) {
        userGrade = userSnap.data().grade;
        document.getElementById('hello-name').textContent = userSnap.data().displayName || 'Sobat';
    }

    // Fetch Active Semester
    const configSnap = await getDoc(doc(db, 'config', 'app'));
    if (configSnap.exists()) {
        activeSemester = configSnap.data().activeSemester || 'Ganjil';
    }

    loadFlashNote();
    loadSchedule();
    loadExams();
    loadTasks();
    loadHabits();
    loadContacts();
    loadUserScheduleManager();
    initModals();
}

async function compressImage(base64Str) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
    });
}

// Returns today's date string YYYY-MM-DD
function getTodayDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// Returns Firestore ref for today's daily log
function todayLogRef() {
    return doc(db, 'progress', currentUserId, 'logs', getTodayDate());
}

// Load flash note for current user from admin (stored in users doc)
function loadFlashNote() {
    const noteCard = document.getElementById('flash-note-card');
    const noteText = document.getElementById('flash-note-text');
    if (!noteCard || !noteText) return;

    onSnapshot(doc(db, 'users', currentUserId), (snap) => {
        const note = snap.exists() && snap.data().flashNote;
        if (note) {
            noteText.textContent = note;
            noteCard.classList.remove('hidden');
        } else {
            noteCard.classList.add('hidden');
        }
    });
}

function loadSchedule() {
    const jadwalList = document.getElementById('jadwal-list');
    const ujianList = document.getElementById('ujian-list');
    
    // Get Current Day in Indonesian
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const today = days[new Date().getDay()];
    
    // Set placeholder while loading
    if (jadwalList) jadwalList.innerHTML = '<p class="text-gray-400 text-center py-4">Memuat jadwal...</p>';

    // Fetch from Firestore: Only by Day to avoid Index requirement for 'in' + 'orderBy'
    const q = query(
        collection(db, "schedules"), 
        where("day", "==", today)
    );
    
    onSnapshot(q, (snapshot) => {
        if (jadwalList) {
            // Local filter for Common OR specific User
            const docs = snapshot.docs.filter(d => {
                const data = d.data();
                // If it's my personal schedule, show it
                if (data.userId === currentUserId) return true;
                
                // If it's common (school) schedule, check if it matches my level/grade and current semester
                if (data.userId === 'common') {
                    const gradeMatch = !data.level || data.level === 'Semua' || data.level === userGrade;
                    const semesterMatch = !data.semester || data.semester === activeSemester;
                    return gradeMatch && semesterMatch;
                }
                return false;
            });

            // Sort by time locally
            docs.sort((a, b) => a.data().time.localeCompare(b.data().time));

            if (docs.length === 0) {
                jadwalList.innerHTML = `<p class="text-gray-400 text-center py-4">Tidak ada jadwal untuk hari ${today}.</p>`;
            } else {
                jadwalList.innerHTML = '';
                docs.forEach((docSnap) => {
                const item = docSnap.data();
                const card = document.createElement('div');
                card.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4';
                card.innerHTML = `
                    <div class="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                        <i class="fas ${item.userId === 'common' ? 'fa-school' : 'fa-home'} text-xl"></i>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">${item.time}</div>
                        <div class="font-bold text-indigo-600 cursor-pointer hover:underline" onclick="window.viewSubjectDetail('${item.subject.replace(/'/g, "\\'")}', '${item.teacher.replace(/'/g, "\\'")}')">${item.subject}</div>
                        <div class="text-xs text-gray-500">${item.teacher}</div>
                    </div>
                `;
                jadwalList.appendChild(card);
            });
        }
    }
    });
}

function loadExams() {
    const ujianList = document.getElementById('ujian-list');
    const docRef = doc(db, 'progress', currentUserId);
    
    onSnapshot(docRef, (docSnap) => {
        if (!ujianList) return;
        ujianList.innerHTML = '';
        
        const data = docSnap.data() || {};
        const exams = data.exams || [];

        if (exams.length === 0) {
            ujianList.innerHTML = '<p class="text-gray-400 text-center py-4">Tidak ada ujian mendatang.</p>';
            return;
        }

        // Sort by date
        exams.sort((a,b) => new Date(a.date) - new Date(b.date));

        exams.forEach(exam => {
            const dateObj = new Date(exam.date + 'T00:00:00');
            const day = dateObj.getDate();
            const month = dateObj.toLocaleString('id-ID', { month: 'short' }).toUpperCase();
            const timeLabel = exam.time ? `<span class="font-bold text-yellow-600">⏰ ${exam.time}</span>` : '';
            const notesLabel = exam.notes ? `<div class="text-xs text-gray-400 italic mt-0.5">${exam.notes}</div>` : '';
            
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group';
            card.innerHTML = `
                <div class="bg-yellow-50 text-yellow-600 w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-yellow-100 flex-shrink-0">
                    <div class="text-[10px] font-bold uppercase leading-none">${month}</div>
                    <div class="text-xl font-black leading-none">${day}</div>
                </div>
                <div class="flex-1">
                    <div class="font-bold text-gray-900">${exam.name}</div>
                    <div class="text-xs text-gray-500 flex flex-wrap gap-2 mt-0.5">
                        <span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">${exam.type}</span>
                        ${timeLabel}
                    </div>
                    ${notesLabel}
                </div>
            `;
            ujianList.appendChild(card);
        });
    });
}

async function loadTasks() {
    const tasksList = document.getElementById('tasks-list');
    const q = doc(db, 'progress', currentUserId);

    onSnapshot(q, (docSnap) => {
        if (!docSnap.exists()) {
            initProgressDoc();
            return;
        }
        const data = docSnap.data();
        const tasks = data.tasks || [];
        
        if (tasks.length === 0) {
            tasksList.innerHTML = '<p class="text-gray-400 text-center py-4">Belum ada tugas.</p>';
        } else {
            tasksList.innerHTML = '';
            tasks.forEach((task, index) => {
                const li = document.createElement('li');
                li.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3';
                const givenDate = task.givenDate ? `<span class="text-gray-400">Diberikan: ${task.givenDate}</span>` : '';
                const dueDate = task.dueDate ? `<span class="bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Kumpul: ${task.dueDate}</span>` : '';
                li.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <input type="checkbox" ${task.completed ? 'checked' : ''} 
                                onchange="window.toggleTask(${index})"
                                class="w-6 h-6 rounded-lg text-indigo-600 focus:ring-indigo-500 border-gray-300">
                            <div>
                                <div class="font-bold text-gray-900 ${task.completed ? 'line-through opacity-50' : ''}">${task.title || task.name || '-'}</div>
                                <div class="text-[10px] flex flex-wrap gap-2 mt-1">
                                    <span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">${task.category || ''}</span>
                                    ${givenDate}
                                    ${dueDate}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="pt-2 flex items-center gap-2 border-t border-gray-50 mt-2">
                        <label class="cursor-pointer text-indigo-500 hover:text-indigo-700">
                            <i class="fas fa-camera"></i> <span class="text-[10px] font-bold">BUKTI FOTO</span>
                            <input type="file" accept="image/*" class="hidden" onchange="window.uploadTaskPhoto(${index}, this)">
                        </label>
                        ${task.photo ? `<img src="${task.photo}" class="w-8 h-8 rounded object-cover border" onclick="window.viewImage('${task.photo}')">` : ''}
                    </div>
                `;
                tasksList.appendChild(li);
            });
        }
    });
}

async function loadHabits() {
    const habitsList = document.getElementById('habits-list');
    const today = getTodayDate();
    const logRef = todayLogRef();
    const rootRef = doc(db, 'progress', currentUserId);
    
    const defaultHabits = [
        { name: "Shalat 5 Waktu", type: 'multi', items: [
            { id: "subuh", name: "Subuh", done: false },
            { id: "dzuhur", name: "Dzuhur", done: false },
            { id: "ashar", name: "Ashar", done: false },
            { id: "maghrib", name: "Maghrib", done: false },
            { id: "isya", name: "Isya", done: false }
        ], photo: null, done: false },
        { name: "Membaca Al-Quran", done: false, type: 'note', notes: '', photo: null },
        { name: "Membereskan Rumah", done: false, type: 'normal', photo: null },
        { name: "Mandi & Gosok Gigi", done: false, type: 'normal', photo: null }
    ];

    // Ensure today's log exists
    const todaySnap = await getDoc(logRef);
    if (!todaySnap.exists() || !todaySnap.data().habits) {
        await setDoc(logRef, { habits: defaultHabits, date: today, updatedAt: serverTimestamp() }, { merge: true });
    }

    onSnapshot(logRef, (snap) => {
        if (!habitsList) return;
        habitsList.innerHTML = '';
        if (!snap.exists()) return;
        const data = snap.data();
        const habits = data.habits || defaultHabits;

        habits.forEach((habit, hIdx) => {
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3';
            
            let contentHtml = `<div class="font-bold text-gray-800 flex justify-between items-center">
                <span>${habit.name}</span>
                ${habit.type === 'normal' || !habit.type ? `
                    <input type="checkbox" ${habit.done ? 'checked' : ''} onchange="window.toggleHabit(${hIdx})" class="w-6 h-6 rounded-lg text-indigo-600">
                ` : ''}
            </div>`;

            if (habit.type === 'multi') {
                const doneCount = (habit.items || []).filter(i => i.done).length;
                contentHtml += `
                <p class="text-xs text-indigo-600 font-semibold">${doneCount}/5 Waktu ✅</p>
                <div class="grid grid-cols-5 gap-2 pt-1">
                    ${(habit.items || []).map((item, iIdx) => `
                        <button onclick="window.toggleMultiHabit(${hIdx}, ${iIdx})" 
                            class="p-2 rounded-xl text-[10px] font-bold transition-all border ${item.done ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-indigo-300'}">
                            ${item.name}
                        </button>
                    `).join('')}
                </div>`;
            }

            if (habit.type === 'note') {
                contentHtml += `
                    <div class="flex gap-2 items-start">
                        <textarea placeholder="Ayat yang dibaca (Ex: Al-Baqarah 1-5)" 
                            rows="2"
                            onblur="window.updateHabitNotes(${hIdx}, this.value)"
                            class="flex-1 p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none resize-none">${habit.notes || ''}</textarea>
                        <input type="checkbox" ${habit.done ? 'checked' : ''} onchange="window.toggleHabit(${hIdx})" class="w-6 h-6 rounded-lg text-indigo-600 mt-1">
                    </div>
                `;
            }

            contentHtml += `
                <div class="pt-2 flex items-center gap-2 border-t border-gray-50 mt-2">
                    <label class="cursor-pointer text-indigo-500 hover:text-indigo-700">
                        <i class="fas fa-camera"></i> <span class="text-[10px] font-bold">BUKTI FOTO</span>
                        <input type="file" accept="image/*" class="hidden" onchange="window.uploadHabitPhoto(${hIdx}, this)">
                    </label>
                    ${habit.photo ? `<img src="${habit.photo}" class="w-8 h-8 rounded object-cover border" onclick="window.viewImage('${habit.photo}')">` : ''}
                </div>
            `;

            card.innerHTML = contentHtml;
            habitsList.appendChild(card);
        });
    });
}

function loadContacts() {
    const teachersList = document.getElementById('kontak-guru');
    const friendsList = document.getElementById('kontak-teman');

    // Fetch teachers from DB (contacts collection where type == 'guru')
    onSnapshot(collection(db, "contacts"), (snapshot) => {
        if (!teachersList) return;
        teachersList.innerHTML = '';
        snapshot.forEach(docSnap => {
            const t = docSnap.data();
            if (t.type === 'guru') {
                teachersList.innerHTML += `
                    <div class="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">${t.name[0]}</div>
                            <div>
                                <div class="font-bold text-sm text-gray-800">${t.name}</div>
                                <div class="text-xs text-gray-500">${t.subject}</div>
                            </div>
                        </div>
                        <a href="https://wa.me/${t.phone.replace(/[^0-9]/g, '')}" target="_blank" class="text-green-500 text-xl"><i class="fab fa-whatsapp"></i></a>
                    </div>
                `;
            }
        });
    });

    const friends = [
        { name: 'Andi', role: 'Teman Sekelas' },
        { name: 'Budi', role: 'Teman Sekelas' }
    ];
    if (friendsList) {
        friendsList.innerHTML = friends.map(f => `
            <div class="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">${f.name[0]}</div>
                <div>
                    <div class="font-bold text-sm text-gray-800">${f.name}</div>
                    <div class="text-xs text-gray-500">${f.role}</div>
                </div>
            </div>
        `).join('');
    }
}

async function initProgressDoc() {
    const initialTasks = [
        { title: 'PR Matematika Hal 10', category: 'Tugas Utama', completed: false },
        { title: 'Catatan Biologi', category: 'Catatan', completed: false }
    ];
    const initialHabits = [
        { name: 'Shalat 5 Waktu', completed: false },
        { name: 'Membaca Al-Quran', completed: false },
        { name: 'Membereskan Rumah', completed: false },
        { name: 'Mandi & Gosok Gigi', completed: false }
    ];
    await setDoc(doc(db, 'progress', currentUserId), {
        tasks: initialTasks,
        habits: initialHabits,
        updatedAt: serverTimestamp()
    });
}

window.toggleTask = async (index) => {
    const docRef = todayLogRef();
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const tasks = docSnap.data().tasks || [];
        if (tasks[index]) {
            tasks[index].completed = !tasks[index].completed;
            await setDoc(docRef, { tasks, updatedAt: serverTimestamp() }, { merge: true });
        }
    }
};

window.uploadTaskPhoto = async (index, input) => {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const compressedBase64 = await compressImage(e.target.result);
            const docRef = todayLogRef();
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const tasks = docSnap.data().tasks || [];
                if (tasks[index]) {
                    tasks[index].photo = compressedBase64;
                    await setDoc(docRef, { tasks, updatedAt: serverTimestamp() }, { merge: true });
                }
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};
window.toggleHabit = async (index) => {
    const docRef = todayLogRef();
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const habits = docSnap.data().habits || [];
        if (habits[index]) {
            habits[index].done = !habits[index].done;
            await setDoc(docRef, { habits, updatedAt: serverTimestamp() }, { merge: true });
        }
    }
};

window.toggleMultiHabit = async (hIdx, iIdx) => {
    const docRef = todayLogRef();
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const habits = docSnap.data().habits || [];
        if (habits[hIdx] && habits[hIdx].items) {
            habits[hIdx].items[iIdx].done = !habits[hIdx].items[iIdx].done;
            habits[hIdx].done = habits[hIdx].items.every(i => i.done);
            await setDoc(docRef, { habits, updatedAt: serverTimestamp() }, { merge: true });
        }
    }
};

window.updateHabitNotes = async (index, value) => {
    const docRef = todayLogRef();
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const habits = docSnap.data().habits || [];
        if (habits[index]) {
            habits[index].notes = value;
            await setDoc(docRef, { habits, updatedAt: serverTimestamp() }, { merge: true });
        }
    }
};

window.uploadHabitPhoto = async (index, input) => {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const compressedBase64 = await compressImage(e.target.result);
            const docRef = todayLogRef();
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const habits = docSnap.data().habits || [];
                if (habits[index]) {
                    habits[index].photo = compressedBase64; 
                    await setDoc(docRef, { habits, updatedAt: serverTimestamp() }, { merge: true });
                }
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.viewImage = (src) => {
    const viewer = document.createElement('div');
    viewer.className = 'fixed inset-0 bg-black bg-opacity-90 z-[100] flex items-center justify-center p-4';
    viewer.onclick = () => viewer.remove();
    viewer.innerHTML = `<img src="${src}" class="max-w-full max-h-full rounded-xl">`;
    document.body.appendChild(viewer);
};

// --- User Schedule Management (Pelajaran Mingguan) ---
function loadUserScheduleManager() {
    const tableBody = document.getElementById('user-manage-table-body');
    const saveBtn = document.getElementById('user-save-jadwal-btn');
    const teacherDatalist = document.getElementById('teacher-list');

    if (!tableBody || !saveBtn) return;

    // 1. Populate Teacher Datalist from Contacts (Admin-set teachers)
    onSnapshot(collection(db, "contacts"), (snapshot) => {
        if (teacherDatalist) {
            teacherDatalist.innerHTML = '';
            snapshot.forEach((docSnap) => {
                const item = docSnap.data();
                if (item.type === 'guru') {
                    const opt = document.createElement('option');
                    opt.value = item.name;
                    teacherDatalist.appendChild(opt);
                }
            });
        }
    });

    // 2. Listen to MY schedules (only those I created)
    const q = query(
        collection(db, "schedules"), 
        where("userId", "==", currentUserId)
    );

    onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Client-side sort: Day and then Time
        const dayOrder = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 7 };
        items.sort((a, b) => {
            if (dayOrder[a.day] !== dayOrder[b.day]) {
                return dayOrder[a.day] - dayOrder[b.day];
            }
            return (a.time || "").localeCompare(b.time || "");
        });

        tableBody.innerHTML = '';
        items.forEach((item) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-700">${item.day}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm font-bold text-indigo-600">${item.subject}</div>
                    <div class="text-[10px] text-gray-400 font-medium">${item.teacher || '-'}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-[10px] text-gray-500 font-mono">${item.time}</td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                    <button onclick="window.deleteUserJadwal('${item.id}')" class="text-red-400 hover:text-red-600 transition-colors p-2">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });

    saveBtn.onclick = async () => {
        const subject = document.getElementById('user-input-subject').value;
        const teacher = document.getElementById('user-input-teacher').value;
        const timeStart = document.getElementById('user-input-time-start').value;
        const timeEnd = document.getElementById('user-input-time-end').value;
        const day = document.getElementById('user-input-day').value;

        if (!subject || !teacher || !timeStart || !timeEnd) {
            alert("Harap isi Mata Pelajaran, Nama Guru, dan Jam!");
            return;
        }

        const fullTime = `${timeStart} - ${timeEnd}`;

        try {
            await addDoc(collection(db, "schedules"), {
                subject,
                teacher,
                time: fullTime,
                day,
                userId: currentUserId,
                createdAt: serverTimestamp()
            });
            // Reset inputs
            document.getElementById('user-input-subject').value = '';
            document.getElementById('user-input-teacher').value = '';
            document.getElementById('user-input-time-start').value = '';
            document.getElementById('user-input-time-end').value = '';
        } catch (error) {
            console.error("Error adding user schedule:", error);
            alert("Gagal menyimpan jadwal. Coba lagi.");
        }
    };
}

// --- Task & Modal Management ---
function initModals() {
    const addBtn = document.getElementById('add-task-btn');
    const saveTaskBtn = document.getElementById('btn-save-task');

    if (addBtn) {
        addBtn.onclick = () => window.openModal('task');
    }

    if (saveTaskBtn) {
        saveTaskBtn.onclick = async () => {
            const name = document.getElementById('task-name').value;
            const category = document.getElementById('task-category').value;
            const given = document.getElementById('task-given').value;
            const due = document.getElementById('task-due').value;

            if (!name || !due) {
                alert("Nama Tugas dan Tanggal Dikumpulkan wajib diisi!");
                return;
            }

            const docRef = doc(db, 'progress', currentUserId);
            const docSnap = await getDoc(docRef);
            
            const newTask = {
                title: name,
                category: category,
                completed: false,
                givenDate: given,
                dueDate: due,
                createdAt: new Date().toISOString()
            };

            const data = docSnap.exists() ? docSnap.data() : {};
            const tasks = data.tasks || [];
            tasks.push(newTask);
            await setDoc(docRef, { ...data, tasks }, { merge: true });

            window.closeModal('task');
            // Reset fields
            document.getElementById('task-name').value = '';
            document.getElementById('task-given').value = '';
            document.getElementById('task-due').value = '';
        };
    }

    const saveExamBtn = document.getElementById('btn-save-exam');
    if (saveExamBtn) {
        saveExamBtn.onclick = async () => {
            const name = document.getElementById('exam-name').value.trim();
            const type = document.getElementById('exam-type').value;
            const date = document.getElementById('exam-date').value;
            const time = document.getElementById('exam-time')?.value || '';
            const notes = document.getElementById('exam-notes')?.value.trim() || '';

            if (!name || !date) {
                alert("Nama Ujian dan Tanggal wajib diisi!");
                return;
            }

            const docRef = doc(db, 'progress', currentUserId);
            const docSnap = await getDoc(docRef);
            
            const newExam = { name, type, date, time, notes, createdAt: new Date().toISOString() };

            const data = docSnap.exists() ? docSnap.data() : {};
            const exams = data.exams || [];
            exams.push(newExam);
            await setDoc(docRef, { ...data, exams }, { merge: true });

            window.closeModal('exam');
            document.getElementById('exam-name').value = '';
            document.getElementById('exam-date').value = '';
            const examTimeEl = document.getElementById('exam-time');
            if (examTimeEl) examTimeEl.value = '';
            const examNotesEl = document.getElementById('exam-notes');
            if (examNotesEl) examNotesEl.value = '';
        };
    }
}

window.openModal = (id) => {
    document.getElementById(`modal-${id}`).classList.remove('hidden');
};

window.closeModal = (id) => {
    document.getElementById(`modal-${id}`).classList.add('hidden');
};

window.deleteUserJadwal = async (id) => {
    if (confirm("Hapus kegiatan ini?")) {
        await deleteDoc(doc(db, "schedules", id));
    }
};

window.viewSubjectDetail = async (subjectName, teacherName) => {
    const modal = document.getElementById('modal-subject-detail');
    const nameEl = document.getElementById('detail-subject-name');
    const teacherEl = document.getElementById('detail-subject-teacher');
    const iconEl = document.getElementById('detail-subject-icon');
    const tasksList = document.getElementById('detail-tasks-list');
    const examsList = document.getElementById('detail-exams-list');
    const tasksCount = document.getElementById('detail-tasks-count');
    const examsCount = document.getElementById('detail-exams-count');

    if (!modal) return;

    // Set Header
    nameEl.textContent = subjectName;
    teacherEl.textContent = teacherName || 'Guru Mata Pelajaran';
    iconEl.textContent = subjectName.charAt(0).toUpperCase();
    
    // Clear Lists
    tasksList.innerHTML = '<p class="text-gray-400 text-xs text-center py-2 italic font-medium">Buka menu "Tugas" untuk mengelola tugas secara lengkap.</p>';
    examsList.innerHTML = '';
    tasksCount.textContent = '0';
    examsCount.textContent = '0';

    window.openModal('subject-detail');

    try {
        // Fetch all data for this user
        const docRef = doc(db, 'progress', currentUserId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const allTasks = data.tasks || [];
            const allExams = data.exams || [];

            // Filter by subject name (case insensitive match)
            const subjectTasks = allTasks.filter(t => 
                (t.title && t.title.toLowerCase().includes(subjectName.toLowerCase())) ||
                (t.name && t.name.toLowerCase().includes(subjectName.toLowerCase())) ||
                (t.category && t.category.toLowerCase().includes(subjectName.toLowerCase()))
            );

            const subjectExams = allExams.filter(e => 
                (e.name && e.name.toLowerCase().includes(subjectName.toLowerCase()))
            );

            // Render Tasks
            if (subjectTasks.length > 0) {
                tasksList.innerHTML = '';
                subjectTasks.forEach(t => {
                    const li = document.createElement('div');
                    li.className = `p-3 rounded-xl border flex items-center justify-between ${t.completed ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-blue-50/30 border-blue-100'}`;
                    li.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-2 h-2 rounded-full ${t.completed ? 'bg-gray-300' : 'bg-blue-500'}"></div>
                            <span class="text-sm font-bold text-gray-800 ${t.completed ? 'line-through' : ''}">${t.title || t.name}</span>
                        </div>
                        ${t.completed ? '✅' : ''}
                    `;
                    tasksList.appendChild(li);
                });
                tasksCount.textContent = subjectTasks.length;
            }

            // Render Exams
            if (subjectExams.length > 0) {
                examsList.innerHTML = '';
                subjectExams.forEach(e => {
                    const li = document.createElement('div');
                    li.className = 'p-3 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center gap-3';
                    li.innerHTML = `
                        <div class="text-yellow-600 font-black flex-shrink-0 text-xs">⚠️</div>
                        <div>
                            <div class="text-sm font-black text-gray-900">${e.name}</div>
                            <div class="text-[10px] font-bold text-yellow-700 uppercase">${new Date(e.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})} • ${e.time || ''}</div>
                        </div>
                    `;
                    examsList.appendChild(li);
                });
                examsCount.textContent = subjectExams.length;
            } else {
                examsList.innerHTML = '<p class="text-gray-400 text-xs text-center py-2 italic font-medium">Buka menu "Jadwal" untuk melihat atau tambah pengingat ujian.</p>';
            }
        }
    } catch (error) {
        console.error("Error loading subject details:", error);
    }
};
