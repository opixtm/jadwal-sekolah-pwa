// user.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUserId = null;

export function initUser() {
    console.log('User Module Initialized');
    currentUserId = auth.currentUser.uid;
    loadSchedule();
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

    // Mock exams (can be made dynamic later too)
    const exams = [
        { date: '25 Mar 2024', subject: 'Ujian Harian Matematika', type: 'UH' }
    ];

    if (ujianList) {
        ujianList.innerHTML = exams.map(item => `
            <div class="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm flex items-center gap-4">
                <div class="bg-yellow-500 text-white w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold">
                    <div class="text-[10px] leading-tight opacity-80 uppercase">MAR</div>
                    <div class="text-lg leading-tight">25</div>
                </div>
                <div>
                    <div class="font-bold text-gray-800">${item.subject}</div>
                    <div class="text-xs text-yellow-700 font-medium">Tipe: ${item.type}</div>
                </div>
            </div>
        `).join('');
    }
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
                li.className = 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group';
                li.innerHTML = `
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
                `;
                tasksList.appendChild(li);
            });
        }
    });
}

async function loadHabits() {
    const habitsList = document.getElementById('habits-list');
    const q = doc(db, 'progress', currentUserId);

    onSnapshot(q, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const habits = data.habits || [];
        
        habitsList.innerHTML = habits.length ? habits.map((habit, index) => `
            <div class="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4 transition-all ${habit.completed ? 'bg-green-50 border-green-100' : ''}">
                <button onclick="toggleHabit(${index})" class="w-10 h-10 rounded-full flex items-center justify-center transition-all ${habit.completed ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}">
                    <i class="fas ${habit.completed ? 'fa-check' : 'fa-circle-notch'}"></i>
                </button>
                <div class="flex-1">
                    <div class="font-bold text-gray-800">${habit.name}</div>
                </div>
            </div>
        `).join('') : '';
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

window.toggleHabit = async (index) => {
    const docRef = doc(db, 'progress', currentUserId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const habits = docSnap.data().habits;
        habits[index].completed = !habits[index].completed;
        await setDoc(docRef, { habits: habits }, { merge: true });
    }
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

            if (docSnap.exists()) {
                const tasks = docSnap.data().tasks || [];
                tasks.push(newTask);
                await setDoc(docRef, { tasks }, { merge: true });
            } else {
                await setDoc(docRef, { tasks: [newTask] });
            }

            window.closeModal('task');
            // Reset fields
            document.getElementById('task-name').value = '';
            document.getElementById('task-given').value = '';
            document.getElementById('task-due').value = '';
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
