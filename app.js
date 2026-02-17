import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { materiasDB } from './data.js';

// --- CONFIGURAÇÃO (COLE SUAS CHAVES AQUI) ---
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

// SEU EMAIL DE ADMIN (Para liberar o painel)
const ADMIN_EMAIL = "SEU_EMAIL_AQUI@GMAIL.COM"; 
// LINK DO CAKTO (CHECKOUT)
const CAKTO_LINK = "https://cakto.com.br/link-do-seu-checkout";

let currentUser = null;
let userData = null;

// --- ELEMENTOS DOM ---
const views = {
    login: document.getElementById('viewLogin'),
    payment: document.getElementById('viewPayment'),
    dashboard: document.getElementById('viewDashboard'),
    admin: document.getElementById('viewAdmin')
};

// --- LOGIN & AUTH ---
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

// Monitorar Estado
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
        // Novo Usuário (Seguro LGPD: salvamos o mínimo)
        userData = {
            uid: user.uid,
            email: user.email,
            name: user.displayName,
            photo: user.photoURL,
            vip: true, // Começa bloqueado
            streak: 0,
            lastStudy: null,
            reviews: [],
            createdAt: new Date().toISOString()
        };
        await setDoc(ref, userData);
    }

    // Roteamento
    if (user.email === ADMIN_EMAIL) {
        setupAdminPanel(); // Carrega painel se for você
        document.getElementById('btnOpenAdmin').style.display = 'inline-block';
    }

    if (userData.vip) {
        initApp();
        switchView('dashboard');
    } else {
        document.getElementById('payLink').href = CAKTO_LINK;
        // Check "escondido" se o pagamento caiu via webhook
        if(user.email !== ADMIN_EMAIL) switchView('payment'); 
        else switchView('dashboard'); // Admin entra direto
    }
}

function switchView(viewName) {
    Object.values(views).forEach(el => el.style.display = 'none');
    views[viewName].style.display = 'block';
}

// --- APP LOGIC (Estudos) ---
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
        mascot.className = "fire-hot";
    } else if (userData.lastStudy) {
        // Lógica de congelamento simples
        const diff = new Date(today) - new Date(userData.lastStudy);
        if (diff > 86400000 * 2) { // Mais de 48h
            mascot.innerText = "🧊"; 
            mascot.className = "fire-frozen";
        } else {
            mascot.innerText = "🔥";
        }
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
        const niveis = materiasDB[mat];
        const container = document.getElementById('contentArea');
        container.innerHTML = `<h3>${mat}</h3>`;
        
        Object.keys(niveis).forEach(nivel => {
            let html = `<div class="level-box"><h4>${nivel}</h4><ul>`;
            niveis[nivel].forEach(sub => {
                html += `<li>
                    <span>${sub}</span>
                    <button onclick="window.searchYoutube('${mat} ${sub}')">📺 Aula</button>
                    <button onclick="window.openStudy('${mat}', '${sub}')">📝 Estudar</button>
                </li>`;
            });
            html += `</ul></div>`;
            container.innerHTML += html;
        });
    });
}

// Funções globais para o HTML acessar
window.searchYoutube = (query) => {
    window.open(`https://www.youtube.com/results?search_query=Aula ENEM ${query}`, '_blank');
};

window.openStudy = (mat, sub) => {
    const resumo = prompt(`Estudando: ${sub}\n\nApós assistir a aula, escreva seu resumo aqui para validar:`);
    if(resumo && resumo.length > 10) {
        saveStudy(mat, sub, resumo);
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
        nextReview: today // Simplificado para demo
    });

    // Salva no banco
    const ref = doc(db, "users", currentUser.uid);
    await updateDoc(ref, {
        streak: userData.streak,
        lastStudy: userData.lastStudy,
        reviews: userData.reviews
    });

    alert("Estudo salvo! Foguinho aquecido 🔥");
    renderStreak();
}


// --- PAINEL ADMINISTRATIVO (Só aparece para você) ---
document.getElementById('btnOpenAdmin').addEventListener('click', () => {
    switchView('admin');
    loadAdminData();
});

async function loadAdminData() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = 'Carregando...';
    
    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    
    list.innerHTML = `
        <table style="width:100%; border-collapse: collapse;">
            <thead><tr style="background:#ddd;"><th>Nome</th><th>Email</th><th>Status</th><th>Ação</th></tr></thead>
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
            <td>${u.email}</td>
            <td style="color:${u.vip ? 'green' : 'red'}">${u.vip ? 'PAGO' : 'PENDENTE'}</td>
            <td>
                <button onclick="window.toggleVip('${u.uid}', ${!u.vip})">
                    ${u.vip ? 'Bloquear' : 'Liberar'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.toggleVip = async (uid, newStatus) => {
    if(!confirm("Alterar status do usuário?")) return;
    await updateDoc(doc(db, "users", uid), { vip: newStatus });
    loadAdminData(); // Recarrega tabela
};