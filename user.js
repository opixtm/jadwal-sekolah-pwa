// user.js
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUserId = null;

export function initUser() {
    console.log('User Module Initialized');
    currentUserId = auth.currentUser.uid;
    loadSchedule();
    loadTasks();
    loadHabits();
    loadContacts();
}

function loadSchedule() {
    const jadwalList = document.getElementById('jadwal-list');
    const ujianList = document.getElementById('ujian-list');
    
    // Get Current Day in Indonesian
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const today = days[new Date().getDay()];
    
    // Set placeholder while loading
    if (jadwalList) jadwalList.innerHTML = '<p class="text-gray-400 text-center py-4">Memuat jadwal...</p>';

    // Fetch from Firestore
    const q = query(collection(db, "schedules"), where("day", "==", today), orderBy("time"));
    onSnapshot(q, (snapshot) => {
        if (jadwalList) {
            if (snapshot.empty) {
                jadwalList.innerHTML = `<p class="text-gray-400 text-center py-4">Tidak ada jadwal untuk hari ${today}.</p>`;
            } else {
                jadwalList.innerHTML = '';
                snapshot.forEach((docSnap) => {
                    const item = docSnap.data();
                    jadwalList.innerHTML += `
                        <div class="bg-white p-4 rounded-xl border-l-4 border-indigo-500 shadow-sm flex justify-between items-center">
                            <div>
                                <div class="text-xs text-gray-400 font-medium uppercase">${item.time}</div>
                                <div class="font-bold text-gray-800">${item.subject}</div>
                                <div class="text-sm text-gray-500">${item.teacher}</div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-300"></i>
                        </div>
                    `;
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
        
        tasksList.innerHTML = tasks.length ? tasks.map((task, index) => `
            <div class="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4 transition-all ${task.completed ? 'opacity-60' : ''}">
                <input type="checkbox" ${task.completed ? 'checked' : ''} 
                    onchange="toggleTask(${index})"
                    class="w-6 h-6 rounded-full border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                <div class="flex-1">
                    <div class="font-bold text-gray-800 ${task.completed ? 'line-through' : ''}">${task.name}</div>
                    <div class="text-xs text-gray-400">${task.category}</div>
                </div>
            </div>
        `).join('') : '<p class="text-gray-400 text-center py-4">Belum ada tugas.</p>';
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
