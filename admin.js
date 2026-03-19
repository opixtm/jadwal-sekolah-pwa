// admin.js
import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc, getDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function initAdmin() {
    loadUsers();
    loadScheduleManager();
    loadTeacherManager();
    loadParentalMonitoring();
    initAppConfig();
    initAdminTabs();
    window.viewImage = (src) => {
        const viewer = document.createElement('div');
        viewer.className = 'fixed inset-0 bg-black bg-opacity-90 z-[100] flex items-center justify-center p-4';
        viewer.onclick = () => viewer.remove();
        viewer.innerHTML = `<img src="${src}" class="max-w-full max-h-full rounded-xl">`;
        document.body.appendChild(viewer);
    };
}

let progressUnsubscribe = null;
let flashNoteUnsubscribe = null;

function loadUsers() {
    const userTableBody = document.getElementById('user-table-body');
    if (!userTableBody) return;

    onSnapshot(collection(db, "users"), (snapshot) => {
        userTableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-full" src="https://ui-avatars.com/api/?name=${user.displayName || 'User'}&background=random" alt="">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.displayName || 'Unknown'}</div>
                            <div class="text-sm text-gray-500">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 
                          user.role === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold">
                    ${user.grade || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    ${user.role === 'Pending' ? `
                        <select id="grade-sel-${docSnap.id}" class="text-xs border rounded p-1">
                            <option value="">Set Kelas...</option>
                            <optgroup label="SD"><option>Kelas 1</option><option>Kelas 2</option><option>Kelas 3</option><option>Kelas 4</option><option>Kelas 5</option><option>Kelas 6</option></optgroup>
                            <optgroup label="SMP"><option>Kelas 7</option><option>Kelas 8</option><option>Kelas 9</option></optgroup>
                            <optgroup label="SMA"><option>Kelas 10</option><option>Kelas 11</option><option>Kelas 12</option></optgroup>
                        </select>
                        <button onclick="window.approveWithGrade('${docSnap.id}')" class="text-indigo-600 hover:text-indigo-900">Approve</button>
                    ` : ''}
                    ${user.role === 'Approved' ? `
                        <button onclick="window.updateUserStatus('${docSnap.id}', 'Admin')" class="text-purple-600 hover:text-purple-900">Make Admin</button>
                    ` : ''}
                    ${user.role !== 'Admin' ? `
                        <button onclick="window.deleteUser('${docSnap.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                    ` : '<span class="text-gray-400">Owner</span>'}
                </td>
            `;
            userTableBody.appendChild(tr);
        });
    }, (err) => {
        console.error("User list listener error:", err);
    });
}

function getStatusColor(role) {
    if (role === 'Admin') return 'bg-purple-100 text-purple-800';
    if (role === 'Approved') return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
}

function loadParentalMonitoring() {
    const childSelect = document.getElementById('child-select');
    const datePicker = document.getElementById('monitoring-date-picker');
    const monitoringData = document.getElementById('monitoring-data');

    // Default hari ini
    const todayStr = new Date().toISOString().split('T')[0];
    datePicker.value = todayStr;

    // Load approved users into dropdown
    const q = query(collection(db, 'users'), where('role', '==', 'Approved'));
    onSnapshot(q, (snapshot) => {
        childSelect.innerHTML = '<option value="">Pilih...</option>';
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = user.displayName || user.email;
            childSelect.appendChild(option);
        });
    }, (err) => {
        console.error("Monitoring dropdown error:", err);
    });

    let currentUid = null;

    function loadForDate() {
        if (!currentUid) return;
        const date = datePicker.value || todayStr;
        monitoringData.classList.remove('hidden');
        subscribeToChildProgress(currentUid, date);
    }

    childSelect.addEventListener('change', (e) => {
        currentUid = e.target.value;
        const flashNoteAdmin = document.getElementById('flash-note-admin-section');
        
        // Cleanup old listeners
        if (progressUnsubscribe) { progressUnsubscribe(); progressUnsubscribe = null; }
        if (flashNoteUnsubscribe) { flashNoteUnsubscribe(); flashNoteUnsubscribe = null; }

        if (currentUid) {
            loadForDate();
            loadFlashNoteForChild(currentUid);
            if (flashNoteAdmin) flashNoteAdmin.classList.remove('hidden');
        } else {
            monitoringData.classList.add('hidden');
            if (flashNoteAdmin) flashNoteAdmin.classList.add('hidden');
        }
    });

    datePicker.addEventListener('change', () => loadForDate());

    // Flash Note save button
    const saveFlashNoteBtn = document.getElementById('save-flash-note-btn');
    const flashNoteInput = document.getElementById('flash-note-input');
    const flashNoteStatus = document.getElementById('flash-note-status');
    if (saveFlashNoteBtn) {
        saveFlashNoteBtn.onclick = async () => {
            if (!currentUid) { alert('Pilih anak dulu!'); return; }
            const message = flashNoteInput.value.trim();
            await updateDoc(doc(db, 'users', currentUid), { flashNote: message, lastNoteAt: serverTimestamp() });
            flashNoteStatus.classList.remove('hidden');
            setTimeout(() => flashNoteStatus.classList.add('hidden'), 3000);
        };
    }
}

function loadFlashNoteForChild(uid) {
    const flashNoteInput = document.getElementById('flash-note-input');
    if (!flashNoteInput) return;
    
    flashNoteUnsubscribe = onSnapshot(doc(db, 'users', uid), (snap) => {
        flashNoteInput.value = snap.exists() ? (snap.data().flashNote || '') : '';
    }, (err) => {
        console.error("Flash note listener error:", err);
    });
}

function subscribeToChildProgress(uid, date) {
    const tasksList = document.getElementById('monitoring-tasks-list');
    const habitsList = document.getElementById('monitoring-habits-list');
    const dateLabel = document.getElementById('monitoring-date-label');
    const lastUpdatedEl = document.getElementById('monitoring-last-updated');

    // Format tanggal untuk label
    const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dateLabel) dateLabel.textContent = displayDate;

    // Cleanup old listener before starting new one
    if (progressUnsubscribe) progressUnsubscribe();

    const logRef = doc(db, 'progress', uid, 'logs', date);
    const rootRef = doc(db, 'progress', uid);

    progressUnsubscribe = onSnapshot(logRef, (docSnap) => {
        if (!docSnap.exists()) {
            // If log doesn't exist, fetch fallback once from root doc (not needed to listen continuously if it doesn't exist)
            getDoc(rootRef).then(rootSnap => {
                if (rootSnap.exists()) {
                    renderProgressData(rootSnap.data(), tasksList, habitsList, lastUpdatedEl);
                } else {
                    tasksList.innerHTML = '<li class="text-gray-400 text-sm py-2">Belum ada data untuk tanggal ini.</li>';
                    habitsList.innerHTML = '<li class="text-gray-400 text-sm py-2">Belum ada data untuk tanggal ini.</li>';
                    updateUIProgress(0, 0);
                }
            });
            return;
        }
        renderProgressData(docSnap.data(), tasksList, habitsList, lastUpdatedEl);
    }, (err) => {
        console.error("Progress listener error:", err);
        tasksList.innerHTML = `<li class="text-red-400 text-xs py-2">Error: ${err.code}</li>`;
    });
}

function renderProgressData(data, tasksList, habitsList, lastUpdatedEl) {
    const tasks = data.tasks || [];
    const habits = data.habits || [];

    renderMonitoringList(tasksList, tasks);
    renderMonitoringList(habitsList, habits);

    const total = tasks.length + habits.length;
    const done = [...tasks, ...habits].filter(item => item.done || item.completed).length;
    const lastUpdated = data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleString('id-ID') : null;

    updateUIProgress(done, total, lastUpdated);
    if (lastUpdatedEl && lastUpdated) {
        lastUpdatedEl.textContent = 'Terakhir diperbarui: ' + lastUpdated;
    }
}

function renderMonitoringList(container, items) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<li class="text-gray-400 text-sm py-2">Belum ada data.</li>';
        return;
    }
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'p-3 rounded-xl border border-gray-100 space-y-2 mb-2 bg-white';

        // Status icon
        const isDone = item.done || item.completed;
        const statusIcon = isDone
            ? '<i class="fas fa-check-circle text-green-500 text-lg"></i>'
            : '<i class="fas fa-circle text-gray-200 text-lg"></i>';

        // Photo thumbnail
        const photoHtml = item.photo
            ? `<img src="${item.photo}" class="w-8 h-8 rounded object-cover border cursor-pointer" onclick="window.viewImage('${item.photo}')">`
            : '';

        // Breakdown for Shalat 5 Waktu
        let breakdownHtml = '';
        if (item.type === 'multi' && item.items) {
            const doneCount = item.items.filter(s => s.done).length;
            breakdownHtml = `
                <div class="flex flex-wrap gap-1 mt-1">
                    ${item.items.map(sub => `
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1
                            ${sub.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}">
                            ${sub.done ? '✅' : '⬜'} ${sub.name}
                        </span>
                    `).join('')}
                </div>
                <p class="text-[10px] text-indigo-500 font-semibold">${doneCount}/5 Waktu Shalat</p>
            `;
        }

        // Breakdown for Quran notes
        if (item.type === 'note') {
            breakdownHtml = item.notes
                ? `<div class="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded mt-1">📖 ${item.notes}</div>`
                : `<div class="text-[10px] text-gray-400 italic mt-1">Belum ada catatan ayat</div>`;
        }

        // Date info for tasks
        let dateHtml = '';
        if (item.givenDate || item.dueDate) {
            dateHtml = `<div class="flex gap-2 text-[10px] mt-1">
                ${item.givenDate ? `<span class="text-gray-400">Diberikan: ${item.givenDate}</span>` : ''}
                ${item.dueDate ? `<span class="bg-red-50 text-red-400 px-1.5 py-0.5 rounded-full font-bold">Kumpul: ${item.dueDate}</span>` : ''}
            </div>`;
        }

        li.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-gray-800">${item.name || item.title || '-'}</span>
                <div class="flex items-center gap-2">
                    ${photoHtml}
                    ${statusIcon}
                </div>
            </div>
            ${breakdownHtml}
            ${dateHtml}
        `;
        container.appendChild(li);
    });
}

function updateUIProgress(done, total, lastUpdated) {
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    document.getElementById('progress-bar-inner').style.width = `${percent}%`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-ratio').textContent = `${done}/${total} Selesai`;
    
    // Add timestamp display if exists
    let tsLabel = document.getElementById('progress-timestamp');
    if (!tsLabel) {
        tsLabel = document.createElement('div');
        tsLabel.id = 'progress-timestamp';
        tsLabel.className = 'text-[10px] text-gray-400 text-center mt-2';
        document.getElementById('content-monitoring').querySelector('.bg-white.p-6')?.appendChild(tsLabel);
    }
    tsLabel.textContent = `Update Terakhir: ${lastUpdated}`;
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
    }, (err) => {
        console.error("Schedule manager listener error:", err);
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
                level: document.getElementById('input-grade-level').value,
                semester: document.getElementById('input-semester').value,
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

// --- Teacher Management ---
function loadTeacherManager() {
    const tableBody = document.getElementById('manage-guru-table-body');
    const saveBtn = document.getElementById('save-guru-btn');

    if (!tableBody || !saveBtn) return;

    onSnapshot(collection(db, "contacts"), (snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            if (item.type !== 'guru') return; // Only teachers in this table

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.subject}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.phone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="window.deleteGuru('${docSnap.id}')" class="text-red-600 hover:text-red-900">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }, (err) => {
        console.error("Teacher manager listener error:", err);
    });

    saveBtn.onclick = async () => {
        const name = document.getElementById('guru-name').value;
        const subject = document.getElementById('guru-subject').value;
        const phone = document.getElementById('guru-phone').value;

        if (!name || !subject || !phone) {
            alert("Harap isi semua kolom!");
            return;
        }

        try {
            await addDoc(collection(db, "contacts"), {
                name,
                subject,
                phone,
                type: 'guru',
                createdAt: new Date()
            });
            document.getElementById('guru-name').value = '';
            document.getElementById('guru-subject').value = '';
            document.getElementById('guru-phone').value = '';
        } catch (error) {
            console.error("Error adding guru:", error);
        }
    };
}

window.deleteGuru = async (id) => {
    if (confirm("Hapus data guru ini?")) {
        await deleteDoc(doc(db, "contacts", id));
    }
};

// Global expose for delete button
window.deleteJadwal = async (id) => {
    if (confirm("Hapus jadwal ini?")) {
        await deleteDoc(doc(db, "schedules", id));
    }
};

window.deleteUser = async (id) => {
    if (confirm("Hapus user ini?")) {
        await deleteDoc(doc(db, "users", id));
    }
};

window.updateUserStatus = async (id, status) => {
    await updateDoc(doc(db, "users", id), { role: status });
};

window.approveWithGrade = async (id) => {
    const gradeSel = document.getElementById(`grade-sel-${id}`);
    const grade = gradeSel ? gradeSel.value : null;
    if (!grade) { alert('Pilih kelas dulu!'); return; }
    await updateDoc(doc(db, "users", id), { role: 'Approved', grade: grade });
};

function initAdminTabs() {
    const tabs = ['users', 'manage-jadwal', 'manage-guru', 'monitoring', 'config'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}-btn`);
        if (btn) {
            btn.addEventListener('click', () => {
                // Hide all contents
                tabs.forEach(t => {
                    const content = document.getElementById(`content-${t}`);
                    if (content) content.classList.add('hidden');
                    const b = document.getElementById(`tab-${t}-btn`);
                    if (b) b.classList.remove('tab-active');
                    if (b) b.classList.add('text-gray-500');
                });
                // Show current
                const activeContent = document.getElementById(`content-${tab}`);
                if (activeContent) activeContent.classList.remove('hidden');
                btn.classList.add('tab-active');
                btn.classList.remove('text-gray-500');
            });
        }
    });
}

async function initAppConfig() {
    const semesterSelect = document.getElementById('active-semester-select');
    const saveBtn = document.getElementById('save-global-config-btn');
    const statusMsg = document.getElementById('global-config-status');

    if (!semesterSelect || !saveBtn) return;

    // Load current config
    const configRef = doc(db, 'config', 'app');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
        semesterSelect.value = configSnap.data().activeSemester || 'Ganjil';
    }

    saveBtn.onclick = async () => {
        await setDoc(configRef, { activeSemester: semesterSelect.value }, { merge: true });
        statusMsg.classList.remove('hidden');
        setTimeout(() => statusMsg.classList.add('hidden'), 3000);
    };
}
