// user.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUserId = null;

export function initUser() {
    console.log('User Module Initialized');
    currentUserId = auth.currentUser.uid;
    loadSchedule();
    loadExams();
    loadTasks();
    loadHabits();
    loadContacts();
    loadUserScheduleManager();
    initModals();
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
                return data.userId === 'common' || data.userId === currentUserId;
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
                        <div class="font-bold text-gray-900">${item.subject}</div>
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
            const dateObj = new Date(exam.date);
            const day = dateObj.getDate();
            const month = dateObj.toLocaleString('id-ID', { month: 'short' }).toUpperCase();
            
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group';
            card.innerHTML = `
                <div class="bg-yellow-50 text-yellow-600 w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-yellow-100">
                    <div class="text-[10px] font-bold uppercase leading-none">${month}</div>
                    <div class="text-xl font-black leading-none">${day}</div>
                </div>
                <div class="flex-1">
                    <div class="font-bold text-gray-900">${exam.name}</div>
                    <div class="text-xs text-gray-500">Tipe: ${exam.type}</div>
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
            tasksList.innerHTML = ''; // Clear existing content
            tasks.forEach((task, index) => {
                const li = document.createElement('li');
                li.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3';
                li.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <input type="checkbox" ${task.completed ? 'checked' : ''} 
                                onchange="window.toggleTask(${index})"
                                class="w-6 h-6 rounded-lg text-indigo-600 focus:ring-indigo-500 border-gray-300">
                            <div>
                                <div class="font-bold text-gray-900 ${task.completed ? 'line-through opacity-50' : ''}">${task.title}</div>
                                <div class="text-[10px] flex gap-2">
                                    <span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">${task.category}</span>
                                    <span class="text-gray-400">Due: ${task.dueDate || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="pt-2 flex items-center justify-between border-t border-gray-50 mt-2">
                        <div class="flex items-center gap-2">
                            <label class="cursor-pointer text-indigo-500 hover:text-indigo-700">
                                <i class="fas fa-camera"></i> <span class="text-[10px] font-bold">BUKTI FOTO</span>
                                <input type="file" accept="image/*" class="hidden" onchange="window.uploadTaskPhoto(${index}, this)">
                            </label>
                            ${task.photo ? `<img src="${task.photo}" class="w-8 h-8 rounded object-cover border" onclick="window.viewImage('${task.photo}')">` : ''}
                        </div>
                    </div>
                `;
                tasksList.appendChild(li);
            });
        }
    });
}

async function loadHabits() {
    const habitsList = document.getElementById('habits-list');
    const docRef = doc(db, 'progress', currentUserId);
    
    // Initialize default habits if not exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || !docSnap.data().habits) {
        const defaultHabits = [
            { name: "Shalat 5 Waktu", items: [
                { id: "subuh", name: "Subuh", done: false },
                { id: "dzuhur", name: "Dzuhur", done: false },
                { id: "ashar", name: "Ashar", done: false },
                { id: "maghrib", name: "Maghrib", done: false },
                { id: "isya", name: "Isya", done: false }
            ], type: 'multi', photo: null, done: false },
            { name: "Membaca Al-Quran", done: false, type: 'note', notes: '', photo: null },
            { name: "Membereskan Rumah", done: false, type: 'normal', photo: null },
            { name: "Mandi & Gosok Gigi", done: false, type: 'normal', photo: null }
        ];
        await setDoc(docRef, { habits: defaultHabits }, { merge: true });
    }

    onSnapshot(docRef, (snap) => {
        if (!habitsList) return;
        habitsList.innerHTML = '';
        const data = snap.data();
        const habits = data.habits || [];

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
                contentHtml += `<div class="grid grid-cols-5 gap-2 pt-2">
                    ${habit.items.map((item, iIdx) => `
                        <button onclick="window.toggleMultiHabit(${hIdx}, ${iIdx})" 
                            class="p-2 rounded-xl text-[10px] font-bold transition-all border ${item.done ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-100'}">
                            ${item.name}
                        </button>
                    `).join('')}
                </div>`;
            }

            if (habit.type === 'note') {
                contentHtml += `
                    <div class="flex gap-2 items-center">
                        <input type="text" placeholder="Catatan (Ex: Al-Baqarah 1-10)" 
                            value="${habit.notes || ''}" 
                            onblur="window.updateHabitNotes(${hIdx}, this.value)"
                            class="flex-1 p-2 bg-gray-50 border-none rounded-lg text-xs outline-none">
                        <input type="checkbox" ${habit.done ? 'checked' : ''} onchange="window.toggleHabit(${hIdx})" class="w-6 h-6 rounded-lg text-indigo-600">
                    </div>
                `;
            }

            // Photo Attachment Section
            contentHtml += `
                <div class="pt-2 flex items-center justify-between border-t border-gray-50 mt-2">
                    <div class="flex items-center gap-2">
                        <label class="cursor-pointer text-indigo-500 hover:text-indigo-700">
                            <i class="fas fa-camera"></i> <span class="text-[10px] font-bold">BUKTI FOTO</span>
                            <input type="file" accept="image/*" class="hidden" onchange="window.uploadHabitPhoto(${hIdx}, this)">
                        </label>
                        ${habit.photo ? `<img src="${habit.photo}" class="w-8 h-8 rounded object-cover border" onclick="window.viewImage('${habit.photo}')">` : ''}
                    </div>
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

    const teachers = [
        { name: 'Pak Budi', subject: 'Matematika' },
        { name: 'Bu Siti', subject: 'Bahasa Indonesia' }
    ];
    const friends = [
        { name: 'Andi', role: 'Teman Sekelas' },
        { name: 'Budi', role: 'Teman Sekelas' }
    ];

    teachersList.innerHTML = teachers.map(t => `
        <div class="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
            <div class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">${t.name[0]}</div>
            <div>
                <div class="font-bold text-sm text-gray-800">${t.name}</div>
                <div class="text-xs text-gray-500">${t.subject}</div>
            </div>
        </div>
    `).join('');

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

async function initProgressDoc() {
    const initialTasks = [
        { name: 'PR Matematika Hal 10', category: 'Tugas Utama', completed: false },
        { name: 'Catatan Biologi', category: 'Notes', completed: false }
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
    const docRef = doc(db, 'progress', currentUserId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const tasks = docSnap.data().tasks;
        tasks[index].completed = !tasks[index].completed;
        await setDoc(docRef, { tasks: tasks }, { merge: true });
    }
};

window.uploadTaskPhoto = async (index, input) => {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            const docRef = doc(db, 'progress', currentUserId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const tasks = docSnap.data().tasks;
                tasks[index].photo = base64;
                await setDoc(docRef, { tasks: tasks }, { merge: true });
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.toggleHabit = async (index) => {
    const docRef = doc(db, 'progress', currentUserId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const habits = docSnap.data().habits;
        habits[index].done = !habits[index].done;
        await setDoc(docRef, { habits: habits }, { merge: true });
    }
};

window.toggleMultiHabit = async (hIdx, iIdx) => {
    const docRef = doc(db, 'progress', currentUserId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const habits = docSnap.data().habits;
        habits[hIdx].items[iIdx].done = !habits[hIdx].items[iIdx].done;
        
        // Track overall multi status
        const allDone = habits[hIdx].items.every(i => i.done);
        habits[hIdx].done = allDone;

        await setDoc(docRef, { habits: habits }, { merge: true });
    }
};

window.updateHabitNotes = async (index, value) => {
    const docRef = doc(db, 'progress', currentUserId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const habits = docSnap.data().habits;
        habits[index].notes = value;
        await setDoc(docRef, { habits: habits }, { merge: true });
    }
};

window.uploadHabitPhoto = async (index, input) => {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            const docRef = doc(db, 'progress', currentUserId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const habits = docSnap.data().habits;
                habits[index].photo = base64; // Using base64 for small PWA demo images
                await setDoc(docRef, { habits: habits }, { merge: true });
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

// --- User Schedule Management (Home Activities) ---
function loadUserScheduleManager() {
    const tableBody = document.getElementById('user-manage-jadwal-table-body');
    const saveBtn = document.getElementById('user-save-jadwal-btn');

    if (!tableBody || !saveBtn) return;

    // Listen to MY schedules (only those I created)
    const q = query(
        collection(db, "schedules"), 
        where("userId", "==", currentUserId),
        orderBy("day")
    );

    onSnapshot(q, (snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${item.day}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div class="font-bold">${item.subject}</div>
                    <div class="text-[10px] text-gray-400">${item.time}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="window.deleteUserJadwal('${docSnap.id}')" class="text-red-500 p-1"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });

    saveBtn.onclick = async () => {
        const subject = document.getElementById('user-input-subject').value;
        const timeStart = document.getElementById('user-input-time-start').value;
        const timeEnd = document.getElementById('user-input-time-end').value;
        const day = document.getElementById('user-input-day').value;

        if (!subject || !timeStart || !timeEnd) {
            alert("Nama Kegiatan dan Jam wajib diisi!");
            return;
        }

        const fullTime = `${timeStart} - ${timeEnd}`;

        try {
            await addDoc(collection(db, "schedules"), {
                subject,
                teacher: "Kegiatan Rumah",
                time: fullTime,
                day,
                userId: currentUserId,
                createdAt: new Date()
            });
            // Clear inputs
            document.getElementById('user-input-subject').value = '';
            document.getElementById('user-input-time-start').value = '';
            document.getElementById('user-input-time-end').value = '';
        } catch (error) {
            console.error("Error adding user schedule:", error);
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
            const name = document.getElementById('exam-name').value;
            const type = document.getElementById('exam-type').value;
            const date = document.getElementById('exam-date').value;

            if (!name || !date) {
                alert("Nama Ujian dan Tanggal wajib diisi!");
                return;
            }

            const docRef = doc(db, 'progress', currentUserId);
            const docSnap = await getDoc(docRef);
            
            const newExam = {
                name: name,
                type: type,
                date: date,
                createdAt: new Date().toISOString()
            };

            const data = docSnap.exists() ? docSnap.data() : {};
            const exams = data.exams || [];
            exams.push(newExam);
            await setDoc(docRef, { ...data, exams }, { merge: true });

            window.closeModal('exam');
            // Reset fields
            document.getElementById('exam-name').value = '';
            document.getElementById('exam-date').value = '';
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
