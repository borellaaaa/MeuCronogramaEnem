import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { materiasDB } from './data.js';

const firebaseConfig = {
  apiKey: "AIzaSyBoL_tRAdNq4qjXvD2wxjzcBh1VmjIgjxQ",
  authDomain: "enemplatform.firebaseapp.com",
  projectId: "enemplatform",
  storageBucket: "enemplatform.firebasestorage.app",
  messagingSenderId: "482031862116",
  appId: "1:482031862116:web:c57e2e1a5f16fdc41b3a71",
  measurementId: "G-K406JF1ZLJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAIL = "SEU_EMAIL_AQUI@GMAIL.COM"; 

let currentUser = null;
let userData = null;

const views = {
    login: document.getElementById('viewLogin'),
    dashboard: document.getElementById('viewDashboard'),
    admin: document.getElementById('viewAdmin')
};

document.getElementById('btnLogin').addEventListener('click', () => {
    const lgpd = document.getElementById('lgpdConsent').checked;
    if(!lgpd) return alert("Você precisa aceitar os termos de uso e privacidade (LGPD).");
    signInWithPopup(auth, provider).catch(e => alert(e.message));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

document.getElementById('btnAdminLogout').addEventListener('click', () => {
    views.admin.style.display = 'none';
    views.dashboard.style.display = 'block';
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUser(user);
    } else {
        switchView('login');
    }
});

async function loadUser(user) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        userData = snap.data();
    } else {
        userData = {
            uid: user.uid,
            email: user.email,
            name: user.displayName,
            photo: user.photoURL,
            streak: 0,
            lastStudy: null,
            reviews: [],
            createdAt: new Date().toISOString()
        };
        await setDoc(ref, userData);
    }

    document.getElementById('userName').innerText = `👤 ${user.displayName || user.email}`;

    if (user.email === ADMIN_EMAIL) {
        document.getElementById('btnOpenAdmin').style.display = 'inline-block';
    }

    initApp();
    switchView('dashboard');
}

function switchView(viewName) {
    Object.values(views).forEach(el => el.style.display = 'none');
    views[viewName].style.display = 'block';
}

function initApp() {
    renderStreak();
    loadMaterias();
}

function renderStreak() {
    const streakEl = document.getElementById('streakCount');
    const mascot = document.getElementById('mascotIcon');
    const today = new Date().toISOString().split('T')[0];

    streakEl.innerText = userData.streak;
    
    if (userData.lastStudy === today) {
        mascot.innerText = "🔥";
        mascot.className = "mascot fire-hot";
    } else if (userData.lastStudy) {
        const diff = new Date(today) - new Date(userData.lastStudy);
        if (diff > 86400000 * 2) {
            mascot.innerText = "🧊"; 
            mascot.className = "mascot fire-frozen";
        } else {
            mascot.innerText = "🔥";
            mascot.className = "mascot fire-hot";
        }
    } else {
        mascot.innerText = "❄️";
        mascot.className = "mascot fire-frozen";
    }
}

function loadMaterias() {
    const sel = document.getElementById('selMateria');
    sel.innerHTML = '<option>Selecione a Matéria...</option>';
    Object.keys(materiasDB).forEach(m => {
        sel.innerHTML += `<option value="${m}">${m}</option>`;
    });

    sel.addEventListener('change', (e) => {
        const mat = e.target.value;
        if (!mat || mat === 'Selecione a Matéria...') return;
        
        const niveis = materiasDB[mat];
        const container = document.getElementById('contentArea');
        container.innerHTML = `<h3>📖 ${mat}</h3>`;
        
        Object.keys(niveis).forEach(nivel => {
            let html = `<div class="level-box"><h4>📚 ${nivel}</h4><ul>`;
            niveis[nivel].forEach(sub => {
                html += `<li>
                    <span>${sub}</span>
                    <button onclick="window.searchYoutube('${mat} ${sub}')">📺 YouTube</button>
                    <button onclick="window.openStudy('${mat}', '${sub}')">📝 Resumo</button>
                </li>`;
            });
            html += `</ul></div>`;
            container.innerHTML += html;
        });
    });
}

window.searchYoutube = (query) => {
    window.open(`https://www.youtube.com/results?search_query=Aula ENEM ${query}`, '_blank');
};

window.openStudy = (mat, sub) => {
    const resumo = prompt(`📝 Você assistiu à aula de: ${sub}\n\nEscreva um resumo para registrar seu estudo (mínimo 10 caracteres):`);
    if(resumo && resumo.length > 10) {
        saveStudy(mat, sub, resumo);
    } else if(resumo) {
        alert("❌ Resumo muito curto! Mínimo 10 caracteres.");
    }
};

async function saveStudy(mat, sub, resumo) {
    const today = new Date().toISOString().split('T')[0];
    
    if (userData.lastStudy !== today) {
        userData.streak++;
        userData.lastStudy = today;
    }

    userData.reviews.push({
        id: Date.now(),
        subject: `${mat} - ${sub}`,
        resume: resumo,
        date: today
    });

    const ref = doc(db, "users", currentUser.uid);
    await updateDoc(ref, {
        streak: userData.streak,
        lastStudy: userData.lastStudy,
        reviews: userData.reviews
    });

    alert("✅ Estudo registrado com sucesso! Foguinho aquecido 🔥");
    renderStreak();
}

document.getElementById('btnOpenAdmin').addEventListener('click', () => {
    switchView('admin');
    loadAdminData();
});

async function loadAdminData() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = 'Carregando...';
    
    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    
    let totalUsers = snapshot.size;
    let totalStudies = 0;
    
    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        totalStudies += (u.reviews ? u.reviews.length : 0);
    });
    
    list.innerHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f5f6fa; border-radius: 8px;">
            <p><strong>👥 Total de Usuários:</strong> ${totalUsers}</p>
            <p><strong>📚 Total de Estudos Registrados:</strong> ${totalStudies}</p>
        </div>
        <table style="width:100%; border-collapse: collapse;">
            <thead><tr style="background:#6c5ce7; color: white;"><th>Nome</th><th>Email</th><th>Sequência</th><th>Estudos</th></tr></thead>
            <tbody id="tableBody"></tbody>
        </table>
    `;

    const tbody = document.getElementById('tableBody');

    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #eee";
        row.innerHTML = `
            <td style="padding:10px;">${u.name}</td>
            <td style="padding:10px;">${u.email}</td>
            <td style="padding:10px; text-align: center;">🔥 ${u.streak || 0}</td>
            <td style="padding:10px; text-align: center;">${u.reviews ? u.reviews.length : 0}</td>
        `;
        tbody.appendChild(row);
    });
}
