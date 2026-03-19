// auth.js
import { auth, db, provider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginSection = document.getElementById('login-section');
const pendingSection = document.getElementById('pending-section');
const appContainer = document.getElementById('app-container');
const loadingScreen = document.getElementById('loading');
const adminDashboard = document.getElementById('admin-dashboard');
const userDashboard = document.getElementById('user-dashboard');
const userDisplayName = document.getElementById('user-display-name');
const helloName = document.getElementById('hello-name');

// ---------------------------------------------------------
// TODO: Ganti dengan email Admin utama Anda
const SUPER_ADMIN_EMAIL = 'vagabondtm@gmail.com'; 
// ---------------------------------------------------------

async function handleUserState(user) {
    if (!user) {
        showSection('login');
        return;
    }

    userDisplayName.textContent = user.displayName;
    helloName.textContent = user.displayName.split(' ')[0];

    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);

    let userData;

    if (!userSnap.exists()) {
        // New user - set as Pending (unless it's the Super Admin)
        const role = user.email === SUPER_ADMIN_EMAIL ? 'Admin' : 'Pending';
        userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            role: role,
            createdAt: serverTimestamp()
        };
        await setDoc(userDocRef, userData);
    } else {
        userData = userSnap.data();
    }

    // Role-based routing
    if (userData.role === 'Admin') {
        showSection('admin');
        import('./admin.js').then(m => m.initAdmin());
    } else if (userData.role === 'Approved') {
        showSection('user');
        import('./user.js').then(m => m.initUser());
    } else {
        showSection('pending');
    }
}

function showSection(section) {
    loadingScreen.classList.add('hidden');
    loginSection.classList.add('hidden');
    pendingSection.classList.add('hidden');
    appContainer.classList.add('hidden');
    adminDashboard.classList.add('hidden');
    userDashboard.classList.add('hidden');

    if (section === 'login') {
        loginSection.classList.remove('hidden');
    } else if (section === 'pending') {
        pendingSection.classList.remove('hidden');
    } else if (section === 'admin') {
        appContainer.classList.remove('hidden');
        adminDashboard.classList.remove('hidden');
    } else if (section === 'user') {
        appContainer.classList.remove('hidden');
        userDashboard.classList.remove('hidden');
    }
}

// Event Listeners
document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => console.error(err));
});

document.querySelectorAll('#logout-btn, #logout-btn-pending').forEach(btn => {
    btn.addEventListener('click', () => {
        signOut(auth).catch(err => console.error(err));
    });
});

// Auth Listener
onAuthStateChanged(auth, (user) => {
    handleUserState(user);
});
