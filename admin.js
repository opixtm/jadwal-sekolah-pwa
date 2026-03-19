// admin.js
import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function initAdmin() {
    console.log('Admin Module Initialized');
    loadUserList();
    loadScheduleManager();
    loadParentalMonitoring();
}

function loadUserList() {
    const userTableBody = document.getElementById('user-table-body');
    const q = query(collection(db, 'users'));

    onSnapshot(q, (snapshot) => {
        userTableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-3 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-full" src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.displayName}</div>
                            <div class="text-sm text-gray-500">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.role)}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    ${user.role === 'Pending' ? `<button onclick="updateRole('${user.uid}', 'Approved')" class="text-indigo-600 hover:text-indigo-900">Approve</button>` : ''}
                    ${user.role === 'Approved' ? `<button onclick="updateRole('${user.uid}', 'Pending')" class="text-yellow-600 hover:text-yellow-900">Deny</button>` : ''}
                    <button onclick="removeUser('${user.uid}')" class="text-red-600 hover:text-red-900">Remove</button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    });
}

function getStatusColor(role) {
    if (role === 'Admin') return 'bg-purple-100 text-purple-800';
    if (role === 'Approved') return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
}

window.updateRole = async (uid, newRole) => {
    try {
        await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err) {
        console.error("Error updating role:", err);
    }
};

window.removeUser = async (uid) => {
    if (confirm('Hapus akun ini?')) {
        try {
            await deleteDoc(doc(db, 'users', uid));
        } catch (err) {
            console.error("Error removing user:", err);
        }
    }
};

function loadParentalMonitoring() {
    const childSelect = document.getElementById('child-select');
    const monitoringData = document.getElementById('monitoring-data');
    const q = query(collection(db, 'users'), where('role', '==', 'Approved'));

    onSnapshot(q, (snapshot) => {
        childSelect.innerHTML = '<option value="">Pilih...</option>';
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const option = document.createElement('option');
            option.value = user.uid;
            option.textContent = user.displayName;
            childSelect.appendChild(option);
        });
    });

    childSelect.addEventListener('change', (e) => {
        const uid = e.target.value;
        if (uid) {
            monitoringData.classList.remove('hidden');
            subscribeToChildProgress(uid);
        } else {
            monitoringData.classList.add('hidden');
        }
    });
}

function subscribeToChildProgress(uid) {
    const tasksList = document.getElementById('monitoring-tasks-list');
    const habitsList = document.getElementById('monitoring-habits-list');
    const progressBar = document.getElementById('progress-bar-inner');
    const progressPercent = document.getElementById('progress-percent');
    const progressRatio = document.getElementById('progress-ratio');

    onSnapshot(doc(db, 'progress', uid), (docSnap) => {
        if (!docSnap.exists()) {
            tasksList.innerHTML = '<li>Belum ada data.</li>';
            habitsList.innerHTML = '<li>Belum ada data.</li>';
            updateUIProgress(0, 0);
            return;
        }

        const data = docSnap.data();
        const tasks = data.tasks || [];
        const habits = data.habits || [];

        renderMonitoringList(tasksList, tasks);
        renderMonitoringList(habitsList, habits);

        const total = tasks.length + habits.length;
        const done = [...tasks, ...habits].filter(item => item.completed).length;
        updateUIProgress(done, total);
    });
}

function renderMonitoringList(container, items) {
    container.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between p-2 hover:bg-gray-50 rounded';
        li.innerHTML = `
            <span class="text-sm">${item.name}</span>
            <i class="fas ${item.completed ? 'fa-check-circle text-green-500' : 'fa-times-circle text-gray-300'}"></i>
        `;
        container.appendChild(li);
    });
}

function updateUIProgress(done, total) {
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    document.getElementById('progress-bar-inner').style.width = `${percent}%`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-ratio').textContent = `${done}/${total} Selesai`;
}

// --- Schedule Management ---
function loadScheduleManager() {
    const tableBody = document.getElementById('manage-jadwal-table-body');
    const saveBtn = document.getElementById('save-jadwal-btn');

    if (!tableBody || !saveBtn) return;

    // Listen to schedules collection
    const q = query(collection(db, "schedules"), orderBy("day"), orderBy("time"));
    onSnapshot(q, (snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.day}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div class="font-bold">${item.subject}</div>
                    <div class="text-xs text-gray-400">${item.teacher}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.time}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="window.deleteJadwal('${docSnap.id}')" class="text-red-600 hover:text-red-900">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });

    saveBtn.onclick = async () => {
        const subject = document.getElementById('input-subject').value;
        const teacher = document.getElementById('input-teacher').value;
        const timeStart = document.getElementById('input-time-start').value;
        const timeEnd = document.getElementById('input-time-end').value;
        const day = document.getElementById('input-day').value;

        if (!subject || !teacher || !timeStart || !timeEnd) {
            alert("Harap isi semua kolom!");
            return;
        }

        const fullTime = `${timeStart} - ${timeEnd}`;

        try {
            await addDoc(collection(db, "schedules"), {
                subject,
                teacher,
                time: fullTime,
                day,
                userId: 'common',
                createdAt: new Date()
            });
            // Clear inputs
            document.getElementById('input-subject').value = '';
            document.getElementById('input-teacher').value = '';
            document.getElementById('input-time-start').value = '';
            document.getElementById('input-time-end').value = '';
        } catch (error) {
            console.error("Error adding schedule:", error);
        }
    };
}

// Global expose for delete button
window.deleteJadwal = async (id) => {
    if (confirm("Hapus jadwal ini?")) {
        await deleteDoc(doc(db, "schedules", id));
    }
};
